import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { zentaoLink } from '../api/config';
import { useAuth } from '../context/AuthContext';
import { useHeaderActions } from '../navigation/ShellContext';
import { hashColor, makeStyles, shadowFor, useTheme } from '../theme/theme';
import { fmtDateTime } from '../utils/format';
import { exportCsv, openUrl, shareBase64File } from '../utils/exporter';
import {
  ActiveFilters,
  Avatar,
  Banner,
  Button,
  Card,
  Checkbox,
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
  SectionHeader,
  Segmented,
  Select,
  Sheet,
  StatStrip,
  ToggleRow,
  usePager,
  useToast,
} from '../ui';

/** Port of PatchPrioritization.jsx */

const COLUMNS = [
  { key: 'TaskNumber', label: 'Task' },
  { key: 'Story', label: 'Story #' },
  { key: 'Product', label: 'Product' },
  { key: 'AjwainSprintName', label: 'Ajwain Sprint' },
  { key: 'Module', label: 'Module' },
  { key: 'Client', label: 'Client' },
  { key: 'Title', label: 'Title' },
  { key: 'Type', label: 'Type' },
  { key: 'Efforts', label: 'Efforts' },
  { key: 'StakeHolderName', label: 'Stakeholder' },
  { key: 'AddedBy', label: 'Added By' },
  { key: 'AddedDateTime', label: 'Added Date', fmt: (v) => fmtDateTime(v, '') },
  { key: 'FirstBRDUploadedDateTime', label: 'First BRD Uploaded' },
  { key: 'ApprovedCRF', label: 'Approved CRF' },
  { key: 'DevLeadName', label: 'Dev Lead' },
];
const SORTABLE = [
  { value: '', label: 'Default order' },
  { value: 'AddedDateTime', label: 'Added Date' },
  { value: 'FirstBRDUploadedDateTime', label: 'First BRD Uploaded' },
  { value: 'Efforts', label: 'Efforts' },
  { value: 'ID', label: 'ID' },
];
const PRIORITIZE_ROLES = ['Product Owner', 'COO', 'CEO', 'Product Head'];

function resolveDevLeadNames(row, mapping, productId) {
  const mod = (row.Module || '').trim().toLowerCase();
  if (productId == null) return '';
  return [...new Set(mapping.filter((m) => Number(m.ProductId) === Number(productId) && (m.ModuleName || '').trim().toLowerCase() === mod).map((m) => m.TeamLeadLoginName).filter(Boolean))].join(', ');
}

const EMPTY_F = { module: '', clients: [], stakeholder: '', type: '', devLead: '', blankStory: false, havingStory: false, nonPrioritized: false, sortField: '', sortDir: 'asc' };

export default function PatchPrioritizationScreen() {
  const s = useStyles();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { session } = useAuth();
  const canPrioritize = PRIORITIZE_ROLES.includes(session.role);

  const [activeTab, setActiveTab] = useState('np');
  const [np, setNp] = useState([]);
  const [p, setP] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [devLeadMapping, setDevLeadMapping] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedSprintId, setSelectedSprintId] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [rowSprintMap, setRowSprintMap] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [prioritizing, setPrioritizing] = useState(false);
  const [docs, setDocs] = useState(null);
  const [history, setHistory] = useState(null);
  const [crfBusy, setCrfBusy] = useState(null);

  const [filters, setFilters] = useState({ np: EMPTY_F, p: EMPTY_F });
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState(EMPTY_F);
  const [filterOpen, setFilterOpen] = useState(false);

  const isAll = selectedProductId === 'all';
  const isNP = activeTab === 'np';
  const f = filters[activeTab];

  useEffect(() => {
    api
      .get('getProduct')
      .then((d) => {
        setProducts(d?.Product || []);
        setSprints(d?.Sprint || []);
      })
      .catch(() => {});
    api
      .get('teamLeadModulesName')
      .then((d) => setDevLeadMapping(Array.isArray(d) ? d : []))
      .catch(() => setDevLeadMapping([]));
  }, []);

  const getProductIdByName = useCallback((name) => {
    const x = products.find((pp) => pp.name === name);
    return x ? Number(x.id) : null;
  }, [products]);
  const planningSprintsFor = useCallback((pid) => sprints.filter((x) => !x.IsClosed && x.IsPlanning && Number(x.ProductId) === Number(pid)), [sprints]);
  const planningSprints = useMemo(() => planningSprintsFor(selectedProductId), [planningSprintsFor, selectedProductId]);
  const selectedProductName = products.find((x) => Number(x.id) === Number(selectedProductId))?.name || '';

  const fetchData = useCallback(
    async (mode = 'load') => {
      if (!selectedProductId) {
        setNp([]);
        setP([]);
        return;
      }
      if (mode === 'load') setLoading(true);
      else setRefreshing(true);
      setError(null);
      setSelectedIds(new Set());
      try {
        const json = await api.get('productPointList', { productId: isAll ? 0 : selectedProductId });
        const data = Array.isArray(json) ? json : json?.data ?? json?.Data ?? [];
        const parsed = data.map((x) => {
          let docsArr = [];
          try {
            docsArr = x.UploadedDocuments ? (typeof x.UploadedDocuments === 'string' ? JSON.parse(x.UploadedDocuments) : x.UploadedDocuments) : [];
          } catch {
            docsArr = [];
          }
          return { ...x, UploadedDocuments: Array.isArray(docsArr) ? docsArr : [] };
        });
        setNp(parsed.filter((r) => !r.IsPrioritized));
        setP(parsed.filter((r) => r.IsPrioritized || r.IsSprintAdded === 1));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedProductId, isAll],
  );

  useEffect(() => {
    fetchData('load');
    setRowSprintMap({});
  }, [selectedProductId, fetchData]);

  const enrich = useCallback((rows) => rows.map((r) => ({ ...r, DevLeadName: resolveDevLeadNames(r, devLeadMapping, getProductIdByName(r.Product)) })), [devLeadMapping, getProductIdByName]);
  const data = useMemo(() => enrich(isNP ? np : p), [enrich, isNP, np, p]);

  // cascading option lists (same as useFilters on web)
  const countOpts = (field, rows) => {
    const m = {};
    rows.forEach((r) => r[field] && (m[r[field]] = (m[r[field]] || 0) + 1));
    return Object.keys(m)
      .sort()
      .map((n) => ({ label: n, value: n, sub: `${m[n]} points` }));
  };
  const byProduct = useMemo(() => (selectedProductName ? data.filter((r) => r.Product === selectedProductName) : data), [data, selectedProductName]);
  const opt = useMemo(() => {
    const d = draft;
    const mRows = byProduct;
    const cRows = d.module ? mRows.filter((r) => r.Module === d.module) : mRows;
    const sRows = d.clients.length ? cRows.filter((r) => d.clients.includes(r.Client)) : cRows;
    const lRows = d.stakeholder ? sRows.filter((r) => r.StakeHolderName === d.stakeholder) : sRows;
    const leads = {};
    lRows.forEach((r) => r.DevLeadName && r.DevLeadName.split(', ').forEach((l) => (leads[l] = (leads[l] || 0) + 1)));
    return {
      module: countOpts('Module', mRows),
      client: countOpts('Client', cRows),
      stakeholder: countOpts('StakeHolderName', sRows),
      devLead: Object.keys(leads)
        .sort()
        .map((n) => ({ label: n, value: n, sub: `${leads[n]} points` })),
      type: countOpts('Type', data),
    };
  }, [byProduct, data, draft]);

  const filtered = useMemo(() => {
    let rows = byProduct;
    if (f.module) rows = rows.filter((r) => r.Module === f.module);
    if (f.clients.length) rows = rows.filter((r) => f.clients.includes(r.Client));
    if (f.stakeholder) rows = rows.filter((r) => r.StakeHolderName === f.stakeholder);
    if (f.type) rows = rows.filter((r) => (r.Type || '').toLowerCase() === f.type.toLowerCase());
    if (f.blankStory) rows = rows.filter((r) => !r.Story || Number(r.Story) === 0);
    if (f.havingStory) rows = rows.filter((r) => r.Story && Number(r.Story) > 0);
    if (f.nonPrioritized) rows = rows.filter((r) => Number(r.IsSprintAdded) === 0);
    if (f.devLead) rows = rows.filter((r) => (r.DevLeadName || '').split(', ').includes(f.devLead));
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => COLUMNS.some((col) => String(r[col.key] ?? '').toLowerCase().includes(q)));
    }
    if (f.sortField) {
      rows = [...rows].sort((a, b) => {
        const av = a[f.sortField] ?? '';
        const bv = b[f.sortField] ?? '';
        if (f.sortField === 'AddedDateTime') {
          const d = (av ? new Date(av).getTime() : 0) - (bv ? new Date(bv).getTime() : 0);
          return f.sortDir === 'asc' ? d : -d;
        }
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
        return f.sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  }, [byProduct, f, search]);

  const pager = usePager(filtered, 25, `${activeTab}|${selectedProductId}|${JSON.stringify(f)}|${search}`);
  const typeCounts = useMemo(() => {
    const m = {};
    filtered.forEach((r) => r.Type && (m[r.Type] = (m[r.Type] || 0) + 1));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const selectable = filtered.filter((r) => r.IsSprintAdded !== 1);
  const allSelected = selectable.length > 0 && selectable.every((r) => selectedIds.has(r.ID));
  const toggleRow = (id) =>
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSelectedIds((prev) => {
      const n = new Set(prev);
      selectable.forEach((r) => (allSelected ? n.delete(r.ID) : n.add(r.ID)));
      return n;
    });

  const askPrioritize = () => {
    if (!canPrioritize) return toast.error('Please contact CEO/COO or Product Team to prioritize the point.');
    if (!selectedIds.size) return;
    if (!selectedProductId) return toast.error('Please select a Product.');
    if (isAll) {
      const missing = [...selectedIds].filter((id) => !rowSprintMap[id]);
      if (missing.length) return toast.error(`Please select a sprint for ${missing.length} selected point(s).`);
    } else if (!selectedSprintId) return toast.error('Please select a Planning Sprint.');
    setConfirmOpen(true);
  };

  const markPrioritized = async () => {
    setPrioritizing(true);
    try {
      const points = np
        .filter((x) => selectedIds.has(x.ID))
        .map((x) => ({
          PointId: x.ID,
          Story: x.Story || null,
          ProductId: isAll ? getProductIdByName(x.Product) : Number(selectedProductId),
          SprintId: isAll ? Number(rowSprintMap[x.ID]) : Number(selectedSprintId),
        }));
      if (points.find((x) => !x.ProductId || !x.SprintId)) throw new Error('Some selected points are missing a Product or Sprint.');
      const result = await api.post('markPrioritizedPatchPoint', { jsonData: JSON.stringify(points), addedBy: session.userId || 0 });
      if (!result?.success) throw new Error(result?.message || 'Failed to save priority points.');
      setConfirmOpen(false);
      toast.success(result.message);
      setSelectedIds(new Set());
      setRowSprintMap({});
      await fetchData('refresh');
      setActiveTab('p');
    } catch (e) {
      toast.error(e.message || 'Failed to save priority points.');
    } finally {
      setPrioritizing(false);
    }
  };

  const approveCRF = async (row) => {
    setCrfBusy(row.ID);
    try {
      const result = await api.post('markApprovedCRF', { pointId: row.ID, isMarked: row.ApprovedCRF ? false : true, approvedBy: session.userId || 0 });
      if (!result?.success) throw new Error(result?.message);
      toast.success(result.message);
      await fetchData('refresh');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCrfBusy(null);
    }
  };

  const downloadDocument = async (name) => {
    try {
      const result = await api.postJson('fetchDocument', { id: name }, undefined, { headers: { 'Content-Type': 'application/json-patch+json' } });
      if (!result?.success) throw new Error('Unable to download.');
      await shareBase64File(result.fileBase64, result.fileName || name, result.contentType);
    } catch (e) {
      toast.error(e.message || 'Unable to download.');
    }
  };

  const doExport = async () => {
    if (!filtered.length) return;
    try {
      await exportCsv(
        isNP ? 'NonPrioritized' : 'PrioritizedPoints',
        COLUMNS.map((col) => ({ header: col.label, value: (r) => (col.fmt ? col.fmt(r[col.key]) : r[col.key] ?? '') })),
        filtered,
      );
    } catch (e) {
      toast.error(e.message);
    }
  };

  useHeaderActions([
    { key: 'export', icon: 'download', onPress: doExport },
    { key: 'refresh', icon: 'refresh-cw', onPress: () => fetchData('refresh') },
  ]);

  const activeFilterCount = ['module', 'stakeholder', 'type', 'devLead', 'sortField'].filter((k) => f[k]).length + (f.clients.length ? 1 : 0) + ['blankStory', 'havingStory', 'nonPrioritized'].filter((k) => f[k]).length;
  const setF = (patch) => setFilters((all) => ({ ...all, [activeTab]: { ...all[activeTab], ...patch } }));

  const header = (
    <View style={{ gap: 12, marginBottom: 2 }}>
      <Segmented
        scroll={false}
        value={activeTab}
        onChange={(t) => {
          setActiveTab(t);
          setSelectedIds(new Set());
          setRowSprintMap({});
        }}
        options={[
          { label: 'Non Prioritized', value: 'np', count: np.length, color: c.indigo },
          { label: 'Prioritized', value: 'p', count: p.length, color: c.emerald },
        ]}
      />
      <Card style={{ gap: 12 }}>
        <Select
          label="Product"
          icon="box"
          value={selectedProductId}
          placeholder="Select Product"
          options={[{ label: 'All Products', value: 'all' }, ...products.map((x) => ({ label: x.name, value: String(x.id) }))]}
          onChange={(v) => {
            setSelectedProductId(v);
            setSelectedSprintId('');
          }}
        />
        {isNP && selectedProductId && !isAll && (
          <Select label="Planning Sprint" icon="zap" value={selectedSprintId} placeholder="Select Planning Sprint" options={planningSprints.map((x) => ({ label: x.SprintName, value: String(x.ID) }))} onChange={setSelectedSprintId} />
        )}
        {isNP && isAll && <Text style={s.hint}>Pick a sprint per point below ▾</Text>}
      </Card>
      {!!selectedProductId && (
        <>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search any column…" />
          <Row>
            <FilterButton count={activeFilterCount} onPress={() => (setDraft(f), setFilterOpen(true))} />
            {isNP && (
              <View style={{ marginLeft: 'auto' }}>
                <Checkbox checked={allSelected} onChange={toggleAll} label={`Select all (${selectable.length})`} disabled={!selectable.length} />
              </View>
            )}
          </Row>
          <ActiveFilters
            onClearAll={() => setF(EMPTY_F)}
            items={[
              f.module && { key: 'm', label: `Module: ${f.module}`, onClear: () => setF({ module: '' }) },
              f.clients.length && { key: 'c', label: `Clients: ${f.clients.length}`, onClear: () => setF({ clients: [] }) },
              f.stakeholder && { key: 's', label: `Stakeholder: ${f.stakeholder}`, onClear: () => setF({ stakeholder: '' }) },
              f.devLead && { key: 'd', label: `Dev Lead: ${f.devLead}`, onClear: () => setF({ devLead: '' }) },
              f.type && { key: 't', label: `Type: ${f.type}`, onClear: () => setF({ type: '' }) },
              f.blankStory && { key: 'b', label: 'Blank Story', onClear: () => setF({ blankStory: false }) },
              f.havingStory && { key: 'h', label: 'Having Story', onClear: () => setF({ havingStory: false }) },
              f.nonPrioritized && { key: 'n', label: 'Non Prioritized', onClear: () => setF({ nonPrioritized: false }) },
              f.sortField && { key: 'o', label: `Sort: ${SORTABLE.find((x) => x.value === f.sortField)?.label} ${f.sortDir === 'asc' ? '▲' : '▼'}`, onClear: () => setF({ sortField: '' }) },
            ]}
          />
          <StatStrip
            items={[
              { key: 'total', label: 'Showing', value: filtered.length, color: c.primary },
              ...typeCounts.map(([t, n]) => ({ key: t, label: t, value: n, color: t.toLowerCase() === 'bug' ? c.red : t.toLowerCase() === 'story' ? c.sky : c.slate })),
            ]}
          />
        </>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {loading ? (
        <Loading text="Loading Points…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchData('load')} />
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: (isNP ? 120 : 40) + insets.bottom }}
          data={selectedProductId ? pager.visible : []}
          keyExtractor={(r, i) => `${r.ID}-${i}`}
          ListHeaderComponent={header}
          refreshing={refreshing}
          onRefresh={() => fetchData('refresh')}
          ListEmptyComponent={
            selectedProductId ? <Empty icon="filter" title="No records" subtitle="No records found for the selected filters." /> : <Empty icon="box" title="Select a product" subtitle="Choose a product (or All Products) to load its points." />
          }
          ListFooterComponent={selectedProductId && filtered.length ? <LoadMore pager={pager} /> : null}
          renderItem={({ item: r }) => {
            const done = r.IsSprintAdded === 1;
            const checked = selectedIds.has(r.ID);
            const rowPid = isAll ? getProductIdByName(r.Product) : null;
            return (
              <Card
                onPress={isNP && !done ? () => toggleRow(r.ID) : undefined}
                accent={r.IsHoldPoint ? c.red : r.Type === 'Bug' ? c.rose : c.sky}
                style={[checked && { borderWidth: 1.6, borderColor: c.primary, backgroundColor: c.primarySoft }, done && isNP && { opacity: 0.6 }]}
              >
                <Row gap={10} align="flex-start">
                  {isNP && <Checkbox checked={checked} onChange={() => toggleRow(r.ID)} disabled={done} />}
                  <View style={{ flex: 1 }}>
                    <Row justify="space-between" align="flex-start">
                      <Row gap={6} wrap style={{ flex: 1 }}>
                        <Text style={s.task}>#{r.TaskNumber || r.ID}</Text>
                        {!!r.Story && (
                          <Pressable onPress={() => openUrl(zentaoLink('story', r.Story))} hitSlop={6}>
                            <Text style={s.story}>Story {r.Story}</Text>
                          </Pressable>
                        )}
                      </Row>
                      <Pill label={r.Type || '—'} status={r.Type} />
                    </Row>
                    {r.IsHoldPoint ? (
                      <View style={s.hold}>
                        <Pill label="HOLD" color={c.red} solid />
                        <Text style={[s.title, { color: c.danger, marginTop: 6 }]}>{r.Title || '—'}</Text>
                        <Text style={s.holdMeta}>
                          Hold by {r.HoldBy || '—'} · {fmtDateTime(r.HoldDateTime)}
                          {r.HoldRemarks ? `\n${r.HoldRemarks}` : ''}
                        </Text>
                      </View>
                    ) : (
                      <Text style={s.title}>{r.Title || '—'}</Text>
                    )}
                    <Row gap={6} wrap style={{ marginTop: 8 }}>
                      {!!r.AjwainSprintName && <Pill label={r.AjwainSprintName} color={c.violet} icon="zap" />}
                      {done && <Pill label="Sprint added" color={c.emerald} icon="check" />}
                      {r.Efforts != null && <Pill label={`${r.Efforts} effort`} color={c.amber} icon="clock" />}
                    </Row>
                    <KVGrid style={{ marginTop: 4 }}>
                      <KV label="Product" value={r.Product} />
                      <KV label="Module" value={r.Module} />
                      <KV label="Client" value={r.Client} />
                      <KV label="Stakeholder" value={r.StakeHolderName} />
                      <KV label="Added By" value={r.AddedBy} />
                      <KV label="Added" value={fmtDateTime(r.AddedDateTime)} />
                      <KV label="First BRD" value={r.FirstBRDUploadedDateTime} />
                      <KV label="Dev Lead" value={r.DevLeadName} />
                    </KVGrid>
                    {isNP && isAll && !done && (
                      <View style={{ marginTop: 6 }}>
                        {!rowPid ? (
                          <Text style={{ color: c.danger, fontSize: 12 }}>Unknown product</Text>
                        ) : (
                          <Select
                            label="Sprint"
                            value={rowSprintMap[r.ID] || ''}
                            placeholder="Select sprint"
                            options={planningSprintsFor(rowPid).map((x) => ({ label: x.SprintName, value: String(x.ID) }))}
                            onChange={(v) => setRowSprintMap((m) => ({ ...m, [r.ID]: v }))}
                            error={checked && !rowSprintMap[r.ID] ? 'Sprint required' : null}
                          />
                        )}
                      </View>
                    )}
                    <Row gap={8} style={{ marginTop: 10 }}>
                      <Button
                        size="sm"
                        variant="soft"
                        color={r.ApprovedCRF ? c.emerald : c.slate}
                        icon={r.ApprovedCRF ? 'check-circle' : 'thumbs-up'}
                        title={r.ApprovedCRF ? 'CRF Approved' : 'Approve CRF'}
                        loading={crfBusy === r.ID}
                        onPress={() => approveCRF(r)}
                      />
                      <Button
                        size="sm"
                        variant="soft"
                        icon="folder"
                        title={String((r.UploadedDocuments || []).length)}
                        disabled={!(r.UploadedDocuments || []).length}
                        onPress={() =>
                          setDocs(
                            [...r.UploadedDocuments].sort(
                              (a, b) => new Date(String(b.AddedDateTime || '').split('/').reverse().join('-')) - new Date(String(a.AddedDateTime || '').split('/').reverse().join('-')),
                            ),
                          )
                        }
                      />
                      <Button size="sm" variant="soft" color={c.sky} icon="clock" disabled={!r.LastAssignedDateTime} onPress={() => setHistory(r)} />
                    </Row>
                    {r.ApprovedCRF && !!r.ApprovedCRFBy && (
                      <Text style={s.crf}>
                        CRF approved by {r.ApprovedCRFBy} · {r.ApprovedCRFDateTime}
                      </Text>
                    )}
                  </View>
                </Row>
              </Card>
            );
          }}
        />
      )}

      {isNP && !!selectedProductId && (
        <View style={[s.bar, shadowFor(c, 3), { paddingBottom: 12 + insets.bottom }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.barCount}>{selectedIds.size} selected</Text>
            {selectedIds.size > 0 && (
              <Pressable onPress={() => setSelectedIds(new Set())}>
                <Text style={s.clear}>Clear selection</Text>
              </Pressable>
            )}
          </View>
          <Button title="Mark Prioritized" icon="check" color={c.emerald} disabled={!selectedIds.size} onPress={askPrioritize} />
        </View>
      )}

      <FilterSheet visible={filterOpen} onClose={() => setFilterOpen(false)} onApply={() => setF(draft)} onClear={() => (setDraft(EMPTY_F), setF(EMPTY_F), setFilterOpen(false))}>
        <Select label="Module" value={draft.module} options={opt.module} allLabel="All Modules" onChange={(v) => setDraft((d) => ({ ...d, module: v, clients: [], stakeholder: '' }))} />
        <Select label="Clients" multi value={draft.clients} options={opt.client} placeholder="All Clients" onChange={(v) => setDraft((d) => ({ ...d, clients: v, stakeholder: '' }))} />
        <Select label="Stakeholder" value={draft.stakeholder} options={opt.stakeholder} allLabel="All Stakeholders" onChange={(v) => setDraft((d) => ({ ...d, stakeholder: v }))} />
        <Select label="Dev Team Lead" value={draft.devLead} options={opt.devLead} allLabel="All Dev Team Leads" onChange={(v) => setDraft((d) => ({ ...d, devLead: v }))} />
        <Select label="Type" value={draft.type} options={opt.type} allLabel="All Types" onChange={(v) => setDraft((d) => ({ ...d, type: v }))} />
        <ToggleRow label="Blank Story" value={draft.blankStory} onChange={(v) => setDraft((d) => ({ ...d, blankStory: v }))} />
        <ToggleRow label="Having Story" value={draft.havingStory} onChange={(v) => setDraft((d) => ({ ...d, havingStory: v }))} />
        <ToggleRow label="Non Prioritized (no sprint added)" value={draft.nonPrioritized} onChange={(v) => setDraft((d) => ({ ...d, nonPrioritized: v }))} />
        <Row gap={10}>
          <Select label="Sort by" value={draft.sortField} options={SORTABLE.slice(1)} allLabel="Default order" onChange={(v) => setDraft((d) => ({ ...d, sortField: v }))} style={{ flex: 1.4 }} />
          <Select label="Direction" value={draft.sortDir} options={[{ label: 'Ascending', value: 'asc' }, { label: 'Descending', value: 'desc' }]} clearable={false} onChange={(v) => setDraft((d) => ({ ...d, sortDir: v }))} style={{ flex: 1 }} />
        </Row>
      </FilterSheet>

      <Sheet
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        icon="check-circle"
        accent={c.emerald}
        title="Mark as Prioritized"
        footer={
          <Row gap={10}>
            <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setConfirmOpen(false)} />
            <Button title="Confirm" icon="check" color={c.emerald} style={{ flex: 1.4 }} loading={prioritizing} onPress={markPrioritized} />
          </Row>
        }
      >
        <Text style={{ color: c.text, fontSize: 14 }}>
          Are you sure you want to mark <Text style={{ fontWeight: '900', color: c.success }}>{selectedIds.size}</Text> selected point{selectedIds.size !== 1 ? 's' : ''} as prioritized?
        </Text>
        <Banner type="info" text="These points will move to the Prioritized Points tab." />
      </Sheet>

      <Sheet visible={!!docs} onClose={() => setDocs(null)} icon="folder" title="Uploaded Documents" subtitle={docs ? `${docs.length} document(s)` : ''}>
        {(docs || []).length === 0 ? (
          <Empty icon="file" title="No documents uploaded." />
        ) : (
          (docs || []).map((d, i) => (
            <Pressable key={d.ID ?? i} onPress={() => downloadDocument(d.DocumentName)} style={({ pressed }) => [s.docRow, pressed && { opacity: 0.8 }]}>
              <Feather name="file-text" size={18} color={c.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.docName} numberOfLines={2}>{d.DocumentName}</Text>
                <Text style={s.docMeta}>
                  {d.AddedByName} · {d.AddedDateTime} {d.DocumentType ? `· ${d.DocumentType}` : ''}
                </Text>
              </View>
              <Feather name="download" size={17} color={c.primary} />
            </Pressable>
          ))
        )}
      </Sheet>

      <PointHistorySheet point={history} onClose={() => setHistory(null)} />
    </View>
  );
}

function PointHistorySheet({ point, onClose }) {
  const { c } = useTheme();
  const s = useStyles();
  let audit = [];
  try {
    audit = typeof point?.AuditRecords === 'string' ? JSON.parse(point.AuditRecords) : Array.isArray(point?.AuditRecords) ? point.AuditRecords : [];
  } catch {
    audit = [];
  }
  const current = audit[0];
  return (
    <Sheet visible={!!point} onClose={onClose} icon="clock" title="Point History" subtitle={`${point?.Title || point?.TaskNumber || '-'}${point?.ID ? ` · ID ${point.ID}` : ''}`} size="full">
      <SectionHeader title="Assignment History" icon="users" />
      {audit.length === 0 ? (
        <Text style={s.hint}>No assignment history available</Text>
      ) : (
        audit.map((rec, i) => (
          <View key={rec.ID || i} style={s.timeline}>
            <Avatar name={rec.AssignedToName} size={34} color={hashColor(rec.AssignedToName)} />
            <View style={{ flex: 1 }}>
              <Text style={s.docName}>
                Assigned to <Text style={{ color: c.primary }}>{rec.AssignedToName || '-'}</Text>
              </Text>
              <Text style={s.docMeta}>By {rec.AssignedByName || '-'} · {fmtDateTime(rec.AssignedDateTime)}</Text>
              {!!rec.Remarks && <Text style={s.remark}>{rec.Remarks}</Text>}
              {!!rec.Status && <Pill label={rec.Status} color={c.indigo} style={{ marginTop: 6 }} />}
            </View>
          </View>
        ))
      )}
      {current && (
        <Card flat style={s.infoBox}>
          <KVGrid>
            <KV label="Current Assignee" value={current.AssignedToName} />
            <KV label="Since" value={fmtDateTime(current.AssignedDateTime)} />
          </KVGrid>
        </Card>
      )}
      <SectionHeader title="Sprint History" icon="zap" color={c.sky} />
      <Text style={s.hint}>No sprint history available</Text>
      <SectionHeader title="Creation Information" icon="info" color={c.slate} />
      <Card flat style={s.infoBox}>
        <KVGrid>
          <KV label="Created by" value={point?.AddedBy} />
          <KV label="Created on" value={fmtDateTime(point?.AddedDateTime)} />
        </KVGrid>
      </Card>
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  hint: { color: c.textFaint, fontSize: 12, fontStyle: 'italic' },
  task: { color: c.text, fontWeight: '900', fontSize: 14 },
  story: { color: c.primary, fontWeight: '800', fontSize: 12.5, textDecorationLine: 'underline' },
  title: { color: c.text, fontSize: 13.5, fontWeight: '700', marginTop: 6, lineHeight: 19 },
  hold: { marginTop: 8, padding: 10, borderRadius: 12, backgroundColor: c.dangerSoft, borderLeftWidth: 3, borderLeftColor: c.red },
  holdMeta: { color: c.textMuted, fontSize: 11.5, marginTop: 4 },
  crf: { color: c.success, fontSize: 11, marginTop: 6, fontWeight: '600' },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: c.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: c.dark ? 1 : 0,
    borderColor: c.border,
  },
  barCount: { color: c.text, fontWeight: '900', fontSize: 16 },
  clear: { color: c.primary, fontSize: 12, fontWeight: '700', marginTop: 2 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border },
  docName: { color: c.text, fontWeight: '700', fontSize: 13 },
  docMeta: { color: c.textFaint, fontSize: 11.5, marginTop: 2 },
  timeline: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 14, backgroundColor: c.primarySoft },
  remark: { color: c.text, fontSize: 12.5, marginTop: 6, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: c.primary },
  infoBox: { backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border },
}));
