import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useHeaderActions, useShell } from '../navigation/ShellContext';
import { hashColor, makeStyles, toneOf, useTheme } from '../theme/theme';
import { fmtDate, fmtDateTime, toYMD } from '../utils/format';
import { exportExcel, exportPdfTable } from '../utils/exporter';
import HtmlText from '../components/HtmlText';
import CreateTaskForm from '../components/CreateTaskForm';
import {
  ActionList,
  Avatar,
  Banner,
  Button,
  Card,
  DateField,
  Empty,
  ErrorState,
  KV,
  KVGrid,
  LoadMore,
  Loading,
  Pill,
  Row,
  SearchBar,
  SectionHeader,
  Segmented,
  Select,
  Sheet,
  usePager,
  useToast,
} from '../ui';

/** Port of AjwainBoard.jsx – personal Kanban for Ajwain tasks */

const COLUMNS = [
  { id: 'todo', title: 'To Do', color: '#94A3B8', icon: 'circle' },
  { id: 'inreview', title: 'In Review', color: '#F59E0B', icon: 'eye' },
  { id: 'action', title: 'In Action', color: '#F43F5E', icon: 'zap' },
  { id: 'completed', title: 'Completed', color: '#10B981', icon: 'check-circle' },
];
const COLUMN_TO_STATUS_ID = { todo: 0, inreview: 1, action: 2, completed: 3 };
const STATUS_TO_COLUMN = { Backlog: 'todo', Open: 'todo', 'In Progress': 'action', 'In Review': 'inreview', Done: 'completed', Closed: 'completed' };
const TAG_COLOR = { Bug: '#F43F5E', Development: '#6366F1', Enhancement: '#10B981', CR: '#8B5CF6', Support: '#F59E0B' };
const PRIORITY = {
  Low: { icon: 'arrow-down', color: '#94A3B8' },
  Normal: { icon: 'minus', color: '#3B82F6' },
  High: { icon: 'arrow-up', color: '#F59E0B' },
  Critical: { icon: 'alert-triangle', color: '#EF4444' },
};
const EMPTY_BOARD = { todo: [], inreview: [], action: [], completed: [] };

const mapTask = (t, pm, mm) => ({
  id: `task-${t.TaskId}`,
  taskId: t.TaskId,
  productId: t.ProductId,
  moduleId: t.ModuleId,
  clientId: t.ClientId,
  ticket: `TSK-${t.TaskId}`,
  title: t.Title || 'Untitled task',
  taskType: t.TaskType || 'Development',
  priority: t.Priority || 'Normal',
  points: t.EstimatedHours ?? 1,
  assignee: t.AssignedToName || 'Unassigned',
  productName: t.ProductName || pm[String(t.ProductId)] || 'Unknown product',
  moduleName: t.ModuleName || mm[String(t.ModuleId)] || 'Unknown module',
  clientName: t.ClientName || t.Client || 'No client',
  description: t.Description || '',
  relatedStory: t.RelatedStory ?? null,
  relatedBug: t.RelatedBug ?? null,
  deadline: t.DeadLine || null,
  addedBy: t.TaskAddedByName || '',
  addedOn: t.TaskAddedDateTime || null,
  status: t.Status || 'Open',
  isSubTask: Boolean(t.IsSubTask),
  subTasks: Array.isArray(t.SubTasks)
    ? t.SubTasks.map((st) => ({
        id: st.ID ?? st.TaskId,
        taskId: st.TaskId ?? st.ID,
        title: st.Title || 'Untitled sub task',
        assignedToName: st.AssignedToName || 'Unassigned',
        estimatedHours: st.EstimatedHours ?? null,
        deadline: st.DeadLine || null,
        status: st.Status || 'Open',
      }))
    : [],
});

const isSubClosed = (st) => String(st?.status || '').trim().toLowerCase() === 'done';
const openSubCount = (card) => (card?.subTasks || []).filter((st) => !isSubClosed(st)).length;

async function productModuleMaps(rows) {
  const pm = {};
  const mm = {};
  try {
    const products = await api.get('zentaoProduct').catch(() => []);
    (Array.isArray(products) ? products : []).forEach((p) => {
      const id = p.id ?? p.ID;
      const name = p.NAME ?? p.Name ?? p.name;
      if (id != null && name) pm[String(id)] = name;
    });
  } catch {
    /* ignore */
  }
  const ids = [...new Set(rows.map((r) => r.ProductId).filter((x) => x !== null && x !== undefined))];
  await Promise.all(
    ids.map(async (pid) => {
      try {
        const mods = await api.get('zentaoModule', { productId: pid });
        (Array.isArray(mods) ? mods : []).forEach((m) => {
          const id = m.id ?? m.ID;
          const name = m.name ?? m.NAME ?? m.Name;
          if (id != null && name) mm[String(id)] = name;
        });
      } catch {
        /* ignore */
      }
    }),
  );
  return { pm, mm };
}

export default function AjwainBoardScreen() {
  const s = useStyles();
  const { c, dark } = useTheme();
  const toast = useToast();
  const { session } = useAuth();
  const { goToTask, createSubTask } = useShell();
  const loggedInUserId = String(session.userId || '').trim();

  const [board, setBoard] = useState(EMPTY_BOARD);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [column, setColumn] = useState('todo');
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(loggedInUserId);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [menuCard, setMenuCard] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pointsOpen, setPointsOpen] = useState(false);

  const isOwnUser = String(selectedUserId) === loggedInUserId;

  useEffect(() => {
    api
      .get('getAjwainUserList')
      .then((d) => {
        if (!d?.success) throw new Error(d?.message || 'Failed to load users.');
        setUsers((Array.isArray(d.users) ? d.users : []).filter((u) => !u.Deleted));
      })
      .catch((e) => toast.error(e.message || "Couldn't load the user list."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBoard = useCallback(
    async (mode = 'load') => {
      const uid = String(selectedUserId ?? '').trim();
      if (!uid) {
        setLoadError('No logged-in user found.');
        setLoading(false);
        return;
      }
      if (mode === 'load') setLoading(true);
      else setRefreshing(true);
      setLoadError(null);
      try {
        const data = await api.get('getTaskPointByAssignedTo', { assignedTo: uid });
        if (!data?.success) throw new Error(data?.message || 'Failed to load tasks.');
        const tasks = Array.isArray(data.tasks) ? data.tasks : [];
        const { pm, mm } = await productModuleMaps(tasks);
        const grouped = { todo: [], inreview: [], action: [], completed: [] };
        tasks.forEach((t) => grouped[STATUS_TO_COLUMN[t.Status] || 'todo'].push(mapTask(t, pm, mm)));
        setBoard(grouped);
      } catch (e) {
        setLoadError(e.message || 'Something went wrong while loading the board.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedUserId],
  );

  useEffect(() => {
    fetchBoard('load');
  }, [fetchBoard]);

  useHeaderActions([
    { key: 'points', icon: 'calendar', onPress: () => setPointsOpen(true) },
    { key: 'create', icon: 'plus', onPress: () => setCreateOpen(true) },
    { key: 'refresh', icon: 'refresh-cw', onPress: () => fetchBoard('refresh') },
  ]);

  const moveCard = async (card, fromCol, toCol) => {
    if (!isOwnUser || fromCol === toCol) return;
    if (toCol === 'completed' && openSubCount(card) > 0) {
      const n = openSubCount(card);
      return toast.error(n === 1 ? 'Sub task is still open. Cannot mark the master task as completed.' : `${n} sub tasks are still open. Cannot mark the master task as completed.`);
    }
    setBoard((prev) => ({ ...prev, [fromCol]: prev[fromCol].filter((x) => x.id !== card.id), [toCol]: [card, ...prev[toCol]] }));
    setSavingId(card.id);
    try {
      const data = await api.postJson('updateTaskPointStatus', { TaskId: card.taskId, StatusId: COLUMN_TO_STATUS_ID[toCol] });
      if (data?.success === false) throw new Error(data?.message || 'Failed to update status.');
      toast.success(`${card.ticket} moved to “${COLUMNS.find((x) => x.id === toCol)?.title}”`);
    } catch (e) {
      toast.error(e.message || "Couldn't update the task status. Reverting.");
      setBoard((prev) => ({ ...prev, [toCol]: prev[toCol].filter((x) => x.id !== card.id), [fromCol]: [{ ...card }, ...prev[fromCol]] }));
    } finally {
      setSavingId(null);
    }
  };

  const startSubTask = (card) => {
    const pid = Number(card?.taskId);
    if (!Number.isFinite(pid) || pid <= 0) return toast.error('Invalid parent task ID.');
    setMenuCard(null);
    setSelected(null);
    createSubTask({
      isSubTask: true,
      parentTaskId: pid,
      productId: card.productId ?? '',
      moduleId: card.moduleId ?? '',
      clientId: card.clientId ?? '',
      taskType: card.taskType || '',
      taskName: `[SUBTASK] - [TASK #${pid}] ${String(card.title || '').trim()}`.trim(),
    });
  };

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = board[column] || [];
    if (!q) return rows;
    return rows.filter((x) => [x.ticket, x.title, x.productName, x.moduleName, x.clientName, x.assignee].join(' ').toLowerCase().includes(q));
  }, [board, column, search]);

  const menuCol = menuCard ? COLUMNS.find((col) => (board[col.id] || []).some((x) => x.id === menuCard.id))?.id : null;

  const header = (
    <View style={{ gap: 12, marginBottom: 4 }}>
      <Card style={{ gap: 10 }}>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={s.boardTitle}>Ajwain Kanban Board</Text>
            <Text style={s.boardSub}>{isOwnUser ? 'Your board — tap a card, long-press to move' : "Viewing another user's board — read only"}</Text>
          </View>
          {!isOwnUser && <Pill label="Read only" icon="lock" color={c.amber} />}
        </Row>
        <Select
          icon="user"
          value={selectedUserId}
          clearable={false}
          title="Select user"
          options={users.map((u) => ({ value: String(u.ID), label: `${u.RealName}${String(u.ID) === loggedInUserId ? ' (You)' : ''}`, sub: u.LoginName }))}
          onChange={(v) => setSelectedUserId(String(v))}
          placeholder="Select user"
          searchable
        />
      </Card>
      <Segmented
        value={column}
        onChange={setColumn}
        options={COLUMNS.map((col) => ({ label: col.title, value: col.id, count: (board[col.id] || []).length, color: col.color, icon: col.icon }))}
      />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search tasks…" />
    </View>
  );

  if (loading) return <Loading text="Loading board…" />;
  if (loadError) return <ErrorState message={loadError} onRetry={() => fetchBoard('load')} />;

  return (
    <>
      <FlatList
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        data={list}
        keyExtractor={(x) => x.id}
        refreshing={refreshing}
        onRefresh={() => fetchBoard('refresh')}
        ListHeaderComponent={header}
        ListEmptyComponent={<Empty icon="inbox" title={`Nothing in ${COLUMNS.find((x) => x.id === column)?.title}`} subtitle="Cards appear here when their status matches this column." />}
        renderItem={({ item: card }) => (
          <TaskCard
            card={card}
            saving={savingId === card.id}
            onPress={() => setSelected(card)}
            onLongPress={() => setMenuCard(card)}
          />
        )}
      />

      {/* Card actions (replaces drag & drop + right-click menu) */}
      <Sheet visible={!!menuCard} onClose={() => setMenuCard(null)} icon="move" title={menuCard?.ticket} subtitle={menuCard?.title}>
        {!isOwnUser && <Banner type="warning" text="Select yourself to move cards — other users' boards are read-only." />}
        <ActionList
          actions={[
            ...COLUMNS.filter((col) => col.id !== menuCol).map((col) => ({
              key: col.id,
              label: `Move to ${col.title}`,
              icon: col.icon,
              color: col.color,
              disabled: !isOwnUser || (col.id === 'completed' && openSubCount(menuCard) > 0),
              sub: col.id === 'completed' && openSubCount(menuCard) > 0 ? `${openSubCount(menuCard)} sub task(s) still open` : undefined,
              onPress: () => {
                const card = menuCard;
                setMenuCard(null);
                moveCard(card, menuCol, col.id);
              },
            })),
            { key: 'sub', label: 'Create Sub Task', icon: 'git-branch', color: c.violet, hidden: menuCol === 'completed', onPress: () => startSubTask(menuCard) },
            { key: 'detail', label: 'View details', icon: 'info', color: c.sky, onPress: () => (setSelected(menuCard), setMenuCard(null)) },
            { key: 'go', label: 'Go to Task', icon: 'external-link', color: c.primary, onPress: () => (setMenuCard(null), goToTask(menuCard.taskId)) },
          ]}
        />
      </Sheet>

      <TaskDetailSheet
        card={selected}
        onClose={() => setSelected(null)}
        onGoToTask={(id) => (setSelected(null), goToTask(id))}
        onActions={() => (setMenuCard(selected), setSelected(null))}
      />

      <Sheet visible={createOpen} onClose={() => setCreateOpen(false)} size="full" icon="plus-square" title="Create Task" subtitle="New Ajwain task">
        {createOpen && (
          <CreateTaskForm
            onCancel={() => setCreateOpen(false)}
            onCreated={() => {
              setCreateOpen(false);
              fetchBoard('refresh');
            }}
          />
        )}
      </Sheet>

      <TaskPointsSheet visible={pointsOpen} onClose={() => setPointsOpen(false)} />
    </>
  );
}

function TaskCard({ card, onPress, onLongPress, saving }) {
  const s = useStyles();
  const { c } = useTheme();
  const pr = PRIORITY[card.priority] || PRIORITY.Normal;
  const tag = TAG_COLOR[card.taskType] || c.slate;
  const subs = card.subTasks || [];
  const open = openSubCount(card);
  return (
    <Card onPress={onPress} onLongPress={onLongPress} accent={pr.color}>
      <Row justify="space-between">
        <Row gap={6} wrap style={{ flex: 1 }}>
          <Pill label={card.taskType} color={tag} />
          {subs.length > 0 && <Pill label={`${subs.length} Sub Task${subs.length === 1 ? '' : 's'}`} icon="layers" color={c.violet} />}
          {card.isSubTask && <Pill label="Sub Task" icon="git-branch" color={c.violet} />}
        </Row>
        {saving ? <ActivityIndicator size="small" color={c.primary} /> : <Feather name="more-vertical" size={16} color={c.textFaint} onPress={onLongPress} />}
      </Row>
      <Text style={s.cardTitle}>{card.title}</Text>
      <Text style={s.meta} numberOfLines={1}>
        {card.productName} • {card.moduleName} • {card.clientName}
      </Text>
      {subs.length > 0 && (
        <View style={s.subBox}>
          <Row justify="space-between">
            <Text style={s.subHead}>SUB TASKS</Text>
            <Text style={s.subCount}>
              {subs.length - open}/{subs.length} closed
            </Text>
          </Row>
          {subs.map((st) => (
            <Row key={st.id} gap={8} style={{ marginTop: 6 }} align="flex-start">
              <View style={[s.subDot, { backgroundColor: isSubClosed(st) ? c.emerald : c.violet }]} />
              <Text style={s.subTitle} numberOfLines={2}>{st.title}</Text>
              <Pill label={st.status} color={isSubClosed(st) ? c.emerald : c.violet} />
            </Row>
          ))}
        </View>
      )}
      <Row gap={10} style={{ marginTop: 12 }}>
        <Row gap={4}>
          <Feather name={pr.icon} size={13} color={pr.color} />
          <Text style={[s.small, { color: pr.color, fontWeight: '800' }]}>{card.priority}</Text>
        </Row>
        <Text style={s.ticket}>{card.ticket}</Text>
        {Number(card.points) > 0 && <Text style={s.small}>{card.points}h</Text>}
        <View style={{ flex: 1 }} />
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.small} numberOfLines={1}>{card.assignee}</Text>
          <Text style={[s.small, { color: c.textFaint }]} numberOfLines={1}>by {card.addedBy || 'Unknown'}</Text>
        </View>
        <Avatar name={card.assignee} size={28} color={hashColor(card.assignee)} />
      </Row>
    </Card>
  );
}

function TaskDetailSheet({ card, onClose, onGoToTask, onActions }) {
  const s = useStyles();
  const { c } = useTheme();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState('desc');

  useEffect(() => {
    if (!card?.taskId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get('getTaskPointComments', { taskId: card.taskId })
      .then((d) => {
        if (!d?.success) throw new Error(d?.message || 'Failed to load comments.');
        if (!cancelled) setComments(Array.isArray(d.comments) ? d.comments : []);
      })
      .catch((e) => !cancelled && (setError(e.message || "Couldn't load comments."), setComments([])))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [card?.taskId]);

  const sorted = useMemo(
    () => [...comments].sort((a, b) => ((new Date(a.AddedDateTime).getTime() || 0) - (new Date(b.AddedDateTime).getTime() || 0)) * (sort === 'asc' ? 1 : -1)),
    [comments, sort],
  );

  if (!card) return <Sheet visible={false} />;
  const pr = PRIORITY[card.priority] || PRIORITY.Normal;
  const subs = card.subTasks || [];
  const open = openSubCount(card);

  return (
    <Sheet
      visible={!!card}
      onClose={onClose}
      size="full"
      icon="clipboard"
      title={card.title}
      subtitle={`${card.ticket} · ${card.taskType}${card.isSubTask ? ' · Sub Task' : ''}`}
      footer={
        <Row gap={10}>
          <Button title="Actions" icon="move" variant="secondary" style={{ flex: 1 }} onPress={onActions} />
          <Button title="Go to Task" icon="external-link" style={{ flex: 1.3 }} onPress={() => onGoToTask(card.taskId)} />
        </Row>
      }
    >
      <KVGrid>
        <KV label="Product" value={card.productName} />
        <KV label="Module" value={card.moduleName} />
        <KV label="Client" value={card.clientName} />
        <KV label="Assigned To" value={card.assignee} />
        <KV label="Priority" value={card.priority} color={pr.color} />
        <KV label="Deadline" value={card.deadline ? fmtDate(card.deadline) : 'None'} />
        <KV label="Estimate" value={card.points ? `${card.points} hrs` : 'None'} />
        {card.relatedStory ? <KV label="Related Story" value={card.relatedStory} /> : null}
        {card.relatedBug ? <KV label="Related Bug" value={card.relatedBug} /> : null}
        <KV label="Created By" value={card.addedBy || 'Unknown'} />
        <KV label="Created On" value={card.addedOn ? fmtDate(card.addedOn) : 'None'} />
      </KVGrid>
      <SectionHeader title="Description" icon="file-text" />
      {card.description && card.description.replace(/<[^>]*>/g, '').trim() ? <HtmlText html={card.description} /> : <Text style={s.small}>No description provided.</Text>}
      {subs.length > 0 && (
        <View style={s.subBox}>
          <Row justify="space-between">
            <Text style={s.subHead}>SUB TASKS</Text>
            <Text style={s.subCount}>
              {subs.length - open}/{subs.length} closed
            </Text>
          </Row>
          {subs.map((st) => (
            <View key={st.id} style={{ marginTop: 8 }}>
              <Row gap={8} align="flex-start">
                <View style={[s.subDot, { backgroundColor: isSubClosed(st) ? c.emerald : c.violet }]} />
                <Text style={s.subTitle}>{st.title}</Text>
                <Pill label={st.status} color={isSubClosed(st) ? c.emerald : c.violet} />
              </Row>
              <Text style={[s.small, { marginLeft: 16, marginTop: 2 }]}>
                {[st.assignedToName, st.estimatedHours != null ? `${st.estimatedHours}h` : null, st.deadline ? fmtDate(st.deadline) : null].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ))}
          {open > 0 && <Text style={[s.subCount, { marginTop: 8 }]}>{open === 1 ? '1 sub task is still open.' : `${open} sub tasks are still open.`} Complete all sub tasks before moving this master task to Completed.</Text>}
        </View>
      )}
      <SectionHeader
        title="Comments"
        icon="message-square"
        right={
          comments.length > 1 ? (
            <Pressable onPress={() => setSort((p) => (p === 'desc' ? 'asc' : 'desc'))}>
              <Text style={{ color: c.primary, fontWeight: '800', fontSize: 12 }}>{sort === 'desc' ? '↓ Newest' : '↑ Oldest'}</Text>
            </Pressable>
          ) : (
            <Pill label={String(comments.length)} color={c.slate} />
          )
        }
      />
      {loading ? (
        <Loading inline text="Loading comments…" />
      ) : error ? (
        <Banner type="error" text={`Unable to load comments — ${error}`} />
      ) : sorted.length === 0 ? (
        <Text style={s.small}>No comments on this task yet.</Text>
      ) : (
        sorted.map((cm) => (
          <Row key={cm.ID} gap={10} align="flex-start">
            <Avatar name={cm.AddedByName} size={30} color={hashColor(cm.AddedByName)} />
            <View style={s.bubble}>
              <Row gap={8}>
                <Text style={{ color: c.text, fontWeight: '800', fontSize: 12.5 }}>{cm.AddedByName || 'Unknown'}</Text>
                <Text style={{ color: c.textFaint, fontSize: 11 }}>{fmtDateTime(cm.AddedDateTime)}</Text>
              </Row>
              <HtmlText html={cm.Comment || ''} size={13} />
            </View>
          </Row>
        ))
      )}
    </Sheet>
  );
}

const TP_COLUMNS = [
  { header: 'Task ID', value: (r) => r.TaskId ?? r.taskId ?? '' },
  { header: 'Title', value: (r) => r.Title ?? r.title ?? '' },
  { header: 'Product', value: (r) => r.ProductName ?? r.productName ?? '—' },
  { header: 'Module', value: (r) => r.ModuleName ?? r.moduleName ?? '—' },
  { header: 'Client', value: (r) => r.ClientName ?? r.Client ?? r.clientName ?? r.client ?? '—' },
  { header: 'Task Type', value: (r) => r.TaskType ?? r.taskType ?? '' },
  { header: 'Priority', value: (r) => r.Priority ?? r.priority ?? '' },
  { header: 'Added By', value: (r) => r.AddedBy ?? r.addedBy ?? '' },
  { header: 'Added Date', value: (r) => fmtDateTime(r.TaskAddedDateTime ?? r.taskAddedDateTime, '') },
  { header: 'Assigned To', value: (r) => r.AssignedToName ?? r.assignedToName ?? 'Unassigned' },
  { header: 'Estimate', value: (r) => r.EstimatedHours ?? r.estimatedHours ?? '' },
  { header: 'Deadline', value: (r) => fmtDate(r.DeadLine ?? r.deadLine ?? r.deadline, '') },
  { header: 'Related Story', value: (r) => r.RelatedStory ?? r.relatedStory ?? '' },
  { header: 'Related Bug', value: (r) => r.RelatedBug ?? r.relatedBug ?? '' },
];

function TaskPointsSheet({ visible, onClose }) {
  const s = useStyles();
  const { c } = useTheme();
  const toast = useToast();
  const today = toYMD(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState([]);

  const fetchList = async (f = from, t = to) => {
    if (!f || !t) return toast.error('Please select From Date and To Date.');
    if (f > t) return toast.error('From Date cannot be greater than To Date.');
    setLoading(true);
    try {
      const data = await api.get('viewTaskPointList', { fromDate: f, toDate: t });
      const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.tasks) ? data.tasks : [];
      const { pm, mm } = await productModuleMaps(list);
      setRows(list.map((r) => ({ ...r, ProductName: r.ProductName || pm[String(r.ProductId)] || '—', ModuleName: r.ModuleName || mm[String(r.ModuleId)] || '—' })));
    } catch (e) {
      setRows([]);
      toast.error(e.message || "Couldn't load task points.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      setFrom(today);
      setTo(today);
      setSearch('');
      setClients([]);
      fetchList(today, today);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const rowClient = (r) => String(r.ClientName ?? r.Client ?? r.clientName ?? r.client ?? '').trim() || 'No Client';
  const allClients = useMemo(() => [...new Set(rows.map(rowClient))].sort((a, b) => a.localeCompare(b)), [rows]);
  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    const ms = !q || String(r.TaskId ?? r.taskId ?? '').toLowerCase().includes(q) || String(r.Title ?? r.title ?? '').toLowerCase().includes(q);
    return ms && (!clients.length || clients.includes(rowClient(r)));
  });
  const pager = usePager(filtered, 20, `${search}|${clients.join()}|${rows.length}`);

  const pdf = async () => {
    try {
      await exportPdfTable({ title: 'Task Points Report', subtitle: `${fmtDate(from)} – ${fmtDate(to)} · ${filtered.length} task(s)`, columns: TP_COLUMNS, rows: filtered, fileName: 'Task_Points' });
    } catch (e) {
      toast.error(e.message);
    }
  };
  const excel = async () => {
    if (!filtered.length) return toast.info('No task points available to download.');
    try {
      await exportExcel(`Task_Points_${from}_to_${to}`, { name: 'Task Points', rows: filtered, columns: [{ header: '#', value: (_, i) => i + 1 }, ...TP_COLUMNS] });
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} size="full" icon="calendar" title="Task Points" subtitle="Task Report">
      <Row gap={10}>
        <DateField label="From Date" value={from} onChange={setFrom} style={{ flex: 1 }} clearable={false} />
        <DateField label="To Date" value={to} onChange={setTo} style={{ flex: 1 }} clearable={false} />
      </Row>
      <Row gap={8}>
        <Button title="Search" icon="search" size="sm" style={{ flex: 1 }} loading={loading} onPress={() => fetchList()} />
        <Button title="PDF" icon="file-text" size="sm" variant="soft" color={c.rose} disabled={loading || !filtered.length} onPress={pdf} />
        <Button title="Excel" icon="grid" size="sm" variant="soft" color={c.emerald} disabled={loading || !filtered.length} onPress={excel} />
      </Row>
      <SearchBar value={search} onChangeText={setSearch} placeholder="Task ID / Title…" />
      <Select multi value={clients} options={allClients} placeholder="All Clients" icon="users" onChange={setClients} label="Client" />
      <Text style={s.small}>{filtered.length} task point(s)</Text>
      {loading ? (
        <Loading inline text="Loading task points…" />
      ) : filtered.length === 0 ? (
        <Empty icon="calendar" title="No task points" subtitle="Try a different date range." />
      ) : (
        <>
          {pager.visible.map((r, i) => (
            <Card key={`${r.TaskId ?? r.taskId}-${i}`} flat style={s.tp}>
              <Row justify="space-between">
                <Text style={s.ticket}>#{r.TaskId ?? r.taskId}</Text>
                <Row gap={6}>
                  {!!(r.Priority ?? r.priority) && <Pill label={r.Priority ?? r.priority} color={(PRIORITY[r.Priority ?? r.priority] || PRIORITY.Normal).color} />}
                  {!!(r.TaskType ?? r.taskType) && <Pill label={r.TaskType ?? r.taskType} color={TAG_COLOR[r.TaskType ?? r.taskType] || c.slate} />}
                </Row>
              </Row>
              <Text style={s.cardTitle}>{r.Title ?? r.title ?? ''}</Text>
              <KVGrid>
                <KV label="Product" value={r.ProductName} />
                <KV label="Module" value={r.ModuleName} />
                <KV label="Client" value={rowClient(r)} />
                <KV label="Assigned To" value={r.AssignedToName ?? r.assignedToName ?? 'Unassigned'} />
                <KV label="Added By" value={r.AddedBy ?? r.addedBy} />
                <KV label="Added" value={fmtDateTime(r.TaskAddedDateTime ?? r.taskAddedDateTime)} />
                <KV label="Deadline" value={fmtDate(r.DeadLine ?? r.deadLine ?? r.deadline)} />
                <KV label="Estimate" value={r.EstimatedHours ?? r.estimatedHours} />
              </KVGrid>
            </Card>
          ))}
          <LoadMore pager={pager} />
        </>
      )}
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  boardTitle: { color: c.text, fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  boardSub: { color: c.textMuted, fontSize: 11.5, marginTop: 2 },
  cardTitle: { color: c.text, fontSize: 14, fontWeight: '800', marginTop: 8, lineHeight: 20 },
  meta: { color: c.textMuted, fontSize: 11.5, marginTop: 4, fontWeight: '600' },
  small: { color: c.textMuted, fontSize: 11.5 },
  ticket: { color: c.textMuted, fontSize: 11.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
  subBox: { marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: toneOf(c.violet, c.dark).bg },
  subHead: { color: c.violet, fontSize: 10.5, fontWeight: '900', letterSpacing: 0.5 },
  subCount: { color: c.violet, fontSize: 10.5, fontWeight: '700' },
  subDot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  subTitle: { flex: 1, color: c.text, fontSize: 12, fontWeight: '600' },
  bubble: { flex: 1, padding: 10, borderRadius: 14, borderTopLeftRadius: 4, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border, gap: 4 },
  tp: { backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border },
}));
