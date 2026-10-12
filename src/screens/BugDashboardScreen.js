import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';
import { zentaoLink } from '../api/config';
import { useAuth } from '../context/AuthContext';
import { useHeaderActions } from '../navigation/ShellContext';
import { makeStyles, useTheme } from '../theme/theme';
import { fmtDate, toYMD } from '../utils/format';
import { exportExcel, openUrl } from '../utils/exporter';
import {
  ActiveFilters,
  Banner,
  Bars,
  Button,
  Card,
  DateField,
  Donut,
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
  Select,
  Sheet,
  StatCard,
  StatGrid,
  TextField,
  usePager,
  useToast,
} from '../ui';

/** Port of ZentaoBugSLADashboard.jsx (Bug Dashboard) */

function calculateSLA(bug, targetHours = 24) {
  if (!bug.firstAssignedDate) return { hasStarted: false, elapsedHours: 0, percent: 0, isBreached: false, tlAssignedDate: null, statusText: 'Not yet assigned', isResolved: false };
  const isClosed = bug.rawStatus === 'resolved' || bug.rawStatus === 'closed';
  const start = new Date(bug.firstAssignedDate);
  const elapsedHours = Math.max(0, (new Date() - start) / 3600000);
  const percent = Math.min(100, (elapsedHours / targetHours) * 100);
  const isBreached = !isClosed && elapsedHours > targetHours;
  let statusText;
  if (isClosed) statusText = bug.rawStatus === 'closed' ? `Closed in ${elapsedHours.toFixed(1)}h` : `Resolved in ${elapsedHours.toFixed(1)}h`;
  else if (isBreached) statusText = `BREACHED: ${elapsedHours.toFixed(1)}h / ${targetHours}h`;
  else statusText = `${elapsedHours.toFixed(1)}h / ${targetHours}h`;
  return { hasStarted: true, tlAssignedDate: start, elapsedHours, percent, isBreached, isResolved: !!isClosed, statusText };
}
function slaLabel(sla) {
  if (!sla.hasStarted) return { text: 'NOT ASSIGNED', color: '#94A3B8' };
  if (sla.isResolved) return { text: 'COMPLETED', color: '#16A34A' };
  if (sla.isBreached) return { text: 'CRITICAL', color: '#DC2626' };
  if (sla.percent > 80) return { text: 'WARNING', color: '#D97706' };
  return { text: 'ON TRACK', color: '#16A34A' };
}
const barColor = (sla) => (sla.isBreached ? '#DC2626' : sla.percent > 80 ? '#D97706' : '#16A34A');
const fmtTs = (d) => {
  if (!d) return '';
  const x = new Date(d);
  if (isNaN(x)) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(x.getDate())}/${p(x.getMonth() + 1)}/${x.getFullYear()} ${p(x.getHours())}:${p(x.getMinutes())}:${p(x.getSeconds())}`;
};
function readField(row, ...keys) {
  if (!row || typeof row !== 'object') return undefined;
  for (const k of keys) if (Object.prototype.hasOwnProperty.call(row, k) && row[k] !== undefined && row[k] !== null) return row[k];
  const names = Object.keys(row);
  for (const k of keys) {
    const a = names.find((n) => n.toLowerCase() === k.toLowerCase());
    if (a && row[a] !== undefined && row[a] !== null) return row[a];
  }
  return undefined;
}
const normalizeRows = (p) => (Array.isArray(p) ? p : [p?.data, p?.Data, p?.items, p?.Items, p?.result, p?.Result].find(Array.isArray) || null);
const buildTLMap = (m) => {
  const map = {};
  m.forEach((x) => {
    map[`${x.ProductId}_${x.ModuleId}`] = x.TeamLeadLoginName || '';
    if (!map[`_${x.ModuleId}`]) map[`_${x.ModuleId}`] = x.TeamLeadLoginName || '';
  });
  return map;
};
const resolveTL = (bug, map) => (!bug.moduleId ? '' : map[`${bug.productId ?? ''}_${bug.moduleId}`] || map[`_${bug.moduleId}`] || '');

const STATUS_CONFIG = {
  'In Development': { color: '#3B82F6', label: 'IN DEV' },
  'Pending SIT Merge': { color: '#A855F7', label: 'PENDING SIT MERGE' },
  'In Testing': { color: '#F59E0B', label: 'TESTING' },
  'SIT Pass': { color: '#16A34A', label: 'SIT PASS' },
  Resolved: { color: '#64748B', label: 'RESOLVED' },
  'On Support': { color: '#D97706', label: 'ON SUPPORT' },
};
const STATUS_OPTIONS = ['Critical', 'In Development', 'Pending SIT Merge', 'In Testing', 'SIT Pass', 'On Support', 'Resolved', 'Closed'];
const SLA_STATUS_OPTIONS = [
  { value: 'breached', label: 'Breached' },
  { value: 'warning', label: 'Warning' },
  { value: 'good', label: 'On Track' },
];
const CACHE_MS = 5 * 60 * 1000;
const today = () => toYMD(new Date());

export default function BugDashboardScreen() {
  const s = useStyles();
  const { c } = useTheme();
  const toast = useToast();
  const { session } = useAuth();
  const storageKey = `zentaoBugSLADashboardFilters_v2_${encodeURIComponent(session.userId || session.loginName || 'default')}`;

  const cache = useRef(new Map());
  const seq = useRef(0);
  const [clientFilter, setClientFilter] = useState([]);
  const [statusFilter, setStatusFilter] = useState([]);
  const [slaStatusFilter, setSlaStatusFilter] = useState([]);
  const [filtersReady, setFiltersReady] = useState(false);
  const [slaTarget, setSlaTarget] = useState(24);
  const [modalBug, setModalBug] = useState(null);
  const [tick, setTick] = useState(0);
  const [clients, setClients] = useState([]);
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());
  const [applied, setApplied] = useState({ from: today(), to: today(), key: 0 });
  const [tlMappings, setTlMappings] = useState([]);
  const [testingMappings, setTestingMappings] = useState([]);
  const [tlDrill, setTlDrill] = useState(null);
  const [testDrill, setTestDrill] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState({ client: [], status: [], sla: [], target: '24' });

  // persisted multi-select filters (web: localStorage per user)
  useEffect(() => {
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!raw) return;
        const p = JSON.parse(raw);
        if (Array.isArray(p?.clientFilter)) setClientFilter(p.clientFilter);
        if (Array.isArray(p?.statusFilter)) setStatusFilter(p.statusFilter);
        if (Array.isArray(p?.slaStatusFilter)) setSlaStatusFilter(p.slaStatusFilter);
      })
      .catch(() => {})
      .finally(() => setFiltersReady(true));
  }, [storageKey]);
  useEffect(() => {
    if (!filtersReady) return;
    AsyncStorage.setItem(storageKey, JSON.stringify({ clientFilter, statusFilter, slaStatusFilter })).catch(() => {});
  }, [clientFilter, statusFilter, slaStatusFilter, filtersReady, storageKey]);

  useEffect(() => {
    api.get('clientFilter').then(setClients).catch(() => setClients([]));
    api
      .get('teamLeadModuleMapping')
      .then((d) => setTlMappings(Array.isArray(d) ? d : []))
      .catch(() => setTlMappings([]));
    api
      .get('testingLeadModuleMapping')
      .then((d) => setTestingMappings(Array.isArray(d) ? d : []))
      .catch(() => setTestingMappings([]));
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = ++seq.current;
    let current = true;
    setLoading(true);
    setError(null);
    const key = `${applied.from}_${applied.to}`;
    const cached = cache.current.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_MS) {
      setBugs(cached.data);
      setLoading(false);
      return undefined;
    }
    (async () => {
      try {
        const payload = await api.get('getTotalBugList', { fromDate: applied.from, toDate: applied.to, _t: String(Math.floor(Date.now() / 10000)) }, { headers: { 'Cache-Control': 'no-cache, no-store', Pragma: 'no-cache' } });
        const rows = normalizeRows(payload);
        if (!Array.isArray(rows)) throw new Error('The API response was received, but its data is not an array.');
        const data = rows
          .filter((b) => b && typeof b === 'object')
          .map((b) => {
            const crit = readField(b, 'IsCritical', 'isCritical', 'Critical');
            return {
              id: readField(b, 'BugId', 'bugId', 'Id', 'id') ?? '',
              product: String(readField(b, 'Product', 'product', 'ProductName') ?? ''),
              module: String(readField(b, 'Module', 'module', 'ModuleName') ?? ''),
              title: String(readField(b, 'BugTitle', 'bugTitle', 'Title', 'title') ?? ''),
              clientName: String(readField(b, 'ClientName', 'clientName', 'Client') ?? ''),
              isCritical: crit === true || Number(crit ?? 0) === 1,
              openedBy: String(readField(b, 'openedBy', 'OpenedBy') ?? ''),
              openedDate: readField(b, 'openedDate', 'OpenedDate') ?? null,
              firstAssignedDevName: String(readField(b, 'FirstAssignedDevName', 'firstAssignedDevName') ?? ''),
              firstAssignedDevRole: String(readField(b, 'FirstAssignedDevRole', 'firstAssignedDevRole') ?? ''),
              firstAssignedDate: readField(b, 'FirstAssignedDate', 'firstAssignedDate') ?? null,
              qaName: String(readField(b, 'QAName', 'qaName') ?? ''),
              qaRole: String(readField(b, 'QARole', 'qaRole') ?? ''),
              qaAssignedDate: readField(b, 'QAAssignedDate', 'qaAssignedDate') ?? null,
              currentAssignee: String(readField(b, 'CurrentAssignedName', 'currentAssignedName', 'CurrentAssignee') ?? ''),
              currentAssignedRole: String(readField(b, 'CurrentAssignedRole', 'currentAssignedRole', 'CurrentAssignedRoleName') ?? ''),
              currentAssignedDateTime: readField(b, 'CurrentAssignedDateTime', 'currentAssignedDateTime') ?? null,
              moduleId: readField(b, 'ModuleId', 'ModuleID', 'moduleId') ?? null,
              productId: readField(b, 'ProductId', 'ProductID', 'productId') ?? null,
              approxIteration: readField(b, 'Approx_Iteration', 'ApproxIteration', 'approxIteration') ?? null,
              onSupport: String(readField(b, 'OnSupport', 'onSupport') ?? ''),
              onSupportAssignedDateTime: readField(b, 'OnSupportAssignedDateTime', 'onSupportAssignedDateTime') ?? null,
              closedDate: readField(b, 'closedDate', 'ClosedDate') ?? null,
              currentStatus: String(readField(b, 'CurrentStatus', 'currentStatus') ?? 'Unknown'),
              rawStatus: String(readField(b, 'status', 'Status', 'rawStatus') ?? '').toLowerCase(),
            };
          });
        if (!current || id !== seq.current) return;
        cache.current.set(key, { data, timestamp: Date.now() });
        if (cache.current.size > 10) cache.current.delete(cache.current.keys().next().value);
        setBugs(data);
      } catch (e) {
        if (!current || id !== seq.current) return;
        setBugs([]);
        setError(e?.message || 'Unable to load bug data.');
      } finally {
        if (current && id === seq.current) setLoading(false);
      }
    })();
    return () => {
      current = false;
    };
  }, [applied]);

  const filtered = useMemo(
    () =>
      bugs.filter((bug) => {
        if (clientFilter.length && !clientFilter.includes(bug.clientName)) return false;
        if (statusFilter.length) {
          const ok = statusFilter.some((st) => {
            if (st === 'Critical') return bug.isCritical === true;
            if (st === 'Resolved') return bug.rawStatus === 'resolved';
            if (st === 'Closed') return bug.rawStatus === 'closed';
            return bug.currentStatus === st && bug.rawStatus !== 'resolved' && bug.rawStatus !== 'closed';
          });
          if (!ok) return false;
        }
        if (slaStatusFilter.length) {
          const sla = calculateSLA(bug, slaTarget);
          const ok = slaStatusFilter.some((x) =>
            x === 'breached'
              ? sla.hasStarted && sla.isBreached && !sla.isResolved
              : x === 'warning'
                ? sla.hasStarted && !sla.isBreached && !sla.isResolved && sla.percent > 80
                : x === 'good'
                  ? sla.hasStarted && !sla.isBreached && !sla.isResolved && sla.percent <= 80
                  : false,
          );
          if (!ok) return false;
        }
        const q = search.trim().toLowerCase();
        if (q && !bug.title.toLowerCase().includes(q) && !bug.clientName.toLowerCase().includes(q) && !String(bug.id).includes(q) && !bug.module.toLowerCase().includes(q)) return false;
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bugs, clientFilter, statusFilter, slaStatusFilter, slaTarget, search, tick],
  );

  const stats = useMemo(() => {
    const st = { inDev: 0, inTesting: 0, sitPass: 0, pendingSitMerge: 0, closedCount: 0, closedStatusCount: 0, breached: 0, onSupport: 0, critical: 0, resolvedSum: 0, resolvedN: 0 };
    for (const b of filtered) {
      if (b.isCritical) st.critical++;
      if (b.rawStatus === 'resolved') {
        st.closedCount++;
        st.resolvedSum += calculateSLA(b, slaTarget).elapsedHours;
        st.resolvedN++;
      } else if (b.rawStatus === 'closed') st.closedStatusCount++;
      else {
        if (b.currentStatus === 'In Development') st.inDev++;
        else if (b.currentStatus === 'In Testing') st.inTesting++;
        else if (b.currentStatus === 'SIT Pass') st.sitPass++;
        else if (b.currentStatus === 'Pending SIT Merge') st.pendingSitMerge++;
        else if (b.currentStatus === 'On Support') st.onSupport++;
        const sla = calculateSLA(b, slaTarget);
        if (sla.hasStarted && sla.isBreached) st.breached++;
      }
    }
    return st;
  }, [filtered, slaTarget]);

  const slaPerf = useMemo(() => {
    let aSum = 0;
    let aN = 0;
    let rSum = 0;
    let rN = 0;
    filtered.forEach((b) => {
      const sla = calculateSLA(b, slaTarget);
      if (b.currentStatus === 'Closed') {
        if (sla.isResolved) {
          rSum += sla.elapsedHours;
          rN++;
        }
      } else if (sla.hasStarted) {
        aSum += sla.elapsedHours;
        aN++;
      }
    });
    return { active: aN ? +(aSum / aN).toFixed(1) : 0, resolved: rN ? +(rSum / rN).toFixed(1) : 0 };
  }, [filtered, slaTarget]);

  const topClients = useMemo(() => {
    const m = new Map();
    filtered.forEach((b) => m.set(b.clientName, (m.get(b.clientName) || 0) + 1));
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, value]) => ({ label: label || '—', value }));
  }, [filtered]);

  const buildLeadGroups = (mappings, idKey, nameKey, statusName, totalKey) => {
    if (!mappings.length) return [];
    const m2t = {};
    mappings.forEach((m) => {
      const k = `${m.ProductId}_${m.ModuleId}`;
      m2t[k] = { id: String(m[idKey]), name: m[nameKey] || `TL ${m[idKey]}` };
      if (!m2t[`_${m.ModuleId}`]) m2t[`_${m.ModuleId}`] = m2t[k];
    });
    const groups = {};
    filtered.forEach((bug) => {
      if (!bug.moduleId) return;
      const tl = m2t[`${bug.productId ?? ''}_${bug.moduleId}`] || m2t[`_${bug.moduleId}`];
      if (!tl) return;
      if (!groups[tl.id]) groups[tl.id] = { id: tl.id, name: tl.name, modules: {}, total: 0, [totalKey]: 0 };
      const mk = (bug.module || 'Unknown').trim();
      if (!groups[tl.id].modules[mk]) groups[tl.id].modules[mk] = { moduleName: mk, count: 0, breached: 0 };
      groups[tl.id].modules[mk].count++;
      const sla = calculateSLA(bug, slaTarget);
      if (sla.hasStarted && sla.isBreached && !sla.isResolved) groups[tl.id].modules[mk].breached++;
      groups[tl.id].total++;
      if (bug.currentStatus === statusName && bug.rawStatus !== 'resolved' && bug.rawStatus !== 'closed') groups[tl.id][totalKey]++;
    });
    return Object.values(groups).sort((a, b) => b.total - a.total);
  };
  const devLeads = useMemo(() => buildLeadGroups(tlMappings.map((m) => ({ ...m, _name: m.TeamLeadLoginName })), 'TeamLeadId', '_name', 'In Development', 'inDevTotal'), [filtered, tlMappings, slaTarget]); // eslint-disable-line
  const testLeads = useMemo(() => buildLeadGroups(testingMappings, 'TestingLeadId', 'TestingLeadName', 'In Testing', 'inTestingTotal'), [filtered, testingMappings, slaTarget]); // eslint-disable-line

  const pager = usePager(filtered, 25, `${JSON.stringify([clientFilter, statusFilter, slaStatusFilter, slaTarget, search])}|${bugs.length}`);
  const clientOptions = useMemo(() => [...new Set((clients || []).map((x) => String(x?.value ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [clients]);

  const doSearch = useCallback(() => {
    cache.current.delete(`${fromDate}_${toDate}`);
    setApplied((a) => ({ from: fromDate, to: toDate, key: a.key + 1 }));
  }, [fromDate, toDate]);

  const resetAll = () => {
    const td = today();
    setClientFilter([]);
    setStatusFilter([]);
    setSlaStatusFilter([]);
    setSlaTarget(24);
    setSearch('');
    setTlDrill(null);
    setTestDrill(null);
    setFromDate(td);
    setToDate(td);
    cache.current.delete(`${td}_${td}`);
    setApplied((a) => ({ from: td, to: td, key: a.key + 1 }));
  };

  const doExport = async () => {
    if (!filtered.length) return toast.info('Nothing to export');
    const tlMap = buildTLMap(tlMappings);
    try {
      await exportExcel('sla_report', {
        name: 'SLA Report',
        rows: filtered,
        columns: [
          { header: 'Bug ID', value: (b) => b.id },
          { header: 'Client', value: (b) => b.clientName },
          { header: 'Product', value: (b) => b.product },
          { header: 'Module', value: (b) => b.module },
          { header: 'Team Lead', value: (b) => resolveTL(b, tlMap) },
          { header: 'Title', value: (b) => b.title, width: 50 },
          { header: 'Approx Iteration', value: (b) => b.approxIteration ?? '' },
          { header: 'Opened By', value: (b) => b.openedBy },
          { header: 'Opened Date', value: (b) => fmtTs(b.openedDate) },
          { header: 'First Dev Assigned', value: (b) => b.firstAssignedDevName },
          { header: 'First Dev Role', value: (b) => b.firstAssignedDevRole },
          { header: 'Dev Assigned Date', value: (b) => fmtTs(b.firstAssignedDate) },
          { header: 'QA Name', value: (b) => b.qaName },
          { header: 'QA Role', value: (b) => b.qaRole },
          { header: 'QA Assigned Date', value: (b) => fmtTs(b.qaAssignedDate) },
          { header: 'Current Assignee', value: (b) => b.currentAssignee },
          { header: 'Current Role', value: (b) => b.currentAssignedRole },
          { header: 'Current Assigned Date', value: (b) => fmtTs(b.currentAssignedDateTime) },
          { header: 'Status', value: (b) => (b.rawStatus === 'resolved' ? 'Resolved' : b.rawStatus === 'closed' ? 'Closed' : b.currentStatus) },
          { header: 'SLA Hours Spent', value: (b) => calculateSLA(b, slaTarget).elapsedHours.toFixed(1) },
          { header: 'SLA Target (hrs)', value: () => slaTarget },
          {
            header: 'SLA Status',
            value: (b) => {
              const sla = calculateSLA(b, slaTarget);
              return sla.isResolved ? (b.rawStatus === 'closed' ? 'Closed' : 'Resolved') : sla.isBreached ? 'Breached' : sla.percent > 80 ? 'Warning' : 'On Track';
            },
          },
          { header: 'Closed Date', value: (b) => fmtTs(b.closedDate) },
        ],
      });
    } catch (e) {
      toast.error(e.message);
    }
  };

  useHeaderActions([
    { key: 'export', icon: 'download', onPress: doExport },
    { key: 'refresh', icon: 'refresh-cw', onPress: doSearch },
  ]);

  const activeCount = (clientFilter.length ? 1 : 0) + (statusFilter.length ? 1 : 0) + (slaStatusFilter.length ? 1 : 0) + (slaTarget !== 24 ? 1 : 0);
  const totalActive = stats.inDev + stats.inTesting + stats.sitPass + stats.pendingSitMerge;

  const LeadCard = ({ title, data, drill, setDrill, valueKey, color, emptyColor }) => {
    if (!data.length) return null;
    const sel = data.find((x) => x.id === drill);
    const mods = sel ? Object.values(sel.modules).sort((a, b) => b.count - a.count) : [];
    const breachedTotal = mods.reduce((x, m) => x + m.breached, 0);
    return (
      <Card>
        <SectionHeader
          title={sel ? `Drill-down: ${sel.name}` : title}
          subtitle={sel ? `${sel.total} bugs${breachedTotal ? ` · ⚠ ${breachedTotal} breached` : ''}` : 'Tap a bar to drill down'}
          icon="bar-chart-2"
          color={color}
          right={sel ? <Button size="sm" variant="soft" icon="chevron-left" title="All" onPress={() => setDrill(null)} /> : null}
        />
        <Bars
          labels={data.map((x) => x.name)}
          series={[{ name: title, color, values: data.map((x) => x[valueKey]) }]}
          onPressBar={(li) => setDrill((p) => (p === data[li].id ? null : data[li].id))}
          height={170}
          labelWidth={76}
          barWidth={30}
        />
        {sel && (
          <View style={{ marginTop: 14 }}>
            <HBars data={mods.map((m) => ({ label: m.moduleName, value: m.count, color: m.breached ? c.red : emptyColor, sub: m.breached ? `⚠ ${m.breached}` : undefined }))} />
          </View>
        )}
      </Card>
    );
  };

  const header = (
    <View style={{ gap: 14, marginBottom: 6 }}>
      <Card style={{ gap: 12 }}>
        <SectionHeader title="ZenTao Bug SLA Dashboard" subtitle="SLA Tracking: First Dev Assignment to Bug Resolution" icon="activity" />
        <Row gap={10}>
          <DateField label="From Date" value={fromDate} onChange={(v) => setFromDate(v || today())} style={{ flex: 1 }} clearable={false} />
          <DateField label="To Date" value={toDate} onChange={(v) => setToDate(v || today())} style={{ flex: 1 }} clearable={false} />
        </Row>
        <Button title="Search" icon="search" onPress={doSearch} loading={loading} />
      </Card>
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search bugs, clients, or modules…" />
      <Row>
        <FilterButton count={activeCount} onPress={() => (setDraft({ client: clientFilter, status: statusFilter, sla: slaStatusFilter, target: String(slaTarget) }), setFilterOpen(true))} />
        <Pressable onPress={resetAll} style={{ marginLeft: 10 }}>
          <Text style={{ color: c.danger, fontWeight: '800', fontSize: 12.5 }}>Reset</Text>
        </Pressable>
        <Text style={s.count}>{filtered.length.toLocaleString()} records</Text>
      </Row>
      <ActiveFilters
        items={[
          clientFilter.length && { key: 'c', label: `Clients: ${clientFilter.length === 1 ? clientFilter[0] : clientFilter.length}`, onClear: () => setClientFilter([]) },
          statusFilter.length && { key: 's', label: `Status: ${statusFilter.join(', ')}`, onClear: () => setStatusFilter([]) },
          slaStatusFilter.length && { key: 'l', label: `SLA: ${slaStatusFilter.map((x) => SLA_STATUS_OPTIONS.find((o) => o.value === x)?.label).join(', ')}`, onClear: () => setSlaStatusFilter([]) },
          slaTarget !== 24 && { key: 't', label: `Target ${slaTarget}h`, onClear: () => setSlaTarget(24) },
        ]}
      />
      {!loading && !error && bugs.length > 0 && filtered.length === 0 && (
        <Banner type="warning" text={`The API returned ${bugs.length} records, but the current filters hide all of them. Use Reset to display them.`} />
      )}
      <StatGrid columns={3} gap={8}>
        <StatCard compact label="Total Bugs" value={filtered.length} icon="alert-octagon" color={c.indigo} />
        <StatCard compact label="In Development" value={stats.inDev} icon="code" color={c.sky} onPress={() => setStatusFilter(['In Development'])} />
        <StatCard compact label="Pending SIT Merge" value={stats.pendingSitMerge} icon="git-merge" color={c.violet} onPress={() => setStatusFilter(['Pending SIT Merge'])} />
        <StatCard compact label="In Testing" value={stats.inTesting} icon="thermometer" color={c.amber} onPress={() => setStatusFilter(['In Testing'])} />
        <StatCard compact label="SIT Pass" value={stats.sitPass} icon="check-circle" color={c.emerald} onPress={() => setStatusFilter(['SIT Pass'])} />
        <StatCard compact label="Resolved" value={stats.closedCount} icon="check-square" color={c.slate} onPress={() => setStatusFilter(['Resolved'])} />
        <StatCard compact label="On Support" value={stats.onSupport} icon="phone" color={c.orange} onPress={() => setStatusFilter(['On Support'])} />
        <StatCard compact label="Closed" value={stats.closedStatusCount} icon="lock" color={c.teal} onPress={() => setStatusFilter(['Closed'])} />
        <StatCard compact label="Critical Points" value={stats.critical} icon="alert-circle" color={c.violet} onPress={() => setStatusFilter(['Critical'])} />
        <StatCard compact label="SLA Breached" value={stats.breached} icon="alert-triangle" color={c.red} onPress={() => setSlaStatusFilter(['breached'])} />
      </StatGrid>

      <Card>
        <SectionHeader title="Active Bugs by Status" icon="pie-chart" color={c.violet} />
        <Donut
          centerLabel="TOTAL ACTIVE"
          centerValue={totalActive}
          data={[
            { label: 'Dev', value: stats.inDev, color: c.sky },
            { label: 'Testing', value: stats.inTesting, color: c.amber },
            { label: 'SIT Pass', value: stats.sitPass, color: c.emerald },
            { label: 'Pending SIT Merge', value: stats.pendingSitMerge, color: '#C084FC' },
          ]}
        />
        <Row gap={8} style={{ marginTop: 10 }}>
          <Pill label={`Resolved: ${stats.closedCount}`} color={c.emerald} size="md" />
          <Pill label={`Breached: ${stats.breached}`} color={c.red} size="md" />
        </Row>
      </Card>

      <Card>
        <SectionHeader title="SLA Performance" subtitle="Average hours vs target" icon="clock" color={c.sky} />
        <Bars
          labels={['Resolved', 'Active']}
          series={[
            { name: 'Actual (hrs)', color: '#94A3B8', values: [slaPerf.resolved, slaPerf.active] },
            { name: `Target (${slaTarget}h)`, color: c.primary, values: [slaTarget, slaTarget] },
          ]}
          height={160}
          labelWidth={120}
        />
      </Card>

      <Card>
        <SectionHeader title="Top 10 Clients by Bug Count" icon="users" color={c.teal} />
        {topClients.length ? <HBars data={topClients} color={c.primary} /> : <Text style={{ color: c.textFaint }}>No data</Text>}
      </Card>

      {!loading && (
        <>
          <LeadCard title="In Development Bugs by Team Lead" data={devLeads} drill={tlDrill} setDrill={setTlDrill} valueKey="inDevTotal" color={c.indigo} emptyColor={c.indigo} />
          <LeadCard title="In Testing Bugs by Testing Lead" data={testLeads} drill={testDrill} setDrill={setTestDrill} valueKey="inTestingTotal" color={c.violet} emptyColor={c.violet} />
        </>
      )}
      <Text style={s.section}>Bug SLA Tracker</Text>
    </View>
  );

  if (error && !bugs.length) return <ErrorState message={error} onRetry={doSearch} />;

  return (
    <>
      <FlatList
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        data={loading ? [] : pager.visible}
        keyExtractor={(b, i) => `${b.id}-${i}`}
        ListHeaderComponent={header}
        refreshing={false}
        onRefresh={doSearch}
        ListEmptyComponent={loading ? <Loading text="Loading Bug Data…" /> : <Text style={{ textAlign: 'center', color: c.textFaint, padding: 24 }}>No records found</Text>}
        ListFooterComponent={!loading && filtered.length ? <LoadMore pager={pager} /> : null}
        renderItem={({ item: bug }) => {
          const sla = calculateSLA(bug, slaTarget);
          const lbl = slaLabel(sla);
          const st =
            bug.rawStatus === 'resolved'
              ? { color: '#64748B', label: 'RESOLVED' }
              : bug.rawStatus === 'closed'
                ? { color: '#059669', label: 'CLOSED' }
                : STATUS_CONFIG[bug.currentStatus] || { color: '#94A3B8', label: bug.currentStatus };
          return (
            <Card onPress={() => setModalBug(bug)} accent={lbl.color}>
              <Row justify="space-between">
                <Row gap={8}>
                  <Pressable onPress={() => openUrl(zentaoLink('bug', bug.id))} hitSlop={6}>
                    <Text style={s.id}>#{bug.id}</Text>
                  </Pressable>
                  {bug.isCritical && <Pill label="Critical" icon="alert-circle" color={c.violet} />}
                </Row>
                <Pill label={st.label} color={st.color} />
              </Row>
              <Text style={s.title}>{bug.title}</Text>
              <Text style={s.meta} numberOfLines={1}>
                {bug.clientName}
                {bug.product ? ` · ${bug.product}` : ''}
                {bug.module ? ` › ${bug.module}` : ''}
              </Text>
              <View style={{ marginTop: 10 }}>
                <Row justify="space-between" style={{ marginBottom: 5 }}>
                  <Text style={[s.small, { fontWeight: '700' }]}>{sla.statusText}</Text>
                  <Text style={[s.small, { color: lbl.color, fontWeight: '900' }]}>
                    {lbl.text === 'CRITICAL' ? '⚠ ' : ''}
                    {lbl.text}
                  </Text>
                </Row>
                <Progress value={sla.percent / 100} color={barColor(sla)} />
              </View>
              <KVGrid style={{ marginTop: 6 }}>
                <KV label="Opened By" value={bug.openedBy ? `${bug.openedBy}` : '—'} />
                <KV label="First Dev" value={bug.firstAssignedDevName ? `${bug.firstAssignedDevName}${bug.firstAssignedDevRole ? ` - ${bug.firstAssignedDevRole}` : ''}` : '—'} />
                <KV label="Current Assignee" value={bug.currentAssignee ? `${bug.currentAssignee}${bug.currentAssignedRole ? ` - ${bug.currentAssignedRole}` : ''}` : '—'} />
                <KV label="On Support" value={bug.onSupport || '—'} />
              </KVGrid>
            </Card>
          );
        }}
      />

      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={() => {
          setClientFilter(draft.client);
          setStatusFilter(draft.status);
          setSlaStatusFilter(draft.sla);
          setSlaTarget(parseInt(draft.target, 10) || 24);
        }}
        onClear={() => (resetAll(), setFilterOpen(false))}
      >
        <Select label="Client" multi searchable value={draft.client} options={clientOptions} placeholder="All Clients" onChange={(v) => setDraft((d) => ({ ...d, client: v }))} />
        <Select label="Status" multi value={draft.status} options={STATUS_OPTIONS} placeholder="All Statuses" onChange={(v) => setDraft((d) => ({ ...d, status: v }))} />
        <Select label="SLA Status" multi value={draft.sla} options={SLA_STATUS_OPTIONS} placeholder="All" onChange={(v) => setDraft((d) => ({ ...d, sla: v }))} />
        <TextField label="SLA Target (hrs)" value={draft.target} onChangeText={(v) => setDraft((d) => ({ ...d, target: v.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" />
      </FilterSheet>

      <Sheet visible={!!modalBug} onClose={() => setModalBug(null)} icon="alert-octagon" title={modalBug ? `Bug #${modalBug.id} Details` : ''} subtitle={modalBug?.title}>
        {modalBug && (
          <>
            <Text style={s.meta}>
              {modalBug.clientName}
              {modalBug.product ? ` · ${modalBug.product}` : ''}
              {modalBug.module ? ` › ${modalBug.module}` : ''}
            </Text>
            <View style={{ gap: 10 }}>
              {[
                ['Opened By', modalBug.openedBy, fmtTs(modalBug.openedDate), c.slate],
                ['First Dev Assigned (SLA Start)', `${modalBug.firstAssignedDevName || '—'}${modalBug.firstAssignedDevRole ? ` - ${modalBug.firstAssignedDevRole}` : ''}`, fmtTs(modalBug.firstAssignedDate) || 'Not assigned', c.indigo],
                ['First QA Assigned', `${modalBug.qaName || '—'}${modalBug.qaRole ? ` (${modalBug.qaRole})` : ''}`, fmtTs(modalBug.qaAssignedDate), c.emerald],
                ['Current Assignee', `${modalBug.currentAssignee || '—'}${modalBug.currentAssignedRole ? ` - ${modalBug.currentAssignedRole}` : ''}`, fmtTs(modalBug.currentAssignedDateTime), c.amber],
              ].map(([l, v, sub, col]) => (
                <View key={l} style={[s.dc, { borderLeftColor: col }]}>
                  <Text style={[s.dcLbl, { color: col }]}>{l}</Text>
                  <Text style={s.dcVal}>{v || '—'}</Text>
                  <Text style={s.small}>{sub || '—'}</Text>
                </View>
              ))}
            </View>
            {!!modalBug.closedDate && <Banner type="success" text={`Closed: ${fmtTs(modalBug.closedDate)}`} />}
            <KVGrid>
              <KV label="SLA" value={calculateSLA(modalBug, slaTarget).statusText} wide />
              <KV label="Status" value={modalBug.currentStatus} />
              <KV label="Raw" value={modalBug.rawStatus} />
            </KVGrid>
            <Button title="Open in Zentao" icon="external-link" variant="soft" onPress={() => openUrl(zentaoLink('bug', modalBug.id))} />
          </>
        )}
      </Sheet>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  count: { marginLeft: 'auto', color: c.textFaint, fontSize: 12, fontWeight: '700' },
  section: { color: c.text, fontWeight: '800', fontSize: 16, marginTop: 4 },
  id: { color: c.primary, fontWeight: '900', fontSize: 14, textDecorationLine: 'underline' },
  title: { color: c.text, fontSize: 14, fontWeight: '700', marginTop: 8, lineHeight: 20 },
  meta: { color: c.textMuted, fontSize: 12, marginTop: 4, fontWeight: '600' },
  small: { color: c.textMuted, fontSize: 11.5 },
  dc: { padding: 12, borderRadius: 14, backgroundColor: c.surfaceAlt, borderLeftWidth: 4 },
  dcLbl: { fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  dcVal: { color: c.text, fontWeight: '700', fontSize: 13.5, marginTop: 4 },
}));
