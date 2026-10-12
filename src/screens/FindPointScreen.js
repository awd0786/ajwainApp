import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '../api/client';
import { zentaoLink } from '../api/config';
import { makeStyles, toneOf, useTheme } from '../theme/theme';
import { fmtDate, fmtDateTime } from '../utils/format';
import { openUrl } from '../utils/exporter';
import { Banner, Button, Card, Empty, KV, KVGrid, Loading, Page, Pill, Row, SectionHeader, Segmented, TextField } from '../ui';

/**
 * Port of FindPoint.jsx (page key 'findPoint') – Find Point Sprint.
 * GetPointDetail?pointId&pointType -> sprint records + AuditHistoryJson + PointDropHistoryJson.
 */

const isTrue = (v) => v === true || v === 1 || v === '1' || v === 'true';
const parseArr = (raw) => {
  if (!raw) return [];
  try {
    const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
};
const byDate = (k) => (a, b) => new Date(a[k] || 0).getTime() - new Date(b[k] || 0).getTime();

function YesNo({ value, yes = 'Yes', no = 'No', color }) {
  const { c } = useTheme();
  return isTrue(value) ? <Pill label={yes} icon="check-circle" color={color || c.emerald} /> : <Pill label={no} icon="x-circle" color={c.slate} />;
}

export default function FindPointScreen() {
  const s = useStyles();
  const { c, dark } = useTheme();
  const [pointIdInput, setPointIdInput] = useState('');
  const [pointType, setPointType] = useState('Bug');
  const [records, setRecords] = useState([]);
  const [audits, setAudits] = useState([]);
  const [drops, setDrops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState({});
  const [tab, setTab] = useState('sprints');
  const [searchedId, setSearchedId] = useState('');

  const search = async () => {
    const id = String(pointIdInput).trim();
    if (!id) return setError('Please enter Point ID.');
    if (!/^\d+$/.test(id)) return setError('Point ID should contain numbers only.');
    setLoading(true);
    setSearched(true);
    setSearchedId(id);
    setError('');
    setRecords([]);
    setAudits([]);
    setDrops([]);
    setExpanded({});
    try {
      const data = await api.get('getPointDetail', { pointId: id, pointType });
      if (!data?.success || !Array.isArray(data?.data)) throw new Error(data?.message || 'Point details not found.');
      const sorted = [...data.data].sort(byDate('AddedDateTime'));
      setRecords(sorted);
      const a = [];
      const d = [];
      sorted.forEach((row) => {
        parseArr(row?.AuditHistoryJson).forEach((it) =>
          a.push({ ...it, Story: it.StoryId ?? row.Story, ProductName: it.ProductName ?? row.ProductName, SprintName: it.SprintName ?? row.SprintName, Type: it.Type ?? row.Type }),
        );
        parseArr(row?.PointDropHistoryJson).forEach((it) =>
          d.push({ ...it, PointId: it.PointId ?? row.Story, PointType: it.PointType ?? row.Type, ProductName: it.ProductName ?? row.ProductName }),
        );
      });
      setAudits(a.sort(byDate('AddedDateTime')));
      setDrops(d.sort(byDate('PointDropDateTime')));
      setTab('sprints');
    } catch (e) {
      setError(e?.message || 'Something went wrong while fetching point details.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPointIdInput('');
    setPointType('Bug');
    setRecords([]);
    setAudits([]);
    setDrops([]);
    setSearched(false);
    setError('');
    setExpanded({});
  };

  const latest = records.length ? records[records.length - 1] : null;
  const info = useMemo(
    () => (latest ? { product: latest.ProductName, story: latest.Story ?? searchedId, type: latest.Type ?? pointType, totalSprints: records.length } : null),
    [latest, records, searchedId, pointType],
  );

  return (
    <Page>
      <Card style={{ gap: 12 }}>
        <SectionHeader title="Find Point Sprint" subtitle="Trace every sprint a point has been part of" icon="search" />
        <Segmented
          scroll={false}
          value={pointType}
          onChange={setPointType}
          options={[
            { label: 'Bug', value: 'Bug', icon: 'alert-octagon', color: c.red },
            { label: 'Story', value: 'Story', icon: 'book-open', color: c.sky },
          ]}
        />
        <TextField
          label="Point ID"
          icon="hash"
          keyboardType="number-pad"
          value={pointIdInput}
          onChangeText={(t) => {
            setPointIdInput(t);
            setError('');
          }}
          placeholder={`Enter ${pointType} ID`}
          onSubmitEditing={search}
          returnKeyType="search"
        />
        <Row gap={10}>
          <Button title="Reset" icon="rotate-ccw" variant="secondary" style={{ flex: 1 }} onPress={reset} />
          <Button title={loading ? 'Searching…' : 'Search point'} icon="search" style={{ flex: 1.6 }} loading={loading} onPress={search} />
        </Row>
        <Banner type="error" text={error} />
      </Card>

      {loading ? (
        <Loading inline text="Fetching point details…" />
      ) : !searched ? (
        <Empty icon="search" title="Search a point" subtitle="Enter a Bug or Story ID to see its sprint journey, sprint changes and point drops." />
      ) : !records.length ? (
        !error && <Empty icon="inbox" title="No records found" />
      ) : (
        <>
          {/* Summary */}
          <Card style={{ gap: 12 }}>
            <Row justify="space-between" align="flex-start">
              <View style={{ flex: 1, gap: 4 }}>
                <Pressable onPress={() => openUrl(zentaoLink(String(info.type).toLowerCase() === 'bug' ? 'bug' : 'story', info.story))}>
                  <Text style={s.bigId}>#{info.story}</Text>
                </Pressable>
                <Row gap={6} wrap>
                  <Pill label={info.type || pointType} status={info.type || pointType} />
                  <Pill label={info.product || '-'} icon="box" color={c.violet} />
                  <Pill label={`${info.totalSprints} sprint${info.totalSprints === 1 ? '' : 's'}`} icon="layers" color={c.indigo} />
                </Row>
              </View>
              {isTrue(latest.IsCriticalPoint) && <Pill label="Critical" icon="alert-triangle" color={c.red} solid />}
            </Row>
            <View style={[s.current, { backgroundColor: toneOf(c.primary, dark).bg }]}>
              <Text style={s.currentLabel}>Current Sprint</Text>
              <Text style={s.currentValue}>{latest.SprintName || '-'}</Text>
            </View>
            <KVGrid>
              <KV label="Added By" value={`${latest.AddedByName || '-'}`} />
              <KV label="Added On" value={fmtDateTime(latest.AddedDateTime, '-')} />
              <KV label="Client Side Testing" value={latest.ClientSideTestingMarkedByName ? `${latest.ClientSideTestingMarkedByName} · ${fmtDateTime(latest.ClientSideTestingMarkDateTime, '-')}` : '-'} />
              <KV label="Point Drop" value={latest.PointDropByName ? `${latest.PointDropByName} · ${fmtDateTime(latest.PointDropDateTime, '-')}` : '-'} />
              <KV label="Target Date" value={latest.TargetDate ? `${fmtDate(latest.TargetDate)}${latest.TargetDateSavedByName ? ` · by ${latest.TargetDateSavedByName}` : ''}` : '-'} />
              <KV label="Dev Efforts" value={latest.DevEfforts != null ? `${latest.DevEfforts}${latest.DevEffortsSavedByName ? ` · by ${latest.DevEffortsSavedByName}` : ''}` : '-'} />
            </KVGrid>
          </Card>

          <Segmented
            scroll={false}
            size="sm"
            value={tab}
            onChange={setTab}
            options={[
              { label: 'Sprints', value: 'sprints', count: records.length },
              { label: 'Changes', value: 'audit', count: audits.length, color: c.violet },
              { label: 'Drops', value: 'drops', count: drops.length, color: c.red },
            ]}
          />

          {tab === 'sprints' &&
            records.map((row, i) => {
              const id = row.ID ?? i;
              const open = !!expanded[id];
              const last = i === records.length - 1;
              return (
                <View key={String(id)} style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ alignItems: 'center', width: 20 }}>
                    <View style={[s.tlDot, { borderColor: last ? c.primary : c.borderStrong, backgroundColor: last ? c.primary : c.surface }]} />
                    {!last && <View style={s.tlLine} />}
                  </View>
                  <Card style={{ flex: 1, marginBottom: 2 }}>
                    <Pressable onPress={() => setExpanded((e) => ({ ...e, [id]: !e[id] }))}>
                      <Row justify="space-between">
                        <Text style={s.sprint}>{row.SprintName || '-'}</Text>
                        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={17} color={c.textFaint} />
                      </Row>
                      <Text style={s.meta}>
                        {row.ProductName || '-'} · {row.Type || '-'} · added {fmtDateTime(row.AddedDateTime, '-')} by {row.AddedByName || '-'}
                      </Text>
                      <Row gap={6} wrap style={{ marginTop: 8 }}>
                        {isTrue(row.IsClientSideTesting) && <Pill label="Client Side Testing" color={c.violet} />}
                        {isTrue(row.IsPointDrop) && <Pill label="Point Dropped" color={c.red} />}
                        {isTrue(row.IsCriticalPoint) && <Pill label="Critical" color={c.rose} icon="flag" />}
                        {isTrue(row.Deleted) && <Pill label="Deleted" color={c.slate} />}
                        {!!row.TargetDate && <Pill label={`Target ${fmtDate(row.TargetDate)}`} icon="calendar" color={c.teal} />}
                        {row.DevEfforts != null && <Pill label={`${row.DevEfforts} h`} icon="clock" color={c.amber} />}
                      </Row>
                    </Pressable>
                    {open && (
                      <View style={{ gap: 10, marginTop: 12 }}>
                        <KVGrid>
                          <KV label="Client Side Testing" value={<YesNo value={row.IsClientSideTesting} />} />
                          <KV label="Point Drop" value={<YesNo value={row.IsPointDrop} color={c.red} />} />
                          <KV label="Critical" value={<YesNo value={row.IsCriticalPoint} color={c.rose} />} />
                          <KV label="Deleted" value={<YesNo value={row.Deleted} color={c.slate} />} />
                          <KV label="CST Marked By" value={row.ClientSideTestingMarkedByName || '-'} />
                          <KV label="CST Marked At" value={fmtDateTime(row.ClientSideTestingMarkDateTime, '-')} />
                          <KV label="Dropped By" value={row.PointDropByName || '-'} />
                          <KV label="Dropped At" value={fmtDateTime(row.PointDropDateTime, '-')} />
                          <KV label="Target Date" value={row.TargetDate ? fmtDate(row.TargetDate) : '-'} />
                          <KV label="Target Saved By" value={row.TargetDateSavedByName ? `${row.TargetDateSavedByName} · ${fmtDateTime(row.TargetDateSavedDateTime, '-')}` : '-'} />
                          <KV label="Dev Efforts" value={row.DevEfforts ?? '-'} />
                          <KV label="Efforts Saved By" value={row.DevEffortsSavedByName ? `${row.DevEffortsSavedByName} · ${fmtDateTime(row.DevEffortsSavedDateTime, '-')}` : '-'} />
                          <KV label="Deleted By" value={row.DeletedByName || '-'} />
                          <KV label="Deleted At" value={fmtDateTime(row.DeletedDateTime, '-')} />
                        </KVGrid>
                      </View>
                    )}
                  </Card>
                </View>
              );
            })}

          {tab === 'audit' &&
            (audits.length === 0 ? (
              <Empty icon="clock" title="No sprint change history found." />
            ) : (
              audits.map((a, i) => (
                <Card key={`${a.ID}-${i}`} accent={c.violet} style={{ gap: 6 }}>
                  <Row justify="space-between">
                    <Text style={s.sprint}>{a.SprintName || '-'}</Text>
                    <Text style={s.idx}>#{i + 1}</Text>
                  </Row>
                  <Text style={s.meta}>
                    {a.ProductName || '-'} · Point #{a.StoryId ?? a.Story ?? '-'}
                  </Text>
                  <Row gap={6}>
                    <Feather name="user" size={12} color={c.textMuted} />
                    <Text style={s.meta}>{a.SprintChangedBy || '-'}</Text>
                    <Feather name="calendar" size={12} color={c.textMuted} style={{ marginLeft: 6 }} />
                    <Text style={s.meta}>{fmtDateTime(a.AddedDateTime, '-')}</Text>
                  </Row>
                  {!!(a.Remarks ?? a.remarks) && <Text style={s.remarks}>{a.Remarks ?? a.remarks}</Text>}
                </Card>
              ))
            ))}

          {tab === 'drops' &&
            (drops.length === 0 ? (
              <Empty icon="alert-circle" title="No point drop history found." />
            ) : (
              drops.map((d, i) => (
                <Card key={`${d.ID ?? i}`} accent={c.red} style={{ gap: 6 }}>
                  <Row justify="space-between">
                    <Text style={s.sprint}>{d.SprintName || '-'}</Text>
                    <Pill label={`${d.PointType || '-'} #${d.PointId ?? '-'}`} color={c.indigo} />
                  </Row>
                  <Text style={s.meta}>{d.ProductName || '-'}</Text>
                  <Row gap={6}>
                    <Feather name="user-x" size={12} color={c.textMuted} />
                    <Text style={s.meta}>{d.PointDroppedByName || d.PointDropByName || '-'}</Text>
                    <Feather name="calendar" size={12} color={c.textMuted} style={{ marginLeft: 6 }} />
                    <Text style={s.meta}>{fmtDateTime(d.PointDropDateTime, '-')}</Text>
                  </Row>
                </Card>
              ))
            ))}
        </>
      )}
    </Page>
  );
}

const useStyles = makeStyles((c) => ({
  bigId: { color: c.primary, fontSize: 24, fontWeight: '900', textDecorationLine: 'underline' },
  current: { padding: 12, borderRadius: 14 },
  currentLabel: { color: c.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  currentValue: { color: c.primary, fontSize: 18, fontWeight: '900', marginTop: 2 },
  sprint: { color: c.text, fontSize: 14.5, fontWeight: '800', flex: 1 },
  meta: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  idx: { color: c.textFaint, fontSize: 11, fontWeight: '800' },
  remarks: { color: c.text, fontSize: 12.5, fontStyle: 'italic', lineHeight: 18 },
  tlDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 3, marginTop: 18 },
  tlLine: { width: 2, flex: 1, backgroundColor: c.border, marginTop: 2 },
}));
