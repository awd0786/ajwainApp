import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '../api/client';
import { zentaoLink } from '../api/config';
import { useHeaderActions } from '../navigation/ShellContext';
import { makeStyles, useTheme } from '../theme/theme';
import { fmtDateIN, getPriorityStatus } from '../utils/format';
import { exportExcel, openUrl } from '../utils/exporter';
import {
  ActiveFilters,
  Button,
  Card,
  Empty,
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
  usePager,
  useToast,
} from '../ui';
import { statusColor } from '../components/SprintSheets';

/**
 * Port of Report.jsx (page key 'report') – Sprint Point Report.
 * GetProduct -> ProductSprint?productId -> SprintDataByProductSprint?productId&sprintId
 * Columns are dynamic (every key returned by the API minus EXCLUDED), exactly like the web grid.
 */

const EXCLUDED = ['SLAId', 'IsClientSideTesting', 'PointDrop', 'Product', 'Module', 'ClientId'];
const CLIENT_KEYS = ['Client', 'ClientName', 'client', 'clientName'];
const PRIMARY = ['Id', 'ID', 'id', 'Title', 'title', 'Type', 'CurrentStatus', 'Sprint', 'SprintName'];

const getValue = (row, key) => {
  const v = row?.[key];
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};
const isDateValue = (v) => {
  if (!v || (typeof v !== 'string' && !(v instanceof Date))) return false;
  const s = String(v);
  if (!s.includes('-') && !s.includes('/') && !s.includes('T')) return false;
  return !Number.isNaN(new Date(v).getTime());
};
const displayValue = (v) => {
  if (v === null || v === undefined || v === '') return '-';
  if (typeof v === 'object') return JSON.stringify(v);
  if (isDateValue(v)) return fmtDateIN(v, String(v));
  return String(v);
};
const titleOf = (col) =>
  String(col)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());

export default function ReportScreen() {
  const s = useStyles();
  const { c } = useTheme();
  const toast = useToast();

  const [products, setProducts] = useState([]);
  const [allSprints, setAllSprints] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedSprint, setSelectedSprint] = useState('');
  const [reportData, setReportData] = useState([]);
  const [loadingReport, setLoadingReport] = useState(false);
  const [loadingSprints, setLoadingSprints] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState({});
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterColumn, setFilterColumn] = useState('');
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const d = await api.get('getProduct');
        setProducts(Array.isArray(d) ? d : Array.isArray(d?.Product) ? d.Product : Array.isArray(d?.data) ? d.data : []);
      } catch {
        setProducts([]);
      }
    })();
  }, []);

  const resetResults = () => {
    setReportData([]);
    setHasSearched(false);
    setGlobalSearch('');
    setClientFilter('');
    setColumnFilters({});
    setSortKey('');
    setSortDir('asc');
  };

  const loadSprints = async (productId) => {
    if (!productId) return setAllSprints([]);
    setLoadingSprints(true);
    try {
      const d = await api.get('productSprint', { productId });
      setAllSprints(d?.success && Array.isArray(d?.data) ? d.data : []);
    } catch {
      setAllSprints([]);
    } finally {
      setLoadingSprints(false);
    }
  };

  const changeProduct = (v) => {
    setSelectedProduct(v);
    setSelectedSprint('');
    setAllSprints([]);
    resetResults();
    if (v) loadSprints(v);
  };

  const loadReport = async () => {
    if (!selectedProduct || !selectedSprint) return toast.warning('Select a product and sprint first');
    setLoadingReport(true);
    try {
      const d = await api.get('sprintDataByProductSprint', { productId: selectedProduct, sprintId: selectedSprint });
      const rows = d?.success && Array.isArray(d?.data) ? d.data : [];
      resetResults();
      setReportData(rows);
      setHasSearched(true);
    } catch (e) {
      setReportData([]);
      setHasSearched(true);
      toast.error(e.message || 'Unable to load report');
    } finally {
      setLoadingReport(false);
    }
  };

  const sprintName = allSprints.find((x) => String(x.ID) === String(selectedSprint))?.SprintName || 'Sprint Report';
  const productName = products.find((p) => String(p.id ?? p.ID) === String(selectedProduct));

  const columns = useMemo(() => {
    const out = [];
    reportData.forEach((row) => Object.keys(row || {}).forEach((k) => !EXCLUDED.includes(k) && !out.includes(k) && out.push(k)));
    return out;
  }, [reportData]);

  const clientColumn = useMemo(() => CLIENT_KEYS.find((k) => columns.includes(k)), [columns]);
  const clientOptions = useMemo(
    () => (clientColumn ? [...new Set(reportData.map((r) => getValue(r, clientColumn).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)) : []),
    [reportData, clientColumn],
  );
  const columnOptions = (col) =>
    [...new Set(reportData.map((r) => getValue(r, col)).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b))).slice(0, 100);

  const filtered = useMemo(() => {
    let data = [...reportData];
    const q = globalSearch.trim().toLowerCase();
    if (q) data = data.filter((r) => columns.some((col) => getValue(r, col).toLowerCase().includes(q)));
    if (clientFilter && clientColumn) data = data.filter((r) => getValue(r, clientColumn) === clientFilter);
    Object.entries(columnFilters).forEach(([col, v]) => {
      if (v) data = data.filter((r) => getValue(r, col) === v);
    });
    if (sortKey) {
      data.sort((a, b) => {
        const cmp = getValue(a, sortKey).localeCompare(getValue(b, sortKey), undefined, { numeric: true, sensitivity: 'base' });
        return sortDir === 'desc' ? -cmp : cmp;
      });
    }
    return data;
  }, [reportData, columns, globalSearch, clientFilter, clientColumn, columnFilters, sortKey, sortDir]);

  const pager = usePager(filtered, 25, `${globalSearch}|${clientFilter}|${JSON.stringify(columnFilters)}|${sortKey}|${sortDir}`);

  const typeCounts = useMemo(() => {
    const m = {};
    filtered.forEach((r) => {
      const t = r.Type || r.type;
      if (t) m[t] = (m[t] || 0) + 1;
    });
    return m;
  }, [filtered]);

  const doExport = async () => {
    if (!filtered.length) return toast.info('Nothing to export');
    try {
      await exportExcel(sprintName.replace(/[\\/:*?"<>|]/g, '_'), {
        name: 'Report',
        rows: filtered,
        columns: columns.map((col) => ({
          header: titleOf(col),
          width: Math.min(Math.max(titleOf(col).length + 2, 10), 40),
          value: (r) => {
            const v = r[col];
            if (v === null || v === undefined) return '';
            return typeof v === 'object' ? JSON.stringify(v) : v;
          },
        })),
      });
    } catch (e) {
      toast.error(e.message || 'Export failed');
    }
  };

  useHeaderActions([{ key: 'export', icon: 'download', onPress: doExport, hidden: !hasSearched }], [hasSearched]);

  const activeColumnFilters = Object.entries(columnFilters).filter(([, v]) => v);
  const filterCount = (clientFilter ? 1 : 0) + activeColumnFilters.length;

  const idKey = ['Id', 'ID', 'id'].find((k) => columns.includes(k));
  const titleKey = ['Title', 'title'].find((k) => columns.includes(k));
  const restCols = columns.filter((k) => !PRIMARY.includes(k));

  const header = (
    <View style={{ gap: 12, paddingBottom: 4 }}>
      <Card style={{ gap: 12 }}>
        <Select
          label="Product"
          icon="box"
          searchable
          value={selectedProduct}
          placeholder="Select product"
          options={products.map((p) => ({ value: String(p.id ?? p.ID), label: p.name ?? p.Name ?? p.NAME ?? '' }))}
          onChange={changeProduct}
        />
        <Select
          label="Sprint"
          icon="zap"
          searchable
          disabled={!selectedProduct}
          value={selectedSprint}
          placeholder={!selectedProduct ? 'Select a product first' : loadingSprints ? 'Loading sprints…' : 'Select sprint'}
          options={allSprints.map((x) => ({ value: String(x.ID), label: x.SprintName ?? '', sub: x.IsClosed ? 'Closed' : undefined }))}
          onChange={(v) => {
            setSelectedSprint(v);
            resetResults();
          }}
        />
        <Row gap={10}>
          <Button
            title="Reset"
            icon="rotate-ccw"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => {
              setSelectedProduct('');
              setSelectedSprint('');
              setAllSprints([]);
              resetResults();
            }}
          />
          <Button title="Generate Report" icon="search" style={{ flex: 1.6 }} loading={loadingReport} disabled={!selectedProduct || !selectedSprint} onPress={loadReport} />
        </Row>
      </Card>

      {hasSearched && reportData.length > 0 && (
        <>
          <Hero title={sprintName} subtitle={productName?.name ?? productName?.Name ?? ''}>
            <Row gap={8} style={{ marginTop: 14 }}>
              <HeroStat label="Points" value={filtered.length} icon="layers" />
              {Object.entries(typeCounts)
                .slice(0, 3)
                .map(([t, n]) => (
                  <HeroStat key={t} label={t} value={n} icon={t === 'Bug' ? 'alert-octagon' : 'book-open'} />
                ))}
            </Row>
          </Hero>
          <SearchBar value={globalSearch} onChangeText={setGlobalSearch} placeholder="Search all columns" />
          <Row gap={8}>
            <FilterButton count={filterCount} onPress={() => setFilterOpen(true)} />
            <View style={{ flex: 1 }}>
              <Select
                compact
                icon="bar-chart"
                label="Sort"
                allLabel="No sorting"
                value={sortKey}
                options={columns.map((col) => ({ value: col, label: titleOf(col) }))}
                onChange={(v) => {
                  setSortKey(v);
                  setSortDir('asc');
                }}
              />
            </View>
            {!!sortKey && (
              <Pressable onPress={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))} style={s.dirBtn}>
                <Feather name={sortDir === 'asc' ? 'arrow-up' : 'arrow-down'} size={16} color={c.primary} />
              </Pressable>
            )}
          </Row>
          <ActiveFilters
            onClearAll={() => {
              setClientFilter('');
              setColumnFilters({});
            }}
            items={[
              clientFilter && { key: 'client', label: `Client: ${clientFilter}`, onClear: () => setClientFilter('') },
              ...activeColumnFilters.map(([col, v]) => ({
                key: col,
                label: `${titleOf(col)}: ${displayValue(v)}`,
                onClear: () => setColumnFilters((p) => ({ ...p, [col]: '' })),
              })),
            ]}
          />
          <Text style={s.count}>
            Showing {filtered.length} of {reportData.length} records
          </Text>
        </>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        data={hasSearched ? pager.visible : []}
        keyExtractor={(r, i) => `${idKey ? r[idKey] : ''}-${i}`}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loadingReport ? (
            <Loading inline text="Loading report…" />
          ) : hasSearched ? (
            <Empty icon="file-text" title={reportData.length ? 'No records match the filters' : 'No records found'} subtitle={reportData.length ? 'Try clearing filters.' : 'This sprint has no points.'} />
          ) : (
            <Empty icon="file-text" title="Sprint Point Report" subtitle="Select a product and sprint, then tap Generate Report." />
          )
        }
        ListFooterComponent={hasSearched && filtered.length ? <LoadMore pager={pager} /> : null}
        renderItem={({ item: row, index }) => {
          const id = idKey ? row[idKey] : null;
          const type = row.Type || row.type;
          const status = 'PointDrop' in row || 'IsClientSideTesting' in row ? getPriorityStatus(row) : row.CurrentStatus;
          const open = !!expanded[index];
          const shown = open ? restCols : restCols.slice(0, 6);
          return (
            <Card accent={type === 'Bug' ? c.red : c.indigo}>
              <Row justify="space-between" align="flex-start">
                <Row gap={8} style={{ flex: 1 }} wrap>
                  {id != null && (
                    <Pressable onPress={() => openUrl(zentaoLink(String(type).toLowerCase() === 'bug' ? 'bug' : 'story', id))} hitSlop={6}>
                      <Text style={s.id}>#{id}</Text>
                    </Pressable>
                  )}
                  {!!type && <Pill label={type} status={type} />}
                  {!!status && status !== '-' && <Pill label={status} color={statusColor(status)} />}
                </Row>
              </Row>
              {!!titleKey && <Text style={s.title}>{displayValue(row[titleKey])}</Text>}
              {!!(row.Sprint || row.SprintName) && <Pill label={row.Sprint || row.SprintName} icon="zap" color={c.indigo} style={{ marginTop: 8 }} />}
              <KVGrid style={{ marginTop: 10 }}>
                {shown.map((col) => (
                  <KV key={col} label={titleOf(col)} value={displayValue(row[col])} />
                ))}
              </KVGrid>
              {restCols.length > 6 && (
                <Pressable onPress={() => setExpanded((e) => ({ ...e, [index]: !e[index] }))} style={s.moreBtn}>
                  <Text style={s.moreText}>{open ? 'Show less' : `Show all ${restCols.length} fields`}</Text>
                  <Feather name={open ? 'chevron-up' : 'chevron-down'} size={14} color={c.primary} />
                </Pressable>
              )}
            </Card>
          );
        }}
      />

      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        onClear={() => {
          setClientFilter('');
          setColumnFilters({});
          setFilterColumn('');
        }}
        subtitle={`${filtered.length} record(s)`}
      >
        {!!clientColumn && <Select label="Client" icon="briefcase" searchable allLabel="All Clients" value={clientFilter} options={clientOptions} onChange={setClientFilter} />}
        <Select
          label="Column filter"
          icon="columns"
          searchable
          placeholder="Choose a column"
          value={filterColumn}
          options={columns.map((col) => ({ value: col, label: titleOf(col), sub: columnFilters[col] ? `= ${displayValue(columnFilters[col])}` : undefined }))}
          onChange={setFilterColumn}
        />
        {!!filterColumn && (
          <Select
            label={`${titleOf(filterColumn)} equals`}
            icon="filter"
            searchable
            allLabel="All"
            value={columnFilters[filterColumn] || ''}
            options={columnOptions(filterColumn).map((v) => ({ value: v, label: displayValue(v) }))}
            onChange={(v) => setColumnFilters((p) => ({ ...p, [filterColumn]: v }))}
          />
        )}
        {activeColumnFilters.length > 0 && (
          <Segmented
            options={activeColumnFilters.map(([col]) => ({ label: titleOf(col), value: col, icon: 'filter' }))}
            value={filterColumn}
            onChange={setFilterColumn}
          />
        )}
      </FilterSheet>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  id: { color: c.primary, fontWeight: '900', fontSize: 15, textDecorationLine: 'underline' },
  title: { color: c.text, fontSize: 14, fontWeight: '700', marginTop: 8, lineHeight: 20 },
  count: { color: c.textFaint, fontSize: 12, fontWeight: '700' },
  dirBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primarySoft },
  moreBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: c.primarySoft },
  moreText: { color: c.primary, fontSize: 11.5, fontWeight: '800' },
}));
