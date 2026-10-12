import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { api } from '../api/client';
import { rowsOf } from '../api/authFetch';
import { zentaoLink } from '../api/config';
import useAsync from '../hooks/useAsync';
import { useHeaderActions } from '../navigation/ShellContext';
import { useAuth } from '../context/AuthContext';
import { hashColor, makeStyles, useTheme } from '../theme/theme';
import { fmtDateIN, uniqSorted } from '../utils/format';
import { exportCsv, openUrl } from '../utils/exporter';
import { Card, Empty, ErrorState, KV, KVGrid, LoadMore, Loading, Pill, Row, SearchBar, Segmented, Select, usePager, useToast } from '../ui';
import MarkCriticalSheet, { canMarkCritical, MarkCriticalButton } from '../components/MarkCriticalSheet';

/** Port of PendingReplicationBugs.jsx */
export default function PendingReplicationScreen() {
  const s = useStyles();
  const { c } = useTheme();
  const toast = useToast();
  const { session } = useAuth();
  const showMarkCritical = canMarkCritical(session.role);

  const [activeTab, setActiveTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [selectedTestingLead, setSelectedTestingLead] = useState('');
  const [selectedSprint, setSelectedSprint] = useState('');
  const [markRow, setMarkRow] = useState(null);

  const main = useAsync(async () => rowsOf(await api.get('pendingReplicationBugs')), [], { initial: [] });
  const leads = useAsync(async () => {
    try {
      return rowsOf(await api.get('testingLeadModuleMapping'));
    } catch {
      return [];
    }
  }, [], { initial: [] });

  const data = main.data || [];
  const mapping = leads.data || [];

  const testingLeadOptions = useMemo(() => uniqSorted(mapping.map((x) => x.TestingLeadName)), [mapping]);
  const sprintOptions = useMemo(
    () => (activeTab !== 'assigned' ? [] : uniqSorted(data.filter((i) => i.RevertBack === 1).map((i) => i.SprintName))),
    [data, activeTab],
  );

  const filtered = useMemo(() => {
    const byTab = data.filter((i) => (activeTab === 'pending' ? i.RevertBack === 0 : i.RevertBack === 1));
    const mods = selectedTestingLead ? mapping.filter((x) => x.TestingLeadName === selectedTestingLead).map((x) => x.ModuleId) : null;
    const q = search.trim().toLowerCase();
    return byTab.filter((i) => {
      if (mods && !mods.includes(i.module)) return false;
      if (activeTab === 'assigned' && selectedSprint && i.SprintName !== selectedSprint) return false;
      if (q && !String(i.id ?? '').includes(q) && !String(i.title || '').toLowerCase().includes(q) && !String(i.openedBy || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, activeTab, selectedTestingLead, mapping, selectedSprint, search]);

  const pager = usePager(filtered, 20, `${activeTab}|${search}|${selectedTestingLead}|${selectedSprint}`);

  const doExport = async () => {
    if (!filtered.length) return toast.info('Nothing to export');
    try {
      await exportCsv(
        activeTab === 'pending' ? 'PendingReplicationPoints' : 'AssignedBackPoints',
        [
          { header: 'ID', value: (r) => r.id },
          { header: 'Type', value: (r) => r.Type },
          { header: 'Title', value: (r) => r.title },
          { header: 'Product', value: (r) => r.Product1 },
          { header: 'Module', value: (r) => r.Module1 },
          { header: 'Client', value: (r) => r.ClientName },
          { header: 'Opened By', value: (r) => r.openedBy },
          { header: 'Opened Date', value: (r) => fmtDateIN(r.openedDate) },
          { header: 'Assigned To', value: (r) => r.assignedTo },
          { header: 'Assigned Date', value: (r) => fmtDateIN(r.assignedDate) },
          ...(activeTab === 'assigned' ? [{ header: 'Sprint Name', value: (r) => r.SprintName || '' }] : []),
        ],
        filtered,
      );
    } catch (e) {
      toast.error(e.message);
    }
  };

  useHeaderActions([
    { key: 'export', icon: 'download', onPress: doExport },
    { key: 'refresh', icon: 'refresh-cw', onPress: main.reload },
  ]);

  const header = (
    <View style={{ gap: 12, paddingBottom: 6 }}>
      <Segmented
        value={activeTab}
        onChange={(t) => {
          setActiveTab(t);
          setSearch('');
          setSelectedSprint('');
        }}
        scroll={false}
        options={[
          { label: 'Pending', value: 'pending', count: data.filter((d) => d.RevertBack === 0).length, color: c.indigo },
          { label: 'Assigned Back', value: 'assigned', count: data.filter((d) => d.RevertBack === 1).length, color: c.emerald },
        ]}
      />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search ID, title or creator" />
      <Row gap={8} wrap>
        <Select
          compact
          icon="user-check"
          label="Testing Lead"
          allLabel="All Testing Leads"
          value={selectedTestingLead}
          options={testingLeadOptions}
          onChange={setSelectedTestingLead}
        />
        {activeTab === 'assigned' && (
          <Select compact icon="zap" label="Sprint" allLabel="All Sprints" value={selectedSprint} options={sprintOptions} onChange={setSelectedSprint} />
        )}
        <Text style={s.count}>
          {filtered.length} record{filtered.length !== 1 ? 's' : ''}
        </Text>
      </Row>
    </View>
  );

  if (main.loading) return <Loading text="Loading Points…" />;
  if (main.error) return <ErrorState message={main.error} onRetry={main.reload} />;

  return (
    <>
      <FlatList
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        data={pager.visible}
        keyExtractor={(i, idx) => `${i.id}-${idx}`}
        ListHeaderComponent={header}
        refreshing={main.refreshing}
        onRefresh={main.refresh}
        ListEmptyComponent={<Empty icon="package" title="No records found" subtitle={search ? 'Try adjusting the search' : 'No pending replication bugs at the moment'} />}
        ListFooterComponent={filtered.length ? <LoadMore pager={pager} /> : null}
        renderItem={({ item, index }) => (
          <Card accent={item.Type === 'Bug' ? c.red : item.Type === 'Story' ? c.sky : c.slate}>
            <Row justify="space-between" align="flex-start">
              <Row gap={8} style={{ flex: 1 }}>
                <Text style={s.idx}>{index + 1}</Text>
                <Pressable onPress={() => openUrl(zentaoLink('bug', item.id))} hitSlop={6}>
                  <Text style={s.id}>#{item.id}</Text>
                </Pressable>
                <Pill label={item.Type || '—'} status={item.Type} />
              </Row>
              {activeTab === 'assigned' && showMarkCritical && item.Type === 'Bug' && <MarkCriticalButton onPress={() => setMarkRow(item)} />}
            </Row>
            <Text style={s.title}>{item.title || '—'}</Text>
            {activeTab === 'assigned' && !!item.SprintName && <Pill label={item.SprintName} color={hashColor(item.SprintName)} style={{ marginTop: 8 }} />}
            <KVGrid style={{ marginTop: 8 }}>
              <KV label="Product" value={item.Product1} />
              <KV label="Module" value={item.Module1} />
              <KV label="Client" value={item.ClientName} />
              <KV label="Opened By" value={item.openedBy} />
              <KV label="Opened" value={fmtDateIN(item.openedDate)} />
              <KV label="Assigned To" value={item.assignedTo} />
              <KV label="Assigned" value={fmtDateIN(item.assignedDate)} />
            </KVGrid>
          </Card>
        )}
      />
      <MarkCriticalSheet visible={!!markRow} row={markRow} onClose={() => setMarkRow(null)} onSaved={main.reload} />
    </>
  );
}

const useStyles = makeStyles((c) => ({
  count: { marginLeft: 'auto', color: c.textFaint, fontSize: 12, fontWeight: '700' },
  idx: { color: c.textFaint, fontWeight: '800', fontSize: 12 },
  id: { color: c.primary, fontWeight: '900', fontSize: 14, textDecorationLine: 'underline' },
  title: { color: c.text, fontSize: 14, fontWeight: '700', marginTop: 8, lineHeight: 20 },
}));
