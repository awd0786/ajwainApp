import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '../api/client';
import { rowsOf } from '../api/authFetch';
import { zentaoLink } from '../api/config';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';
import { useHeaderActions } from '../navigation/ShellContext';
import { makeStyles, toneOf, useTheme } from '../theme/theme';
import { fmtDate, fmtDateTime, getTargetDateStatus } from '../utils/format';
import { exportExcel, openUrl } from '../utils/exporter';
import {
  ActionList,
  ActiveFilters,
  Banner,
  Button,
  Card,
  Chip,
  DateField,
  Donut,
  Empty,
  ErrorState,
  FilterButton,
  FilterSheet,
  HBars,
  KV,
  KVGrid,
  LoadMore,
  Loading,
  Pill,
  Progress,
  Row,
  SearchBar,
  SectionHeader,
  Segmented,
  Select,
  Sheet,
  StatCard,
  StatGrid,
  StatStrip,
  TextField,
  ToggleRow,
  usePager,
  useToast,
} from '../ui';
import MarkCriticalSheet, { canMarkCritical, MarkCriticalButton } from '../components/MarkCriticalSheet';
import { statusColor } from '../components/SprintSheets';

/**
 * Port of Scrum.jsx (page key 'scrum'):
 *   Dashboard        – CriticalPointsOverviewDashboard
 *   Not Assigned Bugs – ScrumMaster backlog + Mark Critical
 *   Critical Points  – GetCriticalPoints list, target date, close, delete, audit
 */

/* ---------------- helpers (verbatim logic from Scrum.jsx) ---------------- */
const getAgeingDays = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d)) return null;
  const diff = Date.now() - d.getTime();
  if (diff < 0) return 0;
  return Math.floor(diff / 86400000);
};
const formatAgeing = (v) => {
  const days = getAgeingDays(v);
  if (days == null) return '-';
  if (days === 0) return 'Today';
  return `${days} Day${days === 1 ? '' : 's'}`;
};
const matchesAgeing = (markedAt, f) => {
  if (!f) return true;
  const d = getAgeingDays(markedAt);
  if (d == null) return false;
  switch (f) {
    case '0':
      return d === 0;
    case '1':
      return d === 1;
    case '2-3':
      return d >= 2 && d <= 3;
    case '4-7':
      return d >= 4 && d <= 7;
    case '8-15':
      return d >= 8 && d <= 15;
    case '16+':
      return d >= 16;
    default:
      return true;
  }
};
const bucketAgeing = (d) => {
  if (d == null) return null;
  if (d === 0) return '0';
  if (d === 1) return '1';
  if (d <= 3) return '2-3';
  if (d <= 7) return '4-7';
  if (d <= 15) return '8-15';
  return '16+';
};
const isClosed = (r) => !!r && (Boolean(r.closedDateTime) || (r.closedBy != null && String(r.closedBy).trim() !== ''));
const matchesClosed = (r, f) => (!f ? true : f === 'closed' ? isClosed(r) : f === 'not-closed' ? !isClosed(r) : true);

const CLOSED_OPTIONS = [
  { value: 'closed', label: 'Closed' },
  { value: 'not-closed', label: 'Not Closed' },
];
const AGEING_OPTIONS = [
  { value: '0', label: 'Today' },
  { value: '1', label: '1 Day' },
  { value: '2-3', label: '2-3 Days' },
  { value: '4-7', label: '4-7 Days' },
  { value: '8-15', label: '8-15 Days' },
  { value: '16+', label: 'More than 15 Days' },
];
const AGEING_COLORS = ['#93C5FD', '#60A5FA', '#38BDF8', '#818CF8', '#F59E0B', '#EF4444'];
const SEV_COLORS = { 1: '#EF4444', 2: '#F97316', 3: '#EAB308' };
const DONUT_COLORS = ['#1E3A8A', '#2D5FB5', '#4A7FD4', '#7BAED4', '#C084FC', '#16A34A', '#D97706', '#94A3B8'];

const extractRows = (p) => {
  if (p == null) return [];
  if (Array.isArray(p)) return p;
  if (typeof p !== 'object') return [];
  for (const k of ['data', 'Data', 'result', 'Result', 'Table', 'table', 'Rows', 'rows', 'items', 'Items', 'd']) {
    const v = p[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') {
      const inner = extractRows(v);
      if (inner.length) return inner;
    }
  }
  if (p.PointId != null || p.pointId != null || p.PointType != null || p.pointType != null) return [p];
  return [];
};

const normalize = (x) => {
  const pointId = x.PointId ?? x.pointId;
  const recordId = x.ID ?? x.RecordId ?? x.recordId ?? x.id;
  return {
    id: pointId ?? recordId,
    recordId: recordId ?? pointId,
    title: x.Title ?? x.title ?? '',
    product: x.Product ?? x.product ?? '',
    productId: x.ProductId ?? x.productId ?? null,
    moduleId: x.ModuleId ?? x.moduleId ?? null,
    module: x.Module ?? x.module ?? '',
    clientName: x.ClientName ?? x.clientName ?? '',
    clientPatchVersion: x.ClientVersion ?? x.clientVersion ?? x.ClientPatchVersion ?? x.clientPatchVersion ?? '',
    remarks: x.Remarks ?? x.remarks ?? '',
    markedBy: x.CriticalMarkedBy ?? x.criticalMarkedBy ?? '',
    markedByName: x.CriticalMarkedByName ?? '',
    markedAt: x.CriticalDateTime ?? x.criticalDateTime ?? '',
    assignedTo: x.AssignedTo ?? x.assignedTo ?? '',
    currentStatus: x.CurrentStatus ?? x.currentStatus ?? '',
    openedBy: x.OpenedBy ?? x.openedBy ?? '',
    openedDate: x.OpenedDate ?? x.openedDate ?? '',
    pointType: x.PointType ?? x.pointType ?? '',
    mainPatchSprint: x.MainPatchSprint ?? x.mainPatchSprint ?? '',
    criticalSprintPatch: x.CriticalSprintPatch ?? x.criticalSprintPatch ?? '',
    slaId: x.SLAId ?? x.slaId ?? x.SLAID ?? null,
    targetDate: x.TargetDate ?? x.targetDate ?? '',
    targetDateSavedBy: x.TargetDateSavedByName ?? x.targetDateSavedByName ?? x.TargetDateSavedBy ?? x.targetDateSavedBy ?? '',
    closedBy: x.ClosedBy ?? x.closedBy ?? null,
    closedByName: x.ClosedByName ?? x.closedByName ?? '',
    closedDateTime: x.ClosedDateTime ?? x.closedDateTime ?? '',
    closingRemarks: x.ClosingRemarks ?? x.closingRemarks ?? '',
    auditTargetDate: Array.isArray(x.AuditTargetDate)
      ? [...x.AuditTargetDate].sort((a, b) => new Date(b?.AddedDateTime || 0) - new Date(a?.AddedDateTime || 0))
      : [],
  };
};

const hasTarget = (r) => r.targetDate != null && String(r.targetDate).trim() !== '';
const sortCount = (map, limit) =>
  Object.entries(map)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
const msgOf = (res, fb) => (typeof res === 'string' && res ? res : res?.message || res?.Message || res?.result || fb);

/* ========================================================================= */
export default function ScrumScreen() {
  const s = useStyles();
  const { c, dark } = useTheme();
  const toast = useToast();
  const { session } = useAuth();
  const { canCriticalPointAdd, isDevTeamLead } = usePermissions();
  const userIdNum = Number(session.userId || 0);
  const showCriticalActions = userIdNum === 1 || userIdNum === 11 || canMarkCritical(session.role);

  const [tab, setTab] = useState('dashboard');

  /* ---------------- data ---------------- */
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [teamLeadMapping, setTeamLeadMapping] = useState([]);
  const [points, setPoints] = useState([]);
  const [cLoading, setCLoading] = useState(true);
  const [cError, setCError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchCritical = useCallback(async () => {
    setCLoading(true);
    setCError('');
    try {
      const res = await api.get('getCriticalPoints');
      setPoints(extractRows(res).map(normalize));
    } catch (e) {
      setCError(e.message || 'Unable to load critical points.');
    } finally {
      setCLoading(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('scrumMaster');
      setData(Array.isArray(res) ? res : []);
    } catch (e) {
      setError(e.message || 'Unable to load Scrum data.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMapping = useCallback(async () => {
    try {
      const res = await api.get('teamLeadModuleMapping');
      setTeamLeadMapping(Array.isArray(res) ? res : rowsOf(res));
    } catch {
      setTeamLeadMapping([]);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchMapping();
    fetchCritical();
  }, [fetchData, fetchMapping, fetchCritical]);

  const refreshAll = async () => {
    setRefreshing(true);
    await Promise.all([tab === 'scrum' ? fetchData() : fetchCritical(), fetchMapping()]);
    setRefreshing(false);
  };

  const teamLeadOptions = useMemo(() => [...new Set(teamLeadMapping.map((x) => x.TeamLeadLoginName).filter(Boolean))].sort(), [teamLeadMapping]);
  const modulesOfLead = useCallback(
    (lead) => new Set(teamLeadMapping.filter((x) => x.TeamLeadLoginName === lead).map((x) => Number(x.ModuleId))),
    [teamLeadMapping],
  );
  const devLeadByModuleId = useMemo(() => {
    const m = new Map();
    teamLeadMapping.forEach((x) => {
      const id = Number(x.ModuleId);
      if (!Number.isNaN(id)) m.set(id, x?.TeamLeadName ?? x?.DevLeadName ?? x?.TeamLeadLoginName ?? '');
    });
    return m;
  }, [teamLeadMapping]);
  const criticalById = useMemo(() => {
    const m = new Map();
    points.forEach((p) => m.set(String(p.id), p));
    return m;
  }, [points]);

  /* ======================= NOT ASSIGNED (ScrumMaster) ======================= */
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('');
  const [slaStatus, setSlaStatus] = useState('');
  const [teamLead, setTeamLead] = useState('');
  const [kpiProduct, setKpiProduct] = useState('');
  const [kpiClient, setKpiClient] = useState('');
  const [scrumFilterOpen, setScrumFilterOpen] = useState(false);
  const [markRow, setMarkRow] = useState(null);

  const productName = (x) => (x.Product || x.product || 'Unknown').trim() || 'Unknown';
  const clientName = (x) => (x.ClientName || x.clientName || 'Unknown').trim() || 'Unknown';
  const rowStatus = (x) => x.CurrentStatus || x.SLAStatus || '';

  const teamLeadCounts = useMemo(() => {
    const byModule = new Map();
    data.forEach((r) => byModule.set(Number(r.ModuleId), (byModule.get(Number(r.ModuleId)) || 0) + 1));
    const m = {};
    teamLeadMapping.forEach((x) => {
      if (!x.TeamLeadLoginName) return;
      m[x.TeamLeadLoginName] = (m[x.TeamLeadLoginName] || 0) + (byModule.get(Number(x.ModuleId)) || 0);
    });
    return m;
  }, [teamLeadMapping, data]);

  const searchTeamRows = useMemo(() => {
    let rows = data;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (x) =>
          String(x.id ?? '').toLowerCase().includes(q) ||
          (x.title || '').toLowerCase().includes(q) ||
          (x.assignedTo || '').toLowerCase().includes(q) ||
          (x.openedBy || '').toLowerCase().includes(q),
      );
    }
    if (teamLead) {
      const ids = modulesOfLead(teamLead);
      rows = rows.filter((x) => ids.has(Number(x.ModuleId)));
    }
    return rows;
  }, [data, search, teamLead, modulesOfLead]);

  const contextRows = useMemo(() => (severity === '' ? searchTeamRows : searchTeamRows.filter((x) => String(x.severity) === severity)), [searchTeamRows, severity]);

  const scrumStatusCounts = useMemo(() => {
    const rows = kpiClient || kpiProduct ? contextRows.filter((x) => (!kpiClient || clientName(x) === kpiClient) && (!kpiProduct || productName(x) === kpiProduct)) : contextRows;
    const m = {};
    rows.forEach((r) => {
      const st = rowStatus(r);
      if (st) m[st] = (m[st] || 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [contextRows, kpiClient, kpiProduct]);

  const scrumProductCounts = useMemo(() => {
    const m = new Map();
    contextRows
      .filter((x) => (!kpiClient || clientName(x) === kpiClient) && (!slaStatus || rowStatus(x) === slaStatus))
      .forEach((x) => m.set(productName(x), (m.get(productName(x)) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [contextRows, kpiClient, slaStatus]);

  const scrumClientCounts = useMemo(() => {
    const m = new Map();
    contextRows
      .filter((x) => (!kpiProduct || productName(x) === kpiProduct) && (!slaStatus || rowStatus(x) === slaStatus))
      .forEach((x) => m.set(clientName(x), (m.get(clientName(x)) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [contextRows, kpiProduct, slaStatus]);

  const scrumFiltered = useMemo(() => {
    let rows = contextRows;
    if (slaStatus) rows = rows.filter((x) => rowStatus(x) === slaStatus);
    if (kpiProduct) rows = rows.filter((x) => productName(x) === kpiProduct);
    if (kpiClient) rows = rows.filter((x) => clientName(x) === kpiClient);
    return rows;
  }, [contextRows, slaStatus, kpiProduct, kpiClient]);

  const severityCounts = useMemo(
    () => ({
      1: searchTeamRows.filter((x) => Number(x.severity) === 1).length,
      2: searchTeamRows.filter((x) => Number(x.severity) === 2).length,
      3: searchTeamRows.filter((x) => Number(x.severity) === 3).length,
    }),
    [searchTeamRows],
  );

  const statusOptions = useMemo(() => [...new Set(data.map((x) => x.CurrentStatus || x.SLAStatus).filter(Boolean))].sort(), [data]);
  const statusOptionCounts = useMemo(() => {
    const m = {};
    contextRows.forEach((r) => {
      const st = r.CurrentStatus || r.SLAStatus;
      if (st) m[st] = (m[st] || 0) + 1;
    });
    return m;
  }, [contextRows]);

  const scrumPager = usePager(scrumFiltered, 20, [search, severity, slaStatus, teamLead, kpiProduct, kpiClient].join('|'));

  /* ======================= CRITICAL POINTS ======================= */
  const [cSearch, setCSearch] = useState('');
  const [cClients, setCClients] = useState([]);
  const [cTeamLead, setCTeamLead] = useState('');
  const [cProduct, setCProduct] = useState('');
  const [cAgeing, setCAgeing] = useState('');
  const [cStatus, setCStatus] = useState([]);
  const [cTargetFilter, setCTargetFilter] = useState('');
  const [cClosedFilter, setCClosedFilter] = useState('');
  const [cSort, setCSort] = useState('');
  const [critFilterOpen, setCritFilterOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);

  const textMatch = (x, q, extended) =>
    String(x.id ?? '').toLowerCase().includes(q) ||
    (x.title || '').toLowerCase().includes(q) ||
    (x.clientName || '').toLowerCase().includes(q) ||
    (x.clientPatchVersion || '').toLowerCase().includes(q) ||
    (x.remarks || '').toLowerCase().includes(q) ||
    (extended && ((x.mainPatchSprint || '').toLowerCase().includes(q) || (x.criticalSprintPatch || '').toLowerCase().includes(q)));

  /* parent-level counts used by the filter controls */
  const critSearchRows = useMemo(() => {
    let rows = [...points];
    if (cSearch.trim()) rows = rows.filter((x) => textMatch(x, cSearch.toLowerCase(), false));
    if (cClosedFilter) rows = rows.filter((x) => matchesClosed(x, cClosedFilter));
    return rows;
  }, [points, cSearch, cClosedFilter]);

  const critClientOptions = useMemo(() => [...new Set(critSearchRows.map((p) => p.clientName).filter(Boolean))].sort(), [critSearchRows]);
  const critProductOptions = useMemo(() => [...new Set(critSearchRows.map((p) => p.product).filter(Boolean))].sort(), [critSearchRows]);

  const critTeamLeadCounts = useMemo(() => {
    const rows = critSearchRows.filter(
      (x) => (!cClients.length || cClients.includes(x.clientName)) && (!cProduct || x.product === cProduct) && (!cAgeing || matchesAgeing(x.markedAt, cAgeing)),
    );
    const byLead = new Map();
    teamLeadMapping.forEach((x) => {
      if (!x.TeamLeadLoginName) return;
      if (!byLead.has(x.TeamLeadLoginName)) byLead.set(x.TeamLeadLoginName, new Set());
      byLead.get(x.TeamLeadLoginName).add(Number(x.ModuleId));
    });
    const m = {};
    rows.forEach((r) => byLead.forEach((ids, lead) => ids.has(Number(r.moduleId)) && (m[lead] = (m[lead] || 0) + 1)));
    return m;
  }, [critSearchRows, cClients, cProduct, cAgeing, teamLeadMapping]);

  const critClientCounts = useMemo(() => {
    const m = {};
    critSearchRows
      .filter((x) => (!cProduct || x.product === cProduct) && (!cAgeing || matchesAgeing(x.markedAt, cAgeing)))
      .forEach((p) => p.clientName && (m[p.clientName] = (m[p.clientName] || 0) + 1));
    return m;
  }, [critSearchRows, cProduct, cAgeing]);

  const critProductCounts = useMemo(() => {
    const m = {};
    critSearchRows
      .filter((x) => (!cClients.length || cClients.includes(x.clientName)) && (!cAgeing || matchesAgeing(x.markedAt, cAgeing)))
      .forEach((p) => p.product && (m[p.product] = (m[p.product] || 0) + 1));
    return m;
  }, [critSearchRows, cClients, cAgeing]);

  const critStatusOptions = useMemo(() => {
    const ids = cTeamLead ? modulesOfLead(cTeamLead) : null;
    const m = {};
    critSearchRows
      .filter(
        (x) =>
          (!cClients.length || cClients.includes(x.clientName)) &&
          (!ids || ids.has(Number(x.moduleId))) &&
          (!cProduct || x.product === cProduct) &&
          (!cAgeing || matchesAgeing(x.markedAt, cAgeing)),
      )
      .forEach((r) => {
        const st = r.currentStatus || 'Yet to be Assigned';
        m[st] = (m[st] || 0) + 1;
      });
    return Object.keys(m)
      .sort()
      .map((status) => ({ status, count: m[status] }));
  }, [critSearchRows, cClients, cTeamLead, cProduct, cAgeing, modulesOfLead]);

  const critAgeingCounts = useMemo(() => {
    const rows = critSearchRows.filter((x) => !isClosed(x) && (!cClients.length || cClients.includes(x.clientName)) && (!cProduct || x.product === cProduct));
    const counts = { '': rows.length, 0: 0, 1: 0, '2-3': 0, '4-7': 0, '8-15': 0, '16+': 0 };
    rows.forEach((x) => {
      const b = bucketAgeing(getAgeingDays(x.markedAt));
      if (b) counts[b] += 1;
    });
    return counts;
  }, [critSearchRows, cClients, cProduct]);

  /* export / chart rows (criticalFilteredExport) */
  const critExportRows = useMemo(() => {
    let rows = [...points];
    if (cSearch.trim()) rows = rows.filter((x) => textMatch(x, cSearch.toLowerCase(), false));
    if (cClients.length) rows = rows.filter((x) => cClients.includes(x.clientName));
    if (cTeamLead) {
      const ids = modulesOfLead(cTeamLead);
      rows = rows.filter((x) => ids.has(Number(x.moduleId)));
    }
    if (cProduct) rows = rows.filter((x) => x.product === cProduct);
    if (cAgeing) rows = rows.filter((x) => matchesAgeing(x.markedAt, cAgeing));
    if (cStatus.length) rows = rows.filter((r) => cStatus.includes(r.currentStatus));
    if (cClosedFilter) rows = rows.filter((r) => matchesClosed(r, cClosedFilter));
    if (cTargetFilter === 'defined') rows = rows.filter(hasTarget);
    else if (cTargetFilter === 'not-defined') rows = rows.filter((r) => !hasTarget(r));
    return rows;
  }, [points, cSearch, cClients, cTeamLead, cProduct, cAgeing, modulesOfLead, cStatus, cTargetFilter, cClosedFilter]);

  /* list rows (CriticalPointsDashboard) */
  const listSearchRows = useMemo(() => {
    let rows = [...points];
    if (cSearch.trim()) rows = rows.filter((x) => textMatch(x, cSearch.toLowerCase(), true));
    if (cAgeing) rows = rows.filter((x) => matchesAgeing(x.markedAt, cAgeing));
    if (cClosedFilter) rows = rows.filter((x) => matchesClosed(x, cClosedFilter));
    if (cTeamLead) {
      const ids = modulesOfLead(cTeamLead);
      rows = rows.filter((x) => ids.has(Number(x.moduleId)));
    }
    return rows;
  }, [points, cSearch, cAgeing, cTeamLead, modulesOfLead, cClosedFilter]);

  const critList = useMemo(() => {
    let rows = listSearchRows;
    if (cClients.length) rows = rows.filter((x) => cClients.includes(x.clientName || 'Unknown'));
    if (cProduct) rows = rows.filter((x) => (x.product || 'Unknown') === cProduct);
    if (cStatus.length) rows = rows.filter((x) => cStatus.includes(x.currentStatus || 'Yet to be Assigned'));
    if (cTargetFilter === 'defined') rows = rows.filter(hasTarget);
    else if (cTargetFilter === 'not-defined') rows = rows.filter((x) => !hasTarget(x));
    if (cSort) {
      rows = [...rows].sort((a, b) => {
        const av = a.targetDate ? new Date(a.targetDate).getTime() : NaN;
        const bv = b.targetDate ? new Date(b.targetDate).getTime() : NaN;
        const ah = Number.isFinite(av);
        const bh = Number.isFinite(bv);
        if (!ah && !bh) return 0;
        if (!ah) return 1;
        if (!bh) return -1;
        return cSort === 'asc' ? av - bv : bv - av;
      });
    }
    return rows;
  }, [listSearchRows, cClients, cProduct, cStatus, cTargetFilter, cSort]);

  const listAgeingCounts = useMemo(() => {
    let rows = [...points];
    if (cSearch.trim()) rows = rows.filter((x) => textMatch(x, cSearch.toLowerCase(), true));
    rows = rows.filter((x) => !isClosed(x));
    if (cClients.length) rows = rows.filter((x) => cClients.includes(x.clientName || 'Unknown'));
    if (cProduct) rows = rows.filter((x) => (x.product || 'Unknown') === cProduct);
    const counts = { '': rows.length, 0: 0, 1: 0, '2-3': 0, '4-7': 0, '8-15': 0, '16+': 0 };
    rows.forEach((x) => {
      const b = bucketAgeing(getAgeingDays(x.markedAt));
      if (b) counts[b] += 1;
    });
    return counts;
  }, [points, cSearch, cClients, cProduct]);

  const listStatusCounts = useMemo(() => {
    const ids = cTeamLead ? modulesOfLead(cTeamLead) : null;
    const m = {};
    listSearchRows
      .filter(
        (r) =>
          (!cClients.length || cClients.includes(r.clientName)) &&
          (!cProduct || r.product === cProduct) &&
          (!ids || ids.has(Number(r.moduleId))) &&
          (!cAgeing || matchesAgeing(r.markedAt, cAgeing)),
      )
      .forEach((r) => {
        const st = r.currentStatus || 'Yet to be Assigned';
        m[st] = (m[st] || 0) + 1;
      });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [listSearchRows, cClients, cProduct, cTeamLead, cAgeing, modulesOfLead]);

  const uniqueClients = useMemo(() => new Set(listSearchRows.map((p) => p.clientName || 'Unknown')).size, [listSearchRows]);
  const uniqueProducts = useMemo(() => new Set(listSearchRows.map((p) => p.product || 'Unknown')).size, [listSearchRows]);

  const critPager = usePager(
    critList,
    30,
    [cSearch, cClients.join(), cProduct, cAgeing, cTeamLead, cStatus.join(), cTargetFilter, cSort, cClosedFilter].join('|'),
  );

  /* ---------------- critical actions ---------------- */
  const [pendingTargets, setPendingTargets] = useState({});
  const [savingTarget, setSavingTarget] = useState(null);
  const [remarksRow, setRemarksRow] = useState(null);
  const [remarksText, setRemarksText] = useState('');
  const [remarksError, setRemarksError] = useState('');
  const [closeRow, setCloseRow] = useState(null);
  const [closeRemarks, setCloseRemarks] = useState('');
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState('');
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [auditRow, setAuditRow] = useState(null);
  const [menuRow, setMenuRow] = useState(null);
  const [expanded, setExpanded] = useState({});

  const tKey = (r) => r?.slaId ?? r?.recordId ?? r?.id;

  const saveTarget = async (row, remarks = null) => {
    if (!isDevTeamLead) return toast.warning('Only Dev Team Lead can save the Target Date.');
    const key = tKey(row);
    const targetDate = pendingTargets[key];
    if (!targetDate) return;
    if (!userIdNum) return toast.error('Operator ID is not available.');
    const existing = row?.targetDate ? String(row.targetDate).substring(0, 10) : '';
    if (existing && remarks === null) {
      setRemarksError('');
      setRemarksText('');
      setRemarksRow(row);
      return;
    }
    if (existing && !String(remarks || '').trim()) return setRemarksError('Remarks are required when changing Target Date.');
    setSavingTarget(key);
    setRemarksError('');
    try {
      await api.post(
        'saveTargetandCloseCriticalPoint',
        {
          ID: String(row?.recordId ?? row?.id ?? ''),
          PointId: String(row?.id ?? ''),
          OperatorId: String(userIdNum),
          TargetDateTime: targetDate,
          TargetChangeRemarks: existing ? String(remarks || '').trim() : '',
          IsClosed: '0',
        },
        { keepEmpty: true },
      );
      setPendingTargets((p) => {
        const n = { ...p };
        delete n[key];
        return n;
      });
      if (existing) setRemarksRow(null);
      toast.success('Target date saved');
      await fetchCritical();
    } catch (e) {
      if (existing) setRemarksError(e.message || 'Unable to save target date.');
      else toast.error(e.message || 'Unable to save target date.');
    } finally {
      setSavingTarget(null);
    }
  };

  const closePoint = async () => {
    const row = closeRow;
    if (!row) return;
    if (!row.id) return setCloseError('Missing Point ID.');
    if (!(row.recordId ?? row.id)) return setCloseError('Missing Order ID.');
    if (!userIdNum) return setCloseError('Operator ID is not available.');
    setClosing(true);
    setCloseError('');
    try {
      await api.post(
        'saveTargetandCloseCriticalPoint',
        { ID: String(row.recordId ?? row.id), PointId: String(row.id), OperatorId: String(userIdNum), IsClosed: '1', ClosingRemarks: closeRemarks.trim() },
        { keepEmpty: true },
      );
      setCloseRow(null);
      toast.success('Critical point closed');
      await fetchCritical();
    } catch (e) {
      setCloseError(e.message || 'Unable to close Critical Point.');
    } finally {
      setClosing(false);
    }
  };

  const deletePoint = async () => {
    if (!deleteRow) return;
    const pointId = parseInt(deleteRow.id, 10);
    if (!pointId) return setDeleteError('Missing point id.');
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await api.post('deleteCriticalMarkedPoint', { pointId: String(pointId), operatorId: String(userIdNum) });
      toast.success(msgOf(res, 'Point removed from critical list.'));
      setDeleteRow(null);
      await fetchCritical();
    } catch (e) {
      setDeleteError(e.message || 'Unable to delete critical point.');
    } finally {
      setDeleting(false);
    }
  };

  /* ---------------- exports ---------------- */
  const exportScrum = async () => {
    if (!scrumFiltered.length) return toast.info('Nothing to export');
    try {
      await exportExcel('Scrum', {
        name: 'Scrum',
        rows: scrumFiltered,
        columns: [
          { header: 'ID', value: (x) => x.id },
          { header: 'Title', value: (x) => x.title },
          { header: 'Severity', value: (x) => x.severity },
          { header: 'Opened By', value: (x) => x.openedBy },
          { header: 'Opened Date', value: (x) => fmtDateTime(x.openedDate, '-') },
          { header: 'Current Assigned', value: (x) => x.assignedTo },
          { header: 'Current Assigned Date', value: (x) => fmtDateTime(x.assignedDate, '-') },
          { header: 'First Developer', value: (x) => x.FirstDevAssignedTo },
          { header: 'First Developer Date', value: (x) => fmtDateTime(x.FirstDevAssignedDateTime, '-') },
          { header: 'SLA Hours', value: (x) => x.SLAHours },
          { header: 'Remaining Hours', value: (x) => x.RemainingHours },
          { header: 'SLA Status', value: (x) => x.SLAStatus },
        ],
      });
    } catch (e) {
      toast.error(e.message);
    }
  };

  const devLeadNameOf = (moduleId) => {
    const m = teamLeadMapping.find((x) => Number(x.ModuleId) === Number(moduleId));
    return m?.TeamLeadName ?? m?.DevLeadName ?? m?.TeamLeadLoginName ?? '';
  };

  const exportCritical = async () => {
    if (!critExportRows.length) return toast.info('Nothing to export');
    try {
      await exportExcel('Critical_Points', {
        name: 'Critical Points',
        rows: critExportRows,
        columns: [
          { header: 'Bug ID', value: (x) => x.id },
          { header: 'Title', value: (x) => x.title },
          { header: 'Module Name', value: (x) => x.module || '' },
          { header: 'Product', value: (x) => x.product },
          { header: 'Client Name', value: (x) => x.clientName },
          { header: 'Assigned To', value: (x) => x.assignedTo },
          { header: 'Opened By', value: (x) => x.openedBy },
          { header: 'Opened Date', value: (x) => fmtDateTime(x.openedDate, '-') },
          { header: 'Point Type', value: (x) => x.pointType },
          { header: 'Current Patch Version/Fix Required', value: (x) => x.clientPatchVersion },
          { header: 'Current Status', value: (x) => x.currentStatus || 'Yet to be Assigned' },
          { header: 'Remarks', value: (x) => x.remarks },
          { header: 'Marked By', value: (x) => x.markedByName || x.markedBy || '' },
          { header: 'Critical Marked At (T1)', value: (x) => fmtDateTime(x.markedAt, '-') },
          { header: 'Ageing (CD - T1)', value: (x) => formatAgeing(x.markedAt) },
          { header: 'Ageing (CD - T2)', value: (x) => formatAgeing(x.openedDate) },
          { header: 'Dev Lead Name', value: (x) => devLeadNameOf(x.moduleId) },
          { header: 'Target Date', value: (x) => (x.targetDate ? fmtDate(x.targetDate, '') : '') },
          { header: 'Target Date Saved By', value: (x) => x.targetDateSavedBy || '' },
          { header: 'TargetDate Iteration', value: (x) => (Array.isArray(x.auditTargetDate) ? x.auditTargetDate.length : 0) },
          { header: 'Closed By', value: (x) => x.closedByName || x.closedBy || '' },
          { header: 'Closed Date Time', value: (x) => (x.closedDateTime ? fmtDateTime(x.closedDateTime, '') : '') },
        ],
      });
    } catch (e) {
      toast.error(e.message);
    }
  };

  useHeaderActions(
    [
      tab === 'critical' && canCriticalPointAdd && { key: 'add', icon: 'plus', onPress: () => setAddOpen(true) },
      tab === 'critical' && { key: 'chart', icon: 'bar-chart-2', onPress: () => (critExportRows.length ? setChartOpen(true) : toast.info('No records')) },
      tab !== 'dashboard' && { key: 'export', icon: 'download', onPress: tab === 'scrum' ? exportScrum : exportCritical },
      { key: 'refresh', icon: 'refresh-cw', onPress: () => (tab === 'scrum' ? fetchData() : fetchCritical()) },
    ],
    [tab, canCriticalPointAdd],
  );

  /* ========================= DASHBOARD ========================= */
  const [dashClients, setDashClients] = useState([]);
  const [drill, setDrill] = useState(null);

  const dashClientOptions = useMemo(() => {
    const counts = {};
    points.forEach((r) => {
      const cl = String(r.clientName || '').trim();
      if (cl) counts[cl] = (counts[cl] || 0) + 1;
    });
    return Object.keys(counts)
      .sort()
      .map((k) => ({ value: k, label: k, sub: String(counts[k]) }));
  }, [points]);

  const dashPoints = useMemo(() => (dashClients.length ? points.filter((r) => dashClients.includes(String(r.clientName || '').trim())) : points), [points, dashClients]);

  const dash = useMemo(() => {
    const statusMap = {};
    const clientMap = {};
    const productMap = {};
    const ageing = { Today: 0, '1 Day': 0, '2-3 Days': 0, '4-7 Days': 0, '8-15 Days': 0, 'More than 15 Days': 0 };
    const labelOf = { 0: 'Today', 1: '1 Day', '2-3': '2-3 Days', '4-7': '4-7 Days', '8-15': '8-15 Days', '16+': 'More than 15 Days' };
    let closed = 0;
    let targetDefined = 0;
    let targetOverdue = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dashPoints.forEach((r) => {
      const st = String(r.currentStatus || 'Yet to be Assigned').trim();
      statusMap[st] = (statusMap[st] || 0) + 1;
      const cl = String(r.clientName || 'No Client').trim() || 'No Client';
      clientMap[cl] = (clientMap[cl] || 0) + 1;
      const pr = String(r.product || 'No Product').trim() || 'No Product';
      productMap[pr] = (productMap[pr] || 0) + 1;
      if (isClosed(r)) closed += 1;
      else {
        const b = bucketAgeing(getAgeingDays(r.markedAt));
        if (b) ageing[labelOf[b]] += 1;
      }
      if (hasTarget(r)) {
        targetDefined += 1;
        const t = new Date(r.targetDate);
        if (!Number.isNaN(t.getTime())) {
          t.setHours(0, 0, 0, 0);
          if (t < today && !isClosed(r)) targetOverdue += 1;
        }
      }
    });
    const total = dashPoints.length;
    return {
      total,
      open: Math.max(total - closed, 0),
      closed,
      targetDefined,
      targetOverdue,
      targetNotDefined: Math.max(total - targetDefined, 0),
      statuses: sortCount(statusMap, 8),
      clients: sortCount(clientMap, 8),
      products: sortCount(productMap, 8),
      ageing: Object.entries(ageing).map(([label, count]) => ({ label, count })),
      impacted: new Set(dashPoints.map((x) => x.clientName).filter(Boolean)).size,
    };
  }, [dashPoints]);

  const openDrill = (type, label) => {
    let list = [];
    if (type === 'status') list = dashPoints.filter((r) => String(r.currentStatus || 'Yet to be Assigned').trim() === label);
    if (type === 'ageing') {
      const map = { Today: '0', '1 Day': '1', '2-3 Days': '2-3', '4-7 Days': '4-7', '8-15 Days': '8-15', 'More than 15 Days': '16+' };
      list = dashPoints.filter((r) => !isClosed(r) && bucketAgeing(getAgeingDays(r.markedAt)) === map[label]);
    }
    if (type === 'client') list = dashPoints.filter((r) => String(r.clientName || 'No Client').trim() === label);
    if (type === 'product') list = dashPoints.filter((r) => String(r.product || 'No Product').trim() === label);
    setDrill({ label, points: list });
  };

  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

  const renderDashboard = () => {
    if (cLoading && !points.length) return <Loading text="Loading Critical Points…" />;
    if (cError && !points.length) return <ErrorState message={cError} onRetry={fetchCritical} />;
    return (
      <FlatList
        data={[0]}
        keyExtractor={() => 'dash'}
        refreshing={refreshing}
        onRefresh={refreshAll}
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
        ListHeaderComponent={tabsBar}
        renderItem={() => (
          <View style={{ gap: 14 }}>
            <Select label="Clients" icon="briefcase" multi searchable placeholder="All Clients" value={dashClients} options={dashClientOptions} onChange={setDashClients} />
            <StatGrid columns={3} gap={8}>
              <StatCard compact label="Total Critical" value={dash.total} icon="flag" color={c.indigo} />
              <StatCard compact label="Open" value={dash.open} icon="alert-circle" color={c.rose} />
              <StatCard compact label="Closed" value={dash.closed} icon="check-circle" color={c.emerald} />
              <StatCard compact label="Target Overdue" value={dash.targetOverdue} icon="alert-triangle" color={c.orange} />
              <StatCard compact label="Target Defined" value={dash.targetDefined} icon="check" color={c.sky} />
              <StatCard compact label="Impacted Clients" value={dash.impacted} icon="package" color={c.violet} />
            </StatGrid>

            <Card>
              <SectionHeader title="Critical Points by Status" subtitle="Tap a status to view points" icon="pie-chart" />
              <View style={{ marginTop: 12 }}>
                <Donut
                  centerLabel="Points"
                  data={dash.statuses.map((x, i) => ({ label: x.label, value: x.count, color: DONUT_COLORS[i % DONUT_COLORS.length] }))}
                  onPressItem={(d) => openDrill('status', d.label)}
                />
              </View>
            </Card>

            <Card>
              <SectionHeader title="Critical Points by Ageing" subtitle="Open points grouped by ageing · older points need attention" icon="clock" color={c.amber} />
              <View style={{ marginTop: 14 }}>
                <HBars
                  data={dash.ageing.map((x, i) => ({ label: x.label, value: x.count, color: AGEING_COLORS[i] }))}
                  onPressItem={(d) => openDrill('ageing', d.label)}
                />
              </View>
            </Card>

            <Card>
              <SectionHeader title="Top Impacted Clients" subtitle="Top 8" icon="briefcase" color={c.violet} />
              <View style={{ marginTop: 14 }}>
                {dash.clients.length ? (
                  <HBars color={c.violet} data={dash.clients.map((x) => ({ label: x.label, value: x.count }))} onPressItem={(d) => openDrill('client', d.label)} />
                ) : (
                  <Text style={s.muted}>No client data available</Text>
                )}
              </View>
            </Card>

            <Card>
              <SectionHeader title="Top Affected Products" subtitle="Top 8" icon="box" color={c.teal} />
              <View style={{ marginTop: 14 }}>
                {dash.products.length ? (
                  <HBars color={c.teal} data={dash.products.map((x) => ({ label: x.label, value: x.count }))} onPressItem={(d) => openDrill('product', d.label)} />
                ) : (
                  <Text style={s.muted}>No product data available</Text>
                )}
              </View>
            </Card>

            <Card style={{ gap: 12 }}>
              <SectionHeader title="Open vs Closed" subtitle="Current critical point closure split" icon="git-commit" color={c.rose} />
              <View style={{ gap: 6 }}>
                <Row justify="space-between">
                  <Text style={s.metaLabel}>Open</Text>
                  <Text style={[s.metaValue, { color: c.rose }]}>
                    {dash.open} · {pct(dash.open, dash.total)}%
                  </Text>
                </Row>
                <Progress value={pct(dash.open, dash.total) / 100} color={c.rose} height={8} />
                <Row justify="space-between" style={{ marginTop: 6 }}>
                  <Text style={s.metaLabel}>Closed</Text>
                  <Text style={[s.metaValue, { color: c.emerald }]}>
                    {dash.closed} · {pct(dash.closed, dash.total)}%
                  </Text>
                </Row>
                <Progress value={pct(dash.closed, dash.total) / 100} color={c.emerald} height={8} />
              </View>
            </Card>

            <Card style={{ gap: 12 }}>
              <SectionHeader
                title="Target Date Coverage"
                subtitle="Target-date readiness across critical points"
                icon="target"
                color={c.sky}
                right={<Pill label={`${pct(dash.targetDefined, dash.total)}% defined`} color={c.sky} />}
              />
              {[
                { label: 'Target Date Defined', value: dash.targetDefined, color: c.sky, sub: null, bar: pct(dash.targetDefined, dash.total) },
                { label: 'Target Overdue', value: dash.targetOverdue, color: c.orange, sub: `${pct(dash.targetOverdue, dash.open)}% of open points` },
                { label: 'Target Date Not Defined', value: dash.targetNotDefined, color: c.slate, sub: 'Points requiring a target date' },
              ].map((x) => (
                <View key={x.label} style={[s.coverage, { backgroundColor: toneOf(x.color, dark).bg, borderColor: toneOf(x.color, dark).border }]}>
                  <Row justify="space-between">
                    <Text style={[s.coverageLabel, { color: x.color }]}>{x.label}</Text>
                    <Text style={[s.coverageValue, { color: x.color }]}>{x.value}</Text>
                  </Row>
                  {x.bar != null ? <Progress value={x.bar / 100} color={x.color} height={6} style={{ marginTop: 8 }} /> : <Text style={s.muted}>{x.sub}</Text>}
                </View>
              ))}
            </Card>
          </View>
        )}
      />
    );
  };

  /* ========================= NOT ASSIGNED ========================= */
  const scrumFilterCount = (severity ? 1 : 0) + (teamLead ? 1 : 0) + (kpiClient ? 1 : 0) + (kpiProduct ? 1 : 0) + (slaStatus ? 1 : 0);
  const remainingColor = (h) => {
    const n = Number(h);
    if (isNaN(n)) return c.textMuted;
    if (n < 0) return c.red;
    if (n <= 2) return c.orange;
    return c.emerald;
  };

  const renderScrum = () => {
    if (loading && !data.length) return <Loading text="Loading Scrum Dashboard…" />;
    if (error && !data.length) return <ErrorState message={error} onRetry={fetchData} />;
    const header = (
      <View style={{ gap: 12, paddingBottom: 4 }}>
        {tabsBar}
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search ID, title, assignee, creator" />
        <Segmented
          size="sm"
          value={severity}
          onChange={setSeverity}
          options={[
            { label: 'All', value: '', count: searchTeamRows.length },
            { label: 'Sev 1', value: '1', count: severityCounts[1], color: SEV_COLORS[1] },
            { label: 'Sev 2', value: '2', count: severityCounts[2], color: SEV_COLORS[2] },
            { label: 'Sev 3', value: '3', count: severityCounts[3], color: SEV_COLORS[3] },
          ]}
        />
        <Row gap={8}>
          <FilterButton count={scrumFilterCount - (severity ? 1 : 0)} onPress={() => setScrumFilterOpen(true)} />
          <Text style={s.count}>
            {scrumFiltered.length} record{scrumFiltered.length !== 1 ? 's' : ''}
          </Text>
        </Row>
        <ActiveFilters
          onClearAll={() => {
            setTeamLead('');
            setKpiClient('');
            setKpiProduct('');
            setSlaStatus('');
          }}
          items={[
            teamLead && { key: 'tl', label: `Dev Lead: ${teamLead}`, onClear: () => setTeamLead('') },
            kpiClient && { key: 'cl', label: `Client: ${kpiClient}`, onClear: () => setKpiClient('') },
            kpiProduct && { key: 'pr', label: `Product: ${kpiProduct}`, onClear: () => setKpiProduct('') },
            slaStatus && { key: 'st', label: `Status: ${slaStatus}`, onClear: () => setSlaStatus('') },
          ]}
        />
        {scrumStatusCounts.length > 0 && (
          <StatStrip
            items={scrumStatusCounts.map(([st, n]) => ({
              key: st,
              label: st,
              value: n,
              color: statusColor(st) === '#94A3B8' ? (st.toLowerCase() === 'breached' ? c.red : st.toLowerCase() === 'within sla' ? c.sky : c.slate) : statusColor(st),
              active: slaStatus === st,
              onPress: () => setSlaStatus((p) => (p === st ? '' : st)),
            }))}
          />
        )}
      </View>
    );
    return (
      <FlatList
        data={scrumPager.visible}
        keyExtractor={(r, i) => `${r.id ?? i}`}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        ListHeaderComponent={header}
        refreshing={refreshing}
        onRefresh={refreshAll}
        ListEmptyComponent={<Empty icon="package" title="No Records Found" subtitle="Try changing the filters." />}
        ListFooterComponent={scrumFiltered.length ? <LoadMore pager={scrumPager} /> : null}
        renderItem={({ item: row, index }) => {
          const marked = criticalById.has(String(row.id));
          const sevColor = SEV_COLORS[Number(row.severity)] || c.slate;
          const st = row.SLAStatus || '-';
          return (
            <Card accent={sevColor}>
              <Row justify="space-between">
                <Row gap={8} style={{ flex: 1 }}>
                  <Text style={s.idx}>{index + 1}</Text>
                  <Pressable onPress={() => openUrl(zentaoLink('bug', row.id))} hitSlop={6}>
                    <Text style={s.id}>#{row.id}</Text>
                  </Pressable>
                  <Pill label={`Sev ${row.severity ?? '-'}`} color={sevColor} solid />
                  <Pill label={st} color={st.toLowerCase() === 'breached' ? c.red : st.toLowerCase() === 'within sla' ? c.sky : statusColor(st)} />
                </Row>
                {canCriticalPointAdd && <MarkCriticalButton marked={marked} onPress={() => setMarkRow(row)} />}
              </Row>
              <Text style={s.title}>{row.title || '-'}</Text>
              <Row gap={10} style={s.slaRow}>
                <View style={s.slaBox}>
                  <Text style={s.slaLabel}>SLA</Text>
                  <Text style={s.slaValue}>{row.SLAHours ?? '-'}</Text>
                </View>
                <View style={s.slaBox}>
                  <Text style={s.slaLabel}>Remaining</Text>
                  <Text style={[s.slaValue, { color: remainingColor(row.RemainingHours) }]}>{row.RemainingHours ?? '-'}</Text>
                </View>
                <View style={[s.slaBox, { flex: 1.6 }]}>
                  <Text style={s.slaLabel}>Assigned To</Text>
                  <Text style={s.slaValue} numberOfLines={1}>
                    {row.assignedTo || '-'}
                  </Text>
                </View>
              </Row>
              <KVGrid style={{ marginTop: 10 }}>
                <KV label="Product" value={row.Product || '-'} />
                <KV label="Module" value={row.Module || '-'} />
                <KV label="Client" value={row.ClientName || '-'} />
                <KV label="Opened By" value={row.openedBy || '-'} />
                <KV label="Opened" value={fmtDateTime(row.openedDate, '-')} />
                <KV label="Assigned" value={fmtDateTime(row.assignedDate, '-')} />
                <KV label="First Dev" value={row.FirstDevAssignedTo || '-'} />
                <KV label="First Dev Date" value={fmtDateTime(row.FirstDevAssignedDateTime, '-')} />
              </KVGrid>
            </Card>
          );
        }}
      />
    );
  };

  /* ========================= CRITICAL LIST ========================= */
  const critFilterCount =
    (cClients.length ? 1 : 0) + (cTeamLead ? 1 : 0) + (cProduct ? 1 : 0) + (cAgeing ? 1 : 0) + (cStatus.length ? 1 : 0) + (cTargetFilter ? 1 : 0) + (cClosedFilter ? 1 : 0);
  const clearCritFilters = () => {
    setCClients([]);
    setCTeamLead('');
    setCProduct('');
    setCAgeing('');
    setCStatus([]);
    setCTargetFilter('');
    setCClosedFilter('');
  };

  const critActions = (row) => {
    const closed = isClosed(row);
    const audits = Array.isArray(row.auditTargetDate) ? row.auditTargetDate : [];
    const close = () => setMenuRow(null);
    return [
      { key: 'open', label: 'Open in Zentao', icon: 'external-link', color: c.sky, onPress: () => (close(), openUrl(zentaoLink('bug', row.id))) },
      showCriticalActions &&
        audits.length > 0 && { key: 'audit', label: 'Target date audit history', icon: 'info', color: c.indigo, sub: `${audits.length} change(s)`, onPress: () => (close(), setAuditRow(row)) },
      closed
        ? {
            key: 'closed',
            label: 'Closed',
            icon: 'check-circle',
            color: c.emerald,
            disabled: true,
            sub: `By ${row.closedByName || row.closedBy || '-'} · ${row.closedDateTime ? fmtDateTime(row.closedDateTime) : '-'}${row.closingRemarks ? ` · ${row.closingRemarks}` : ''}`,
          }
        : showCriticalActions
          ? {
              key: 'close',
              label: 'Mark as completed',
              icon: 'check',
              color: c.emerald,
              onPress: () => (close(), setCloseError(''), setCloseRemarks(''), setCloseRow(row)),
            }
          : isDevTeamLead
            ? { key: 'closed-na', label: 'Close not available', icon: 'check-circle', color: c.slate, disabled: true, sub: 'Close action is available only to Support / Product Owner or User ID 1' }
            : null,
      showCriticalActions && {
        key: 'delete',
        label: 'Delete critical point',
        icon: 'trash-2',
        color: c.red,
        onPress: () => (close(), setDeleteError(''), setDeleteRow(row)),
      },
    ].filter(Boolean);
  };

  const renderCritical = () => {
    if (cLoading && !points.length) return <Loading text="Loading Critical Points…" />;
    if (cError && !points.length) return <ErrorState message={cError} onRetry={fetchCritical} />;
    const header = (
      <View style={{ gap: 12, paddingBottom: 4 }}>
        {tabsBar}
        <SearchBar value={cSearch} onChangeText={setCSearch} placeholder="Search ID, title, client, version, remarks" />
        <Row gap={8}>
          <FilterButton count={critFilterCount} onPress={() => setCritFilterOpen(true)} />
          <Chip
            label="Non Target Date"
            icon="calendar"
            active={cTargetFilter === 'not-defined'}
            color={c.indigo}
            onPress={() => setCTargetFilter((v) => (v === 'not-defined' ? '' : 'not-defined'))}
          />
          <Chip
            label={cSort === 'asc' ? 'Target ↑' : cSort === 'desc' ? 'Target ↓' : 'Target ⇅'}
            active={!!cSort}
            color={c.teal}
            onPress={() => setCSort((p) => (p === '' ? 'asc' : p === 'asc' ? 'desc' : ''))}
          />
        </Row>
        <ActiveFilters
          onClearAll={clearCritFilters}
          items={[
            cClients.length && { key: 'cl', label: `Client: ${cClients.join(', ')}`, onClear: () => setCClients([]) },
            cTeamLead && { key: 'tl', label: `Dev Lead: ${cTeamLead}`, onClear: () => setCTeamLead('') },
            cProduct && { key: 'pr', label: `Product: ${cProduct}`, onClear: () => setCProduct('') },
            cAgeing && { key: 'ag', label: `Ageing: ${AGEING_OPTIONS.find((o) => o.value === cAgeing)?.label}`, onClear: () => setCAgeing('') },
            cStatus.length && { key: 'st', label: `Status: ${cStatus.join(', ')}`, onClear: () => setCStatus([]) },
            cClosedFilter && { key: 'cf', label: cClosedFilter === 'closed' ? 'Closed' : 'Not Closed', onClear: () => setCClosedFilter('') },
          ]}
        />
        <StatStrip
          items={[
            { key: 'm', label: 'Marked Critical', value: listSearchRows.length, color: c.rose, active: !cClients.length && !cProduct, onPress: () => (setCClients([]), setCProduct('')) },
            { key: 'c', label: 'Impacted Clients', value: uniqueClients, color: c.violet, active: cClients.length > 0, onPress: () => setCClients([]) },
            { key: 'p', label: 'Affected Products', value: uniqueProducts, color: c.emerald, active: !!cProduct, onPress: () => setCProduct('') },
          ]}
        />
        <StatStrip
          items={AGEING_OPTIONS.map((o, i) => ({
            key: o.value,
            label: o.label,
            value: listAgeingCounts[o.value] || 0,
            color: AGEING_COLORS[i],
            active: cAgeing === o.value,
            onPress: () => setCAgeing((p) => (p === o.value ? '' : o.value)),
          }))}
        />
        {listStatusCounts.length > 0 && (
          <StatStrip
            items={listStatusCounts.map(([st, n]) => ({
              key: st,
              label: st,
              value: n,
              color: statusColor(st),
              active: cStatus.includes(st),
              onPress: () => setCStatus((p) => (p.includes(st) ? p.filter((x) => x !== st) : [...p, st])),
            }))}
          />
        )}
        <Text style={s.count}>{critList.length} record(s)</Text>
        {!!cError && <Banner type="error" text={cError} />}
      </View>
    );
    return (
      <FlatList
        data={critPager.visible}
        keyExtractor={(r, i) => `${r.recordId ?? ''}-${r.id ?? i}`}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        ListHeaderComponent={header}
        refreshing={refreshing}
        onRefresh={refreshAll}
        ListEmptyComponent={
          points.length === 0 ? (
            <Empty icon="flag" title="No critical points yet" subtitle="Use Mark Critical on the Scrum Dashboard to add points." />
          ) : (
            <Empty icon="filter" title="No records match the current filters." />
          )
        }
        ListFooterComponent={critList.length ? <LoadMore pager={critPager} /> : null}
        renderItem={({ item: row }) => {
          const closed = isClosed(row);
          const key = tKey(row);
          const dateValue = row.targetDate ? String(row.targetDate).substring(0, 10) : '';
          const pending = pendingTargets[key];
          const tds = getTargetDateStatus(row.targetDate);
          const audits = Array.isArray(row.auditTargetDate) ? row.auditTargetDate.length : 0;
          const open = !!expanded[key];
          const devLead = devLeadByModuleId.get(Number(row.moduleId)) || '-';
          return (
            <Pressable onPress={() => setMenuRow(row)}>
              <Card accent={closed ? c.emerald : c.rose}>
                <Row justify="space-between">
                  <Row gap={8} style={{ flex: 1 }} wrap>
                    <Pressable onPress={() => openUrl(zentaoLink('bug', row.id))} hitSlop={6}>
                      <Text style={s.id}>#{row.id}</Text>
                    </Pressable>
                    {closed ? <Pill label="Closed" icon="check" color={c.emerald} solid /> : <Pill label={formatAgeing(row.markedAt)} icon="clock" color={c.rose} />}
                    <Pill label={row.currentStatus || 'Yet to be Assigned'} color={statusColor(row.currentStatus || 'yet to be assigned')} />
                  </Row>
                  <Feather name="more-vertical" size={18} color={c.textFaint} />
                </Row>
                <Text style={s.title} numberOfLines={open ? undefined : 3}>
                  {row.title || '-'}
                </Text>
                <Row gap={6} wrap style={{ marginTop: 8 }}>
                  {!!row.clientPatchVersion && <Pill label={row.clientPatchVersion} icon="tag" color={c.rose} />}
                  {!!row.mainPatchSprint && <Pill label={row.mainPatchSprint} icon="zap" color={c.indigo} />}
                </Row>
                <KVGrid style={{ marginTop: 10 }}>
                  <KV label="Client" value={row.clientName || '-'} />
                  <KV label="Product" value={row.product || '-'} />
                  <KV label="Module" value={row.module || '-'} />
                  <KV label="Assigned To" value={row.assignedTo || '-'} />
                </KVGrid>

                <View style={s.editRow}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={s.slaLabel}>Target Date</Text>
                    {isDevTeamLead ? (
                      <Row gap={6}>
                        <DateField
                          compact
                          style={{ flex: 1 }}
                          label="Set date"
                          clearable={false}
                          value={pending ?? dateValue}
                          onChange={(v) => setPendingTargets((p) => ({ ...p, [key]: v }))}
                        />
                        {!!pending && pending !== dateValue && (
                          <Pressable
                            onPress={() => saveTarget(row)}
                            disabled={savingTarget === key}
                            style={[s.saveBtn, { backgroundColor: c.emerald, opacity: savingTarget === key ? 0.5 : 1 }]}
                          >
                            <Feather name={savingTarget === key ? 'loader' : 'save'} size={15} color="#fff" />
                          </Pressable>
                        )}
                      </Row>
                    ) : (
                      <Text style={[s.slaValue, tds.color && { color: tds.color }]}>{dateValue ? fmtDate(dateValue) : '-'}</Text>
                    )}
                    {!!row.targetDate && (
                      <Row gap={6} wrap>
                        {!!tds.status && <Pill label={tds.status} color={tds.color} />}
                        <Text style={s.muted}>by {row.targetDateSavedBy || '-'}</Text>
                      </Row>
                    )}
                  </View>
                  <View style={{ alignItems: 'center', gap: 4 }}>
                    <Text style={s.slaLabel}>Iterations</Text>
                    <Text style={[s.slaValue, { fontSize: 18 }]}>{audits}</Text>
                  </View>
                </View>

                <Row justify="space-between" style={{ marginTop: 10 }}>
                  <Text style={s.muted} numberOfLines={1}>
                    Marked by {row.markedByName || row.markedBy || '-'} · {fmtDateTime(row.markedAt, '-')}
                  </Text>
                  <Pressable hitSlop={8} onPress={() => setExpanded((e) => ({ ...e, [key]: !e[key] }))} style={s.moreBtn}>
                    <Text style={s.moreText}>{open ? 'Less' : 'Details'}</Text>
                    <Feather name={open ? 'chevron-up' : 'chevron-down'} size={14} color={c.primary} />
                  </Pressable>
                </Row>
                {open && (
                  <KVGrid style={{ marginTop: 10 }}>
                    <KV label="Ageing (CD - T1)" value={formatAgeing(row.markedAt)} />
                    <KV label="Ageing (CD - T2)" value={formatAgeing(row.openedDate)} />
                    <KV label="Dev Lead" value={devLead} />
                    <KV label="Opened By" value={row.openedBy || '-'} />
                    <KV label="Opened Date (T2)" value={fmtDateTime(row.openedDate, '-')} />
                    <KV label="Marked At (T1)" value={fmtDateTime(row.markedAt, '-')} />
                    <KV label="Remarks" value={row.remarks || '-'} wide />
                  </KVGrid>
                )}
              </Card>
            </Pressable>
          );
        }}
      />
    );
  };

  /* ---------------- tabs ---------------- */
  const tabsBar = (
    <Segmented
      scroll={false}
      size="sm"
      value={tab}
      onChange={(t) => {
        setTab(t);
        if (t !== 'scrum') fetchCritical();
      }}
      options={[
        { label: 'Overview', value: 'dashboard' },
        { label: 'Not Assigned', value: 'scrum' },
        { label: `Critical${points.length ? ` (${points.length})` : ''}`, value: 'critical', color: c.rose },
      ]}
    />
  );

  const clientChart = useMemo(() => {
    const m = {};
    critExportRows.forEach((r) => {
      const k = (r.clientName && String(r.clientName).trim()) || '(No Client)';
      m[k] = (m[k] || 0) + 1;
    });
    return Object.entries(m)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [critExportRows]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {tab === 'dashboard' ? renderDashboard() : tab === 'scrum' ? renderScrum() : renderCritical()}

      {/* Not Assigned filters */}
      <FilterSheet
        visible={scrumFilterOpen}
        onClose={() => setScrumFilterOpen(false)}
        onClear={() => {
          setTeamLead('');
          setKpiClient('');
          setKpiProduct('');
          setSlaStatus('');
        }}
        subtitle={`${scrumFiltered.length} record(s)`}
      >
        <Select
          label="Dev Lead"
          icon="code"
          allLabel="All Dev Leads"
          value={teamLead}
          options={teamLeadOptions.map((x) => ({ value: x, label: x, sub: String(teamLeadCounts[x] || 0) }))}
          onChange={setTeamLead}
        />
        <Select
          label="Client"
          icon="briefcase"
          allLabel="All Clients"
          searchable
          value={kpiClient}
          options={scrumClientCounts.map(([n, k]) => ({ value: n, label: n, sub: String(k) }))}
          onChange={setKpiClient}
        />
        <Select
          label="Product"
          icon="box"
          allLabel="All Products"
          value={kpiProduct}
          options={scrumProductCounts.map(([n, k]) => ({ value: n, label: n, sub: String(k) }))}
          onChange={setKpiProduct}
        />
        <Select
          label="Status"
          icon="activity"
          allLabel="All Status"
          value={slaStatus}
          options={statusOptions.map((x) => ({ value: x, label: x, sub: String(statusOptionCounts[x] || 0) }))}
          onChange={setSlaStatus}
        />
      </FilterSheet>

      {/* Critical filters */}
      <FilterSheet visible={critFilterOpen} onClose={() => setCritFilterOpen(false)} onClear={clearCritFilters} subtitle={`${critList.length} record(s)`}>
        <Select
          label="Clients"
          icon="briefcase"
          multi
          searchable
          placeholder="All Clients"
          value={cClients}
          options={critClientOptions.map((x) => ({ value: x, label: x, sub: String(critClientCounts[x] || 0) }))}
          onChange={setCClients}
        />
        <Select
          label="Dev Lead"
          icon="code"
          allLabel="All Dev Leads"
          value={cTeamLead}
          options={teamLeadOptions.map((x) => ({ value: x, label: x, sub: String(critTeamLeadCounts[x] || 0) }))}
          onChange={setCTeamLead}
        />
        <Select
          label="Product"
          icon="box"
          allLabel="All Products"
          value={cProduct}
          options={critProductOptions.map((x) => ({ value: x, label: x, sub: String(critProductCounts[x] || 0) }))}
          onChange={setCProduct}
        />
        <Select
          label="Ageing"
          icon="clock"
          allLabel={`All Ageing (${critAgeingCounts[''] ?? 0})`}
          value={cAgeing}
          options={AGEING_OPTIONS.map((o) => ({ value: o.value, label: o.label, sub: String(critAgeingCounts[o.value] ?? 0) }))}
          onChange={setCAgeing}
        />
        <Select
          label="Current Status"
          icon="activity"
          multi
          placeholder="All Statuses"
          value={cStatus}
          options={critStatusOptions.map((x) => ({ value: x.status, label: x.status, sub: String(x.count), color: statusColor(x.status) }))}
          onChange={setCStatus}
        />
        <Segmented
          scroll={false}
          value={cClosedFilter}
          onChange={setCClosedFilter}
          options={[{ label: 'All', value: '' }, ...CLOSED_OPTIONS.map((o) => ({ ...o, color: o.value === 'closed' ? c.emerald : c.rose }))]}
        />
        <ToggleRow
          label="Non Target Date"
          description="Show only records where Target Date is not defined"
          value={cTargetFilter === 'not-defined'}
          onChange={(v) => setCTargetFilter(v ? 'not-defined' : '')}
        />
      </FilterSheet>

      {/* Critical row actions */}
      <Sheet visible={!!menuRow} onClose={() => setMenuRow(null)} title={menuRow ? `Bug #${menuRow.id}` : ''} subtitle={menuRow?.title} icon="flag">
        {menuRow && <ActionList actions={critActions(menuRow)} />}
      </Sheet>

      {/* Target date change remarks */}
      <Sheet
        visible={!!remarksRow}
        onClose={() => savingTarget == null && setRemarksRow(null)}
        title="Target Date Change Remarks"
        subtitle={remarksRow ? `#${remarksRow.id} · ${remarksRow.title || 'Critical Point'}` : ''}
        icon="edit-3"
        footer={
          <Row gap={10}>
            <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setRemarksRow(null)} disabled={savingTarget != null} />
            <Button
              title="Save Target Date"
              icon="save"
              style={{ flex: 1.4 }}
              loading={savingTarget != null}
              disabled={!remarksText.trim()}
              onPress={() => saveTarget(remarksRow, remarksText)}
            />
          </Row>
        }
      >
        <Card flat>
          <Text style={s.muted}>
            Current Target Date: <Text style={s.metaValue}>{remarksRow?.targetDate ? fmtDateTime(remarksRow.targetDate) : '-'}</Text>
          </Text>
        </Card>
        <TextField label="Remarks" required multiline maxLength={200} showCount value={remarksText} onChangeText={setRemarksText} placeholder="Enter reason for changing the Target Date…" />
        <Banner type="error" text={remarksError} />
      </Sheet>

      {/* Close critical point */}
      <Sheet
        visible={!!closeRow}
        onClose={() => !closing && setCloseRow(null)}
        title="Close Critical Point"
        subtitle={closeRow ? `#${closeRow.id} · ${closeRow.title || 'Critical Point'}` : ''}
        icon="check-circle"
        accent={c.emerald}
        footer={
          <Row gap={10}>
            <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setCloseRow(null)} disabled={closing} />
            <Button title="Yes, Close Point" icon="check" variant="success" style={{ flex: 1.4 }} loading={closing} onPress={closePoint} />
          </Row>
        }
      >
        <Text style={s.body}>Are you sure you want to mark this Critical Point as closed?</Text>
        <Card flat>
          <KVGrid>
            <KV label="Target Date" value={closeRow?.targetDate ? fmtDateTime(closeRow.targetDate) : 'Not set'} />
            <KV label="Current Status" value={closeRow?.currentStatus || 'Yet to be Assigned'} />
          </KVGrid>
        </Card>
        <TextField
          label="Closing Remarks (Optional)"
          multiline
          maxLength={200}
          showCount
          value={closeRemarks}
          onChangeText={(t) => setCloseRemarks(t.slice(0, 200))}
          placeholder="Enter closing remarks…"
        />
        <Banner type="error" text={closeError} />
      </Sheet>

      {/* Delete */}
      <Sheet
        visible={!!deleteRow}
        onClose={() => setDeleteRow(null)}
        title="Delete critical point"
        icon="trash-2"
        accent={c.red}
        footer={
          <Row gap={10}>
            <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setDeleteRow(null)} />
            <Button title="Delete" icon="trash-2" variant="danger" style={{ flex: 1.4 }} loading={deleting} onPress={deletePoint} />
          </Row>
        }
      >
        <Text style={s.body}>Remove this point from the Critical Points?</Text>
        <Text style={s.title}>
          #{deleteRow?.id} · {deleteRow?.title || 'Untitled'}
        </Text>
        <Banner type="error" text={deleteError} />
      </Sheet>

      {/* Target date audit */}
      <Sheet
        visible={!!auditRow}
        onClose={() => setAuditRow(null)}
        title="Target Date Audit History"
        subtitle={auditRow ? `#${auditRow.id} · ${auditRow.title || 'Critical Point'}` : ''}
        icon="info"
        size="full"
      >
        {(auditRow?.auditTargetDate || []).length === 0 ? (
          <Empty icon="info" title="No Target Date audit history available." />
        ) : (
          (auditRow?.auditTargetDate || []).map((a, i) => (
            <Card flat key={String(a?.ID ?? i)} style={{ gap: 8 }}>
              <Row justify="space-between">
                <Text style={[s.metaValue, { color: c.primary }]}>Audit #{a?.ID ?? '-'}</Text>
                <Text style={s.muted}>{a?.AddedDateTime ? fmtDateTime(a.AddedDateTime) : '-'}</Text>
              </Row>
              <KVGrid>
                <KV label="Order ID" value={a?.OrderId ?? '-'} />
                <KV label="Point ID" value={a?.PointId ?? '-'} />
                <KV label="Target Date" value={a?.TargetDateTime ? fmtDateTime(a.TargetDateTime) : '-'} />
                <KV label="Saved By" value={a?.TargetSavedByNameAudit || a?.TargetSavedBy || '-'} />
                <KV label="Operator ID" value={a?.OperatorId ?? '-'} />
                <KV label="Added" value={a?.AddedDateTime ? fmtDateTime(a.AddedDateTime) : '-'} />
              </KVGrid>
              <View style={s.remarkBox}>
                <Text style={s.slaLabel}>Change Remarks</Text>
                <Text style={s.body}>{a?.TargetDateChangeRemarks || '-'}</Text>
              </View>
            </Card>
          ))
        )}
      </Sheet>

      {/* Dashboard drill-down */}
      <Sheet visible={!!drill} onClose={() => setDrill(null)} title={drill?.label} subtitle={drill ? `${drill.points.length} critical point(s)` : ''} icon="list" size="full">
        {drill?.points.length ? (
          drill.points.map((r, i) => (
            <Card flat key={`${r.id}-${i}`} style={{ gap: 6 }}>
              <Row justify="space-between">
                <Pressable onPress={() => openUrl(zentaoLink('bug', r.id))}>
                  <Text style={s.id}>#{r.id ?? '-'}</Text>
                </Pressable>
                <Pill label={r.currentStatus || 'Yet to be Assigned'} color={c.sky} />
              </Row>
              <Text style={s.titleSm}>{r.title || '-'}</Text>
              <Text style={s.muted}>
                {[r.clientName, r.product].filter(Boolean).join(' · ') || '-'}
              </Text>
              <Row gap={12}>
                <Text style={s.muted}>Marked: {r.markedAt ? fmtDateTime(r.markedAt) : '-'}</Text>
                <Text style={s.muted}>Target: {r.targetDate ? fmtDate(r.targetDate) : '-'}</Text>
              </Row>
            </Card>
          ))
        ) : (
          <Empty icon="inbox" title="No critical points found for this selection." />
        )}
      </Sheet>

      {/* Client chart */}
      <Sheet visible={chartOpen} onClose={() => setChartOpen(false)} title="Client Breakdown" subtitle={`Critical Points · ${critExportRows.length} records`} icon="bar-chart-2" size="full">
        <HBars color={c.teal} data={clientChart.map((x) => ({ ...x, sub: `${pct(x.value, critExportRows.length)}%` }))} />
      </Sheet>

      <MarkCriticalSheet visible={addOpen} addMode onClose={() => setAddOpen(false)} onSaved={fetchCritical} />
      <MarkCriticalSheet
        visible={!!markRow}
        row={markRow}
        existing={markRow ? criticalById.get(String(markRow.id)) : undefined}
        onClose={() => setMarkRow(null)}
        onSaved={fetchCritical}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  idx: { color: c.textFaint, fontWeight: '800', fontSize: 12 },
  id: { color: c.primary, fontWeight: '900', fontSize: 15, textDecorationLine: 'underline' },
  title: { color: c.text, fontSize: 14, fontWeight: '700', marginTop: 8, lineHeight: 20 },
  titleSm: { color: c.text, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  count: { marginLeft: 'auto', color: c.textFaint, fontSize: 12, fontWeight: '700' },
  muted: { color: c.textMuted, fontSize: 12 },
  body: { color: c.text, fontSize: 13.5, lineHeight: 20 },
  metaLabel: { color: c.textMuted, fontSize: 12.5, fontWeight: '700' },
  metaValue: { color: c.text, fontSize: 13, fontWeight: '800' },
  slaRow: { marginTop: 10, padding: 10, borderRadius: 14, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border },
  slaBox: { flex: 1, gap: 2 },
  slaLabel: { color: c.textFaint, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  slaValue: { color: c.text, fontSize: 14, fontWeight: '800' },
  editRow: { flexDirection: 'row', gap: 12, marginTop: 12, padding: 10, borderRadius: 14, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border },
  saveBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  moreBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: c.primarySoft },
  moreText: { color: c.primary, fontSize: 11.5, fontWeight: '800' },
  coverage: { padding: 12, borderRadius: 14, borderWidth: 1, gap: 4 },
  coverageLabel: { fontSize: 12, fontWeight: '800' },
  coverageValue: { fontSize: 22, fontWeight: '900' },
  remarkBox: { padding: 10, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, gap: 4 },
}));
