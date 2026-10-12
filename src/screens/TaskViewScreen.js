import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useShell, useHeaderActions } from '../navigation/ShellContext';
import { hashColor, makeStyles, radii, toneOf, useTheme } from '../theme/theme';
import { fmtDate, fmtDateTime } from '../utils/format';
import { formatFileSize, shareBase64File } from '../utils/exporter';
import HtmlText, { textToHtml } from '../components/HtmlText';
import { Avatar, Button, Card, Empty, ErrorState, KV, KVGrid, Loading, Page, Pill, Row, SectionHeader, useToast } from '../ui';

/** Port of TaskView.jsx – GetTaskPointById / GetTaskPointComments / SaveTaskPointComments / FetchDocument2 */

const STATUS_LABEL = { 0: 'Open', 1: 'In Progress', 2: 'In Review', 3: 'Done', 4: 'Closed', 5: 'Backlog' };
export const resolveTaskStatus = (raw) => {
  if (raw === null || raw === undefined) return 'Open';
  if (typeof raw === 'string' && isNaN(Number(raw))) return raw;
  return STATUS_LABEL[Number(raw)] ?? 'Open';
};
export const PRIORITY_COLOR = { Low: '#94A3B8', Normal: '#3B82F6', High: '#F59E0B', Critical: '#EF4444' };
export const TASK_STATUS_COLOR = { Backlog: '#94A3B8', Open: '#0EA5E9', 'In Progress': '#6366F1', 'In Review': '#8B5CF6', Done: '#10B981', Closed: '#64748B' };

const gv = (obj, ...keys) => {
  if (!obj) return null;
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  return null;
};

const fileColor = (name = '') => {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return '#EF4444';
  if (['doc', 'docx'].includes(ext)) return '#3B82F6';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '#10B981';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return '#EC4899';
  if (['zip', 'rar', '7z'].includes(ext)) return '#F59E0B';
  return '#6366F1';
};

export async function downloadTaskDocument(file) {
  const stored = file?.StoredFileName ?? file?.storedFileName ?? '';
  const original = file?.UploadedDocumentName ?? file?.uploadedDocumentName ?? file?.fileName ?? 'attachment';
  if (!stored) throw new Error('Stored file name is not available.');
  const data = await api.postJson('fetchDocument2', { Id: stored });
  if (data?.success === false) throw new Error(data?.message || 'Document API failed.');
  const doc = Array.isArray(data?.documents) ? data.documents[0] : data?.fileBase64 || data?.FileBase64 ? data : null;
  if (!doc) throw new Error('Document was not returned by FetchDocument2.');
  const b64 = doc.fileBase64 ?? doc.FileBase64 ?? '';
  const ct = doc.contentType ?? doc.ContentType ?? 'application/octet-stream';
  return shareBase64File(b64, original || doc.fileName || doc.FileName || stored, ct);
}

export default function TaskViewScreen() {
  const s = useStyles();
  const { c, dark } = useTheme();
  const toast = useToast();
  const { session } = useAuth();
  const { pageParams } = useShell();

  const [inputVal, setInputVal] = useState(pageParams?.taskId ? String(pageParams.taskId) : '');
  const [activeId, setActiveId] = useState('');
  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [sort, setSort] = useState('desc');
  const [products, setProducts] = useState([]);
  const [modules, setModules] = useState([]);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    api
      .get('zentaoProduct')
      .then((d) => setProducts(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const pid = gv(task, 'ProductId', 'productId');
    if (!pid) return;
    api
      .get('zentaoModule', { productId: pid })
      .then((d) => setModules(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [task]);

  const productName = useCallback(
    (id) => {
      if (!id) return null;
      const f = products.find((p) => String(p.id) === String(id));
      return f ? f.NAME || f.name || String(id) : String(id);
    },
    [products],
  );
  const moduleName = useCallback(
    (id) => {
      if (!id) return null;
      const f = modules.find((m) => String(m.id) === String(id));
      return f ? f.name || f.NAME || String(id) : String(id);
    },
    [modules],
  );

  const fetchTask = async (raw) => {
    const id = String(raw || '').trim();
    if (!id || !/^\d+$/.test(id)) {
      setErrorMsg(id ? 'Please enter a numeric Task ID.' : 'Enter a Task ID.');
      setStatus('error');
      return;
    }
    try {
      setStatus('loading');
      setErrorMsg('');
      setAttachments([]);
      let data;
      try {
        data = await api.get('getTaskPointById', { taskId: id });
      } catch (e) {
        if (e.status === 404) throw new Error(e.message || `Task #${id} not found.`);
        throw e;
      }
      if (data?.success === false) throw new Error(data.message || `Task #${id} not found.`);
      const td = data?.task ?? data?.Task ?? data?.data ?? data;
      if (!td || typeof td !== 'object') throw new Error(`Task #${id} not found.`);
      setTask(td);
      try {
        const cd = await api.get('getTaskPointComments', { taskId: id });
        const list = cd?.success === false ? [] : cd?.comments ?? cd?.Comments ?? cd?.data ?? [];
        setComments(Array.isArray(list) ? list : []);
      } catch {
        setComments([]);
      }
      const docs = data?.documents ?? data?.Documents ?? data?.attachments ?? data?.Attachments ?? td?.documents ?? td?.Documents ?? td?.attachments ?? td?.Attachments ?? [];
      setAttachments((Array.isArray(docs) ? docs : []).filter((f) => !(f?.Deleted === true || f?.deleted === true || f?.Deleted === 1 || f?.deleted === 1)));
      setActiveId(id);
      setStatus('success');
    } catch (e) {
      setTask(null);
      setComments([]);
      setAttachments([]);
      setStatus('error');
      setErrorMsg(e?.message || 'Something went wrong.');
    }
  };

  useEffect(() => {
    const incoming = String(pageParams?.taskId ?? '').trim();
    if (incoming) {
      setInputVal(incoming);
      fetchTask(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageParams?.taskId]);

  useHeaderActions([{ key: 'refresh', icon: 'refresh-cw', hidden: !activeId, onPress: () => fetchTask(activeId) }], [activeId]);

  const postComment = async () => {
    const txt = commentText.trim();
    if (!txt || !task) return;
    const taskId = Number(gv(task, 'TaskId', 'taskId', 'ID', 'id') ?? activeId);
    const addedBy = Number(session.userId || 0);
    if (!taskId || taskId <= 0) return toast.warning('Valid Task ID is required.');
    if (!addedBy || addedBy <= 0) return toast.warning('User ID is not available in session.');
    const html = textToHtml(txt);
    try {
      setPosting(true);
      const res = await api.postJson('saveTaskPointComments', { TaskId: taskId, AddedBy: addedBy, Comments: [{ Comment: html }] });
      if (res?.success === false) throw new Error(res?.message || 'Failed to save comment.');
      setComments((prev) => [
        { ID: res?.commentId ?? `local-${Date.now()}`, Comment: html, AddedBy: addedBy, AddedByName: session.realName || 'You', AddedDateTime: new Date().toISOString() },
        ...prev,
      ]);
      setCommentText('');
      toast.success('Comment posted');
    } catch (e) {
      toast.error(e?.message || 'Error while saving comment.');
    } finally {
      setPosting(false);
    }
  };

  const download = async (file, key) => {
    try {
      setDownloading(key);
      await downloadTaskDocument(file);
    } catch (e) {
      toast.error(e?.message || 'Unable to download the document.');
    } finally {
      setDownloading(null);
    }
  };

  const sortedComments = useMemo(() => {
    const list = [...(comments || [])];
    const t = (x) => new Date(gv(x, 'AddedDateTime', 'addedDateTime', 'CreatedAt', 'createdAt') || 0).getTime();
    return list.sort((a, b) => (sort === 'asc' ? t(a) - t(b) : t(b) - t(a)));
  }, [comments, sort]);

  const d = useMemo(() => {
    if (!task) return null;
    return {
      taskId: gv(task, 'TaskId', 'taskId', 'ID', 'id'),
      title: gv(task, 'Title', 'title', 'TaskName', 'name') || 'Untitled task',
      description: gv(task, 'Description', 'description') || '',
      productId: gv(task, 'ProductId', 'productId'),
      moduleId: gv(task, 'ModuleId', 'moduleId'),
      clientId: gv(task, 'ClientId', 'clientId'),
      clientName: gv(task, 'ClientName', 'clientName'),
      taskType: gv(task, 'TaskType', 'taskType') || 'Task',
      priority: gv(task, 'Priority', 'priority') || 'Normal',
      status: resolveTaskStatus(gv(task, 'Status', 'status')),
      assigneeName: gv(task, 'AssignedToName', 'assignedToName', 'AssigneeName'),
      reporterName: gv(task, 'TaskAddedByName', 'taskAddedByName', 'AddedByName'),
      deadline: gv(task, 'DeadLine', 'deadline', 'Deadline'),
      estimate: gv(task, 'EstimatedHours', 'estimatedHours'),
      storyId: gv(task, 'RelatedStory', 'relatedStory'),
      bugId: gv(task, 'RelatedBug', 'relatedBug'),
      createdAt: gv(task, 'TaskAddedDateTime', 'taskAddedDateTime', 'CreatedAt'),
    };
  }, [task]);

  const searchBar = (
    <View style={s.searchRow}>
      <Feather name="hash" size={16} color={c.textFaint} />
      <TextInput
        value={inputVal}
        onChangeText={setInputVal}
        placeholder="Task ID…"
        placeholderTextColor={c.textFaint}
        keyboardType="number-pad"
        returnKeyType="search"
        onSubmitEditing={() => fetchTask(inputVal)}
        style={s.searchInput}
      />
      <Button title="Search" icon="search" size="sm" loading={status === 'loading'} onPress={() => fetchTask(inputVal)} />
    </View>
  );

  return (
    <Page refreshing={false} onRefresh={activeId ? () => fetchTask(activeId) : undefined} header={searchBar}>
      {status === 'idle' && <Empty icon="search" title="Search for a task" subtitle="Enter a Task ID above and press Search." />}
      {status === 'loading' && <Loading text="Loading task…" />}
      {status === 'error' && <ErrorState message={errorMsg} onRetry={() => fetchTask(activeId || inputVal)} />}

      {status === 'success' && d && (
        <>
          <Card>
            <Row gap={6} wrap>
              {!!productName(d.productId) && <Pill label={productName(d.productId)} color={c.indigo} />}
              {!!moduleName(d.moduleId) && <Pill label={moduleName(d.moduleId)} color={c.violet} />}
              {!!(d.clientName ?? d.clientId) && <Pill label={String(d.clientName ?? d.clientId)} color={c.sky} />}
            </Row>
            <Row gap={6} wrap style={{ marginTop: 10 }}>
              <Pill label={`#${d.taskId}`} color={c.slate} />
              <Pill label={d.taskType} color={c.slate} />
              <Pill label={d.priority} color={PRIORITY_COLOR[d.priority] || PRIORITY_COLOR.Normal} />
              <Pill label={d.status} color={TASK_STATUS_COLOR[d.status] || TASK_STATUS_COLOR.Open} solid />
            </Row>
            <Text style={s.title}>{d.title}</Text>
            <View style={s.metaStrip}>
              {!!d.assigneeName && (
                <Row gap={6}>
                  <Avatar name={d.assigneeName} size={22} color={hashColor(d.assigneeName)} />
                  <Text style={s.metaText}>{d.assigneeName}</Text>
                </Row>
              )}
              {!!d.deadline && (
                <Row gap={4}>
                  <Feather name="calendar" size={12} color={c.textFaint} />
                  <Text style={s.metaText}>{fmtDate(d.deadline)}</Text>
                </Row>
              )}
              {!!d.estimate && (
                <Row gap={4}>
                  <Feather name="clock" size={12} color={c.textFaint} />
                  <Text style={s.metaText}>{d.estimate} hrs</Text>
                </Row>
              )}
            </View>
            <Text style={s.created}>
              Created {fmtDateTime(d.createdAt)}
              {d.reporterName ? ` · ${d.reporterName}` : ''}
            </Text>
          </Card>

          <Card>
            <SectionHeader title="Details" icon="info" />
            <KVGrid>
              <KV label="Assignee" value={d.assigneeName || 'Unassigned'} />
              <KV label="Added by" value={d.reporterName || 'Unknown'} />
              <KV label="Type" value={d.taskType} />
              <KV label="Client" value={d.clientName ?? d.clientId} />
              <KV label="Deadline" value={d.deadline ? fmtDate(d.deadline) : '—'} />
              <KV label="Est. hours" value={d.estimate != null && d.estimate !== '' ? `${d.estimate} hrs` : '—'} />
              <KV label="Related story" value={d.storyId || '—'} />
              <KV label="Related bug" value={d.bugId || '—'} />
            </KVGrid>
          </Card>

          <Card>
            <SectionHeader title="Description" icon="align-left" />
            {d.description ? <HtmlText html={d.description} /> : <Text style={s.muted}>No description provided.</Text>}
          </Card>

          {attachments.length > 0 && (
            <Card>
              <SectionHeader title="Attachments" icon="paperclip" right={<Pill label={String(attachments.length)} color={c.slate} />} />
              <View style={{ gap: 8 }}>
                {attachments.map((f, i) => {
                  const name = f?.UploadedDocumentName ?? f?.fileName ?? f?.FileName ?? 'Attachment';
                  const uploader = f?.UploadedByName ?? f?.uploadedByName;
                  const date = f?.UploadedDateTime ?? f?.uploadedDateTime;
                  const size = f?.size ?? f?.fileSize ?? f?.Size;
                  const k = f?.ID ?? f?.id ?? i;
                  const canDl = Boolean(f?.StoredFileName ?? f?.storedFileName ?? f?.FileName ?? f?.fileName);
                  const t = toneOf(fileColor(name), dark);
                  return (
                    <View key={k} style={s.file}>
                      <View style={[s.fileIcon, { backgroundColor: t.bg }]}>
                        <Feather name="file" size={17} color={t.fg} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.fileName} numberOfLines={1}>{name}</Text>
                        <Text style={s.fileMeta} numberOfLines={1}>
                          {[uploader, date ? fmtDateTime(date) : null, size ? formatFileSize(size) : null].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      {canDl && (
                        <Button size="sm" variant="soft" icon="download" loading={downloading === k} onPress={() => download(f, k)} />
                      )}
                    </View>
                  );
                })}
              </View>
            </Card>
          )}

          <Card>
            <SectionHeader
              title="Comments"
              icon="message-square"
              right={
                <Pressable onPress={() => setSort((p) => (p === 'desc' ? 'asc' : 'desc'))} style={s.sortBtn}>
                  <Feather name={sort === 'desc' ? 'arrow-down' : 'arrow-up'} size={12} color={c.primary} />
                  <Text style={s.sortText}>{sort === 'desc' ? 'Newest first' : 'Oldest first'}</Text>
                </Pressable>
              }
            />
            <View style={s.composer}>
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Write a comment…"
                placeholderTextColor={c.textFaint}
                multiline
                style={s.composerInput}
                editable={!posting}
              />
              <Row justify="flex-end">
                <Button title="Post comment" icon="send" size="sm" loading={posting} disabled={!commentText.trim()} onPress={postComment} />
              </Row>
            </View>
            {sortedComments.length === 0 ? (
              <Text style={[s.muted, { textAlign: 'center', paddingVertical: 18 }]}>No comments yet — be the first!</Text>
            ) : (
              <View style={{ gap: 12, marginTop: 14 }}>
                {sortedComments.map((cm, i) => {
                  const author = gv(cm, 'author', 'Author', 'AddedByName', 'addedByName');
                  const body = gv(cm, 'text', 'Comment', 'comment');
                  const date = gv(cm, 'createdAt', 'CreatedAt', 'AddedDateTime', 'addedDateTime');
                  return (
                    <Row key={gv(cm, 'id', 'ID', 'CommentId') ?? i} align="flex-start" gap={10}>
                      <Avatar name={author || '?'} size={32} color={hashColor(author)} />
                      <View style={s.bubble}>
                        <Row gap={8} style={{ marginBottom: 4 }}>
                          <Text style={s.author}>{author || 'Unknown'}</Text>
                          <Text style={s.date}>{fmtDateTime(date)}</Text>
                        </Row>
                        <HtmlText html={body} size={13} />
                      </View>
                    </Row>
                  );
                })}
              </View>
            )}
          </Card>
        </>
      )}
    </Page>
  );
}

const useStyles = makeStyles((c) => ({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingLeft: 12,
    paddingRight: 5,
    height: 48,
  },
  searchInput: { flex: 1, color: c.text, fontSize: 15, fontWeight: '700' },
  title: { color: c.text, fontSize: 20, fontWeight: '800', marginTop: 12, lineHeight: 26, letterSpacing: -0.3 },
  metaStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border },
  metaText: { color: c.textMuted, fontSize: 12.5, fontWeight: '600' },
  created: { color: c.textFaint, fontSize: 11.5, marginTop: 10 },
  muted: { color: c.textFaint, fontStyle: 'italic', fontSize: 13 },
  file: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border },
  fileIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  fileName: { color: c.text, fontWeight: '700', fontSize: 13 },
  fileMeta: { color: c.textFaint, fontSize: 11, marginTop: 2 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 30, borderRadius: 999, backgroundColor: c.primarySoft },
  sortText: { color: c.primary, fontSize: 11.5, fontWeight: '800' },
  composer: { gap: 8, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.inputBg },
  composerInput: { minHeight: 70, color: c.text, fontSize: 14, textAlignVertical: 'top' },
  bubble: { flex: 1, padding: 12, borderRadius: 14, borderTopLeftRadius: 4, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border },
  author: { color: c.text, fontWeight: '800', fontSize: 12.5 },
  date: { color: c.textFaint, fontSize: 11 },
}));
