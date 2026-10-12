import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { api } from '../api/client';
import { zentaoLink } from '../api/config';
import useAsync from '../hooks/useAsync';
import { useHeaderActions } from '../navigation/ShellContext';
import { makeStyles, useTheme } from '../theme/theme';
import { fmtDate, fmtDateTime, parseAnyDate, uniqSorted } from '../utils/format';
import { exportExcel, openUrl } from '../utils/exporter';
import {
  ActiveFilters,
  Card,
  Empty,
  ErrorState,
  FilterButton,
  FilterSheet,
  KV,
  KVGrid,
  LoadMore,
  Loading,
  Pill,
  Row,
  SearchBar,
  Select,
  StatStrip,
  usePager,
  useToast,
} from '../ui';

/** Port of TaskWorklist.jsx – ZentaoTaskDetails */

const norm = (v) => String(v ?? '').trim();
const DONE = ['closed', 'done', 'completed'];
const PRIORITY_COLORS = { 1: '#EF4444', 2: '#F97316', 3: '#EAB308', 4: '#3B82F6', 5: '#94A3B8' };
const EMPTY_F = { product: [], module: [], project: [], type: [], status: [], priority: [] };

export default function TaskWorklistScreen() {
  const s = useStyles();
  const { c } = useTheme();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState(EMPTY_F);
  const [applied, setApplied] = useState(EMPTY_F);
  const [filterOpen, setFilterOpen] = useState(false);
  const [quick, setQuick] = useState('');

  const q = useAsync(
    async () => {
      const result = await api.get('zentaoTaskDetails');
      const data = Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : [];
      return data.map((it) => ({
        ...it,
        TaskId: it.TaskId ?? it.taskId ?? it.ID ?? it.id,
        ModuleName: it.ModuleName ?? it.moduleName ?? it.name ?? '',
        ProjectName: it.ProjectName ?? it.projectName ?? it.executionName ?? '',
        ProductName: it.ProductName ?? it.productName ?? '',
        Title: it.Title ?? it.title ?? it.name ?? '',
        Type: it.Type ?? it.type ?? '',
        Priority: it.Priority ?? it.priority ?? '',
        Deadline: it.Deadline ?? it.deadline,
        Status: it.Status ?? it.status ?? '',
        OpenedBy: it.OpenedBy ?? it.openedBy ?? '',
        OpenedDate: it.OpenedDate ?? it.openedDate,
        AssignedTo: it.AssignedTo ?? it.assignedTo ?? '',
        AssignedDate: it.AssignedDate ?? it.assignedDate,
      }));
    },
    [],
    { initial: [] },
  );
  const rows = q.data || [];

  const opts = useMemo(
    () => ({
      product: uniqSorted(rows.map((r) => norm(r.ProductName))),
      module: uniqSorted(rows.map((r) => norm(r.ModuleName))),
      project: uniqSorted(rows.map((r) => norm(r.ProjectName))),
      type: uniqSorted(rows.map((r) => norm(r.Type))),
      status: uniqSorted(rows.map((r) => norm(r.Status))),
      priority: uniqSorted(rows.map((r) => norm(r.Priority))).sort((a, b) => Number(a) - Number(b)),
    }),
    [rows],
  );

  const isOverdue = (r) => {
    const d = parseAnyDate(r.Deadline);
    return !!d && d < new Date() && !DONE.includes(norm(r.Status).toLowerCase());
  };

  const filtered = useMemo(() => {
    const qq = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (applied.product.length && !applied.product.includes(norm(r.ProductName))) return false;
      if (applied.module.length && !applied.module.includes(norm(r.ModuleName))) return false;
      if (applied.project.length && !applied.project.includes(norm(r.ProjectName))) return false;
      if (applied.type.length && !applied.type.includes(norm(r.Type))) return false;
      if (applied.status.length && !applied.status.includes(norm(r.Status))) return false;
      if (applied.priority.length && !applied.priority.includes(norm(r.Priority))) return false;
      if (qq) {
        const hay = [r.TaskId, r.Title, r.ProductName, r.ModuleName, r.ProjectName, r.Type, r.Status, r.OpenedBy, r.AssignedTo].map(norm).join(' ').toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
  }, [rows, applied, search]);

  const summary = useMemo(() => {
    const total = filtered.length;
    const closed = filtered.filter((r) => DONE.includes(norm(r.Status).toLowerCase())).length;
    return { total, active: total - closed, closed, overdue: filtered.filter(isOverdue).length };
  }, [filtered]);

  const visible = useMemo(() => {
    if (quick === 'active') return filtered.filter((r) => !DONE.includes(norm(r.Status).toLowerCase()));
    if (quick === 'closed') return filtered.filter((r) => DONE.includes(norm(r.Status).toLowerCase()));
    if (quick === 'overdue') return filtered.filter(isOverdue);
    return filtered;
  }, [filtered, quick]);

  const pager = usePager(visible, 25, `${search}|${JSON.stringify(applied)}|${quick}`);
  const activeCount = Object.values(applied).filter((v) => v.length).length;

  const doExport = async () => {
    if (!filtered.length) return toast.warning('No task data available to export.');
    try {
      await exportExcel('Task_Worklist', {
        name: 'Task Worklist',
        rows: filtered,
        columns: [
          { header: 'Task ID', value: (r) => r.TaskId, width: 10 },
          { header: 'Product', value: (r) => r.ProductName, width: 22 },
          { header: 'Module', value: (r) => r.ModuleName, width: 22 },
          { header: 'Project', value: (r) => r.ProjectName, width: 26 },
          { header: 'Title', value: (r) => r.Title, width: 55 },
          { header: 'Type', value: (r) => r.Type },
          { header: 'Priority', value: (r) => r.Priority },
          { header: 'Deadline', value: (r) => (r.Deadline ? fmtDate(r.Deadline, '') : '') },
          { header: 'Status', value: (r) => r.Status },
          { header: 'Opened By', value: (r) => r.OpenedBy },
          { header: 'Opened Date', value: (r) => (r.OpenedDate ? fmtDateTime(r.OpenedDate, '') : '') },
          { header: 'Assigned To', value: (r) => r.AssignedTo },
          { header: 'Assigned Date', value: (r) => (r.AssignedDate ? fmtDateTime(r.AssignedDate, '') : '') },
        ],
      });
    } catch (e) {
      toast.error(e.message);
    }
  };

  useHeaderActions([
    { key: 'export', icon: 'download', onPress: doExport },
    { key: 'refresh', icon: 'refresh-cw', onPress: q.reload },
  ]);

  if (q.loading) return <Loading text="Loading tasks…" />;
  if (q.error) return <ErrorState message={q.error} onRetry={q.reload} />;

  const FILTERS = [
    ['product', 'Products'],
    ['module', 'Modules'],
    ['project', 'Projects'],
    ['type', 'Types'],
    ['status', 'Status'],
    ['priority', 'Priority'],
  ];

  return (
    <>
      <FlatList
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        data={pager.visible}
        keyExtractor={(r, i) => `${r.TaskId}-${i}`}
        refreshing={q.refreshing}
        onRefresh={q.refresh}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <StatStrip
              items={[
                { key: '', label: 'Total', value: summary.total, color: c.sky, active: quick === '', onPress: () => setQuick('') },
                { key: 'active', label: 'Active', value: summary.active, color: c.indigo, active: quick === 'active', onPress: () => setQuick('active') },
                { key: 'closed', label: 'Closed', value: summary.closed, color: c.emerald, active: quick === 'closed', onPress: () => setQuick('closed') },
                { key: 'overdue', label: 'Overdue', value: summary.overdue, color: c.red, active: quick === 'overdue', onPress: () => setQuick('overdue') },
              ]}
            />
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search task, title, people…" />
            <Row>
              <FilterButton count={activeCount} onPress={() => (setDraft(applied), setFilterOpen(true))} />
              <Text style={s.count}>{visible.length} tasks</Text>
            </Row>
            <ActiveFilters
              items={FILTERS.filter(([k]) => applied[k].length).map(([k, l]) => ({
                key: k,
                label: `${l}: ${applied[k].length === 1 ? applied[k][0] : applied[k].length}`,
                onClear: () => setApplied((a) => ({ ...a, [k]: [] })),
              }))}
              onClearAll={() => setApplied(EMPTY_F)}
            />
          </View>
        }
        ListEmptyComponent={<Empty icon="check-square" title="No tasks" subtitle="No tasks match the selected filters." />}
        ListFooterComponent={visible.length ? <LoadMore pager={pager} /> : null}
        renderItem={({ item: r }) => {
          const overdue = isOverdue(r);
          return (
            <Card accent={PRIORITY_COLORS[norm(r.Priority)] || c.slate}>
              <Row justify="space-between">
                <Pressable onPress={() => r.TaskId && openUrl(zentaoLink('task', r.TaskId))} hitSlop={6}>
                  <Text style={s.id}>Task #{r.TaskId}</Text>
                </Pressable>
                <Row gap={6}>
                  <Pill label={`P${norm(r.Priority) || '—'}`} color={PRIORITY_COLORS[norm(r.Priority)] || c.slate} solid />
                  <Pill label={r.Status || '—'} status={r.Status} />
                </Row>
              </Row>
              <Text style={s.title}>{r.Title || '—'}</Text>
              <Row gap={6} wrap style={{ marginTop: 8 }}>
                {!!r.Type && <Pill label={r.Type} color={c.violet} />}
                {!!r.ProjectName && <Pill label={r.ProjectName} color={c.teal} />}
                {overdue && <Pill label="Overdue" icon="alert-triangle" color={c.red} />}
              </Row>
              <KVGrid style={{ marginTop: 6 }}>
                <KV label="Product" value={r.ProductName} />
                <KV label="Module" value={r.ModuleName} />
                <KV label="Deadline" value={fmtDate(r.Deadline)} color={overdue ? c.danger : undefined} />
                <KV label="Assigned To" value={r.AssignedTo} />
                <KV label="Opened By" value={r.OpenedBy} />
                <KV label="Opened" value={fmtDateTime(r.OpenedDate)} />
              </KVGrid>
            </Card>
          );
        }}
      />
      <FilterSheet visible={filterOpen} onClose={() => setFilterOpen(false)} onApply={() => setApplied(draft)} onClear={() => (setDraft(EMPTY_F), setApplied(EMPTY_F), setFilterOpen(false))}>
        {FILTERS.map(([k, l]) => (
          <Select key={k} label={l} multi value={draft[k]} options={opts[k]} placeholder={`All ${l}`} onChange={(v) => setDraft((d) => ({ ...d, [k]: v }))} />
        ))}
      </FilterSheet>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  count: { marginLeft: 'auto', color: c.textFaint, fontSize: 12, fontWeight: '700' },
  id: { color: c.primary, fontWeight: '900', fontSize: 13.5, textDecorationLine: 'underline' },
  title: { color: c.text, fontSize: 14, fontWeight: '700', marginTop: 8, lineHeight: 20 },
}));
