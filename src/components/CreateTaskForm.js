import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { makeStyles, radii, useTheme } from '../theme/theme';
import { formatFileSize } from '../utils/exporter';
import { textToHtml } from './HtmlText';
import { Banner, Button, Card, DateField, Pill, Row, SectionHeader, Segmented, Select, TextField, useToast } from '../ui';

/**
 * Port of CreateTask.jsx – used as a full page (Create Task) and inside a
 * sheet from the Ajwain Board. Sub-task prefill comes from `subTaskData`
 * (web: sessionStorage 'ajwainSubTaskData').
 */
const PRIORITIES = ['Low', 'Normal', 'High', 'Critical'];
const PRIORITY_COLOR = { Low: '#94A3B8', Normal: '#3B82F6', High: '#F59E0B', Critical: '#EF4444' };

const emptyForm = (taskType = '') => ({
  productId: '',
  moduleId: '',
  clientId: '',
  taskName: '',
  taskType,
  priority: 'Normal',
  assignedTo: '',
  storyId: '',
  bugId: '',
  estimate: '',
  deadline: '',
  description: '',
  isSubTask: false,
  parentTaskId: 0,
});

const arrOf = (data, ...keys) => {
  if (Array.isArray(data)) return data;
  for (const k of keys) if (Array.isArray(data?.[k])) return data[k];
  return [];
};

export default function CreateTaskForm({ subTaskData, onCreated, onCancel }) {
  const s = useStyles();
  const { c } = useTheme();
  const toast = useToast();
  const { session } = useAuth();

  const [products, setProducts] = useState([]);
  const [modules, setModules] = useState([]);
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]);
  const [loading, setLoading] = useState({ products: true, modules: false, users: true, master: true });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [attachments, setAttachments] = useState([]);
  const [form, setForm] = useState(emptyForm());

  const setL = (k, v) => setLoading((p) => ({ ...p, [k]: v }));

  const fetchModules = async (productId) => {
    if (!productId) {
      setModules([]);
      return;
    }
    setL('modules', true);
    try {
      setModules(arrOf(await api.get('zentaoModule', { productId }), 'Modules', 'modules', 'data'));
    } catch {
      setModules([]);
    } finally {
      setL('modules', false);
    }
  };

  useEffect(() => {
    api
      .get('zentaoProduct')
      .then((d) => setProducts(arrOf(d, 'Product', 'products', 'data')))
      .catch(() => setProducts([]))
      .finally(() => setL('products', false));
    api
      .get('getAjwainUserList')
      .then((d) => setUsers(d?.success && Array.isArray(d.users) ? d.users.filter((u) => u.Deleted === false) : []))
      .catch(() => setUsers([]))
      .finally(() => setL('users', false));
    api
      .get('taskMaster')
      .then((d) => {
        const cl = arrOf(d, 'Clients', 'clients');
        const tt = arrOf(d, 'TaskTypes', 'taskTypes');
        setClients(cl);
        setTaskTypes(tt);
        if (tt.length) {
          const first = String(tt[0].Name ?? tt[0].name ?? '');
          setForm((prev) => (prev.isSubTask && prev.taskType ? prev : { ...prev, taskType: prev.taskType || first }));
        }
      })
      .catch(() => {
        setClients([]);
        setTaskTypes([]);
      })
      .finally(() => setL('master', false));
  }, []);

  // Sub-task prefill
  useEffect(() => {
    const st = subTaskData;
    const pid = Number(st?.parentTaskId);
    if (st?.isSubTask === true && Number.isFinite(pid) && pid > 0) {
      setForm((prev) => ({
        ...prev,
        productId: String(st.productId ?? ''),
        moduleId: String(st.moduleId ?? ''),
        clientId: String(st.clientId ?? ''),
        taskName: String(st.taskName ?? ''),
        taskType: String(st.taskType ?? prev.taskType ?? ''),
        isSubTask: true,
        parentTaskId: pid,
      }));
      if (st.productId) fetchModules(st.productId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTaskData]);

  const change = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: '' }));
  };

  const changeProduct = (pid) => {
    setForm((p) => ({ ...p, productId: pid, moduleId: '' }));
    setErrors((p) => ({ ...p, productId: '', moduleId: '' }));
    fetchModules(pid);
  };

  const pickFiles = async () => {
    const res = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: '*/*' });
    if (res.canceled) return;
    setAttachments((prev) => [...prev, ...(res.assets || [])]);
  };

  const validate = () => {
    const e = {};
    if (!form.productId) e.productId = 'Product is required';
    if (!form.moduleId) e.moduleId = 'Module is required';
    if (!form.clientId) e.clientId = 'Client is required';
    if (!String(form.taskName ?? '').trim()) e.taskName = 'Task name is required';
    if (!String(form.description || '').trim()) e.description = 'Description is required';
    if (form.assignedTo === null || form.assignedTo === undefined || String(form.assignedTo).trim() === '') e.assignedTo = 'Assigned to is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const reset = () => {
    const first = taskTypes.length ? String(taskTypes[0].Name ?? taskTypes[0].name ?? '') : '';
    setForm(emptyForm(first));
    setModules([]);
    setAttachments([]);
    setErrors({});
  };

  const save = async () => {
    if (!validate()) return;
    const userId = session.userId;
    if (!userId || Number(userId) <= 0) return toast.error('User session not found. Please login again.');
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('ProductId', String(form.productId));
      fd.append('ModuleId', String(form.moduleId));
      fd.append('ClientId', String(form.clientId));
      fd.append('TaskName', form.taskName.trim());
      fd.append('TaskType', String(form.taskType || ''));
      fd.append('Priority', String(form.priority || 'Normal'));
      if (form.storyId) fd.append('RelatedStory', String(form.storyId));
      if (form.bugId) fd.append('RelatedBug', String(form.bugId));
      if (form.assignedTo) fd.append('AssignedTo', String(form.assignedTo));
      if (form.estimate) fd.append('EstimatedHours', String(form.estimate));
      if (form.deadline) fd.append('Deadline', form.deadline);
      fd.append('Description', textToHtml(form.description));
      fd.append('TaskAddedBy', String(userId));
      fd.append('IsSubTask', form.isSubTask ? 'true' : 'false');
      fd.append('ParentTaskId', String(form.parentTaskId || 0));

      const result = await api.post('createTask', undefined, { body: fd, headers: { Accept: 'application/json' } });
      if (result?.success === false) throw new Error(result.message || 'Task creation failed.');
      const taskId = Number(result?.taskId || 0);
      const orderId = Number(result?.orderId || 0);

      if (attachments.length) {
        if (taskId <= 0 || orderId <= 0) {
          toast.warning('Task created, but attachments could not be uploaded because Task ID / Order ID was not returned.');
        } else {
          let ok = 0;
          for (const f of attachments) {
            try {
              const up = new FormData();
              up.append('OrderId', String(orderId));
              up.append('TaskId', String(taskId));
              up.append('UploadedBy', String(userId));
              up.append('Attachment', { uri: f.uri, name: f.name || 'attachment', type: f.mimeType || 'application/octet-stream' });
              const r = await api.post('uploadDocument2', undefined, { body: up, headers: { Accept: 'application/json' } });
              if (r?.success === false) throw new Error(r.message);
              ok += 1;
            } catch {
              /* counted below */
            }
          }
          if (ok === attachments.length) toast.success(`Task created successfully. Task ID: ${taskId}. ${ok} document(s) uploaded.`);
          else if (ok > 0) toast.warning(`Task created successfully. ${ok} document(s) uploaded, ${attachments.length - ok} failed.`);
          else toast.warning('Task created successfully, but document upload failed.');
        }
      } else {
        toast.success(`Task created successfully. Task ID: ${taskId || '-'}`);
      }
      onCreated?.(taskId);
      reset();
    } catch (e) {
      toast.error(e?.message || 'Something went wrong while creating task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: 14 }}>
      {form.isSubTask && <Banner type="info" text={`Creating a sub task of Task #${form.parentTaskId}`} />}

      <Card style={{ gap: 12 }}>
        <SectionHeader title="Task Information" icon="clipboard" />
        <Select
          label="Product"
          required
          value={form.productId}
          options={products.map((p) => ({ value: String(p.id ?? p.ID), label: p.NAME ?? p.Name ?? p.name ?? '' }))}
          placeholder={loading.products ? 'Loading products…' : 'Select product'}
          onChange={changeProduct}
          error={errors.productId}
          searchable
        />
        <Select
          label="Module"
          required
          value={form.moduleId}
          disabled={!form.productId}
          options={modules.map((m) => ({ value: String(m.id ?? m.ID), label: m.name ?? m.Name ?? m.NAME ?? '' }))}
          placeholder={!form.productId ? 'Select product first' : loading.modules ? 'Loading modules…' : 'Select module'}
          onChange={(v) => change('moduleId', v)}
          error={errors.moduleId}
          searchable
        />
        <Select
          label="Client"
          required
          value={form.clientId}
          options={clients.map((x) => ({ value: String(x.ID ?? x.id), label: x.Name ?? x.name }))}
          placeholder={loading.master ? 'Loading clients…' : 'Select client'}
          onChange={(v) => change('clientId', v)}
          error={errors.clientId}
          searchable
        />
        <TextField label="Task Name" required value={form.taskName} onChangeText={(v) => change('taskName', v)} placeholder="Enter task name" error={errors.taskName} />
        <Select
          label="Task Type"
          value={form.taskType}
          disabled={loading.master}
          clearable={false}
          options={taskTypes.map((t) => String(t.Name ?? t.name ?? ''))}
          placeholder={loading.master ? 'Loading…' : taskTypes.length === 0 ? 'No task type found' : 'Select type'}
          onChange={(v) => change('taskType', v)}
        />
        <View>
          <Text style={s.lbl}>Priority</Text>
          <Segmented scroll={false} size="sm" value={form.priority} onChange={(v) => change('priority', v)} options={PRIORITIES.map((p) => ({ label: p, value: p, color: PRIORITY_COLOR[p] }))} />
        </View>
        <Row gap={10}>
          <TextField label="Related Story" value={form.storyId} onChangeText={(v) => change('storyId', v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="Story ID" style={{ flex: 1 }} />
          <TextField label="Related Bug" value={form.bugId} onChangeText={(v) => change('bugId', v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="Bug ID" style={{ flex: 1 }} />
        </Row>
      </Card>

      <Card style={{ gap: 12 }}>
        <SectionHeader title="Assignment & Timeline" icon="user-check" color={c.teal} />
        <Select
          label="Assigned To"
          required
          value={form.assignedTo}
          options={users.map((u) => ({ value: String(u.ID), label: u.RealName, sub: `${u.LoginName} • ${u.Role || 'No Role'}` }))}
          placeholder={loading.users ? 'Loading users…' : 'Select user'}
          onChange={(v) => change('assignedTo', v)}
          error={errors.assignedTo}
          searchable
        />
        <Row gap={10}>
          <TextField label="Estimated Hours" value={form.estimate} onChangeText={(v) => change('estimate', v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="e.g. 4" style={{ flex: 1 }} />
          <DateField label="Deadline" value={form.deadline} onChange={(v) => change('deadline', v)} style={{ flex: 1 }} />
        </Row>
      </Card>

      <Card style={{ gap: 10 }}>
        <SectionHeader title="Description" subtitle="Requirements or acceptance criteria" icon="align-left" color={c.violet} />
        <TextInput
          value={form.description}
          onChangeText={(v) => change('description', v)}
          placeholder="Describe the task, requirements or acceptance criteria…"
          placeholderTextColor={c.textFaint}
          multiline
          style={[s.desc, errors.description && { borderColor: c.danger }]}
        />
        {!!errors.description && <Text style={s.err}>{errors.description}</Text>}
      </Card>

      <Card style={{ gap: 10 }}>
        <SectionHeader title="Attachments" subtitle="Optional documents" icon="paperclip" color={c.amber} right={<Button size="sm" variant="soft" icon="upload-cloud" title="Add" onPress={pickFiles} />} />
        {attachments.length === 0 ? (
          <Pressable onPress={pickFiles} style={s.drop}>
            <Feather name="upload-cloud" size={22} color={c.textFaint} />
            <Text style={{ color: c.textMuted, fontSize: 12.5, fontWeight: '600' }}>Tap to attach files</Text>
          </Pressable>
        ) : (
          attachments.map((f, i) => (
            <View key={`${f.uri}-${i}`} style={s.file}>
              <Feather name="file" size={16} color={c.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.fileName} numberOfLines={1}>{f.name}</Text>
                <Text style={s.fileMeta}>{formatFileSize(f.size)}</Text>
              </View>
              <Pressable onPress={() => setAttachments((p) => p.filter((_, j) => j !== i))} hitSlop={8}>
                <Feather name="trash-2" size={16} color={c.danger} />
              </Pressable>
            </View>
          ))
        )}
      </Card>

      <Row gap={10}>
        <Button title={onCancel ? 'Cancel' : 'Reset'} variant="secondary" icon={onCancel ? undefined : 'rotate-ccw'} style={{ flex: 1 }} onPress={onCancel || reset} disabled={saving} />
        <Button title={form.isSubTask ? 'Create Sub Task' : 'Create Task'} icon="check" style={{ flex: 1.5 }} loading={saving} onPress={save} />
      </Row>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  lbl: { fontSize: 11.5, fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  desc: { minHeight: 130, borderRadius: radii.md, borderWidth: 1.2, borderColor: c.border, backgroundColor: c.inputBg, padding: 12, color: c.text, fontSize: 14, textAlignVertical: 'top' },
  err: { color: c.danger, fontSize: 11.5, fontWeight: '600' },
  drop: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 22, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.borderStrong },
  file: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border },
  fileName: { color: c.text, fontWeight: '700', fontSize: 13 },
  fileMeta: { color: c.textFaint, fontSize: 11 },
}));
