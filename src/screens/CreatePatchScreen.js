import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { zentaoLink } from '../api/config';
import { useAuth } from '../context/AuthContext';
import { useHeaderActions, useShell } from '../navigation/ShellContext';
import { makeStyles, shadowFor, useTheme } from '../theme/theme';
import { fmtDate, isPatchCreatedToday, toYMD, uniqSorted } from '../utils/format';
import { exportExcel, openUrl } from '../utils/exporter';
import {
  ActiveFilters,
  Banner,
  Button,
  Card,
  Checkbox,
  DateField,
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
  Segmented,
  Select,
  Sheet,
  TextField,
  usePager,
  useToast,
} from '../ui';

/** Port of DeveloperDashboard.jsx (Create Patch / Patch Generation) */

const DEFAULT_TO = toYMD(new Date());
const DEFAULT_FROM = toYMD(new Date(Date.now() - 7 * 86400000));
const ENDPOINT = { SIT: 'patchPoints', Sanity: 'patchPointsSanity', Regression: 'patchPointsRegression' };

const normaliseRows = (json, tab) =>
  (Array.isArray(json) ? json : []).map((r) => (tab === 'SIT' ? r : { ...r, Product1: r.Product ?? r.Product1, Module1: r.Module ?? r.Module1 }));

const getPointProduct = (row) => String(row?.Product1 ?? row?.ProductName ?? row?.Product ?? row?.product ?? '').trim();

export default function CreatePatchScreen() {
  const s = useStyles();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { session } = useAuth();
  const { replace } = useShell();

  const [patchTab, setPatchTab] = useState('SIT');
  const [data, setData] = useState({ SIT: [], Sanity: [], Regression: [] });
  const [loadState, setLoadState] = useState({ SIT: true, Sanity: true, Regression: true });
  const [errors, setErrors] = useState({});
  const [clients, setClients] = useState([]);
  const [allSprints, setAllSprints] = useState([]);
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [selected, setSelected] = useState([]);
  const [creating, setCreating] = useState(false);
  const [pointIdSearch, setPointIdSearch] = useState('');
  const [patchCreationMap, setPatchCreationMap] = useState({});

  const [dateFrom, setDateFrom] = useState(DEFAULT_FROM);
  const [dateTo, setDateTo] = useState(DEFAULT_TO);
  const [productFilter, setProductFilter] = useState('');
  const [draft, setDraft] = useState({ module: [], client: '', type: [] });
  const [applied, setApplied] = useState({ module: [], client: '', product: '', type: [] });
  const [filterOpen, setFilterOpen] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [manualType, setManualType] = useState('Bug');
  const [manualPointId, setManualPointId] = useState('');
  const [manualFetching, setManualFetching] = useState(false);
  const [excelUploading, setExcelUploading] = useState(false);
  const [mismatch, setMismatch] = useState(null); // { queue, index, bulk }

  const rows = data[patchTab];

  const fetchTab = async (tab, from, to) => {
    setLoadState((p) => ({ ...p, [tab]: true }));
    setErrors((p) => ({ ...p, [tab]: null }));
    try {
      const json = await api.get(ENDPOINT[tab], { fromDate: from, toDate: to });
      setData((p) => ({ ...p, [tab]: normaliseRows(json, tab) }));
    } catch (e) {
      setErrors((p) => ({ ...p, [tab]: e.message }));
    } finally {
      setLoadState((p) => ({ ...p, [tab]: false }));
    }
  };
  const fetchAllTabs = (from, to) => ['SIT', 'Sanity', 'Regression'].forEach((t) => fetchTab(t, from, to));

  useEffect(() => {
    fetchAllTabs(DEFAULT_FROM, DEFAULT_TO);
    api
      .get('getPatchList')
      .then((d) => {
        if (!d?.success || !Array.isArray(d.data)) return;
        const map = {};
        d.data.forEach((p) => (p.PatchDetails || []).forEach((det) => det.PointId && (map[det.PointId] = p.PatchCreationDateTime)));
        setPatchCreationMap(map);
      })
      .catch(() => {});
    api
      .get('getProduct')
      .then((d) => setAllSprints(Array.isArray(d?.Sprint) ? d.Sprint : []))
      .catch(() => {});
    api
      .get('clientFilter')
      .then((d) => setClients(Array.isArray(d) ? d : []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moduleOptions = useMemo(() => uniqSorted(rows.map((r) => r.Module1)), [rows]);
  const productOptions = useMemo(() => uniqSorted(rows.map((r) => r.Product1)), [rows]);
  const openSprints = useMemo(() => allSprints.filter((sp) => sp.IsClosed === false && (!productFilter || sp.ProductName === productFilter)), [allSprints, productFilter]);

  const isAllowed = (row, sprint = selectedSprint) => {
    if (!sprint) return false;
    const sp = String(sprint.ProductName || '').trim();
    const pp = getPointProduct(row);
    return sp !== '' && pp !== '' && sp.toLowerCase() === pp.toLowerCase();
  };
  const mismatchMsg = (row) =>
    `Point ${row?.id} cannot be selected. Point product "${getPointProduct(row) || 'Unknown'}" does not match Sprint product "${String(selectedSprint?.ProductName || '').trim() || 'Unknown'}".`;

  const getDefaultProduct = (opts) => (opts.includes('HISTree') ? 'HISTree' : opts[0] || '');
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (!productOptions.length) {
      autoSelectedRef.current = false;
      return;
    }
    if (autoSelectedRef.current) return;
    autoSelectedRef.current = true;
    const def = getDefaultProduct(productOptions);
    setProductFilter(def);
    setApplied((p) => ({ ...p, product: def }));
  }, [productOptions]);

  useEffect(() => {
    if (!openSprints.length) return;
    const stillValid = selectedSprint && openSprints.some((sp) => sp.ID === selectedSprint.ID);
    if (!stillValid) setSelectedSprint(openSprints[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSprints]);

  useEffect(() => {
    if (!selectedSprint) return;
    setSelected((prev) => {
      const invalid = new Set(rows.filter((r) => !isAllowed(r)).map((r) => r.id));
      if (!invalid.size) return prev;
      const next = prev.filter((id) => !invalid.has(id));
      if (next.length !== prev.length) toast.warning(`${prev.length - next.length} selected point(s) were removed because their Product does not match Sprint Product "${selectedSprint.ProductName}".`);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSprint, patchTab, rows]);

  const filtered = useMemo(() => {
    const list = rows.filter((r) => {
      if (selected.includes(r.id)) return true;
      if (applied.product && r.Product1 !== applied.product) return false;
      if (applied.module.length && !applied.module.includes(r.Module1)) return false;
      if (applied.client && r.ClientId !== applied.client) return false;
      if (applied.type.length && !applied.type.includes(r.Type || '')) return false;
      if (pointIdSearch.trim() && !String(r.id).toLowerCase().includes(pointIdSearch.trim().toLowerCase())) return false;
      return true;
    });
    const today = list.filter((r) => isPatchCreatedToday(patchCreationMap[r.id]));
    const regular = list.filter((r) => !isPatchCreatedToday(patchCreationMap[r.id]));
    return [...regular, ...today];
  }, [rows, applied, pointIdSearch, selected, patchCreationMap]);

  const pager = usePager(filtered, 30, `${patchTab}|${JSON.stringify(applied)}|${pointIdSearch}`);
  const selectable = useMemo(() => filtered.filter((r) => isAllowed(r)), [filtered, selectedSprint]); // eslint-disable-line
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.includes(r.id));

  const toggleRow = (row) => {
    if (!selectedSprint) return toast.warning('Please select a Sprint before selecting a point.');
    if (!isAllowed(row)) return toast.warning(mismatchMsg(row));
    setSelected((p) => (p.includes(row.id) ? p.filter((x) => x !== row.id) : [...p, row.id]));
  };
  const toggleAll = () => {
    if (!selectedSprint) return toast.warning('Please select a Sprint before selecting points.');
    const ids = selectable.map((r) => r.id);
    if (!ids.length) return toast.warning(`No points match Sprint product "${selectedSprint.ProductName}".`);
    if (allSelected) setSelected((p) => p.filter((id) => !ids.includes(id)));
    else setSelected((p) => [...new Set([...p, ...ids])]);
  };

  const applyFilters = () => {
    fetchAllTabs(dateFrom, dateTo);
    setApplied({ ...draft, product: productFilter });
    setSelected([]);
  };
  const clearFilters = () => {
    setDateFrom(DEFAULT_FROM);
    setDateTo(DEFAULT_TO);
    const empty = { module: [], client: '', type: [] };
    setDraft(empty);
    const def = getDefaultProduct(productOptions);
    setProductFilter(def);
    setApplied({ ...empty, product: def });
    setPointIdSearch('');
    fetchAllTabs(DEFAULT_FROM, DEFAULT_TO);
    setSelected([]);
    setSelectedSprint(null);
    setFilterOpen(false);
  };

  const changeProduct = (p) => {
    setProductFilter(p);
    setSelectedSprint(null);
    setSelected([]);
    setDraft((d) => ({ ...d, module: [] }));
    setApplied((prev) => ({ ...prev, product: p, module: [] }));
  };

  const changeSprint = (id) => {
    const sprint = openSprints.find((sp) => String(sp.ID) === String(id));
    if (!sprint) {
      setSelectedSprint(null);
      setSelected([]);
      return;
    }
    setSelectedSprint(sprint);
    const sprintProduct = String(sprint.ProductName || '').trim().toLowerCase();
    setSelected((prev) => {
      const next = prev.filter((pid) => {
        const row = rows.find((r) => String(r.id) === String(pid));
        return row && sprintProduct !== '' && getPointProduct(row).toLowerCase() === sprintProduct;
      });
      if (prev.length - next.length > 0) toast.warning(`${prev.length - next.length} selected point(s) were removed because their Product does not match Sprint Product "${sprint.ProductName}".`);
      return next;
    });
  };

  const switchTab = (t) => {
    setPatchTab(t);
    setSelected([]);
    autoSelectedRef.current = false;
    setSelectedSprint(null);
  };

  const createPatch = async () => {
    const type = patchTab;
    if (!selected.length) return toast.warning('Select at least one point to create a patch.');
    if (!selectedSprint) return toast.warning('Please select a sprint before creating a patch.');
    const selRows = rows.filter((r) => selected.includes(r.id));
    const bad = selRows.filter((r) => !isAllowed(r));
    if (bad.length) {
      setSelected((p) => p.filter((id) => !bad.some((r) => r.id === id)));
      return toast.error(`Patch creation blocked. ${bad.length} selected point(s) belong to a different Product than Sprint Product "${selectedSprint.ProductName}".`);
    }
    if (!selRows.length) {
      setSelected([]);
      return toast.warning('No valid points remain selected for the current Sprint.');
    }
    setCreating(true);
    try {
      const payload = {
        PatchType: type,
        PatchCreationBy: session.loginName || '',
        SprintId: selectedSprint.ID,
        SprintName: selectedSprint.SprintName,
        Points: selRows.map((r) => ({
          PointID: r.id,
          PointType: r.Type || 'Bug',
          Product: r.Product1 || '',
          Client: r.ClientName || '',
          Module: r.Module1 || '',
          Title: r.title || '',
          Openedby: r.openedBy || '',
          OpenedDate: r.openedDate || new Date().toISOString(),
          AssignedBy: r.assignedBy || '',
          AssignedTo: r.assignedTo || '',
          AssignedDate: r.assignedDate || new Date().toISOString(),
        })),
      };
      const res = await api.postJson('createPatch', payload);
      const row0 = Array.isArray(res) ? res[0] : res;
      if (row0?.STATUS === 1) {
        toast.success(`${type} Patch Created · ${row0.PatchId} · ${selRows.length} point(s)`);
        setSelected([]);
        setTimeout(() => replace('viewPatch'), 1500);
      } else toast.error(row0?.MESSAGE || 'Failed to create patch.');
    } catch (e) {
      toast.error(e.message || 'Network error. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const setRowsFor = (fn) => setData((p) => ({ ...p, [patchTab]: fn(p[patchTab]) }));
  const resetSecondaryFilters = () => {
    setApplied((p) => ({ ...p, module: [], client: '', type: [] }));
    setDraft({ module: [], client: '', type: [] });
  };

  const addPointToGrid = (n, id) => {
    if (!selectedSprint) {
      toast.warning('Please select a Sprint before adding a point.');
      return false;
    }
    if (!isAllowed(n)) {
      toast.error(mismatchMsg(n));
      return false;
    }
    setRowsFor((prev) => [n, ...prev]);
    setSelected((p) => [...new Set([...p, id])]);
    setPointIdSearch('');
    resetSecondaryFilters();
    toast.success(`Point ${id} added and selected.`);
    return true;
  };

  const fetchPoint = async (pid, type) => {
    const json = await api.get('getPointDetails', { pointId: pid, type: String(type).toLowerCase() });
    const raw = Array.isArray(json) ? json[0] : json;
    if (!raw || !(raw.id ?? raw.Id ?? raw.ID)) throw new Error('Point not found.');
    const id = raw.id ?? raw.Id ?? raw.ID;
    return { ...raw, id, Product1: raw.ProductName ?? raw.product ?? '', Module1: raw.ModuleName ?? raw.module ?? '' };
  };

  const addManualPoint = async () => {
    const pid = manualPointId.trim();
    if (!pid) return toast.warning('Enter a Point ID.');
    if (!selectedSprint) return toast.warning('Please select a Sprint before adding a point.');
    const existing = rows.find((r) => String(r.id) === pid);
    if (existing) {
      if (!isAllowed(existing)) return toast.error(mismatchMsg(existing));
      if (applied.product && existing.Product1 && existing.Product1 !== applied.product) {
        setMismatch({ queue: [existing], index: 0, bulk: false });
        return;
      }
      resetSecondaryFilters();
      setSelected((p) => [...new Set([...p, existing.id])]);
      toast.info(`Point ${pid} is already in the list — filters cleared to reveal it.`);
      setAddOpen(false);
      return;
    }
    setManualFetching(true);
    try {
      const n = await fetchPoint(pid, manualType);
      if (!isAllowed(n)) return toast.error(mismatchMsg(n));
      if (applied.product && n.Product1 && n.Product1 !== applied.product) {
        setMismatch({ queue: [n], index: 0, bulk: false });
        return;
      }
      setRowsFor((prev) => [n, ...prev]);
      setSelected((p) => [...new Set([...p, n.id])]);
      setPointIdSearch('');
      resetSecondaryFilters();
      setManualPointId('');
      setAddOpen(false);
      toast.success(`Point ${n.id} added and selected.`);
    } catch (e) {
      toast.error(e.message || 'Failed to fetch point details.');
    } finally {
      setManualFetching(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      await exportExcel('PatchPoints_Template', {
        name: 'Points',
        rows: [{ PointId: '', PointType: 'Bug' }, { PointId: '', PointType: 'Story' }],
        columns: [
          { header: 'PointId', key: 'PointId', width: 16 },
          { header: 'PointType', key: 'PointType', width: 14 },
        ],
      });
      toast.info('Template ready. Fill in PointId and PointType columns, then upload.');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const uploadExcel = async () => {
    if (!selectedSprint) return toast.warning('Please select a Sprint before uploading points.');
    const pick = await DocumentPicker.getDocumentAsync({
      type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', '*/*'],
      copyToCacheDirectory: true,
    });
    if (pick.canceled || !pick.assets?.[0]) return;
    setExcelUploading(true);
    try {
      const b64 = await FileSystem.readAsStringAsync(pick.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
      const wb = XLSX.read(b64, { type: 'base64' });
      const rawData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      if (!rawData.length) return toast.warning('The uploaded file is empty.');
      if (!('PointId' in rawData[0]) || !('PointType' in rawData[0])) return toast.error('Invalid template. Please use the template with "PointId" and "PointType" columns.');
      const valid = rawData.filter((r) => String(r.PointId).trim() !== '');
      if (!valid.length) return toast.warning('No Point IDs found in the uploaded file.');
      toast.info(`Processing ${valid.length} point(s) from Excel…`);

      const autoSel = [];
      const toFetch = [];
      const mism = [];
      let blocked = 0;
      for (const r of valid) {
        const pid = String(r.PointId).trim();
        const ptype = String(r.PointType || 'Bug').trim();
        const ex = rows.find((x) => String(x.id) === pid);
        if (ex) {
          if (!isAllowed(ex)) {
            blocked++;
            continue;
          }
          if (applied.product && ex.Product1 && ex.Product1 !== applied.product) mism.push(ex);
          else autoSel.push(ex.id);
        } else toFetch.push({ pid, ptype });
      }
      if (autoSel.length) {
        setSelected((p) => [...new Set([...p, ...autoSel])]);
        resetSecondaryFilters();
      }
      const ok = [];
      const notFound = [];
      for (const { pid, ptype } of toFetch) {
        try {
          const n = await fetchPoint(pid, ptype);
          if (!isAllowed(n)) {
            blocked++;
            continue;
          }
          if (applied.product && n.Product1 && n.Product1 !== applied.product) mism.push(n);
          else ok.push(n);
        } catch {
          notFound.push(pid);
        }
      }
      if (ok.length) {
        setRowsFor((prev) => [...ok, ...prev]);
        setSelected((p) => [...new Set([...p, ...ok.map((r) => r.id)])]);
        resetSecondaryFilters();
      }
      const total = autoSel.length + ok.length;
      if (total) toast.success(`${total} point(s) selected from Excel.`);
      if (notFound.length) setTimeout(() => toast.warning(`${notFound.length} point(s) not found: ${notFound.join(', ')}`), 1200);
      if (blocked) setTimeout(() => toast.error(`${blocked} point(s) were not added because their Product does not match Sprint Product "${selectedSprint.ProductName}".`), 2400);
      if (mism.length) setMismatch({ queue: mism, index: 0, bulk: true });
      setAddOpen(false);
    } catch (e) {
      toast.error('Failed to read Excel file. Please ensure it is a valid .xlsx file.');
    } finally {
      setExcelUploading(false);
    }
  };

  const pending = mismatch ? mismatch.queue[mismatch.index] : null;
  const nextMismatch = () => setMismatch((m) => (m && m.index + 1 < m.queue.length ? { ...m, index: m.index + 1 } : null));
  const mismatchContinue = () => {
    if (!pending) return;
    if (!rows.some((r) => String(r.id) === String(pending.id))) addPointToGrid(pending, pending.id);
    else {
      setSelected((p) => [...new Set([...p, pending.id])]);
      toast.info(`Point ${pending.id} selected.`);
    }
    if (mismatch.bulk) nextMismatch();
    else {
      setMismatch(null);
      setAddOpen(false);
    }
  };
  const mismatchCancel = () => {
    if (mismatch.bulk) {
      toast.info(`Skipped point ${pending?.id} due to product mismatch.`);
      nextMismatch();
    } else setMismatch(null);
  };

  useHeaderActions([
    { key: 'add', icon: 'plus-circle', onPress: () => setAddOpen(true) },
    { key: 'refresh', icon: 'refresh-cw', onPress: () => fetchAllTabs(dateFrom, dateTo) },
  ]);

  const isLoading = loadState[patchTab];
  const currentError = errors[patchTab];
  const activeFilterCount = (dateFrom !== DEFAULT_FROM || dateTo !== DEFAULT_TO ? 1 : 0) + (applied.module.length ? 1 : 0) + (applied.client ? 1 : 0) + (applied.type.length ? 1 : 0);
  const clientLabel = clients.find((x) => x.key === applied.client)?.value;

  const header = (
    <View style={{ gap: 12, marginBottom: 2 }}>
      <Segmented
        scroll={false}
        value={patchTab}
        onChange={switchTab}
        options={[
          { label: 'SIT Patch', value: 'SIT', icon: 'package', color: c.sky },
          { label: 'Sanity Patch', value: 'Sanity', icon: 'refresh-cw', color: c.emerald },
        ]}
      />
      <Card style={{ gap: 12 }}>
        <Select label="Product" icon="box" value={productFilter} options={productOptions} onChange={changeProduct} clearable={false} placeholder="Select product" />
        <Select
          label="Sprint"
          icon="zap"
          value={selectedSprint ? String(selectedSprint.ID) : ''}
          options={openSprints.map((sp) => ({ value: String(sp.ID), label: `${sp.SprintName}${sp.Version ? ` (${sp.Version})` : ''}`, sub: sp.ProductName }))}
          onChange={changeSprint}
          placeholder="— Select Sprint —"
          error={!selectedSprint ? 'Select a sprint to enable point selection' : null}
        />
      </Card>
      <SearchBar value={pointIdSearch} onChangeText={setPointIdSearch} placeholder="Search by Point ID…" />
      <Row>
        <FilterButton count={activeFilterCount} onPress={() => setFilterOpen(true)} />
        <View style={{ marginLeft: 'auto' }}>
          <Checkbox checked={allSelected} onChange={toggleAll} label={`Select all (${selectable.length})`} disabled={!selectedSprint || !selectable.length} />
        </View>
      </Row>
      <ActiveFilters
        items={[
          (dateFrom !== DEFAULT_FROM || dateTo !== DEFAULT_TO) && { key: 'date', label: `${fmtDate(dateFrom)} → ${fmtDate(dateTo)}`, onClear: () => (setDateFrom(DEFAULT_FROM), setDateTo(DEFAULT_TO), fetchAllTabs(DEFAULT_FROM, DEFAULT_TO)) },
          applied.type.length && { key: 'type', label: `Type: ${applied.type.join(', ')}`, onClear: () => setApplied((a) => ({ ...a, type: [] })) },
          applied.module.length && { key: 'module', label: `Modules: ${applied.module.length}`, onClear: () => setApplied((a) => ({ ...a, module: [] })) },
          applied.client && { key: 'client', label: `Client: ${clientLabel || applied.client}`, onClear: () => setApplied((a) => ({ ...a, client: '' })) },
        ]}
      />
      <Row gap={6}>
        <View style={[s.legendDot, { backgroundColor: c.red }]} />
        <View style={[s.legendDot, { backgroundColor: c.cyan }]} />
        <Text style={s.legend}>Points already in a patch created today are shown last with a coloured edge.</Text>
      </Row>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {isLoading && !rows.length ? (
        <Loading text="Loading Points…" />
      ) : currentError ? (
        <ErrorState message={currentError} onRetry={() => fetchTab(patchTab, dateFrom, dateTo)} />
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 130 + insets.bottom }}
          data={pager.visible}
          keyExtractor={(r, i) => `${r.id}-${i}`}
          ListHeaderComponent={header}
          refreshing={isLoading}
          onRefresh={() => fetchTab(patchTab, dateFrom, dateTo)}
          ListEmptyComponent={<Empty icon="package" title="No points" subtitle="No points match the current filters." />}
          ListFooterComponent={filtered.length ? <LoadMore pager={pager} /> : null}
          renderItem={({ item: r }) => {
            const isSel = selected.includes(r.id);
            const bad = !isAllowed(r);
            const today = isPatchCreatedToday(patchCreationMap[r.id]);
            const accent = today && (r.Type === 'Bug' || r.Type === 'Story') ? (r.Type === 'Bug' ? c.red : c.cyan) : undefined;
            return (
              <Card
                onPress={() => (bad ? toast.warning(selectedSprint ? mismatchMsg(r) : 'Please select a Sprint before selecting a point.') : toggleRow(r))}
                accent={accent}
                style={[isSel && { borderWidth: 1.6, borderColor: c.primary, backgroundColor: c.primarySoft }, bad && { opacity: 0.5 }]}
              >
                <Row gap={10} align="flex-start">
                  <Checkbox checked={isSel} onChange={() => toggleRow(r)} disabled={bad} />
                  <View style={{ flex: 1 }}>
                    <Row justify="space-between">
                      <Pressable onPress={() => openUrl(zentaoLink(r.Type === 'Story' ? 'story' : 'bug', r.id))} hitSlop={6}>
                        <Text style={s.id}>#{r.id}</Text>
                      </Pressable>
                      <Pill label={(r.Type || '—').toUpperCase()} status={r.Type} solid />
                    </Row>
                    <Text style={s.title}>{r.title || '—'}</Text>
                    <KVGrid style={{ marginTop: 4 }}>
                      <KV label="Product" value={r.Product1} />
                      <KV label="Client" value={r.ClientName} />
                      <KV label="Module" value={r.Module1} />
                      <KV label="Opened By" value={r.openedBy} />
                      <KV label="Opened" value={fmtDate(r.openedDate)} />
                      <KV label="Assigned By" value={r.assignedBy} />
                      <KV label="Assigned To" value={r.assignedTo} />
                      <KV label="Assigned" value={fmtDate(r.assignedDate)} />
                    </KVGrid>
                    {today && <Pill label="In a patch created today" icon="clock" color={accent || c.primary} style={{ marginTop: 6 }} />}
                  </View>
                </Row>
              </Card>
            );
          }}
        />
      )}

      {/* Sticky selection bar */}
      <View style={[s.bar, shadowFor(c, 3), { paddingBottom: 12 + insets.bottom }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.barCount}>{selected.length} selected</Text>
          <Text style={s.barSub} numberOfLines={1}>
            {selectedSprint ? `${selectedSprint.SprintName} · ${selectedSprint.ProductName}` : 'No sprint selected'}
          </Text>
        </View>
        <Button
          title={`Create ${patchTab} Patch`}
          icon={patchTab === 'SIT' ? 'plus' : 'refresh-cw'}
          color={patchTab === 'SIT' ? c.sky : c.emerald}
          loading={creating}
          disabled={!selected.length}
          onPress={createPatch}
        />
      </View>

      <FilterSheet visible={filterOpen} onClose={() => setFilterOpen(false)} onApply={applyFilters} onClear={clearFilters}>
        <Row gap={10}>
          <DateField label="From" value={dateFrom} onChange={(v) => setDateFrom(v || DEFAULT_FROM)} style={{ flex: 1 }} clearable={false} />
          <DateField label="To" value={dateTo} onChange={(v) => setDateTo(v || DEFAULT_TO)} style={{ flex: 1 }} clearable={false} />
        </Row>
        <Select label="Type" multi value={draft.type} options={['Bug', 'Story']} placeholder="All Types" onChange={(v) => setDraft((d) => ({ ...d, type: v }))} />
        <Select label="Module" multi value={draft.module} options={moduleOptions} placeholder="All Modules" onChange={(v) => setDraft((d) => ({ ...d, module: v }))} />
        <Select
          label="Client"
          value={draft.client}
          options={clients.map((x) => ({ value: x.key, label: x.value }))}
          placeholder="All Clients"
          searchable
          onChange={(v) => setDraft((d) => ({ ...d, client: v }))}
        />
      </FilterSheet>

      <Sheet visible={addOpen} onClose={() => setAddOpen(false)} title="Add Points" subtitle="Add a point manually or bulk-select from Excel" icon="plus-circle" accent={c.violet}>
        {!selectedSprint && <Banner type="warning" text="Select a Sprint first — points must match the Sprint product." />}
        <Text style={s.lbl}>Add point manually</Text>
        <Segmented scroll={false} value={manualType} onChange={setManualType} options={[{ label: 'Bug', value: 'Bug', color: c.red }, { label: 'Story', value: 'Story', color: c.sky }]} />
        <TextField label="Point ID" value={manualPointId} onChangeText={setManualPointId} keyboardType="number-pad" placeholder="Point ID…" onSubmitEditing={addManualPoint} />
        <Button title="Add Point" icon="plus-circle" color={c.violet} loading={manualFetching} disabled={!manualPointId.trim()} onPress={addManualPoint} />
        <View style={s.divider} />
        <Text style={s.lbl}>Bulk select from Excel</Text>
        <Row gap={10}>
          <Button title="Template" icon="download" variant="outline" color={c.emerald} style={{ flex: 1 }} onPress={downloadTemplate} />
          <Button title="Upload" icon="upload" color={c.teal} style={{ flex: 1 }} loading={excelUploading} onPress={uploadExcel} />
        </Row>
      </Sheet>

      <Sheet
        visible={!!pending}
        onClose={mismatchCancel}
        icon="alert-triangle"
        accent={c.amber}
        title={`Product Mismatch${mismatch?.bulk && mismatch.queue.length > 1 ? ` (${mismatch.index + 1} of ${mismatch.queue.length})` : ''}`}
        footer={
          <Row gap={10}>
            <Button title={mismatch?.bulk ? 'Skip' : 'Cancel'} variant="secondary" style={{ flex: 1 }} onPress={mismatchCancel} />
            <Button title="Continue" color={c.amber} style={{ flex: 1.4 }} onPress={mismatchContinue} />
          </Row>
        }
      >
        <KVGrid>
          <KV label="Current Product" value={applied.product} />
          <KV label="Point Product" value={pending?.Product1} />
        </KVGrid>
        <Text style={{ color: c.text, fontSize: 13.5 }}>Point {pending?.id} belongs to a different product. Do you want to add it anyway?</Text>
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  id: { color: c.primary, fontWeight: '900', fontSize: 14, textDecorationLine: 'underline' },
  title: { color: c.text, fontSize: 13.5, fontWeight: '700', marginTop: 6, lineHeight: 19 },
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
  barSub: { color: c.textMuted, fontSize: 11.5, marginTop: 1 },
  legend: { color: c.textFaint, fontSize: 11, flex: 1 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  lbl: { fontSize: 11.5, fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: c.border, marginVertical: 4 },
}));
