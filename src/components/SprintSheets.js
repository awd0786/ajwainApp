import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { makeStyles, toneOf, useTheme, STATUS_ACCENT } from '../theme/theme';
import { fmtDateTime, getPriorityStatus } from '../utils/format';
import {
  Banner,
  Button,
  Card,
  Empty,
  Legend,
  Loading,
  Pill,
  Row,
  Segmented,
  SegmentBar,
  Select,
  Sheet,
  TextField,
} from '../ui';

/* Shared sheets for the Sprint dashboard (port of the modals inside SprintDashboard.jsx). */

export const STORY_COLOR = '#6366F1';
export const BUG_COLOR = '#EF4444';
export const OTHER_COLOR = '#94A3B8';

export function statusColor(status) {
  return STATUS_ACCENT[String(status || '').toLowerCase().trim()] || '#94A3B8';
}

/* -------------------------------------------------------------------------
   Breakdown (ChartModal + LeadChartModal + ClientChartModal)
   ------------------------------------------------------------------------- */
function typeSplit(rows, keyFn) {
  const map = {};
  rows.forEach((r) => {
    const k = keyFn(r);
    if (!map[k]) map[k] = { label: k, story: 0, bug: 0, other: 0, count: 0 };
    const t = String(r.Type || r.type || '').trim().toLowerCase();
    if (t === 'bug') map[k].bug += 1;
    else if (t === 'story') map[k].story += 1;
    else map[k].other += 1;
    map[k].count += 1;
  });
  return Object.values(map).sort((a, b) => b.count - a.count);
}

function SplitTable({ data, total, head }) {
  const s = useStyles();
  const { c } = useTheme();
  const showOther = data.some((d) => d.other > 0);
  const tot = data.reduce((a, d) => ({ story: a.story + d.story, bug: a.bug + d.bug, other: a.other + d.other }), { story: 0, bug: 0, other: 0 });
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <View style={{ gap: 12 }}>
      <Legend
        items={[
          { label: 'Story', value: tot.story, color: STORY_COLOR },
          { label: 'Bug', value: tot.bug, color: BUG_COLOR },
          ...(showOther ? [{ label: 'Other', value: tot.other, color: OTHER_COLOR }] : []),
        ]}
      />
      {data.length === 0 ? (
        <Empty icon="bar-chart-2" title="No data" subtitle="No mapping data available for current records." />
      ) : (
        data.map((d) => (
          <View key={d.label} style={{ gap: 5 }}>
            <Row justify="space-between">
              <Text style={s.rowLabel} numberOfLines={1}>
                {d.label}
              </Text>
              <Text style={s.rowNums}>
                <Text style={{ color: STORY_COLOR }}>{d.story}</Text>
                <Text style={{ color: c.textFaint }}> / </Text>
                <Text style={{ color: BUG_COLOR }}>{d.bug}</Text>
                {showOther && (
                  <>
                    <Text style={{ color: c.textFaint }}> / </Text>
                    <Text style={{ color: OTHER_COLOR }}>{d.other}</Text>
                  </>
                )}
                <Text style={{ color: c.textFaint, fontWeight: '600' }}>{`   ${total ? Math.round((d.count / total) * 100) : 0}%`}</Text>
              </Text>
            </Row>
            <View style={{ width: `${Math.max(8, (d.count / max) * 100)}%` }}>
              <SegmentBar
                height={12}
                segments={[
                  { value: d.story, color: STORY_COLOR },
                  { value: d.bug, color: BUG_COLOR },
                  { value: d.other, color: OTHER_COLOR },
                ]}
              />
            </View>
          </View>
        ))
      )}
      {data.length > 0 && (
        <View style={s.table}>
          <View style={[s.tr, s.th]}>
            <Text style={[s.td, { flex: 2.2, fontWeight: '800', color: c.primary }]}>{head}</Text>
            <Text style={[s.tdNum, { color: STORY_COLOR }]}>Story</Text>
            <Text style={[s.tdNum, { color: BUG_COLOR }]}>Bug</Text>
            {showOther && <Text style={[s.tdNum, { color: OTHER_COLOR }]}>Other</Text>}
            <Text style={s.tdNum}>Total</Text>
          </View>
          {data.map((d) => (
            <View key={d.label} style={s.tr}>
              <Text style={[s.td, { flex: 2.2 }]} numberOfLines={2}>
                {d.label}
              </Text>
              <Text style={[s.tdNum, { color: STORY_COLOR }]}>{d.story}</Text>
              <Text style={[s.tdNum, { color: BUG_COLOR }]}>{d.bug}</Text>
              {showOther && <Text style={[s.tdNum, { color: OTHER_COLOR }]}>{d.other}</Text>}
              <Text style={[s.tdNum, { color: c.text }]}>{d.count}</Text>
            </View>
          ))}
          <View style={[s.tr, s.tfoot]}>
            <Text style={[s.td, { flex: 2.2, fontWeight: '800' }]}>Total</Text>
            <Text style={[s.tdNum, { color: STORY_COLOR }]}>{tot.story}</Text>
            <Text style={[s.tdNum, { color: BUG_COLOR }]}>{tot.bug}</Text>
            {showOther && <Text style={[s.tdNum, { color: OTHER_COLOR }]}>{tot.other}</Text>}
            <Text style={[s.tdNum, { color: c.text }]}>{total}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

export function BreakdownSheet({ visible, onClose, rows = [], devLeadMapping = [], testingLeadMapping = [], subtitle, initialTab = 'status' }) {
  const s = useStyles();
  const { c } = useTheme();
  const [tab, setTab] = useState(initialTab);
  useEffect(() => {
    if (visible) setTab(initialTab);
  }, [visible, initialTab]);

  const total = rows.length;

  const statusData = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      const st = getPriorityStatus(r);
      if (st && st !== '-') map[st] = (map[st] || 0) + 1;
    });
    return Object.entries(map)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  const devByModule = useMemo(() => {
    const m = new Map();
    devLeadMapping.forEach((x) => {
      const k = String(x.ModuleId);
      if (!m.has(k)) m.set(k, x.TeamLeadLoginName);
    });
    return m;
  }, [devLeadMapping]);
  const testByModule = useMemo(() => {
    const m = new Map();
    testingLeadMapping.forEach((x) => {
      const k = String(x.ModuleId);
      if (!m.has(k)) m.set(k, x.TestingLeadName);
    });
    return m;
  }, [testingLeadMapping]);

  const devData = useMemo(() => typeSplit(rows, (r) => devByModule.get(String(r.Module ?? '')) || '(Unassigned)'), [rows, devByModule]);
  const testData = useMemo(() => typeSplit(rows, (r) => testByModule.get(String(r.Module ?? '')) || '(Unassigned)'), [rows, testByModule]);
  const clientData = useMemo(() => typeSplit(rows, (r) => (r.ClientName && String(r.ClientName).trim()) || '(No Client)'), [rows]);
  const maxStatus = Math.max(1, ...statusData.map((d) => d.count));

  return (
    <Sheet visible={visible} onClose={onClose} title="Breakdown" subtitle={subtitle} icon="bar-chart-2" size="full">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { label: 'Status', value: 'status', icon: 'pie-chart' },
          { label: 'Dev Lead', value: 'dev', icon: 'code' },
          { label: 'Testing Lead', value: 'testing', icon: 'check-circle', color: c.violet },
          { label: 'Client', value: 'client', icon: 'briefcase', color: c.teal },
        ]}
      />
      {tab === 'status' ? (
        statusData.length === 0 ? (
          <Empty icon="pie-chart" title="No data" />
        ) : (
          <View style={{ gap: 12 }}>
            {statusData.map(({ status, count }) => (
              <View key={status} style={{ gap: 5 }}>
                <Row justify="space-between">
                  <Row gap={6} style={{ flex: 1 }}>
                    <View style={[s.dot, { backgroundColor: statusColor(status) }]} />
                    <Text style={s.rowLabel} numberOfLines={1}>
                      {status}
                    </Text>
                  </Row>
                  <Text style={s.rowNums}>
                    {count}
                    <Text style={{ color: c.textFaint, fontWeight: '600' }}>{`  ${total ? Math.round((count / total) * 100) : 0}%`}</Text>
                  </Text>
                </Row>
                <View style={s.track}>
                  <View style={{ width: `${Math.max(4, (count / maxStatus) * 100)}%`, height: '100%', borderRadius: 6, backgroundColor: statusColor(status) }} />
                </View>
              </View>
            ))}
            <Row justify="space-between" style={s.totalRow}>
              <Text style={[s.rowLabel, { fontWeight: '800' }]}>Total</Text>
              <Text style={s.rowNums}>{total}</Text>
            </Row>
          </View>
        )
      ) : tab === 'dev' ? (
        <SplitTable data={devData} total={total} head="Dev Team Lead" />
      ) : tab === 'testing' ? (
        <SplitTable data={testData} total={total} head="Testing Lead" />
      ) : (
        <SplitTable data={clientData} total={total} head="Client" />
      )}
    </Sheet>
  );
}

/* -------------------------------------------------------------------------
   Sprint change (SprintChangeModal)
   ------------------------------------------------------------------------- */
export function SprintChangeSheet({ visible, row, count = 1, allSprints = [], onClose, onConfirm, loading }) {
  const [sprintId, setSprintId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setSprintId('');
      setRemarks('');
      setError('');
    }
  }, [visible]);

  const available = useMemo(() => allSprints.filter((s) => String(s.ProductId) === String(row?.Product)), [allSprints, row]);

  const confirm = () => {
    if (!sprintId) return setError('Please select a sprint.');
    if (!remarks.trim()) return setError('Remarks are mandatory.');
    setError('');
    onConfirm?.(sprintId, remarks.trim());
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Change Sprint"
      subtitle={count > 1 ? `${count} points selected` : row ? `${row.Type || 'Point'} #${row.Id}` : undefined}
      icon="repeat"
      footer={
        <Row gap={10}>
          <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={onClose} />
          <Button
            title="Confirm"
            icon="check"
            style={{ flex: 1.4 }}
            loading={loading}
            disabled={!sprintId || !remarks.trim() || available.length === 0}
            onPress={confirm}
          />
        </Row>
      }
    >
      <ProductText name={row?.ProductName} />
      {available.length === 0 ? (
        <Banner type="warning" text="No sprints available for this product" />
      ) : (
        <Select
          label="Select New Sprint"
          icon="zap"
          required
          value={sprintId}
          onChange={(v) => {
            setSprintId(v);
            setError('');
          }}
          placeholder="-- Select a sprint --"
          options={available.map((s) => ({ value: String(s.ID), label: s.SprintName }))}
        />
      )}
      <TextField
        label="Remarks"
        required
        multiline
        maxLength={1000}
        showCount
        value={remarks}
        onChangeText={(t) => {
          setRemarks(t);
          if (t.trim()) setError('');
        }}
        placeholder="Enter reason for changing the sprint"
      />
      <Banner type="error" text={error} />
    </Sheet>
  );
}

function ProductText({ name }) {
  const { c } = useTheme();
  return (
    <Card flat style={{ gap: 2 }}>
      <Text style={{ fontSize: 11, color: c.textFaint, fontWeight: '800', letterSpacing: 0.6 }}>PRODUCT</Text>
      <Text style={{ color: c.text, fontSize: 15, fontWeight: '800' }}>{name || 'Unknown'}</Text>
    </Card>
  );
}

/* -------------------------------------------------------------------------
   Point history (SprintHistoryModal + openSprintHistory)
   ------------------------------------------------------------------------- */
const parseJsonArray = (raw) => {
  if (!raw) return [];
  try {
    const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
};

export async function loadPointHistory(pointId, type) {
  const pointType = String(type).toLowerCase() === 'bug' ? 'Bug' : 'Story';
  const payload = await api.get('getPointDetail', { pointId, pointType });
  if (payload && payload.success === false) throw new Error(payload.message || 'Unable to load point history.');
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const hist = [];
  const drops = [];
  rows.forEach((r) => {
    hist.push(...parseJsonArray(r?.AuditHistoryJson));
    drops.push(...parseJsonArray(r?.PointDropHistoryJson));
  });
  const uniq = (arr, keyFn) => Array.from(new Map(arr.map((it, i) => [keyFn(it, i), it])).values());
  const h = uniq(hist, (it, i) => String(it.ID ?? `${it.StoryId}-${it.SprintId}-${it.AddedDateTime}-${i}`));
  const d = uniq(drops, (it, i) => String(it.ID ?? `${it.PointId}-${it.SprintId}-${it.PointDropDateTime}-${i}`));
  h.sort((a, b) => new Date(a.AddedDateTime || 0) - new Date(b.AddedDateTime || 0));
  d.sort((a, b) => new Date(a.PointDropDateTime || 0) - new Date(b.PointDropDateTime || 0));
  return { history: h, drops: d, pointType };
}

export function PointHistorySheet({ visible, row, onClose }) {
  const s = useStyles();
  const { c } = useTheme();
  const [tab, setTab] = useState('sprint');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [drops, setDrops] = useState([]);

  useEffect(() => {
    if (!visible || !row) return;
    let alive = true;
    setTab('sprint');
    setHistory([]);
    setDrops([]);
    setError('');
    if (!row.Id || !row.Type) {
      setError('Point ID or point type is missing.');
      return;
    }
    setLoading(true);
    loadPointHistory(row.Id, row.Type)
      .then((r) => {
        if (!alive) return;
        setHistory(r.history);
        setDrops(r.drops);
      })
      .catch((e) => alive && setError(e.message || 'Unable to load point history.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [visible, row]);

  const list = tab === 'sprint' ? history : drops;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Point History"
      subtitle={row ? `${row.Type || 'Point'} #${row.Id ?? '-'} · ${row.Title || ''}` : undefined}
      icon="clock"
      size="full"
    >
      <Segmented
        scroll={false}
        value={tab}
        onChange={setTab}
        options={[
          { label: 'Sprint Changes', value: 'sprint', count: history.length },
          { label: 'Point Drops', value: 'drop', count: drops.length, color: c.red },
        ]}
      />
      {loading ? (
        <Loading inline text="Loading point history…" />
      ) : error ? (
        <Banner type="error" text={error} />
      ) : list.length === 0 ? (
        <Empty icon={tab === 'sprint' ? 'clock' : 'alert-circle'} title={tab === 'sprint' ? 'No sprint change history found.' : 'No point drop history found.'} />
      ) : (
        <View style={{ paddingLeft: 6 }}>
          {list.map((it, i) => {
            const accent = tab === 'sprint' ? c.primary : c.red;
            const last = i === list.length - 1;
            return (
              <View key={String(it.ID ?? i)} style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ alignItems: 'center', width: 18 }}>
                  <View style={[s.tlDot, { borderColor: accent }]} />
                  {!last && <View style={[s.tlLine, { backgroundColor: c.border }]} />}
                </View>
                <View style={[s.tlCard, { marginBottom: last ? 0 : 12 }]}>
                  <Row justify="space-between" align="flex-start">
                    <Text style={s.tlTitle}>{it.SprintName || '-'}</Text>
                    <Text style={s.tlIdx}>#{i + 1}</Text>
                  </Row>
                  <Text style={s.tlMeta}>{it.ProductName || '-'}</Text>
                  {tab === 'sprint' ? (
                    <>
                      <Row gap={6} style={{ marginTop: 6 }}>
                        <Feather name="user" size={12} color={c.textMuted} />
                        <Text style={s.tlMeta}>{it.SprintChangedBy || '-'}</Text>
                        <Feather name="calendar" size={12} color={c.textMuted} style={{ marginLeft: 6 }} />
                        <Text style={s.tlMeta}>{fmtDateTime(it.AddedDateTime, '-')}</Text>
                      </Row>
                      {(it.Remarks ?? it.remarks) ? <Text style={s.tlRemarks}>{it.Remarks ?? it.remarks}</Text> : null}
                    </>
                  ) : (
                    <>
                      <Row gap={6} style={{ marginTop: 6 }} wrap>
                        <Pill label={`${it.PointType || row?.Type || '-'} #${it.PointId ?? row?.Id ?? '-'}`} color={c.indigo} />
                      </Row>
                      <Row gap={6} style={{ marginTop: 6 }}>
                        <Feather name="user-x" size={12} color={c.textMuted} />
                        <Text style={s.tlMeta}>{it.PointDroppedByName || '-'}</Text>
                        <Feather name="calendar" size={12} color={c.textMuted} style={{ marginLeft: 6 }} />
                        <Text style={s.tlMeta}>{fmtDateTime(it.PointDropDateTime, '-')}</Text>
                      </Row>
                    </>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Sheet>
  );
}

/* -------------------------------------------------------------------------
   Add sprint points (AddPointModal)
   ------------------------------------------------------------------------- */
export function AddPointSheet({ visible, allSprints = [], onClose, onSaved }) {
  const s = useStyles();
  const { c, dark } = useTheme();
  const { session } = useAuth();
  const [productId, setProductId] = useState('');
  const [sprintName, setSprintName] = useState('');
  const [type, setType] = useState('Story');
  const [input, setInput] = useState('');
  const [grid, setGrid] = useState([]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [response, setResponse] = useState('');

  useEffect(() => {
    if (visible) {
      setProductId('');
      setSprintName('');
      setType('Story');
      setInput('');
      setGrid([]);
      setAddError('');
      setSaveError('');
      setResponse('');
    }
  }, [visible]);

  const productOptions = useMemo(() => {
    const map = new Map();
    allSprints.forEach((sp) => {
      if (sp.ProductId == null) return;
      const id = String(sp.ProductId);
      if (!map.has(id)) map.set(id, { value: id, label: sp.ProductName || `Product ${sp.ProductId}` });
    });
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [allSprints]);

  const related = useMemo(
    () => (productId ? allSprints.filter((sp) => String(sp.ProductId) === String(productId) && sp.IsClosed === false) : []),
    [allSprints, productId],
  );
  const sprintObj = useMemo(() => related.find((sp) => sp.SprintName === sprintName), [related, sprintName]);

  const add = async () => {
    setAddError('');
    const id = input.trim();
    if (!productId) return setAddError('Please select a product first.');
    if (!sprintName) return setAddError('Please select a sprint first.');
    if (!id || isNaN(Number(id))) return setAddError(`Please enter a valid numeric ${type.toLowerCase()} number.`);
    if (grid.some((r) => String(r.id) === id)) return setAddError(`${type} #${id} is already added.`);
    setAdding(true);
    try {
      const check = await api.get('getPointSprint', { story: id, type: type.toLowerCase() });
      if (check?.exists) throw new Error(`${type} #${id} ${check.message || 'already exists'}`);
      const data = await api.get('getPointDetails', { pointId: id, type: type.toLowerCase() });
      if (!Array.isArray(data) || data.length === 0) throw new Error(`${type} #${id} not found.`);
      const item = data[0];
      if (sprintObj && String(item.product) !== String(sprintObj.ProductId)) {
        throw new Error(
          `${type} belongs to "${item.ProductName}" but the selected sprint belongs to "${sprintObj.ProductName}". Only items from the same product as the sprint can be added.`,
        );
      }
      if (grid.length > 0 && String(item.product) !== String(grid[0].productId)) {
        throw new Error(
          `Product mismatch - existing items are for "${grid[0].ProductName}", but ${type} #${id} belongs to "${item.ProductName}". All items in a sprint must be from the same product.`,
        );
      }
      setGrid((g) => [
        ...g,
        {
          id: item.id,
          type,
          productId: item.product,
          ProductName: item.ProductName,
          ModuleName: item.ModuleName,
          title: item.title,
          ClientName: item.ClientName,
          CurrentStatus: item.CurrentStatus,
          assignedTo: item.assignedTo,
        },
      ]);
      setInput('');
    } catch (e) {
      setAddError(e.message);
    } finally {
      setAdding(false);
    }
  };

  const save = async () => {
    if (!sprintName || grid.length === 0 || !sprintObj) return;
    setSaveError('');
    setSaving(true);
    const byType = grid.reduce((acc, r) => {
      const t = (r.type || 'Story').toLowerCase();
      (acc[t] = acc[t] || []).push(r.id);
      return acc;
    }, {});
    try {
      const messages = [];
      for (const [t, ids] of Object.entries(byType)) {
        const json = await api.post(
          'insertSLASprintPoint',
          { productId: grid[0].productId, sprintId: sprintObj.ID, stories: ids.join(','), operatorId: parseInt(session.userId || '0', 10), type: t },
          { headers: { 'Content-Type': 'application/json' } },
        );
        if (!json?.success) throw new Error(json?.message || 'Save failed.');
        if (json.message) messages.push(json.message);
      }
      setResponse(messages.length ? messages.join('\n') : 'Points added successfully!');
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const finish = () => {
    const wasSaved = !!response;
    onClose?.();
    if (wasSaved) onSaved?.();
  };

  return (
    <Sheet
      visible={visible}
      onClose={finish}
      title="Add Sprint Points"
      subtitle="Pick product & sprint, choose type, add IDs, then save"
      icon="plus-circle"
      accent={c.emerald}
      size="full"
      footer={
        response ? (
          <Button title="Done" icon="check" onPress={finish} />
        ) : (
          <Row gap={10}>
            <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={finish} />
            <Button
              title={grid.length ? `Save ${grid.length} item${grid.length === 1 ? '' : 's'}` : 'Save'}
              icon="save"
              style={{ flex: 1.4 }}
              loading={saving}
              disabled={grid.length === 0 || !sprintName}
              onPress={save}
            />
          </Row>
        )
      }
    >
      {response ? (
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 20 }}>
          <View style={[s.okIcon, { backgroundColor: toneOf(c.emerald, dark).bg }]}>
            <Feather name="check" size={30} color={c.emerald} />
          </View>
          <Text style={{ color: c.text, fontSize: 17, fontWeight: '800' }}>Operation Successful</Text>
          <Text style={{ color: c.textMuted, fontSize: 13.5, textAlign: 'center', lineHeight: 20 }}>{response}</Text>
        </View>
      ) : (
        <>
          <Select
            label="Product"
            icon="box"
            value={productId}
            placeholder="Select Product"
            options={productOptions}
            onChange={(v) => {
              setProductId(v);
              setSprintName('');
              setGrid([]);
              setAddError('');
            }}
          />
          <Select
            label="Sprint Master"
            icon="zap"
            value={sprintName}
            disabled={!productId}
            placeholder={productId ? 'Select Sprint' : 'Select a product first'}
            options={related.map((sp) => sp.SprintName)}
            onChange={(v) => {
              setSprintName(v);
              setGrid([]);
              setAddError('');
            }}
          />
          <Segmented
            scroll={false}
            value={type}
            onChange={(v) => {
              setType(v);
              setInput('');
              setAddError('');
            }}
            options={[
              { label: 'Story', value: 'Story', icon: 'book-open', color: c.sky },
              { label: 'Bug', value: 'Bug', icon: 'alert-octagon', color: c.red },
            ]}
          />
          <Row gap={10} align="flex-end">
            <TextField
              style={{ flex: 1 }}
              label={`${type} Number`}
              keyboardType="number-pad"
              value={input}
              onChangeText={(t) => {
                setInput(t.replace(/[^\d]/g, ''));
                setAddError('');
              }}
              placeholder={type === 'Bug' ? 'e.g. 1234' : 'e.g. 3722'}
              onSubmitEditing={() => !adding && add()}
              returnKeyType="done"
            />
            <Button title="Add" icon="plus" loading={adding} onPress={add} style={{ marginBottom: 1 }} />
          </Row>
          <Banner type="error" text={addError} />
          {grid.length === 0 ? (
            <Empty icon="list" title="No items added yet" subtitle="Select a product and sprint, enter an ID above and tap Add." />
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={s.gridHead}>
                {grid.length} item{grid.length === 1 ? '' : 's'} · {grid[0].ProductName} · {sprintName}
              </Text>
              {grid.map((r, i) => (
                <Card key={String(r.id)} accent={r.type === 'Bug' ? c.red : c.sky} style={{ gap: 6 }}>
                  <Row justify="space-between">
                    <Row gap={8}>
                      <Text style={s.gridId}>#{r.id}</Text>
                      <Pill label={r.type} status={r.type} />
                      {!!r.CurrentStatus && <Pill label={r.CurrentStatus} status={r.CurrentStatus} />}
                    </Row>
                    <Pressable hitSlop={8} onPress={() => setGrid((g) => g.filter((_, idx) => idx !== i))}>
                      <Feather name="trash-2" size={17} color={c.red} />
                    </Pressable>
                  </Row>
                  <Text style={s.gridTitle}>{r.title}</Text>
                  <Text style={s.gridMeta}>
                    {[r.ModuleName, r.ClientName].filter(Boolean).join(' · ') || '—'}
                  </Text>
                </Card>
              ))}
            </View>
          )}
          <Banner type="error" text={saveError} />
        </>
      )}
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  rowLabel: { flex: 1, color: c.text, fontSize: 12.5, fontWeight: '700' },
  rowNums: { color: c.text, fontSize: 12.5, fontWeight: '800' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  track: { height: 12, borderRadius: 6, backgroundColor: c.bgAlt, overflow: 'hidden' },
  totalRow: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 },
  table: { borderWidth: 1, borderColor: c.border, borderRadius: 12, overflow: 'hidden' },
  tr: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.border, alignItems: 'center' },
  th: { backgroundColor: c.primarySoft, borderTopWidth: 0 },
  tfoot: { backgroundColor: c.surfaceAlt },
  td: { flex: 1, color: c.text, fontSize: 12 },
  tdNum: { width: 46, textAlign: 'right', fontSize: 12, fontWeight: '800', color: c.textMuted },
  tlDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, backgroundColor: c.surface, marginTop: 4 },
  tlLine: { width: 2, flex: 1, marginTop: 2 },
  tlCard: { flex: 1, backgroundColor: c.surfaceAlt, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: c.border },
  tlTitle: { color: c.text, fontWeight: '800', fontSize: 13.5, flex: 1 },
  tlIdx: { color: c.textFaint, fontWeight: '800', fontSize: 11 },
  tlMeta: { color: c.textMuted, fontSize: 12 },
  tlRemarks: { color: c.text, fontSize: 12.5, marginTop: 8, lineHeight: 18, fontStyle: 'italic' },
  okIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  gridHead: { color: c.textMuted, fontSize: 12, fontWeight: '700' },
  gridId: { color: c.primary, fontWeight: '900', fontSize: 14 },
  gridTitle: { color: c.text, fontSize: 13.5, fontWeight: '600', lineHeight: 19 },
  gridMeta: { color: c.textMuted, fontSize: 12 },
}));
