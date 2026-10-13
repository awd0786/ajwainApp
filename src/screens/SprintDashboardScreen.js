import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '../api/client';
import { rowsOf } from '../api/authFetch';
import { zentaoLink } from '../api/config';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';
import { useHeaderActions, useShell } from '../navigation/ShellContext';
import { blend, hashColor, makeStyles, toneOf, useTheme } from '../theme/theme';
import {
  fmtDateTime,
  fmtExpectedDeliveryDate,
  getAgeing,
  getPriorityStatus,
  getTargetDateStatus,
  isPatchCreatedToday,
  parseProductIds,
  rowProductId,
} from '../utils/format';
import { exportExcel, openUrl } from '../utils/exporter';
import {
  ActionList,
  ActiveFilters,
  Avatar,
  Button,
  Card,
  Checkbox,
  Chip,
  DateField,
  Empty,
  ErrorState,
  FilterButton,
  FilterSheet,
  Hero,
  HeroStat,
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
  StatStrip,
  confirmAsync,
  usePager,
  useToast,
} from '../ui';
import MarkCriticalSheet, { MarkCriticalButton } from '../components/MarkCriticalSheet';
import { AddPointSheet, BreakdownSheet, PointHistorySheet, SprintChangeSheet, statusColor } from '../components/SprintSheets';

/**
 * Port of SprintDashboard.jsx (page key 'sprint').
 * Same endpoints, same filters/auto-select rules, same role + PermissionAPI gates.
 * Web right-click context menu  ->  tap a card (action sheet).
 * Web row checkboxes            ->  long-press a card (bulk sprint change).
 */

const COLUMNS = [
  { key: 'Id', label: 'ID', fmt: (v) => v },
  { key: 'ProductName', label: 'Product', fmt: (v) => v || '-' },
  { key: 'ClientName', label: 'Client', fmt: (v) => v || '-' },
  { key: 'ModuleName', label: 'Module', fmt: (v) => v || '-' },
  { key: 'Sprint', label: 'Sprint', fmt: (v) => v || '-' },
  { key: 'Type', label: 'Type', fmt: (v) => v || '-' },
  { key: 'CurrentStatus', label: 'Status', fmt: (v, row) => getPriorityStatus(row) || '-' },
  { key: 'Title', label: 'Title', fmt: (v) => v || '-' },
  { key: 'IterationCount', label: 'Iteration', fmt: (v) => v ?? '-' },
  { key: 'DevEfforts', label: 'Dev Hours', fmt: (v) => v ?? '-' },
  { key: 'TargetDate', label: 'Target Date' },
  { key: 'AssignedTo', label: 'Current Assigned', fmt: (v) => v || '-' },
  { key: 'AssignedDate', label: 'Current Assigned Date', fmt: (v) => fmtDateTime(v, '-') },
  { key: 'OpenedBy', label: 'Opened By', fmt: (v) => v || '-' },
  { key: 'OpenedDate', label: 'Opened Date', fmt: (v) => fmtDateTime(v, '-') },
  { key: 'FirstDevAssignedName', label: 'First Dev', fmt: (v) => v || '-' },
  { key: 'FirstDevAssignedDateTime', label: 'First Dev Date', fmt: (v) => fmtDateTime(v, '-') },
  { key: 'FirstQAAssignedName', label: 'First QA', fmt: (v) => v || '-' },
  { key: 'FirstQAAssignedDateTime', label: 'First QA Date', fmt: (v) => fmtDateTime(v, '-') },
  { key: 'DevTeamLead', label: 'Dev Team Lead', fmt: (v) => v || '-' },
  { key: 'TestingLead', label: 'Testing Lead', fmt: (v) => v || '-' },
  { key: 'AddedDateTime', label: 'Sprint Added', fmt: (v) => fmtDateTime(v, '-') },
  { key: 'Ageing', label: 'Ageing', fmt: (v, row) => getAgeing(row.AddedDateTime, getPriorityStatus(row)) },
];

const SORT_OPTIONS = [
  { value: '', label: 'Default order' },
  { value: 'AssignedDate|asc', label: 'Assigned Date ↑' },
  { value: 'AssignedDate|desc', label: 'Assigned Date ↓' },
  { value: 'TargetDate|asc', label: 'Target Date ↑' },
  { value: 'TargetDate|desc', label: 'Target Date ↓' },
  { value: 'AddedDateTime|asc', label: 'Sprint Added ↑' },
  { value: 'AddedDateTime|desc', label: 'Sprint Added ↓' },
  { value: 'IterationCount|asc', label: 'Iteration ↑' },
  { value: 'IterationCount|desc', label: 'Iteration ↓' },
];

const isCriticalRow = (r) =>
  r.IsCriticalPoint === true || r.IsCriticalPoint === 1 || String(r.IsCriticalPoint).toLowerCase() === 'true' || String(r.IsCriticalPoint) === '1';
const hasValue = (v) => v !== null && v !== undefined && String(v).trim() !== '';

async function loadGroups() {
  const [g, m] = await Promise.all([api.get('getProductGroup').catch(() => ({})), api.get('getProductGroupMapping').catch(() => ({}))]);
  const groupList = Array.isArray(g?.data) ? g.data : Array.isArray(g?.Data) ? g.Data : [];
  const mappingList = Array.isArray(m?.data) ? m.data : Array.isArray(m?.Data) ? m.Data : [];
  const productsByGroup = new Map();
  mappingList.forEach((x) => {
    const id = String(x.groupId ?? x.GroupId ?? '');
    if (!id) return;
    const ids = parseProductIds(x.products ?? x.Products);
    productsByGroup.set(id, [...new Set([...(productsByGroup.get(id) || []), ...ids.map(String)])]);
  });
  const mapped = groupList
    .map((x) => {
      const id = String(x.id ?? x.ID ?? x.Id ?? '');
      return { id, name: x.name ?? x.Name ?? x.NAME ?? '', productIds: productsByGroup.get(id) || [] };
    })
    .filter((x) => x.id);
  mappingList.forEach((x) => {
    const id = String(x.groupId ?? x.GroupId ?? '');
    if (!id || mapped.some((y) => y.id === id)) return;
    mapped.push({ id, name: x.groupName ?? x.GroupName ?? `Group #${id}`, productIds: parseProductIds(x.products ?? x.Products).map(String) });
  });
  return mapped;
}

export default function SprintDashboardScreen() {
  const s = useStyles();
  const { c, dark } = useTheme();
  const toast = useToast();
  const { session } = useAuth();
  const perms = usePermissions();
  const { canAddPoint, canChangeSprint, canPointDrop, canSaveTargetDate, canEditDevEfforts, isDevTeamLead, canMarkCritical: showMarkCritical } = perms;
  const isTestingLead = session.role === 'Testing Lead';

  /* ---------------- data ---------------- */
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [openSprints, setOpenSprints] = useState([]);
  const [devLeadMapping, setDevLeadMapping] = useState([]);
  const [testingLeadMapping, setTestingLeadMapping] = useState([]);
  const [patchCreationMap, setPatchCreationMap] = useState({});
  const [productGroups, setProductGroups] = useState([]);

  const fetchData = useCallback(async (mode = 'load') => {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const json = await api.get('sprintData');
      if (!json?.success) throw new Error(json?.message || 'Failed to load sprint data');
      setAllData(json.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchMeta = useCallback(async () => {
    const tasks = [
      api
        .get('getProduct')
        .then((d) => setOpenSprints(Array.isArray(d?.Sprint) ? d.Sprint.filter((x) => x.IsClosed === false) : []))
        .catch(() => {}),
      api
        .get('teamLeadModuleMapping')
        .then((d) => setDevLeadMapping(Array.isArray(d) ? d : rowsOf(d)))
        .catch(() => setDevLeadMapping([])),
      api
        .get('testingLeadModuleMapping')
        .then((d) => setTestingLeadMapping(Array.isArray(d) ? d : rowsOf(d)))
        .catch(() => setTestingLeadMapping([])),
      api
        .get('getPatchList')
        .then((d) => {
          const map = {};
          if (d?.success) {
            (d.data || []).forEach((p) =>
              (p.PatchDetails || []).forEach((det) => {
                const id = String(det.PointId);
                if (!map[id] || new Date(p.PatchCreationDateTime) > new Date(map[id])) map[id] = p.PatchCreationDateTime;
              }),
            );
          }
          setPatchCreationMap(map);
        })
        .catch(() => {}),
      loadGroups()
        .then(setProductGroups)
        .catch(() => setProductGroups([])),
    ];
    await Promise.all(tasks);
  }, []);

  useEffect(() => {
    fetchData();
    fetchMeta();
  }, [fetchData, fetchMeta]);

  const devLeadByModule = useMemo(() => {
    const m = new Map();
    devLeadMapping.forEach((x) => {
      const k = String(x.ModuleId);
      if (!m.has(k)) m.set(k, x.TeamLeadLoginName);
    });
    return m;
  }, [devLeadMapping]);
  const testingLeadByModule = useMemo(() => {
    const m = new Map();
    testingLeadMapping.forEach((x) => {
      const k = String(x.ModuleId);
      if (!m.has(k)) m.set(k, x.TestingLeadName);
    });
    return m;
  }, [testingLeadMapping]);
  const patchIsTodaySet = useMemo(() => {
    const set = new Set();
    Object.keys(patchCreationMap).forEach((id) => isPatchCreatedToday(patchCreationMap[id]) && set.add(id));
    return set;
  }, [patchCreationMap]);

  /* ---------------- filters ---------------- */
  const { pageParams } = useShell();
  const [selectedSprint, setSelectedSprint] = useState(pageParams?.sprint ? String(pageParams.sprint) : '');
  const [selectedProduct, setSelectedProduct] = useState(pageParams?.product ? String(pageParams.product) : '');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const productManualAllRef = useRef(false);
  const sprintManualAllRef = useRef(false);
  const [selectedStatus, setSelectedStatus] = useState([]);
  const [selectedClient, setSelectedClient] = useState([]);
  const [selectedAssignedTo, setSelectedAssignedTo] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedDevLead, setSelectedDevLead] = useState('');
  const [selectedTestingLead, setSelectedTestingLead] = useState('');
  // Opened from a "new sprint point" push notification → pre-search that point.
  const [search, setSearch] = useState(pageParams?.search ? String(pageParams.search) : '');
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [sortKey, setSortKey] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  const selectedGroupProductIds = useMemo(() => {
    if (!selectedGroupId) return null;
    const g = productGroups.find((x) => String(x.id) === String(selectedGroupId));
    return new Set((g?.productIds || []).map(String));
  }, [selectedGroupId, productGroups]);

  const dataInGroupScope = useMemo(
    () => (selectedGroupProductIds ? allData.filter((r) => selectedGroupProductIds.has(rowProductId(r))) : allData),
    [allData, selectedGroupProductIds],
  );

  const products = useMemo(() => {
    const m = {};
    dataInGroupScope.forEach((r) => r.ProductName && (m[r.ProductName] = (m[r.ProductName] || 0) + 1));
    return Object.keys(m)
      .sort()
      .map((name) => ({ name, count: m[name] }));
  }, [dataInGroupScope]);

  const defaultProduct = () => (products.find((p) => p.name.toLowerCase() === 'histree') || products[0]).name;

  useEffect(() => {
    if (!products.length || selectedGroupId || productManualAllRef.current || selectedProduct) return;
    setSelectedProduct(defaultProduct());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, selectedGroupId]);

  const sprints = useMemo(() => {
    const rows = selectedProduct ? dataInGroupScope.filter((r) => r.ProductName === selectedProduct) : dataInGroupScope;
    return [...new Set(rows.map((r) => r.Sprint).filter(Boolean))].sort();
  }, [dataInGroupScope, selectedProduct]);

  useEffect(() => {
    if (!sprints.length) return setSelectedSprint('');
    if (sprintManualAllRef.current) return;
    if (selectedSprint && sprints.includes(selectedSprint)) return;
    setSelectedSprint(sprints[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprints]);

  useEffect(() => {
    if (selectedAssignedTo || selectedGroupId || selectedProduct || !products.length) return;
    productManualAllRef.current = false;
    sprintManualAllRef.current = false;
    setSelectedProduct(defaultProduct());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAssignedTo, products, selectedGroupId]);

  const scopeRows = useMemo(() => {
    let rows = dataInGroupScope;
    if (selectedSprint) rows = rows.filter((r) => r.Sprint === selectedSprint);
    if (selectedProduct) rows = rows.filter((r) => r.ProductName === selectedProduct);
    return rows;
  }, [dataInGroupScope, selectedSprint, selectedProduct]);

  const statuses = useMemo(() => {
    const m = {};
    scopeRows.forEach((r) => {
      const st = getPriorityStatus(r);
      if (st && st !== '-') m[st] = (m[st] || 0) + 1;
    });
    return Object.keys(m)
      .sort()
      .map((status) => ({ status, count: m[status] }));
  }, [scopeRows]);

  const clients = useMemo(() => {
    const m = {};
    scopeRows.forEach((r) => {
      const cl = (r.ClientName && String(r.ClientName).trim()) || '';
      if (cl) m[cl] = (m[cl] || 0) + 1;
    });
    return Object.keys(m)
      .sort((a, b) => a.localeCompare(b))
      .map((client) => ({ client, count: m[client] }));
  }, [scopeRows]);

  const assignedPersons = useMemo(() => [...new Set(scopeRows.map((r) => r.AssignedTo).filter(Boolean))].sort(), [scopeRows]);

  const devLeads = useMemo(() => {
    const mods = new Set(scopeRows.map((r) => String(r.Module ?? '')).filter(Boolean));
    return [...new Set(devLeadMapping.filter((m) => mods.has(String(m.ModuleId))).map((m) => m.TeamLeadLoginName))].sort();
  }, [scopeRows, devLeadMapping]);
  const testingLeads = useMemo(() => {
    const mods = new Set(scopeRows.map((r) => String(r.Module ?? '')).filter(Boolean));
    return [...new Set(testingLeadMapping.filter((m) => mods.has(String(m.ModuleId))).map((m) => m.TestingLeadName))].sort();
  }, [scopeRows, testingLeadMapping]);

  useEffect(() => {
    if (!selectedStatus.length) return;
    const names = statuses.map((x) => x.status);
    const valid = selectedStatus.filter((x) => names.includes(x));
    if (valid.length !== selectedStatus.length) setSelectedStatus(valid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses]);
  useEffect(() => {
    if (!selectedClient.length) return;
    const names = clients.map((x) => x.client);
    const valid = selectedClient.filter((x) => names.includes(x));
    if (valid.length !== selectedClient.length) setSelectedClient(valid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients]);
  useEffect(() => {
    if (selectedAssignedTo && !assignedPersons.includes(selectedAssignedTo)) setSelectedAssignedTo('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedPersons]);

  const [sortField, sortDirection] = sortKey ? sortKey.split('|') : ['', 'asc'];

  const filtered = useMemo(() => {
    let rows = dataInGroupScope;
    if (selectedProduct) rows = rows.filter((r) => r.ProductName === selectedProduct);
    if (selectedSprint) rows = rows.filter((r) => r.Sprint === selectedSprint);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => COLUMNS.some((col) => String(r[col.key] ?? '').toLowerCase().includes(q)));
    }
    if (selectedStatus.length) rows = rows.filter((r) => selectedStatus.includes(getPriorityStatus(r)));
    if (selectedClient.length) rows = rows.filter((r) => selectedClient.includes(r.ClientName));
    if (selectedAssignedTo) rows = rows.filter((r) => r.AssignedTo === selectedAssignedTo);
    if (typeFilter) rows = rows.filter((r) => (r.Type || '').toLowerCase() === typeFilter.toLowerCase());
    if (selectedDevLead) {
      const ids = new Set(devLeadMapping.filter((m) => m.TeamLeadLoginName === selectedDevLead).map((m) => String(m.ModuleId)));
      rows = rows.filter((r) => ids.has(String(r.Module ?? '')));
    }
    if (selectedTestingLead) {
      const ids = new Set(testingLeadMapping.filter((m) => m.TestingLeadName === selectedTestingLead).map((m) => String(m.ModuleId)));
      rows = rows.filter((r) => ids.has(String(r.Module ?? '')));
    }
    if (showCriticalOnly) rows = rows.filter(isCriticalRow);
    if (sortField) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortField] ? new Date(a[sortField]).getTime() : 0;
        const bv = b[sortField] ? new Date(b[sortField]).getTime() : 0;
        return sortDirection === 'asc' ? av - bv : bv - av;
      });
    }
    return [...rows].sort((a, b) => {
      const ac = isCriticalRow(a);
      const bc = isCriticalRow(b);
      if (ac !== bc) return ac ? -1 : 1;
      const at = patchIsTodaySet.has(String(a.Id));
      const bt = patchIsTodaySet.has(String(b.Id));
      if (at !== bt) return at ? 1 : -1;
      return 0;
    });
  }, [
    dataInGroupScope,
    selectedSprint,
    selectedProduct,
    selectedStatus,
    selectedClient,
    selectedAssignedTo,
    typeFilter,
    selectedDevLead,
    selectedTestingLead,
    devLeadMapping,
    testingLeadMapping,
    search,
    sortField,
    sortDirection,
    patchIsTodaySet,
    showCriticalOnly,
  ]);

  const statusCounts = useMemo(() => {
    const m = {};
    filtered.forEach((r) => {
      const st = getPriorityStatus(r);
      if (st && st !== '-') m[st] = (m[st] || 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const criticalCount = useMemo(() => {
    let rows = dataInGroupScope;
    if (selectedProduct) rows = rows.filter((r) => r.ProductName === selectedProduct);
    if (selectedSprint) rows = rows.filter((r) => r.Sprint === selectedSprint);
    return rows.filter(isCriticalRow).length;
  }, [dataInGroupScope, selectedProduct, selectedSprint]);

  const selectedSprintMeta = useMemo(() => {
    if (!selectedProduct || !selectedSprint) return null;
    return (
      openSprints.find(
        (x) => String(x.ProductName).trim() === String(selectedProduct).trim() && String(x.SprintName).trim() === String(selectedSprint).trim(),
      ) || null
    );
  }, [openSprints, selectedProduct, selectedSprint]);

  const pager = usePager(
    filtered,
    20,
    [selectedSprint, selectedProduct, selectedGroupId, selectedStatus.join(), selectedClient.join(), selectedAssignedTo, typeFilter, selectedDevLead, selectedTestingLead, search, sortKey, showCriticalOnly].join('|'),
  );

  /* ---------------- selection / actions ---------------- */
  const [selectedRows, setSelectedRows] = useState([]);
  const [menuRow, setMenuRow] = useState(null);
  const [actionRow, setActionRow] = useState(null);
  const [sprintChangeOpen, setSprintChangeOpen] = useState(false);
  const [historyRow, setHistoryRow] = useState(null);
  const [markCriticalRow, setMarkCriticalRow] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [pendingTargetDates, setPendingTargetDates] = useState({});
  const [pendingDevEfforts, setPendingDevEfforts] = useState({});
  const [savingDevEffort, setSavingDevEffort] = useState(null);

  const toggleRow = (row) =>
    setSelectedRows((prev) => (prev.some((x) => x.Id === row.Id) ? prev.filter((x) => x.Id !== row.Id) : [...prev, row]));
  const isSelected = (row) => selectedRows.some((x) => x.Id === row.Id);

  const patchRow = (slaId, patch) => setAllData((rows) => rows.map((r) => (r.SLAId === slaId ? { ...r, ...patch } : r)));

  const updateClientSideTesting = async (row, sprintId = 0, actionType = 1, remarks = '') => {
    if (!row?.SLAId || !session.userId) return toast.error('Missing SLA ID or User ID');
    setActionLoading(true);
    try {
      const ids = selectedRows.length > 0 ? selectedRows.map((x) => x.SLAId).join(',') : String(row.SLAId);
      const params = { ids, operatorId: parseInt(session.userId, 10), isPointDroporSprintChange: actionType, sprintId };
      if (actionType === 3) params.remarks = remarks.trim();
      const res = await api.post('updateSprintClientSideTesting', params);
      toast.success(typeof res === 'string' && res ? res : res?.message || 'Action completed successfully!');
      setSelectedRows([]);
      setSprintChangeOpen(false);
      fetchData('refresh');
    } catch (e) {
      toast.error(e.message || 'Failed to perform action');
    } finally {
      setActionLoading(false);
    }
  };

  const removeStatus = async (row, type) => {
    if (!row?.SLAId) return toast.error('Missing SLA ID');
    setActionLoading(true);
    try {
      const res = await api.post('removeClientSideTestingPointDropStatus', { id: row.SLAId, isPointDroporSprintChange: type });
      toast.success(
        (typeof res === 'string' && res) ||
          res?.message ||
          (type === 1 ? 'Client Side Testing status removed successfully!' : 'Point Drop status reverted successfully!'),
      );
      fetchData('refresh');
    } catch (e) {
      toast.error(e.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const saveTargetDate = async (row) => {
    const targetDate = pendingTargetDates[row.SLAId];
    if (!targetDate) return;
    if (isDevTeamLead && row.TargetDate) return toast.warning('Target Date can be saved only once. Existing Target Date cannot be updated.');
    if (!session.userId) return toast.error('Operator ID is not available');
    try {
      const res = await api.post('updateTargetDate', { slaId: row.SLAId, targetDate, operatorId: session.userId });
      toast.success(typeof res === 'string' ? res : res?.message || 'Target date saved');
      patchRow(row.SLAId, { TargetDate: targetDate });
      setPendingTargetDates((p) => {
        const n = { ...p };
        delete n[row.SLAId];
        return n;
      });
    } catch {
      toast.error('Unable to save target date');
    }
  };

  const changeDevEfforts = (row, value) => {
    if (value === '' || /^\d+(\.\d{0,2})?$/.test(value)) setPendingDevEfforts((p) => ({ ...p, [row.SLAId]: value }));
  };

  const saveDevEfforts = async (row) => {
    if (isDevTeamLead && hasValue(row.DevEfforts)) return toast.error('Dev Efforts can be saved only once.');
    const value = parseFloat(pendingDevEfforts[row.SLAId]);
    if (isNaN(value)) return toast.error('Please enter a valid value.');
    setSavingDevEffort(row.SLAId);
    try {
      const result = await api.post('saveDevEfforts', { SLAId: row.SLAId, DevEfforts: value, opeartorId: parseInt(session.userId, 10) });
      if (result?.success) {
        patchRow(row.SLAId, { DevEfforts: Number(value) });
        setPendingDevEfforts((p) => {
          const n = { ...p };
          delete n[row.SLAId];
          return n;
        });
        toast.success(result.message || 'Dev Efforts saved');
      } else toast.error(result?.message || 'Unable to save Dev Efforts');
    } catch {
      toast.error('Unable to save Dev Efforts');
    } finally {
      setSavingDevEffort(null);
    }
  };

  const doExport = async () => {
    if (!filtered.length) return toast.info('Nothing to export');
    try {
      await exportExcel(`Sprint_${selectedSprint || 'Data'}`, {
        name: 'Sprint',
        columns: COLUMNS.map((col) => ({
          header: col.label,
          value: (row) => {
            const r = { ...row, DevTeamLead: devLeadByModule.get(String(row.Module)) || '', TestingLead: testingLeadByModule.get(String(row.Module)) || '' };
            const v = col.fmt ? col.fmt(r[col.key], r) : r[col.key];
            return v === '-' || v == null ? '' : v;
          },
        })),
        rows: filtered,
      });
    } catch (e) {
      toast.error(e.message || 'Export failed');
    }
  };

  useHeaderActions(
    [
      canAddPoint && { key: 'add', icon: 'plus', onPress: () => setAddOpen(true) },
      { key: 'chart', icon: 'bar-chart-2', onPress: () => (filtered.length ? setChartOpen(true) : toast.info('No records to chart')) },
      { key: 'export', icon: 'download', onPress: doExport },
      { key: 'refresh', icon: 'refresh-cw', onPress: () => fetchData() },
    ],
    [canAddPoint, filtered.length],
  );

  /* ---------------- render helpers ---------------- */
  const groupName = productGroups.find((g) => String(g.id) === String(selectedGroupId))?.name;
  const showAll = !!selectedAssignedTo || !!selectedGroupId;
  const filterCount =
    (selectedGroupId ? 1 : 0) +
    (selectedStatus.length ? 1 : 0) +
    (selectedClient.length ? 1 : 0) +
    (selectedAssignedTo ? 1 : 0) +
    (typeFilter ? 1 : 0) +
    (selectedDevLead ? 1 : 0) +
    (selectedTestingLead ? 1 : 0);

  const clearFilters = () => {
    setSelectedGroupId('');
    productManualAllRef.current = false;
    sprintManualAllRef.current = false;
    setSelectedStatus([]);
    setSelectedClient([]);
    setSelectedAssignedTo('');
    setTypeFilter('');
    setSelectedDevLead('');
    setSelectedTestingLead('');
  };

  const changeGroup = (id) => {
    setSelectedGroupId(id);
    setSelectedProduct('');
    setSelectedSprint('');
    productManualAllRef.current = !!id;
    sprintManualAllRef.current = !!id;
  };

  const changeProduct = (v) => {
    if (v === '') {
      productManualAllRef.current = true;
      sprintManualAllRef.current = true;
    } else {
      productManualAllRef.current = false;
      sprintManualAllRef.current = selectedGroupId ? sprintManualAllRef.current : false;
    }
    setSelectedProduct(v);
    setSelectedSprint('');
  };

  const header = (
    <View style={{ gap: 12, paddingBottom: 4 }}>
      <Hero
        title={selectedSprint || 'All Sprints'}
        subtitle={`${groupName ? `${groupName} · ` : ''}${selectedProduct || (selectedGroupId ? 'All in group' : 'All Products')}`}
        right={
          selectedSprintMeta?.ExpectedDeliveryDate ? (
            <View style={s.edd}>
              <Text style={s.eddLabel}>Delivery</Text>
              <Text style={s.eddValue}>{fmtExpectedDeliveryDate(selectedSprintMeta.ExpectedDeliveryDate)}</Text>
            </View>
          ) : null
        }
      >
        <Row gap={8} style={{ marginTop: 14 }}>
          <HeroStat label="Points" value={filtered.length} icon="layers" />
          <HeroStat label="Critical" value={criticalCount} icon="alert-circle" />
          <HeroStat label="Bugs" value={filtered.filter((r) => r.Type === 'Bug').length} icon="alert-octagon" />
          <HeroStat label="Stories" value={filtered.filter((r) => r.Type === 'Story').length} icon="book-open" />
        </Row>
      </Hero>

      <Row gap={8}>
        <View style={{ flex: 1 }}>
          <Select
            compact
            icon="box"
            label="Product"
            allLabel={showAll ? 'All Products' : undefined}
            value={selectedProduct}
            options={products.map((p) => ({ value: p.name, label: p.name, sub: `${p.count} records` }))}
            onChange={changeProduct}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Select
            compact
            icon="zap"
            label="Sprint"
            allLabel={showAll ? 'All Sprints' : undefined}
            value={selectedSprint}
            options={sprints}
            onChange={(v) => {
              sprintManualAllRef.current = v === '';
              setSelectedSprint(v);
            }}
          />
        </View>
      </Row>

      <SearchBar value={search} onChangeText={setSearch} placeholder="Search any column" />

      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <FilterButton count={filterCount} onPress={() => setFilterOpen(true)} />
        <Chip
          label="Critical"
          icon="alert-circle"
          count={criticalCount}
          active={showCriticalOnly}
          color={c.red}
          onPress={() => {
            setShowCriticalOnly((v) => !v);
            setSelectedRows([]);
          }}
        />
        <View style={{ flex: 1 }}>
          <Select compact icon="bar-chart" label="Sort" value={sortKey} options={SORT_OPTIONS.slice(1)} allLabel="Default order" onChange={setSortKey} />
        </View>
      </View>

      <ActiveFilters
        onClearAll={clearFilters}
        items={[
          selectedGroupId && { key: 'g', label: `Group: ${groupName || selectedGroupId}`, onClear: () => changeGroup('') },
          selectedStatus.length && { key: 'st', label: `Status: ${selectedStatus.join(', ')}`, onClear: () => setSelectedStatus([]) },
          selectedClient.length && { key: 'cl', label: `Client: ${selectedClient.join(', ')}`, onClear: () => setSelectedClient([]) },
          selectedAssignedTo && { key: 'as', label: `Assigned: ${selectedAssignedTo}`, onClear: () => setSelectedAssignedTo('') },
          typeFilter && { key: 'ty', label: `Type: ${typeFilter}`, onClear: () => setTypeFilter('') },
          selectedDevLead && { key: 'dl', label: `Dev Lead: ${selectedDevLead}`, onClear: () => setSelectedDevLead('') },
          selectedTestingLead && { key: 'tl', label: `Testing Lead: ${selectedTestingLead}`, onClear: () => setSelectedTestingLead('') },
        ]}
      />

      {statusCounts.length > 0 && (
        <StatStrip
          items={statusCounts.map(([st, n]) => ({
            key: st,
            label: st,
            value: n,
            color: statusColor(st),
            active: selectedStatus.includes(st),
            onPress: () => setSelectedStatus((p) => (p.includes(st) ? p.filter((x) => x !== st) : [...p, st])),
          }))}
        />
      )}

      {canChangeSprint && (
        <Text style={s.hint}>
          <Feather name="info" size={11} color={c.textFaint} /> Tap a card for actions · long-press to select for bulk sprint change
        </Text>
      )}
    </View>
  );

  const renderItem = ({ item: row }) => {
    const critical = isCriticalRow(row);
    const today = patchIsTodaySet.has(String(row.Id)) && (row.Type === 'Bug' || row.Type === 'Story');
    const accent = critical ? c.red : today ? (row.Type === 'Bug' ? c.rose : c.cyan) : row.Type === 'Bug' ? c.orange : c.indigo;
    const status = getPriorityStatus(row);
    const sel = isSelected(row);
    const open = !!expanded[row.Id];
    const tds = getTargetDateStatus(row.TargetDate);
    const dateValue = row.TargetDate ? String(row.TargetDate).substring(0, 10) : '';
    const pendingDate = pendingTargetDates[row.SLAId];
    const dateLocked = isDevTeamLead && !!row.TargetDate;
    const effortLocked = isDevTeamLead && hasValue(row.DevEfforts);
    const currentEffort = row.DevEfforts ?? '';
    const pendingEffort = pendingDevEfforts[row.SLAId] ?? currentEffort;
    const iter = Number(row.IterationCount);
    const iterColor = row.IterationCount == null ? c.slate : iter <= 2 ? c.emerald : iter <= 4 ? c.amber : c.red;
    const devLead = devLeadByModule.get(String(row.Module)) || '-';
    const testLead = testingLeadByModule.get(String(row.Module)) || '-';

    return (
      <Pressable
        onPress={() => (selectedRows.length && canChangeSprint ? toggleRow(row) : setMenuRow(row))}
        onLongPress={canChangeSprint ? () => toggleRow(row) : undefined}
        delayLongPress={300}
      >
        <Card accent={accent} style={[critical && { backgroundColor: blend(c.red, dark ? '#131829' : '#FFFFFF', dark ? 0.12 : 0.06), borderWidth: 1, borderColor: toneOf(c.red, dark).border }, sel && { borderWidth: 2, borderColor: c.primary }]}>
          <Row justify="space-between" align="center">
            <Row gap={8} style={{ flex: 1 }}>
              {canChangeSprint && selectedRows.length > 0 && <Checkbox checked={sel} onChange={() => toggleRow(row)} />}
              <Pressable hitSlop={6} onPress={() => openUrl(zentaoLink((row.Type || '').toLowerCase() === 'bug' ? 'bug' : 'story', row.Id))}>
                <Text style={s.id}>#{row.Id}</Text>
              </Pressable>
              <Pill label={row.Type || '-'} status={row.Type} />
              {critical && <Pill label="Critical" icon="alert-triangle" color={c.red} solid />}
              {today && <Pill label="Patch today" icon="package" color={c.cyan} />}
            </Row>
            {showMarkCritical && row.Type === 'Bug' && <MarkCriticalButton marked={critical} onPress={() => setMarkCriticalRow(row)} />}
          </Row>

          <Text style={s.title} numberOfLines={open ? undefined : 3}>
            {row.Title || '-'}
          </Text>

          <Row gap={6} wrap style={{ marginTop: 8 }}>
            <Pill label={status} color={statusColor(status)} />
            <Pressable onPress={() => setHistoryRow(row)} hitSlop={4} style={s.sprintBtn}>
              <Feather name="clock" size={11} color={c.primary} />
              <Text style={s.sprintText} numberOfLines={1}>
                {row.Sprint || '-'}
              </Text>
            </Pressable>
            <Pill label={`Iter ${row.IterationCount ?? '-'}`} color={iterColor} />
            <Pill label={getAgeing(row.AddedDateTime, status)} icon="watch" color={c.slate} />
          </Row>

          <KVGrid style={{ marginTop: 10 }}>
            <KV label="Product" value={row.ProductName || '-'} />
            <KV label="Module" value={row.ModuleName || '-'} />
            <KV label="Client" value={row.ClientName || '-'} wide />
          </KVGrid>

          {/* Target date + Dev hours */}
          <View style={s.editRow}>
            <View style={{ flex: 1.35, gap: 4 }}>
              <Text style={s.editLabel}>Target Date</Text>
              {canSaveTargetDate ? (
                <Row gap={6}>
                  <DateField
                    compact
                    style={{ flex: 1 }}
                    label="Set date"
                    clearable={false}
                    disabled={dateLocked}
                    value={pendingDate ?? dateValue}
                    onChange={(v) => setPendingTargetDates((p) => ({ ...p, [row.SLAId]: v }))}
                  />
                  {!!pendingDate && pendingDate !== dateValue && (
                    <Pressable onPress={() => saveTargetDate(row)} style={[s.saveBtn, { backgroundColor: c.emerald }]} hitSlop={6}>
                      <Feather name="check" size={16} color="#fff" />
                    </Pressable>
                  )}
                </Row>
              ) : (
                <Text style={[s.editValue, tds.color && { color: tds.color }]}>{dateValue || 'No Target Date Selected'}</Text>
              )}
              {!!row.TargetDate && (
                <Row gap={6} wrap>
                  {!!tds.status && <Pill label={tds.status} color={tds.color} />}
                  <Text style={s.savedBy}>by {row.TargetDateSavedBy || '-'}</Text>
                </Row>
              )}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.editLabel}>Dev Hours</Text>
              {canEditDevEfforts ? (
                <Row gap={6} style={{ width: '100%' }}>
                  <TextInput
                    value={String(pendingEffort)}
                    onChangeText={(v) => changeDevEfforts(row, v)}
                    editable={!effortLocked}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={c.textFaint}
                    style={[s.effortInput, effortLocked && { opacity: 0.55 }]}
                  />
                  {pendingDevEfforts[row.SLAId] !== undefined && String(pendingEffort) !== String(currentEffort) && !effortLocked && (
                    <Pressable
                      onPress={() => saveDevEfforts(row)}
                      disabled={savingDevEffort === row.SLAId}
                      style={[s.saveBtn, { backgroundColor: c.emerald, opacity: savingDevEffort === row.SLAId ? 0.5 : 1 }]}
                      hitSlop={6}
                    >
                      <Feather name={savingDevEffort === row.SLAId ? 'loader' : 'save'} size={15} color="#fff" />
                    </Pressable>
                  )}
                </Row>
              ) : (
                <Text style={s.editValue}>{hasValue(row.DevEfforts) ? row.DevEfforts : '-'}</Text>
              )}
            </View>
          </View>

          <Row justify="space-between" style={{ marginTop: 10 }}>
            <Row gap={8} style={{ flex: 1 }}>
              <Avatar name={row.AssignedTo || '?'} size={28} color={hashColor(row.AssignedTo)} />
              <View style={{ flex: 1 }}>
                <Text style={s.assignee} numberOfLines={1}>
                  {row.AssignedTo || 'Unassigned'}
                </Text>
                <Text style={s.assignedAt}>{fmtDateTime(row.AssignedDate, '-')}</Text>
              </View>
            </Row>
            <Pressable hitSlop={8} onPress={() => setExpanded((e) => ({ ...e, [row.Id]: !e[row.Id] }))} style={s.moreBtn}>
              <Text style={s.moreText}>{open ? 'Less' : 'Details'}</Text>
              <Feather name={open ? 'chevron-up' : 'chevron-down'} size={14} color={c.primary} />
            </Pressable>
          </Row>

          {open && (
            <KVGrid style={{ marginTop: 10 }}>
              <KV label="Opened By" value={row.OpenedBy || '-'} />
              <KV label="Opened Date" value={fmtDateTime(row.OpenedDate, '-')} />
              <KV label="First Dev" value={row.FirstDevAssignedName || '-'} />
              <KV label="First Dev Date" value={fmtDateTime(row.FirstDevAssignedDateTime, '-')} />
              <KV label="First QA" value={row.FirstQAAssignedName || '-'} />
              <KV label="First QA Date" value={fmtDateTime(row.FirstQAAssignedDateTime, '-')} />
              <KV label="Dev Team Lead" value={devLead} />
              <KV label="Testing Lead" value={testLead} />
              <KV label="Sprint Added" value={fmtDateTime(row.AddedDateTime, '-')} />
              <KV label="Added By" value={row.AddedBy || '-'} />
            </KVGrid>
          )}
        </Card>
      </Pressable>
    );
  };

  /* ---------------- context menu ---------------- */
  const menuActions = useMemo(() => {
    if (!menuRow) return [];
    const r = menuRow;
    const bulk = selectedRows.length > 0 ? `Applies to ${selectedRows.length} selected point(s)` : undefined;
    const close = () => setMenuRow(null);
    return [
      { key: 'history', label: 'Sprint / point drop history', icon: 'clock', onPress: () => (close(), setHistoryRow(r)) },
      {
        key: 'open',
        label: 'Open in Zentao',
        icon: 'external-link',
        color: c.sky,
        onPress: () => (close(), openUrl(zentaoLink((r.Type || '').toLowerCase() === 'bug' ? 'bug' : 'story', r.Id))),
      },
      showMarkCritical &&
        r.Type === 'Bug' && { key: 'critical', label: isCriticalRow(r) ? 'Critical details' : 'Mark as critical', icon: 'flag', color: c.rose, onPress: () => (close(), setMarkCriticalRow(r)) },
      isTestingLead &&
        (r.IsClientSideTesting === true
          ? { key: 'rmcst', label: 'Remove Client Side Testing', icon: 'x-circle', color: c.orange, onPress: () => (close(), removeStatus(r, 1)) }
          : {
              key: 'cst',
              label: 'Mark Client Side Testing',
              icon: 'user-check',
              color: c.violet,
              sub: bulk,
              onPress: () => (close(), updateClientSideTesting(r, 0, 1)),
            }),
      canPointDrop &&
        (r.PointDrop === true
          ? { key: 'revert', label: 'Revert Point Drop', icon: 'rotate-ccw', color: c.amber, onPress: () => (close(), removeStatus(r, 2)) }
          : {
              key: 'drop',
              label: 'Point Drop',
              icon: 'x-octagon',
              color: c.red,
              sub: bulk,
              onPress: async () => {
                close();
                const ok = await confirmAsync('Point Drop', bulk || `Drop ${r.Type} #${r.Id} from ${r.Sprint}?`, { confirmText: 'Drop', destructive: true });
                if (ok) updateClientSideTesting(r, 0, 2);
              },
            }),
      canChangeSprint && {
        key: 'sprint',
        label: 'Sprint Change',
        icon: 'repeat',
        color: c.indigo,
        sub: bulk,
        onPress: () => (close(), setActionRow(selectedRows.length > 0 ? selectedRows[0] : r), setSprintChangeOpen(true)),
      },
      canChangeSprint && {
        key: 'select',
        label: isSelected(r) ? 'Deselect' : 'Select for bulk action',
        icon: 'check-square',
        color: c.teal,
        onPress: () => (close(), toggleRow(r)),
      },
    ].filter(Boolean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuRow, selectedRows, isTestingLead, canPointDrop, canChangeSprint, showMarkCritical, c]);

  if (loading && !allData.length) return <Loading text="Loading Sprint Data…" />;
  if (error && !allData.length) return <ErrorState message={error} onRetry={() => fetchData()} />;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: selectedRows.length ? 120 : 40 }}
        data={pager.visible}
        keyExtractor={(r, i) => `${r.Id}-${r.SLAId ?? i}`}
        ListHeaderComponent={header}
        refreshing={refreshing}
        onRefresh={() => {
          fetchData('refresh');
          fetchMeta();
        }}
        ListEmptyComponent={<Empty icon="zap" title="No records found" subtitle="No records found for the selected filters." />}
        ListFooterComponent={filtered.length ? <LoadMore pager={pager} /> : null}
        renderItem={renderItem}
        extraData={[selectedRows, expanded, pendingTargetDates, pendingDevEfforts, savingDevEffort]}
      />

      {selectedRows.length > 0 && (
        <View style={s.bulkBar}>
          <View style={{ flex: 1 }}>
            <Text style={s.bulkCount}>{selectedRows.length} selected</Text>
            <Pressable onPress={() => setSelectedRows(selectedRows.length === filtered.length ? [] : filtered)}>
              <Text style={s.bulkLink}>{selectedRows.length === filtered.length ? 'Deselect all' : `Select all ${filtered.length}`}</Text>
            </Pressable>
          </View>
          <Button
            title="Change Sprint"
            icon="repeat"
            size="sm"
            variant="secondary"
            onPress={() => {
              setActionRow(selectedRows[0]);
              setSprintChangeOpen(true);
            }}
          />
          <Pressable onPress={() => setSelectedRows([])} style={s.bulkClose} hitSlop={6}>
            <Feather name="x" size={18} color="#fff" />
          </Pressable>
        </View>
      )}

      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        onClear={clearFilters}
        subtitle={`${filtered.length} record${filtered.length !== 1 ? 's' : ''} match`}
      >
        <Select
          label="Product Group"
          icon="grid"
          allLabel="All Groups"
          value={selectedGroupId}
          options={productGroups.map((g) => ({ value: g.id, label: g.name, sub: `${g.productIds.length} product(s)` }))}
          onChange={changeGroup}
        />
        <Select
          label="Status"
          icon="activity"
          multi
          placeholder="All Statuses"
          value={selectedStatus}
          options={statuses.map((x) => ({ value: x.status, label: x.status, sub: `${x.count}`, color: statusColor(x.status) }))}
          onChange={setSelectedStatus}
        />
        <Select
          label="Client"
          icon="briefcase"
          multi
          searchable
          placeholder="All Clients"
          value={selectedClient}
          options={clients.map((x) => ({ value: x.client, label: x.client, sub: `${x.count}` }))}
          onChange={setSelectedClient}
        />
        <Select label="Current Assigned" icon="user" allLabel="All Assigned" value={selectedAssignedTo} options={assignedPersons} onChange={setSelectedAssignedTo} />
        <Segmented
          scroll={false}
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { label: 'All Types', value: '' },
            { label: 'Bug', value: 'Bug', color: c.red },
            { label: 'Story', value: 'Story', color: c.sky },
          ]}
        />
        {devLeads.length > 0 && (
          <Select label="Dev Team Lead" icon="code" allLabel="All Dev Leads" value={selectedDevLead} options={devLeads} onChange={setSelectedDevLead} />
        )}
        {testingLeads.length > 0 && (
          <Select
            label="Testing Lead"
            icon="check-circle"
            allLabel="All Testing Leads"
            value={selectedTestingLead}
            options={testingLeads}
            onChange={setSelectedTestingLead}
          />
        )}
      </FilterSheet>

      <Sheet
        visible={!!menuRow}
        onClose={() => setMenuRow(null)}
        title={menuRow ? `${menuRow.Type || 'Point'} #${menuRow.Id}` : ''}
        subtitle={menuRow?.Title}
        icon="more-horizontal"
      >
        <ActionList actions={menuActions} />
        {!isTestingLead && !canPointDrop && !canChangeSprint && <Text style={s.hint}>No sprint actions available for your role.</Text>}
      </Sheet>

      <SprintChangeSheet
        visible={sprintChangeOpen}
        row={actionRow}
        count={selectedRows.length || 1}
        allSprints={openSprints}
        loading={actionLoading}
        onClose={() => {
          setSprintChangeOpen(false);
          setActionRow(null);
        }}
        onConfirm={(sprintId, remarks) => updateClientSideTesting(actionRow, sprintId, 3, remarks)}
      />
      <PointHistorySheet visible={!!historyRow} row={historyRow} onClose={() => setHistoryRow(null)} />
      <MarkCriticalSheet visible={!!markCriticalRow} row={markCriticalRow} onClose={() => setMarkCriticalRow(null)} onSaved={() => fetchData('refresh')} />
      <AddPointSheet visible={addOpen} allSprints={openSprints} onClose={() => setAddOpen(false)} onSaved={() => fetchData('refresh')} />
      <BreakdownSheet
        visible={chartOpen}
        onClose={() => setChartOpen(false)}
        rows={filtered}
        devLeadMapping={devLeadMapping}
        testingLeadMapping={testingLeadMapping}
        subtitle={`${selectedSprint || 'All Sprints'} · ${selectedProduct || 'All Products'} · ${filtered.length} records`}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  id: { color: c.primary, fontWeight: '900', fontSize: 15, textDecorationLine: 'underline' },
  title: { color: c.text, fontSize: 14, fontWeight: '700', marginTop: 8, lineHeight: 20 },
  sprintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: c.primarySoft,
    maxWidth: 200,
  },
  sprintText: { color: c.primary, fontSize: 10.5, fontWeight: '800' },
  editRow: { flexDirection: 'row', gap: 12, marginTop: 12, padding: 10, borderRadius: 14, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border },
  editLabel: { color: c.textFaint, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  editValue: { color: c.text, fontSize: 13, fontWeight: '700' },
  savedBy: { color: c.textFaint, fontSize: 10.5 },
  saveBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  effortInput: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.inputBg,
    color: c.text,
    paddingHorizontal: 10,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  assignee: { color: c.text, fontSize: 12.5, fontWeight: '700' },
  assignedAt: { color: c.textFaint, fontSize: 11 },
  moreBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: c.primarySoft },
  moreText: { color: c.primary, fontSize: 11.5, fontWeight: '800' },
  hint: { color: c.textFaint, fontSize: 11.5, fontWeight: '600' },
  edd: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'flex-end' },
  eddLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '700' },
  eddValue: { color: '#FFD1D1', fontSize: 14, fontWeight: '900' },
  bulkBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 18,
    backgroundColor: c.primary,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  bulkCount: { color: '#fff', fontWeight: '900', fontSize: 14 },
  bulkLink: { color: 'rgba(255,255,255,0.85)', fontSize: 11.5, fontWeight: '700', textDecorationLine: 'underline', marginTop: 2 },
  bulkClose: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
}));
