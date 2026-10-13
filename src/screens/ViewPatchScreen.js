import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '../api/client';
import { zentaoLink } from '../api/config';
import { useAuth } from '../context/AuthContext';
import { useHeaderActions, useShell } from '../navigation/ShellContext';
import { makeStyles, statusTone, useTheme } from '../theme/theme';
import { fmtDateTime, isPatchCreatedToday, uniqSorted } from '../utils/format';
import { exportCsv, openUrl } from '../utils/exporter';
import {
  Button,
  Card,
  Checkbox,
  Empty,
  ErrorState,
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
  usePager,
  useToast,
} from '../ui';

/** Port of ViewPatch.jsx (Build Review & Assignment) */

const PATCH_STATUSES = ['SIT Pass', 'Sanity Pass', 'In Testing', 'Observation', 'Under Development', 'Closed', 'Yet to be Assigned'];
const STATUS_ICON = {
  'SIT Pass': 'check',
  'Sanity Pass': 'check-circle',
  'In Testing': 'clock',
  Observation: 'eye',
  'Under Development': 'clock',
  Closed: 'check-circle',
  'Yet to be Assigned': 'minus',
};

function Pulse({ children, active }) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
        Animated.timing(v, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, v]);
  return <Animated.View style={{ transform: [{ scale: v }], alignSelf: 'flex-start' }}>{children}</Animated.View>;
}

export default function ViewPatchScreen() {
  const s = useStyles();
  const { c, dark } = useTheme();
  const toast = useToast();
  const { session } = useAuth();

  const [patches, setPatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const { pageParams } = useShell();
  // Opened from a "patch created" push notification → pre-filter to that patch.
  const [search, setSearch] = useState(pageParams?.patchId ? String(pageParams.patchId) : '');
  const [openKey, setOpenKey] = useState(null);
  const [testingUsers, setTestingUsers] = useState([]);
  const [userRoleMap, setUserRoleMap] = useState({});
  const [userRealNameMap, setUserRealNameMap] = useState({});
  const [assignedForTesting, setAssignedForTesting] = useState({});
  const [tlMappings, setTlMappings] = useState([]);
  const [savingIds, setSavingIds] = useState({});
  const [savedIds, setSavedIds] = useState({});
  const [markingStatus, setMarkingStatus] = useState({});
  const [viewAllMap, setViewAllMap] = useState({});

  const role = session.role || '';
  const loginName = session.loginName || '';
  const canAssignTesting = role === 'Testing Lead';
  const isTestingLead = role === 'Testing Lead';

  const tlMappingSet = useMemo(
    () => new Set(tlMappings.filter((m) => m.TestingLeadName === loginName).map((m) => `${m.ProductId}_${m.ModuleId}`)),
    [tlMappings, loginName],
  );

  const getVisibleDetails = (details, viewAll = false) => {
    if (!Array.isArray(details)) return [];
    if (!isTestingLead || viewAll) return details;
    return details.filter((d) => d.PointData && tlMappingSet.has(`${d.PointData.Product}_${d.PointData.Module}`));
  };

  const normalizeStatus = (st) => (st === 'In Observation' ? 'Observation' : st === 'Unassigned' ? 'Yet to be Assigned' : st);
  const getPointStatus = (assignedTo) => {
    if (!assignedTo || assignedTo === 'Pending_SIT_Merge') return 'Yet to be Assigned';
    const r = userRoleMap[assignedTo];
    if (r === 'Testing Lead') return 'SIT Pass';
    if (r === 'Testing') return 'In Testing';
    if (r === 'Developer' || r === 'Dev Team Lead') return 'Observation';
    return 'Yet to be Assigned';
  };
  const resolvePointStatus = (d) => {
    if (d.PointStatus === 1) return 'SIT Pass';
    if (d.PointStatus === 2) return 'Sanity Pass';
    if (d.PointStatus === 3) return 'Observation';
    return normalizeStatus(d.PointData?.CurrentStatus || getPointStatus(d.PointData?.AssignedTo));
  };

  const fetchPatches = async () => {
    setError(null);
    try {
      const data = await api.get('getPatchList');
      setPatches(data?.success && Array.isArray(data.data) ? data.data : []);
    } catch (e) {
      setError(e.message);
    }
  };

  const loadAll = async (mode = 'load') => {
    if (mode === 'load') setLoading(true);
    else setRefreshing(true);
    try {
      await api.post('refreshPatchStatuses').catch(() => null);
      await Promise.all([
        fetchPatches(),
        api
          .get('zentaoUserDB')
          .then((data) => {
            if (!Array.isArray(data)) return;
            const nonDeleted = data.filter((u) => !u.Deleted);
            setTestingUsers(nonDeleted.filter((u) => u.Role === 'Testing' || u.Role === 'Testing Lead'));
            setUserRoleMap(Object.fromEntries(nonDeleted.map((u) => [u.LoginName, u.Role])));
            setUserRealNameMap(Object.fromEntries(nonDeleted.map((u) => [u.LoginName, u.RealName])));
          })
          .catch(() => {}),
        api
          .get('testingLeadModuleMapping')
          .then((d) => setTlMappings(Array.isArray(d) ? d : []))
          .catch(() => {}),
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const init = {};
    patches.forEach((p) => (p.PatchDetails || []).forEach((d) => d.ID != null && (init[d.ID] = d.PointData?.AssignedTo || '')));
    setAssignedForTesting(init);
  }, [patches]);

  useHeaderActions([{ key: 'refresh', icon: 'refresh-cw', onPress: () => loadAll('refresh') }]);

  const productOptions = useMemo(() => uniqSorted(patches.flatMap((p) => (p.PatchDetails || []).map((d) => d.PointData?.ProductName))), [patches]);

  const filtered = useMemo(
    () =>
      patches.filter((p) => {
        if (typeFilter && p.PatchType !== typeFilter) return false;
        if (productFilter && !(p.PatchDetails || []).some((d) => d.PointData?.ProductName === productFilter)) return false;
        const q = search.trim().toLowerCase();
        if (q) {
          const m =
            String(p.PatchId || '').toLowerCase().includes(q) ||
            String(p.CreatedBy || '').toLowerCase().includes(q) ||
            (p.PatchDetails || []).some((d) => String(d.PointId || '').toLowerCase().includes(q));
          if (!m) return false;
        }
        return true;
      }),
    [patches, typeFilter, productFilter, search],
  );
  const pager = usePager(filtered, 15, `${typeFilter}|${productFilter}|${search}`);

  const markPointStatus = async (patch, d, actionType) => {
    const key = `${patch.ID}_${d.PointId}`;
    setMarkingStatus((p) => ({ ...p, [key]: actionType }));
    const pointStatus = actionType === 'obs' ? 3 : patch.PatchType === 'SIT' ? 1 : 2;
    try {
      await api.post('markPointStatus', { patchId: patch.ID, pointId: d.PointId, patchType: patch.PatchType, pointStatus });
      toast.success(actionType === 'obs' ? 'Marked as Observation' : 'Marked as Pass');
      fetchPatches();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setMarkingStatus((p) => {
        const n = { ...p };
        delete n[key];
        return n;
      });
    }
  };

  const assignPatchPoint = async (d, patchType) => {
    const tester = assignedForTesting[d.ID];
    if (!tester) return;
    setSavingIds((p) => ({ ...p, [d.ID]: true }));
    try {
      const data = await api.postJson('assignPatchPoint', {
        PointId: d.PointId,
        PointType: d.PointType,
        AssignedBy: loginName,
        AssignedTo: tester,
        AssignmentType: patchType,
      });
      if (!data?.success) throw new Error(data?.message || 'Assignment failed');
      setSavedIds((p) => ({ ...p, [d.ID]: true }));
      toast.success('Assignment saved');
      setTimeout(
        () =>
          setSavedIds((p) => {
            const n = { ...p };
            delete n[d.ID];
            return n;
          }),
        2000,
      );
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingIds((p) => {
        const n = { ...p };
        delete n[d.ID];
        return n;
      });
    }
  };

  const exportPatch = async (patch, details) => {
    try {
      await exportCsv(
        `${patch.PatchId}_Points`,
        [
          { header: 'Patch ID', value: () => patch.PatchId },
          { header: 'Patch Type', value: () => patch.PatchType },
          { header: 'Point ID', value: (d) => d.PointId },
          { header: 'Type', value: (d) => d.PointType },
          { header: 'Product', value: (d) => d.PointData?.ProductName },
          { header: 'Client', value: (d) => d.PointData?.ClientName },
          { header: 'Module', value: (d) => d.PointData?.ModuleName },
          { header: 'Title', value: (d) => d.PointData?.Title },
          { header: 'Opened By', value: (d) => d.PointData?.OpenedBy },
          { header: 'Opened Date', value: (d) => fmtDateTime(d.PointData?.OpenedDate, '') },
          { header: 'Assigned By', value: (d) => d.PointData?.AssignedBy },
          { header: 'Assigned Date', value: (d) => fmtDateTime(d.PointData?.AssignedDate, '') },
          { header: 'Zentao Status', value: (d) => resolvePointStatus(d) },
        ],
        details,
      );
    } catch (e) {
      toast.error(e.message);
    }
  };

  const keyOf = (p, i) => p.PatchHeaderId ?? p.PatchId ?? i;
  const openPatch = patches.find((p, i) => keyOf(p, i) === openKey);
  const openDetails = openPatch ? getVisibleDetails(openPatch.PatchDetails, !!viewAllMap[openKey]) : [];

  if (loading) return <Loading text="Loading Patches…" />;
  if (error && !patches.length) return <ErrorState message={error} onRetry={() => loadAll()} />;

  const StatusSummary = ({ details }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {PATCH_STATUSES.map((st) => {
        const n = details.filter((d) => resolvePointStatus(d) === st).length;
        const t = statusTone(st, dark);
        return (
          <View key={st} style={[s.sumChip, { backgroundColor: t.bg, opacity: n > 0 ? 1 : 0.35 }]}>
            <Text style={[s.sumText, { color: t.fg }]}>
              {st}: <Text style={{ fontWeight: '900' }}>{n}</Text>
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );

  return (
    <>
      <FlatList
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        data={pager.visible}
        keyExtractor={(p, i) => String(keyOf(p, i))}
        refreshing={refreshing}
        onRefresh={() => loadAll('refresh')}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 2 }}>
            <Segmented
              scroll={false}
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { label: 'All', value: '', color: c.primary },
                { label: 'SIT', value: 'SIT', color: c.sky },
                { label: 'Sanity', value: 'Sanity', color: c.emerald },
              ]}
            />
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search Patch ID, Point ID or Creator" />
            <Row>
              <Select compact icon="box" label="Product" allLabel="All Products" value={productFilter} options={productOptions} onChange={setProductFilter} />
              <Text style={s.count}>
                {filtered.length} patch{filtered.length !== 1 ? 'es' : ''}
              </Text>
            </Row>
          </View>
        }
        ListEmptyComponent={
          <Empty icon="package" title="No patches found" subtitle={search || typeFilter || productFilter ? 'Try adjusting the filters' : 'Create your first patch from the Create Patch tab'} />
        }
        ListFooterComponent={filtered.length ? <LoadMore pager={pager} /> : null}
        renderItem={({ item: p, index }) => {
          const k = keyOf(p, index);
          const visible = getVisibleDetails(p.PatchDetails, !!viewAllMap[k]);
          const bugs = visible.filter((d) => d.PointType === 'Bug').length;
          const stories = visible.filter((d) => d.PointType === 'Story').length;
          const today = isPatchCreatedToday(p.PatchCreationDateTime);
          return (
            <Card onPress={() => setOpenKey(k)} accent={p.PatchType === 'SIT' ? c.sky : p.PatchType === 'Sanity' ? c.emerald : c.slate}>
              <Row justify="space-between" align="flex-start">
                <View style={{ flex: 1 }}>
                  <Text style={s.patchId}>{p.PatchId || '—'}</Text>
                  <Text style={s.product}>{p.PatchDetails?.[0]?.PointData?.ProductName || '—'}</Text>
                </View>
                <Pill label={p.PatchType || '—'} status={p.PatchType} solid />
              </Row>
              <Row gap={6} wrap style={{ marginTop: 10 }}>
                <Pill label={`${bugs} Bug`} color={bugs ? c.red : c.slate} />
                <Pill label={`${stories} Story`} color={stories ? c.sky : c.slate} />
                <Pulse active={today}>
                  <Pill label={fmtDateTime(p.PatchCreationDateTime)} icon="clock" color={today ? c.primary : c.slate} />
                </Pulse>
              </Row>
              <Text style={s.by}>Created by {p.CreatedBy || '—'}</Text>
              <View style={{ marginTop: 10 }}>
                <StatusSummary details={visible} />
              </View>
              <Row gap={10} style={{ marginTop: 12 }}>
                {isTestingLead && <Checkbox label="View All" checked={!!viewAllMap[k]} onChange={() => setViewAllMap((m) => ({ ...m, [k]: !m[k] }))} color={c.violet} size={18} />}
                <View style={{ flex: 1 }} />
                <Button size="sm" variant="soft" color={c.emerald} icon="download" title="Export" disabled={!visible.length} onPress={() => exportPatch(p, visible)} />
                <Button size="sm" variant="soft" icon="chevron-right" title="Points" onPress={() => setOpenKey(k)} />
              </Row>
            </Card>
          );
        }}
      />

      <Sheet
        visible={!!openPatch}
        onClose={() => setOpenKey(null)}
        size="full"
        icon="package"
        accent={openPatch?.PatchType === 'Sanity' ? c.emerald : c.sky}
        title={openPatch?.PatchId}
        subtitle={openPatch ? `${openPatch.PatchType} · ${openDetails.length} points · by ${openPatch.CreatedBy || '—'}` : ''}
        headerRight={
          isTestingLead ? (
            <Checkbox label="All" checked={!!viewAllMap[openKey]} onChange={() => setViewAllMap((m) => ({ ...m, [openKey]: !m[openKey] }))} color={c.violet} size={18} />
          ) : null
        }
      >
        {openPatch && (
          <>
            <StatusSummary details={openDetails} />
            {openDetails.length === 0 ? (
              <Empty icon="list" title="No detail records found." />
            ) : (
              openDetails.map((d, i) => {
                const status = resolvePointStatus(d);
                const markKey = `${openPatch.ID}_${d.PointId}`;
                const busy = markingStatus[markKey];
                const tickEnabled = status === 'In Testing';
                const obsEnabled = status === 'Yet to be Assigned';
                const zType = (d.PointType || '').toLowerCase() === 'bug' ? 'bug' : 'story';
                return (
                  <Card key={`${d.PointId}-${i}`} flat style={s.detail}>
                    <Row justify="space-between">
                      <Row gap={8}>
                        <Text style={s.idx}>{i + 1}</Text>
                        <Pressable onPress={() => d.PointId && openUrl(zentaoLink(zType, d.PointId))} hitSlop={6}>
                          <Text style={s.pointId}>#{d.PointId || '—'}</Text>
                        </Pressable>
                        <Pill label={d.PointType || '—'} status={d.PointType} />
                      </Row>
                      <Pill label={status} status={status} icon={STATUS_ICON[status] || 'minus'} />
                    </Row>
                    <Text style={s.title}>{d.PointData?.Title || '—'}</Text>
                    <KVGrid style={{ marginTop: 4 }}>
                      <KV label="Product" value={d.PointData?.ProductName} />
                      <KV label="Client" value={d.PointData?.ClientName} />
                      <KV label="Module" value={d.PointData?.ModuleName} />
                      <KV label="Opened By" value={d.PointData?.OpenedBy} />
                      <KV label="Opened" value={fmtDateTime(d.PointData?.OpenedDate)} />
                      <KV label="Assigned By" value={d.PointData?.AssignedBy} />
                      <KV label="Assigned" value={fmtDateTime(d.PointData?.AssignedDate)} />
                    </KVGrid>
                    <Row gap={8} style={{ marginTop: 8 }}>
                      <Button
                        size="sm"
                        variant="soft"
                        color={c.amber}
                        icon="eye"
                        title="Observation"
                        disabled={!obsEnabled || !!busy}
                        loading={busy === 'obs'}
                        onPress={() => markPointStatus(openPatch, d, 'obs')}
                        style={{ flex: 1 }}
                      />
                      <Button
                        size="sm"
                        variant="soft"
                        color={c.emerald}
                        icon="check-circle"
                        title="Pass"
                        disabled={!tickEnabled || !!busy}
                        loading={busy === 'pass'}
                        onPress={() => markPointStatus(openPatch, d, 'pass')}
                        style={{ flex: 1 }}
                      />
                    </Row>
                    <View style={s.assignBox}>
                      <Text style={s.assignLbl}>Assigned for Testing</Text>
                      <Row gap={8}>
                        <View style={{ flex: 1 }}>
                          <Select
                            value={assignedForTesting[d.ID] || ''}
                            placeholder={userRealNameMap[assignedForTesting[d.ID]] || assignedForTesting[d.ID] || '— Select Tester —'}
                            disabled={!canAssignTesting}
                            options={testingUsers.map((u) => ({ value: u.LoginName, label: u.RealName, sub: u.Role }))}
                            onChange={(v) => setAssignedForTesting((m) => ({ ...m, [d.ID]: v }))}
                            title="Assign tester"
                            searchable
                          />
                        </View>
                        {canAssignTesting && (
                          <Pressable
                            onPress={() => assignPatchPoint(d, openPatch.PatchType)}
                            disabled={!assignedForTesting[d.ID] || !!savingIds[d.ID]}
                            style={[s.saveBtn, { backgroundColor: savedIds[d.ID] ? c.successSoft : c.primarySoft, opacity: assignedForTesting[d.ID] ? 1 : 0.4 }]}
                          >
                            {savingIds[d.ID] ? (
                              <ActivityIndicator size="small" color={c.primary} />
                            ) : (
                              <Feather name={savedIds[d.ID] ? 'check' : 'save'} size={18} color={savedIds[d.ID] ? c.success : c.primary} />
                            )}
                          </Pressable>
                        )}
                      </Row>
                    </View>
                  </Card>
                );
              })
            )}
          </>
        )}
      </Sheet>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  count: { marginLeft: 'auto', color: c.textFaint, fontSize: 12, fontWeight: '700' },
  patchId: { color: c.text, fontSize: 16, fontWeight: '900', fontVariant: ['tabular-nums'] },
  product: { color: c.textMuted, fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  by: { color: c.textFaint, fontSize: 11.5, marginTop: 8, fontWeight: '600' },
  sumChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  sumText: { fontSize: 10.5, fontWeight: '700' },
  detail: { backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border },
  idx: { color: c.textFaint, fontWeight: '800', fontSize: 12 },
  pointId: { color: c.primary, fontWeight: '900', fontSize: 14, textDecorationLine: 'underline' },
  title: { color: c.text, fontSize: 13.5, fontWeight: '700', marginTop: 8, lineHeight: 19 },
  assignBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border },
  assignLbl: { fontSize: 10.5, fontWeight: '800', color: c.textFaint, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  saveBtn: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
}));
