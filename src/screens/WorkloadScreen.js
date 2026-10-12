import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '../api/client';
import { useHeaderActions } from '../navigation/ShellContext';
import { hashColor, makeStyles, useTheme } from '../theme/theme';
import { fmtDate, toYMD } from '../utils/format';
import {
  ActiveFilters,
  Avatar,
  Banner,
  Bars,
  Button,
  Card,
  DateField,
  Empty,
  ErrorState,
  FilterButton,
  FilterSheet,
  LineChart,
  Loading,
  Pill,
  Row,
  SearchBar,
  SectionHeader,
  Segmented,
  Select,
  Sheet,
  StatCard,
  StatGrid,
  StatStrip,
} from '../ui';

/** Port of AssignedCounts.jsx (Workload & Progress) */

const UNASSIGNED_KEY = 'unassigned';
const UNASSIGNED_LABEL = 'Unassigned';
const DEV_TEAM_ROLES = ['Dev Team Lead', 'Developer'];
const classifyTeam = (role) => (!role ? 'testing' : DEV_TEAM_ROLES.includes(role.trim()) ? 'development' : 'testing');
const isDevOnlyRole = (role) => ['dev', 'top'].includes((role || '').trim().toLowerCase());
const norm = (s) => (s || '').trim().toLowerCase();
const parseIds = (v) => (Array.isArray(v) ? v.map(String).map((x) => x.trim()).filter(Boolean) : v == null || v === '' ? [] : String(v).split(',').map((x) => x.trim()).filter(Boolean));

function last10DayRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 9);
  return { from: toYMD(from), to: toYMD(to) };
}
const inclusiveDays = (a, b) => Math.floor((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000) + 1;

const FIXED_HOLIDAYS_2026 = {
  '2026-01-01': 'New Year',
  '2026-01-26': 'Republic Day',
  '2026-03-04': 'Holi',
  '2026-08-15': 'Independence Day',
  '2026-08-28': 'Raksha Bandhan',
  '2026-10-02': 'Mahatma Gandhi Jayanti',
  '2026-10-20': 'Dussehra (Mahanavami)',
  '2026-11-08': 'Diwali (Deepavali)',
  '2026-12-25': 'Christmas Day',
};
const OPTIONAL_HOLIDAYS_2026 = {
  '2026-01-13': 'Lohri',
  '2026-01-14': 'Pongal/Makar Sankranti',
  '2026-02-15': 'Maha Shivratri',
  '2026-03-19': 'Ugadi/Gudi Padwa',
  '2026-03-20': 'Eid-ul-Fitr',
  '2026-03-31': 'Mahavir Jayanti',
  '2026-04-03': 'Good Friday',
  '2026-04-14': 'Bahag/Bihu/Vishu',
  '2026-05-01': 'Buddha Purnima',
  '2026-05-27': 'Bakra Eid (Id-ul-Zuha)',
  '2026-07-29': 'Guru Purnima',
  '2026-08-26': 'Eid e Milad',
  '2026-08-29': 'Onam',
  '2026-09-04': 'Janmashtami',
  '2026-09-14': 'Ganesh Chaturthi',
  '2026-11-01': 'Kannada Rajyotsava',
  '2026-11-09': 'Govardhan Puja',
  '2026-11-11': 'Bhai Dooj',
  '2026-11-24': 'Guru Nanak Jayanti',
};
function dayType(date) {
  const key = String(date || '').slice(0, 10);
  if (FIXED_HOLIDAYS_2026[key]) return { label: 'Fixed Holiday', name: FIXED_HOLIDAYS_2026[key], color: '#EF4444' };
  if (OPTIONAL_HOLIDAYS_2026[key]) return { label: 'Optional Holiday', name: OPTIONAL_HOLIDAYS_2026[key], color: '#F97316' };
  const d = new Date(date).getDay();
  if (d === 6) return { label: 'Saturday', color: '#8B5CF6' };
  if (d === 0) return { label: 'Sunday', color: '#0EA5E9' };
  return { label: 'Working Day', color: '#94A3B8' };
}

export default function WorkloadScreen() {
  const s = useStyles();
  const { c } = useTheme();

  const [accountData, setAccountData] = useState([]);
  const [tlMappings, setTlMappings] = useState([]);
  const [testingTlMappings, setTestingTlMappings] = useState([]);
  const [userRoles, setUserRoles] = useState([]);
  const [sprintData, setSprintData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [groupMode, setGroupMode] = useState('dev');
  const [search, setSearch] = useState('');
  const [teamLeadFilter, setTeamLeadFilter] = useState('all');
  const [resourceTypeFilter, setResourceTypeFilter] = useState('all');
  const [sprintFilter, setSprintFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState({ tl: 'all', rt: 'all', sprint: 'all' });
  const [idsFor, setIdsFor] = useState(null);

  const [detail, setDetail] = useState(null); // { account, resourceType }

  const loadAll = useCallback(async (mode = 'load') => {
    if (mode === 'load') setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [acc] = await Promise.all([
        api.get('accountWiseCountAssignee'),
        api
          .get('sprintData')
          .then((j) => setSprintData(j?.success && Array.isArray(j.data) ? j.data : []))
          .catch(() => setSprintData([])),
        api
          .get('teamLeadDevMapping')
          .then((d) => setTlMappings(Array.isArray(d) ? d : []))
          .catch(() => setTlMappings([])),
        api
          .get('testingTeamLeadWiseData')
          .then((d) => setTestingTlMappings(Array.isArray(d) ? d : []))
          .catch(() => setTestingTlMappings([])),
        api
          .get('zentaoUserDB')
          .then((d) => setUserRoles(Array.isArray(d) ? d : []))
          .catch(() => setUserRoles([])),
      ]);
      setAccountData(Array.isArray(acc) ? acc : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    setTeamLeadFilter('all');
    setResourceTypeFilter('all');
    setSprintFilter('all');
  }, [groupMode]);

  useHeaderActions([{ key: 'refresh', icon: 'refresh-cw', onPress: () => loadAll('refresh') }]);

  const accountToRole = useMemo(() => {
    const m = {};
    userRoles.forEach((u) => {
      const login = u.LoginName || u.loginName || u.Account || u.account;
      if (login) m[login] = u.Role || u.role || u.RoleName || u.roleName || '';
    });
    return m;
  }, [userRoles]);

  const devToTL = useMemo(() => Object.fromEntries(tlMappings.map((m) => [m.DeveloperLoginName, { teamLeadId: String(m.TeamLeadId), teamLeadName: m.TeamLeadName || `TL ${m.TeamLeadId}` }])), [tlMappings]);
  const testerToTL = useMemo(
    () => Object.fromEntries(testingTlMappings.map((m) => [m.TesterName, { teamLeadId: m.TestingTeamLeadName || 'Unknown', teamLeadName: m.TestingTeamLeadName || 'Unknown' }])),
    [testingTlMappings],
  );
  const devLeadByName = useMemo(
    () => Object.fromEntries(tlMappings.map((m) => [norm(m.TeamLeadName || `TL ${m.TeamLeadId}`), { teamLeadId: String(m.TeamLeadId), teamLeadName: m.TeamLeadName || `TL ${m.TeamLeadId}` }])),
    [tlMappings],
  );
  const testingLeadByName = useMemo(
    () => Object.fromEntries(testingTlMappings.map((m) => [norm(m.TestingTeamLeadName || 'Unknown'), { teamLeadId: m.TestingTeamLeadName || 'Unknown', teamLeadName: m.TestingTeamLeadName || 'Unknown' }])),
    [testingTlMappings],
  );

  const sprintOptions = useMemo(() => [...new Set(sprintData.map((r) => String(r.Sprint || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [sprintData]);
  const sprintMembership = useMemo(() => {
    const m = new Map();
    sprintData.forEach((r) => {
      const type = String(r.Type || '').trim().toLowerCase();
      const id = String(r.Id ?? '').trim();
      const sp = String(r.Sprint || '').trim();
      if (!type || !id || !sp) return;
      const k = `${type}:${id}`;
      if (!m.has(k)) m.set(k, new Set());
      m.get(k).add(sp);
    });
    return m;
  }, [sprintData]);

  const matchesSprint = useCallback(
    (type, id) => {
      const sp = sprintMembership.get(`${type}:${id}`);
      if (sprintFilter === '__NO_SPRINT__') return !sp || sp.size === 0;
      return !!sp?.has(sprintFilter);
    },
    [sprintMembership, sprintFilter],
  );
  const getSprintIds = useCallback(
    (row) => {
      const bugIds = parseIds(row.BugIds || row.bugIds);
      const storyIds = parseIds(row.StoryIds || row.storyIds);
      if (sprintFilter === 'all') return { bugIds, storyIds };
      return { bugIds: bugIds.filter((id) => matchesSprint('bug', id)), storyIds: storyIds.filter((id) => matchesSprint('story', id)) };
    },
    [sprintFilter, matchesSprint],
  );
  const getCounts = useCallback(
    (row) => {
      if (sprintFilter === 'all') return { bugCount: Number(row.BugCount) || 0, storyCount: Number(row.StoryCount) || 0 };
      const ids = getSprintIds(row);
      return { bugCount: ids.bugIds.length, storyCount: ids.storyIds.length };
    },
    [sprintFilter, getSprintIds],
  );

  const activeMap = groupMode === 'testing' ? testerToTL : devToTL;
  const activeLeadByName = groupMode === 'testing' ? testingLeadByName : devLeadByName;
  const tlLabel = groupMode === 'testing' ? 'Testing Team Lead' : 'Dev Team Lead';
  const targetTeam = groupMode === 'testing' ? 'testing' : 'development';

  const accounts = useMemo(
    () =>
      accountData
        .map((a) => {
          const role = accountToRole[a.account] || '';
          let tl = activeMap[a.account];
          let isLead = false;
          const lm = activeLeadByName[norm(a.account)];
          if (lm) {
            tl = lm;
            isLead = true;
          }
          const cnt = getCounts(a);
          const ids = getSprintIds(a);
          return {
            account: a.account,
            role,
            resourceType: String(a.ResourceType || a.resourceType || '').trim(),
            zentaoRole: a.role || '',
            team: classifyTeam(role),
            isLead,
            bugIds: ids.bugIds,
            storyIds: ids.storyIds,
            bugCount: cnt.bugCount,
            storyCount: cnt.storyCount,
            total: cnt.bugCount + cnt.storyCount,
            teamLeadId: tl ? tl.teamLeadId : UNASSIGNED_KEY,
            teamLeadName: tl ? tl.teamLeadName : UNASSIGNED_LABEL,
          };
        })
        .filter((a) => a.team === targetTeam),
    [accountData, accountToRole, activeMap, activeLeadByName, getCounts, getSprintIds, targetTeam],
  );

  const tlGroups = useMemo(() => {
    const g = {};
    accounts.forEach((a) => {
      if (!g[a.teamLeadId]) g[a.teamLeadId] = { teamLeadId: a.teamLeadId, teamLeadName: a.teamLeadName, developers: [], totalBugs: 0, totalStories: 0, totalAssigned: 0 };
      g[a.teamLeadId].developers.push(a);
      g[a.teamLeadId].totalBugs += a.bugCount;
      g[a.teamLeadId].totalStories += a.storyCount;
      g[a.teamLeadId].totalAssigned += a.total;
    });
    return Object.values(g).sort((a, b) => (a.teamLeadId === UNASSIGNED_KEY ? 1 : b.teamLeadId === UNASSIGNED_KEY ? -1 : b.totalAssigned - a.totalAssigned));
  }, [accounts]);

  const stats = useMemo(() => {
    const n = accounts.length;
    const bugs = accounts.reduce((x, a) => x + a.bugCount, 0);
    const stories = accounts.reduce((x, a) => x + a.storyCount, 0);
    return {
      members: n,
      bugs,
      stories,
      leads: tlGroups.filter((g) => g.teamLeadId !== UNASSIGNED_KEY).length,
      unassigned: tlGroups.find((g) => g.teamLeadId === UNASSIGNED_KEY)?.developers.length || 0,
      avgBugs: n ? bugs / n : 0,
      avgStories: n ? stories / n : 0,
    };
  }, [accounts, tlGroups]);

  const resourceTypeOptions = useMemo(() => {
    const order = { Expert: 1, Senior: 2, Intermediate: 3, Junior: 4, Unassigned: 5 };
    return [...new Set(accounts.map((a) => a.resourceType || UNASSIGNED_LABEL))].sort((a, b) => (order[a] ?? 999) - (order[b] ?? 999));
  }, [accounts]);

  const filtered = useMemo(
    () =>
      accounts
        .filter((a) => {
          if (teamLeadFilter !== 'all' && a.teamLeadId !== teamLeadFilter) return false;
          if (resourceTypeFilter !== 'all' && (a.resourceType || UNASSIGNED_LABEL) !== resourceTypeFilter) return false;
          const q = search.trim().toLowerCase();
          if (q && !a.account.toLowerCase().includes(q) && !a.teamLeadName.toLowerCase().includes(q) && !(a.role || '').toLowerCase().includes(q) && !(a.resourceType || '').toLowerCase().includes(q))
            return false;
          return true;
        })
        .sort((a, b) => (a.isLead !== b.isLead ? (a.isLead ? -1 : 1) : b.total - a.total)),
    [accounts, teamLeadFilter, resourceTypeFilter, search],
  );

  const selectedLeadName = teamLeadFilter === 'all' ? null : tlGroups.find((g) => g.teamLeadId === teamLeadFilter)?.teamLeadName;
  const activeCount = (teamLeadFilter !== 'all' ? 1 : 0) + (resourceTypeFilter !== 'all' ? 1 : 0) + (sprintFilter !== 'all' ? 1 : 0);

  if (loading) return <Loading text="Loading workload…" />;
  if (error) return <ErrorState message={error} onRetry={() => loadAll()} />;

  const header = (
    <View style={{ gap: 12, marginBottom: 4 }}>
      <Segmented
        scroll={false}
        value={groupMode}
        onChange={setGroupMode}
        options={[
          { label: 'Dev Team Lead', value: 'dev', icon: 'code', color: c.indigo },
          { label: 'Testing Team Lead', value: 'testing', icon: 'check-circle', color: c.teal },
        ]}
      />
      <StatGrid columns={3} gap={8}>
        <StatCard compact label="Members" value={stats.members} icon="users" color={c.indigo} />
        <StatCard compact label="Bugs" value={stats.bugs} icon="alert-circle" color={c.red} />
        <StatCard compact label="Stories" value={stats.stories} icon="book-open" color={c.violet} />
        <StatCard compact label="Team Leads" value={stats.leads} icon="user-check" color={c.teal} />
        <StatCard compact label="Unassigned" value={stats.unassigned} icon="user-x" color={c.amber} />
        <StatCard compact label="Avg / member" value={`${stats.avgBugs.toFixed(1)}·${stats.avgStories.toFixed(1)}`} icon="activity" color={c.sky} sub="bugs · stories" />
      </StatGrid>
      {tlGroups.length > 0 && (
        <Card>
          <SectionHeader title="Team Lead distribution" subtitle="Tap a bar to drill into a team" icon="bar-chart-2" />
          <Bars
            labels={tlGroups.map((g) => g.teamLeadName)}
            series={[
              { name: 'Bug Count', color: c.indigo, values: tlGroups.map((g) => g.totalBugs) },
              { name: 'Story Count', color: c.violet, values: tlGroups.map((g) => g.totalStories) },
            ]}
            onPressBar={(li) => setTeamLeadFilter((prev) => (prev === tlGroups[li].teamLeadId ? 'all' : tlGroups[li].teamLeadId))}
            height={170}
            labelWidth={78}
          />
        </Card>
      )}
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search member, role or team lead…" />
      <Row>
        <FilterButton count={activeCount} onPress={() => (setDraft({ tl: teamLeadFilter, rt: resourceTypeFilter, sprint: sprintFilter }), setFilterOpen(true))} />
        <Text style={s.count}>{filtered.length} records</Text>
      </Row>
      <ActiveFilters
        onClearAll={() => (setTeamLeadFilter('all'), setResourceTypeFilter('all'), setSprintFilter('all'), setSearch(''))}
        items={[
          selectedLeadName && { key: 'tl', label: `${tlLabel}: ${selectedLeadName}`, onClear: () => setTeamLeadFilter('all') },
          resourceTypeFilter !== 'all' && { key: 'rt', label: `Resource: ${resourceTypeFilter}`, onClear: () => setResourceTypeFilter('all') },
          sprintFilter !== 'all' && { key: 'sp', label: `Sprint: ${sprintFilter === '__NO_SPRINT__' ? 'No Sprint' : sprintFilter}`, onClear: () => setSprintFilter('all') },
        ]}
      />
      <Text style={s.section}>{groupMode === 'testing' ? 'Tester Assignment Tracker' : 'Developer Assignment Tracker'}</Text>
    </View>
  );

  return (
    <>
      <FlatList
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        data={filtered}
        keyExtractor={(a) => a.account}
        refreshing={refreshing}
        onRefresh={() => loadAll('refresh')}
        ListHeaderComponent={header}
        ListEmptyComponent={<Empty icon="users" title="No records found" />}
        renderItem={({ item: a }) => {
          const showDetail = isDevOnlyRole(a.zentaoRole) || (a.isLead && groupMode === 'dev');
          return (
            <Card accent={a.isLead ? c.primary : undefined}>
              <Row gap={12}>
                <Avatar name={a.account} color={hashColor(a.account)} />
                <View style={{ flex: 1 }}>
                  <Row gap={6}>
                    <Text style={s.name} numberOfLines={1}>{a.account}</Text>
                    {a.isLead && <Pill label="Lead" color={c.primary} solid />}
                  </Row>
                  <Row gap={6} wrap style={{ marginTop: 4 }}>
                    {!!a.role && <Pill label={a.role} color={c.slate} />}
                    {!!a.resourceType && <Pill label={a.resourceType} color={c.amber} />}
                    <Pill label={a.teamLeadId === UNASSIGNED_KEY ? 'UNASSIGNED' : a.teamLeadName} color={a.teamLeadId === UNASSIGNED_KEY ? c.slate : groupMode === 'testing' ? c.teal : c.indigo} />
                  </Row>
                </View>
                {showDetail && <Button size="sm" variant="soft" icon="eye" onPress={() => setDetail({ account: a.account, resourceType: a.resourceType })} />}
              </Row>
              <Row gap={8} style={{ marginTop: 12 }}>
                <Pressable style={[s.metric, { backgroundColor: c.dangerSoft }]} onPress={() => setIdsFor({ title: `${a.account} · Bugs`, ids: a.bugIds })}>
                  <Text style={[s.metricVal, { color: c.danger }]}>{a.bugCount}</Text>
                  <Text style={s.metricLbl}>Bugs</Text>
                </Pressable>
                <Pressable style={[s.metric, { backgroundColor: c.primarySoft }]} onPress={() => setIdsFor({ title: `${a.account} · Stories`, ids: a.storyIds })}>
                  <Text style={[s.metricVal, { color: c.primary }]}>{a.storyCount}</Text>
                  <Text style={s.metricLbl}>Stories</Text>
                </Pressable>
                <View style={[s.metric, { backgroundColor: c.warningSoft }]}>
                  <Text style={[s.metricVal, { color: c.warning }]}>{a.total}</Text>
                  <Text style={s.metricLbl}>Total</Text>
                </View>
              </Row>
            </Card>
          );
        }}
      />

      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={() => (setTeamLeadFilter(draft.tl), setResourceTypeFilter(draft.rt), setSprintFilter(draft.sprint))}
        onClear={() => (setTeamLeadFilter('all'), setResourceTypeFilter('all'), setSprintFilter('all'), setSearch(''), setFilterOpen(false))}
      >
        <Select label={tlLabel} value={draft.tl} clearable={false} options={[{ label: `All ${tlLabel}s`, value: 'all' }, ...tlGroups.map((g) => ({ label: g.teamLeadName, value: g.teamLeadId }))]} onChange={(v) => setDraft((d) => ({ ...d, tl: v }))} />
        <Select label="Resource Type" value={draft.rt} clearable={false} options={[{ label: 'All Resource Types', value: 'all' }, ...resourceTypeOptions]} onChange={(v) => setDraft((d) => ({ ...d, rt: v }))} />
        <Select
          label="Sprint"
          value={draft.sprint}
          clearable={false}
          options={[{ label: 'All Sprints', value: 'all' }, { label: 'No Sprint', value: '__NO_SPRINT__' }, ...sprintOptions]}
          onChange={(v) => setDraft((d) => ({ ...d, sprint: v }))}
        />
      </FilterSheet>

      <Sheet visible={!!idsFor} onClose={() => setIdsFor(null)} title={idsFor?.title} subtitle={`${idsFor?.ids?.length || 0} item(s)`} icon="hash">
        {idsFor?.ids?.length ? (
          <Row wrap gap={6}>
            {idsFor.ids.map((id) => (
              <Pill key={id} label={`#${id}`} color={c.primary} size="md" />
            ))}
          </Row>
        ) : (
          <Text style={{ color: c.textFaint }}>None</Text>
        )}
      </Sheet>

      <DeveloperDetailSheet detail={detail} onClose={() => setDetail(null)} />
    </>
  );
}

function DeveloperDetailSheet({ detail, onClose }) {
  const s = useStyles();
  const { c } = useTheme();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [summary, setSummary] = useState(null);
  const [daily, setDaily] = useState([]);
  const [from, setFrom] = useState(last10DayRange().from);
  const [to, setTo] = useState(last10DayRange().to);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dateErr, setDateErr] = useState(null);
  const [view, setView] = useState('table');

  const fetchDaily = (account, f, t) => api.get('developerDailySummary', { developerName: account, fromDate: f, toDate: t }).then((r) => (Array.isArray(r) ? r : []));

  useEffect(() => {
    if (!detail) return;
    const r = last10DayRange();
    setFrom(r.from);
    setTo(r.to);
    setLoading(true);
    setErr(null);
    setDateErr(null);
    setSummary(null);
    setDaily([]);
    setView('table');
    Promise.all([api.get('developerSummary', { developerName: detail.account }), fetchDaily(detail.account, r.from, r.to)])
      .then(([sum, rows]) => {
        setSummary(Array.isArray(sum) ? sum[0] || null : sum);
        setDaily(rows);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [detail]);

  const apply = () => {
    if (!from || !to) return setDateErr('Select both From Date and To Date.');
    if (from > to) return setDateErr('From Date cannot be after To Date.');
    if (inclusiveDays(from, to) > 31) return setDateErr('Date range cannot exceed 31 days.');
    setDateErr(null);
    setDailyLoading(true);
    fetchDaily(detail.account, from, to)
      .then(setDaily)
      .catch((e) => setDateErr(e.message || 'Failed to load day-wise data'))
      .finally(() => setDailyLoading(false));
  };

  const totals = useMemo(
    () =>
      daily.reduce(
        (acc, r) => ({
          BugAssigned: acc.BugAssigned + (Number(r.BugAssigned) || 0),
          BugCompleted: acc.BugCompleted + (Number(r.BugCompleted) || 0),
          StoryAssigned: acc.StoryAssigned + (Number(r.StoryAssigned) || 0),
          StoryCompleted: acc.StoryCompleted + (Number(r.StoryCompleted) || 0),
        }),
        { BugAssigned: 0, BugCompleted: 0, StoryAssigned: 0, StoryCompleted: 0 },
      ),
    [daily],
  );

  const n = (v) => Number(v) || 0;

  return (
    <Sheet visible={!!detail} onClose={onClose} size="full" icon="user" title={detail?.account} subtitle={`${detail?.resourceType ? `${detail.resourceType} · ` : ''}${fmtDate(from)} – ${fmtDate(to)}`}>
      {loading ? (
        <Loading text="Loading detail…" />
      ) : err ? (
        <Banner type="error" text={`Failed to load detail: ${err}`} />
      ) : (
        <>
          <SectionHeader title="Summary" icon="pie-chart" />
          <StatGrid columns={3} gap={8}>
            <StatCard compact label="Bugs Assigned" value={n(summary?.TotalBugAssigned)} color={c.indigo} />
            <StatCard compact label="Bugs Completed" value={n(summary?.TotalCompletedBug)} color={c.emerald} />
            <StatCard compact label="Bug Balance" value={Math.max(0, n(summary?.TotalBugAssigned) - n(summary?.TotalCompletedBug))} color={c.amber} />
            <StatCard compact label="Stories Assigned" value={n(summary?.TotalStoryAssigned)} color={c.violet} />
            <StatCard compact label="Stories Completed" value={n(summary?.TotalCompletedStory)} color={c.emerald} />
            <StatCard compact label="Story Balance" value={Math.max(0, n(summary?.TotalStoryAssigned) - n(summary?.TotalCompletedStory))} color={c.amber} />
          </StatGrid>

          <SectionHeader title="Day-wise Breakdown" icon="calendar" style={{ marginTop: 6 }} />
          <Row gap={10} align="flex-end">
            <DateField label="From" value={from} maximumDate={to} onChange={(v) => setFrom(v)} style={{ flex: 1 }} clearable={false} />
            <DateField label="To" value={to} minimumDate={from} onChange={(v) => setTo(v)} style={{ flex: 1 }} clearable={false} />
          </Row>
          <Row gap={10}>
            <Button title="Fetch" icon="download-cloud" style={{ flex: 1 }} loading={dailyLoading} onPress={apply} />
            <Segmented
              scroll={false}
              size="sm"
              value={view}
              onChange={setView}
              style={{ flex: 1 }}
              options={[
                { label: 'Table', value: 'table', icon: 'list' },
                { label: 'Trend', value: 'trend', icon: 'trending-up' },
              ]}
            />
          </Row>
          <Banner type="error" text={dateErr} />
          <Row gap={10} wrap>
            {[
              ['Saturday', '#8B5CF6'],
              ['Sunday', '#0EA5E9'],
              ['Fixed Holiday', '#EF4444'],
              ['Optional Holiday', '#F97316'],
            ].map(([l, col]) => (
              <Row key={l} gap={5}>
                <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: col }} />
                <Text style={{ color: c.textMuted, fontSize: 11 }}>{l}</Text>
              </Row>
            ))}
          </Row>
          {daily.length === 0 ? (
            <Empty icon="calendar" title="No activity in this window" />
          ) : view === 'trend' ? (
            <Card flat style={s.box}>
              <LineChart
                labels={daily.map((r) => fmtDate(r.ReportDate).slice(0, 6))}
                series={[
                  { name: 'Bugs Assigned', color: '#1e4080', values: daily.map((r) => n(r.BugAssigned)) },
                  { name: 'Bugs Completed', color: '#16a34a', values: daily.map((r) => n(r.BugCompleted)) },
                  { name: 'Stories Assigned', color: '#7c3aed', values: daily.map((r) => n(r.StoryAssigned)) },
                  { name: 'Stories Completed', color: '#c2410c', values: daily.map((r) => n(r.StoryCompleted)) },
                ]}
              />
            </Card>
          ) : (
            <View style={{ gap: 8, opacity: dailyLoading ? 0.55 : 1 }}>
              {daily.map((r, i) => {
                const dt = dayType(r.ReportDate);
                return (
                  <View key={r.ReportDate || i} style={[s.dayRow, { borderLeftColor: dt.color }]}>
                    <View style={{ flex: 1.3 }}>
                      <Text style={s.dayDate}>{fmtDate(r.ReportDate)}</Text>
                      <Text style={[s.dayType, { color: dt.color }]} numberOfLines={1}>
                        {dt.name ? `${dt.label} · ${dt.name}` : dt.label}
                      </Text>
                    </View>
                    <DayCell label="Bug A" v={n(r.BugAssigned)} />
                    <DayCell label="Bug C" v={n(r.BugCompleted)} good />
                    <DayCell label="Story A" v={n(r.StoryAssigned)} />
                    <DayCell label="Story C" v={n(r.StoryCompleted)} good />
                  </View>
                );
              })}
              <View style={[s.dayRow, { borderLeftColor: c.primary, backgroundColor: c.primarySoft }]}>
                <View style={{ flex: 1.3 }}>
                  <Text style={s.dayDate}>Total</Text>
                </View>
                <DayCell label="Bug A" v={totals.BugAssigned} />
                <DayCell label="Bug C" v={totals.BugCompleted} good />
                <DayCell label="Story A" v={totals.StoryAssigned} />
                <DayCell label="Story C" v={totals.StoryCompleted} good />
              </View>
            </View>
          )}
        </>
      )}
    </Sheet>
  );
}

function DayCell({ label, v, good }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: good ? c.success : c.text, fontWeight: '800', fontSize: 14 }}>{v}</Text>
      <Text style={{ color: c.textFaint, fontSize: 9.5, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  count: { marginLeft: 'auto', color: c.textFaint, fontSize: 12, fontWeight: '700' },
  section: { color: c.text, fontWeight: '800', fontSize: 15, marginTop: 4 },
  name: { color: c.text, fontWeight: '800', fontSize: 15, flexShrink: 1 },
  metric: { flex: 1, borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  metricVal: { fontSize: 20, fontWeight: '900' },
  metricLbl: { color: c.textMuted, fontSize: 11, fontWeight: '700', marginTop: 1 },
  box: { backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border },
  dayRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12, backgroundColor: c.surfaceAlt, borderLeftWidth: 4 },
  dayDate: { color: c.text, fontWeight: '800', fontSize: 12.5 },
  dayType: { fontSize: 10.5, fontWeight: '700', marginTop: 2 },
}));
