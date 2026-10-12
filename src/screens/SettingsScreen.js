import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useHeaderActions } from '../navigation/ShellContext';
import { hashColor, makeStyles, useTheme } from '../theme/theme';
import { fmtDateTime, parseProductIds } from '../utils/format';
import {
  Button,
  Card,
  confirmAsync,
  Empty,
  Loading,
  Page,
  Pill,
  Row,
  SearchBar,
  SectionHeader,
  Segmented,
  Select,
  TextField,
  useToast,
} from '../ui';

/**
 * Port of SettingsSlider.jsx (+ ProductGroupMaster.jsx / ProductGroupMapping.jsx)
 * Tabs: Module→Dev Lead, Team Lead→Developer, Module→Testing Lead,
 *       Product Group Master, Product Group Mapping
 */

const TABS = [
  { value: 'module', label: 'Module Dev Lead', icon: 'git-branch' },
  { value: 'tldev', label: 'Team Lead & Dev', icon: 'users' },
  { value: 'modtl', label: 'Module Testing Lead', icon: 'check-circle' },
  { value: 'productgroup', label: 'Product Groups', icon: 'folder' },
  { value: 'groupmapping', label: 'Group Mapping', icon: 'link' },
];

const arr = (x) => (Array.isArray(x) ? x : []);

const normalizeGroups = (raw) => {
  const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.Data) ? raw.Data : Array.isArray(raw) ? raw : [];
  return list
    .map((r) => ({
      id: r.id ?? r.ID ?? r.Id ?? r.ProductGroupID ?? r.productGroupID,
      name: r.name ?? r.Name ?? r.NAME ?? r.GroupName ?? '',
      addedBy: r.addedBy ?? r.AddedBy ?? 0,
      addedByName: r.AddedByName ?? '',
      addedDateTime: r.addedDateTime ?? r.AddedDateTime ?? null,
    }))
    .filter((g) => g.id != null && g.id !== '');
};

const normalizeMappings = (raw) => {
  const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.Data) ? raw.Data : Array.isArray(raw) ? raw : [];
  const byGroup = new Map();
  list.forEach((r) => {
    const groupId = r.groupId ?? r.GroupId ?? r.GroupID;
    if (groupId == null) return;
    const productIds = parseProductIds(r.products ?? r.Products);
    const ex = byGroup.get(String(groupId));
    if (!ex) {
      byGroup.set(String(groupId), {
        groupId,
        groupName: r.groupName ?? r.GroupName ?? '',
        productIds: [...new Set(productIds)],
        mappingDateTime: r.mappingDateTime ?? r.MappingDateTime ?? null,
        mappedByName: r.mappedByName ?? r.MappedByName ?? '',
      });
    } else ex.productIds = [...new Set([...ex.productIds, ...productIds])];
  });
  return [...byGroup.values()];
};

async function modulesFor(productIds) {
  const out = {};
  await Promise.all(
    productIds.map(async (pid) => {
      try {
        out[pid] = arr(await api.get('zentaoModule', { productId: pid }));
      } catch {
        out[pid] = [];
      }
    }),
  );
  return out;
}

export default function SettingsScreen() {
  const toast = useToast();
  const { session } = useAuth();
  const [tab, setTab] = useState('module');

  const [products, setProducts] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [booting, setBooting] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [groups, setGroups] = useState([]);
  const [savedMappings, setSavedMappings] = useState([]);
  const [savedTLDev, setSavedTLDev] = useState([]);
  const [savedMTL, setSavedMTL] = useState([]);
  const [groupMappings, setGroupMappings] = useState([]);

  const teamLeads = useMemo(() => allUsers.filter((u) => (u.Role || '') === 'Dev Team Lead'), [allUsers]);
  const developers = useMemo(() => allUsers.filter((u) => (u.Role || '') === 'Developer'), [allUsers]);
  const testingLeads = useMemo(() => allUsers.filter((u) => (u.Role || '') === 'Testing Lead'), [allUsers]);
  const productOptions = useMemo(() => products.map((p) => ({ label: p.NAME || p.name || '', value: String(p.id) })), [products]);
  const productNameById = useMemo(() => Object.fromEntries(products.map((p) => [String(p.id), p.NAME || p.name || `#${p.id}`])), [products]);

  const fetchModuleMappings = useCallback(async (prods, users) => {
    try {
      const data = arr(await api.get('teamLeadModuleMapping'));
      const mods = await modulesFor([...new Set(data.map((r) => r.ProductId).filter(Boolean))]);
      setSavedMappings(
        data.map((r) => {
          const prod = prods.find((p) => String(p.id) === String(r.ProductId));
          const mod = (mods[r.ProductId] || []).find((m) => String(m.id) === String(r.ModuleId));
          const user = users.find((u) => u.LoginName === r.TeamLeadLoginName || String(u.ID) === String(r.TeamLeadId));
          return {
            id: r.ID,
            productId: r.ProductId,
            productName: prod ? prod.NAME || prod.name || '' : `Product #${r.ProductId}`,
            moduleId: r.ModuleId,
            moduleName: mod ? mod.name || '' : `Module #${r.ModuleId}`,
            teamLeadId: r.TeamLeadId,
            teamLeadName: user ? user.RealName || user.LoginName || r.TeamLeadLoginName : r.TeamLeadLoginName,
          };
        }),
      );
    } catch {
      setSavedMappings([]);
    }
  }, []);

  const fetchTLDev = useCallback(async (users) => {
    try {
      const data = arr(await api.get('teamLeadDevMapping'));
      setSavedTLDev(
        data.map((r) => {
          const tl = users.find((u) => String(u.ID) === String(r.TeamLeadId));
          const dev = users.find((u) => u.LoginName === r.DeveloperLoginName || String(u.ID) === String(r.DeveloperId));
          return {
            id: r.ID,
            teamLeadId: r.TeamLeadId,
            teamLeadName: tl ? tl.RealName || tl.LoginName || '' : `TL #${r.TeamLeadId}`,
            developerId: r.DeveloperId,
            developerName: dev ? dev.RealName || dev.LoginName || r.DeveloperLoginName : r.DeveloperLoginName || `Dev #${r.DeveloperId}`,
          };
        }),
      );
    } catch {
      setSavedTLDev([]);
    }
  }, []);

  const fetchMTL = useCallback(async (prods) => {
    try {
      const data = arr(await api.get('testingLeadModuleMapping'));
      const mods = await modulesFor([...new Set(data.map((r) => r.ProductId).filter(Boolean))]);
      setSavedMTL(
        data.map((r) => {
          const prod = prods.find((p) => String(p.id) === String(r.ProductId));
          const mod = (mods[r.ProductId] || []).find((m) => String(m.id) === String(r.ModuleId));
          return {
            id: r.ID,
            productId: r.ProductId,
            productName: prod ? prod.NAME || prod.name || '' : `Product #${r.ProductId}`,
            moduleId: r.ModuleId,
            moduleName: mod ? mod.name || '' : `Module #${r.ModuleId}`,
            testingLeadId: r.TestingLeadId,
            testingLeadName: r.TestingLeadName || `Testing Lead #${r.TestingLeadId}`,
          };
        }),
      );
    } catch {
      setSavedMTL([]);
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      const json = await api.get('getProductGroup');
      if (json && (json.success === false || json.Success === false)) return;
      setGroups(normalizeGroups(json));
    } catch {
      /* keep list */
    }
  }, []);

  const fetchGroupMappings = useCallback(async () => {
    try {
      const json = await api.get('getProductGroupMapping');
      if (json && (json.success === false || json.Success === false)) return setGroupMappings([]);
      setGroupMappings(normalizeMappings(json));
    } catch {
      setGroupMappings([]);
    }
  }, []);

  const loadAll = useCallback(async () => {
    const [prodsData, usersData] = await Promise.all([api.get('zentaoProduct').catch(() => []), api.get('zentaoUserDB').catch(() => [])]);
    const prods = arr(prodsData);
    const users = arr(usersData);
    setProducts(prods);
    setAllUsers(users);
    await Promise.all([fetchModuleMappings(prods, users), fetchTLDev(users), fetchMTL(prods), fetchGroups(), fetchGroupMappings()]);
  }, [fetchModuleMappings, fetchTLDev, fetchMTL, fetchGroups, fetchGroupMappings]);

  useEffect(() => {
    loadAll().finally(() => setBooting(false));
  }, [loadAll]);

  const refresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  useHeaderActions([{ key: 'refresh', icon: 'refresh-cw', onPress: refresh }]);

  const showResult = (json, fallbackOk, fallbackErr) => {
    if (json && (json.success === false || json.Success === false)) {
      toast.error(json.message || json.Message || fallbackErr);
      return false;
    }
    toast.success(json?.message || json?.Message || fallbackOk);
    return true;
  };

  const ctx = {
    products,
    productOptions,
    productNameById,
    teamLeads,
    developers,
    testingLeads,
    groups,
    toast,
    showResult,
    session,
  };

  return (
    <Page refreshing={refreshing} onRefresh={refresh} header={<Segmented options={TABS} value={tab} onChange={setTab} />}>
      {booting ? (
        <Loading text="Loading settings…" />
      ) : tab === 'module' ? (
        <ModuleLeadTab {...ctx} saved={savedMappings} setSaved={setSavedMappings} reload={() => fetchModuleMappings(products, allUsers)} />
      ) : tab === 'tldev' ? (
        <TLDevTab {...ctx} saved={savedTLDev} setSaved={setSavedTLDev} reload={() => fetchTLDev(allUsers)} />
      ) : tab === 'modtl' ? (
        <ModuleTestingLeadTab {...ctx} saved={savedMTL} setSaved={setSavedMTL} reload={() => fetchMTL(products)} />
      ) : tab === 'productgroup' ? (
        <ProductGroupTab {...ctx} reload={fetchGroups} />
      ) : (
        <GroupMappingTab {...ctx} mappings={groupMappings} reload={fetchGroupMappings} />
      )}
    </Page>
  );
}

/* --------------------------------------------------------------------- */
/* Shared bits                                                           */
/* --------------------------------------------------------------------- */
function useModules(productId) {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!productId) {
      setModules([]);
      return;
    }
    setLoading(true);
    api
      .get('zentaoModule', { productId })
      .then((d) => setModules(arr(d)))
      .catch(() => setModules([]))
      .finally(() => setLoading(false));
  }, [productId]);
  return { modules, loading };
}

function MappingRow({ title, subtitle, badge, badgeColor, onDelete, onPress }) {
  const s = useStyles();
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [s.mapRow, pressed && { opacity: 0.8 }]}>
      <View style={{ flex: 1 }}>
        <Text style={s.mapMain} numberOfLines={2}>{title}</Text>
        {!!subtitle && <Text style={s.mapSub} numberOfLines={2}>{subtitle}</Text>}
        {!!badge && <Pill label={badge} color={badgeColor || hashColor(badge)} style={{ marginTop: 6 }} />}
      </View>
      {!!onDelete && (
        <Pressable onPress={onDelete} hitSlop={8} style={s.del}>
          <Feather name="trash-2" size={15} color={c.danger} />
        </Pressable>
      )}
      {!!onPress && !onDelete && <Feather name="edit-2" size={15} color={c.textFaint} />}
    </Pressable>
  );
}

function SavedList({ title, count, total, search, setSearch, filter, setFilter, filterOptions, filterLabel, children, emptyText, placeholder }) {
  return (
    <Card>
      <SectionHeader title={title} icon="list" right={<Pill label={count !== total ? `${count}/${total}` : String(total)} color="#6366F1" />} />
      {total > 0 && (
        <View style={{ gap: 10, marginBottom: 10 }}>
          <SearchBar value={search} onChangeText={setSearch} placeholder={placeholder} />
          {!!filterOptions && <Select compact icon="filter" allLabel={filterLabel} label={filterLabel} value={filter} options={filterOptions} onChange={setFilter} />}
        </View>
      )}
      {total === 0 ? <Empty icon="layers" title="Nothing configured yet" subtitle={emptyText} style={{ paddingVertical: 24 }} /> : count === 0 ? <Empty icon="search" title="No matches" subtitle="No mappings match your search." style={{ paddingVertical: 24 }} /> : <View style={{ gap: 8 }}>{children}</View>}
    </Card>
  );
}

const userLabel = (u) => `${u.RealName || ''}${u.LoginName ? ` (${u.LoginName})` : ''}`;

/* --------------------------------------------------------------------- */
/* Tab 1: Module → Dev Lead                                              */
/* --------------------------------------------------------------------- */
function ModuleLeadTab({ productOptions, products, teamLeads, saved, setSaved, reload, showResult, toast }) {
  const [selProduct, setSelProduct] = useState('');
  const [selModules, setSelModules] = useState([]);
  const [selTeamLead, setSelTeamLead] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [tlFilter, setTlFilter] = useState('');
  const { modules, loading } = useModules(selProduct);

  useEffect(() => setSelModules([]), [selProduct]);

  const add = async () => {
    const product = products.find((p) => String(p.id) === selProduct);
    const lead = teamLeads.find((u) => String(u.ID) === selTeamLead);
    if (!product || !lead || !selModules.length) return;
    setSaving(true);
    try {
      const json = await api.postJson('saveModuleTeamLeadMapping', {
        ProductId: parseInt(selProduct, 10),
        ModuleIds: selModules.join(','),
        TeamLeadId: parseInt(selTeamLead, 10),
        TeamLeadLoginName: lead.LoginName || '',
      });
      if (showResult(json, `${selModules.length} mapping${selModules.length > 1 ? 's' : ''} saved successfully.`, 'Failed to save mapping.')) {
        setSelModules([]);
        setSelTeamLead('');
        reload();
      }
    } catch (e) {
      toast.error(e.message || 'Failed to save mapping.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m) => {
    if (!(await confirmAsync('Remove mapping', `${m.moduleName} → ${m.teamLeadName}`, { confirmText: 'Remove', destructive: true }))) return;
    setSaved((prev) => prev.filter((x) => x.id !== m.id));
    try {
      const json = await api.postJson('deleteModuleTeamLeadMapping', {
        ProductId: parseInt(m.productId, 10),
        ModuleId: parseInt(m.moduleId, 10),
        TeamLeadId: parseInt(m.teamLeadId, 10),
      });
      if (!showResult(json, 'Mapping deleted.', 'Failed to delete mapping.')) setSaved((p) => [...p, m]);
    } catch (e) {
      setSaved((p) => [...p, m]);
      toast.error(e.message);
    }
  };

  const uniqueTLs = [...new Map(saved.map((m) => [m.teamLeadId, m.teamLeadName])).entries()].map(([id, name]) => ({ value: String(id), label: name }));
  const filtered = saved.filter((m) => {
    const q = search.toLowerCase();
    const ms = !q || m.moduleName.toLowerCase().includes(q) || m.productName.toLowerCase().includes(q) || String(m.teamLeadName).toLowerCase().includes(q);
    return ms && (!tlFilter || String(m.teamLeadId) === tlFilter);
  });

  return (
    <>
      <Card>
        <SectionHeader title="Add / Update Mapping" subtitle="Assign product modules to a Dev Team Lead" icon="plus-circle" />
        <View style={{ gap: 12 }}>
          <Select label="Product" value={selProduct} options={productOptions} placeholder="Select Product" onChange={setSelProduct} />
          <Select
            label={`Module${selModules.length ? ` · ${selModules.length} selected` : ''}`}
            multi
            value={selModules}
            disabled={!selProduct || loading || modules.length === 0}
            placeholder={loading ? 'Loading modules…' : !selProduct ? 'Select a product first' : modules.length === 0 ? 'No modules found' : 'Select Modules…'}
            options={modules.map((m) => ({ value: String(m.id), label: m.name || '' }))}
            onChange={setSelModules}
          />
          <Select
            label="Team Lead"
            value={selTeamLead}
            disabled={selModules.length === 0}
            placeholder={selModules.length === 0 ? 'Select modules first' : teamLeads.length === 0 ? 'No team leads found' : 'Select Team Lead'}
            options={teamLeads.map((u) => ({ value: String(u.ID), label: userLabel(u) }))}
            onChange={setSelTeamLead}
          />
          <Button
            title={`Save ${selModules.length > 1 ? `${selModules.length} Mappings` : 'Mapping'}`}
            icon="plus"
            loading={saving}
            disabled={!selProduct || !selModules.length || !selTeamLead}
            onPress={add}
          />
        </View>
      </Card>
      <SavedList
        title="Saved Module Mappings"
        count={filtered.length}
        total={saved.length}
        search={search}
        setSearch={setSearch}
        filter={tlFilter}
        setFilter={setTlFilter}
        filterOptions={uniqueTLs}
        filterLabel="All Team Leads"
        placeholder="Search modules, products"
        emptyText="No module mappings configured yet. Add one above."
      >
        {filtered.map((m) => (
          <MappingRow key={m.id} title={m.moduleName} subtitle={m.productName} badge={m.teamLeadName} onDelete={() => remove(m)} />
        ))}
      </SavedList>
    </>
  );
}

/* --------------------------------------------------------------------- */
/* Tab 2: Team Lead → Developer                                          */
/* --------------------------------------------------------------------- */
function TLDevTab({ teamLeads, developers, saved, setSaved, reload, showResult, toast }) {
  const s = useStyles();
  const [selTL, setSelTL] = useState('');
  const [selDevs, setSelDevs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [tlFilter, setTlFilter] = useState('');

  useEffect(() => setSelDevs([]), [selTL]);

  const alreadyMapped = new Set(saved.filter((m) => String(m.teamLeadId) === selTL).map((m) => String(m.developerId)));
  const devOptions = developers.filter((u) => !alreadyMapped.has(String(u.ID))).map((u) => ({ value: String(u.ID), label: u.RealName ? userLabel(u) : u.LoginName || '' }));

  const add = async () => {
    if (!selTL || !selDevs.length) return;
    setSaving(true);
    try {
      const json = await api.postJson('saveTeamLeadDeveloperMapping', { TeamLeadId: parseInt(selTL, 10), DeveloperIds: selDevs.join(',') });
      if (showResult(json, `${selDevs.length} mapping${selDevs.length > 1 ? 's' : ''} saved successfully.`, 'Failed to save mapping.')) {
        setSelDevs([]);
        reload();
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m) => {
    if (!(await confirmAsync('Remove mapping', `${m.teamLeadName} → ${m.developerName}`, { confirmText: 'Remove', destructive: true }))) return;
    setSaved((prev) => prev.filter((x) => x.id !== m.id));
    try {
      const json = await api.postJson('deleteTeamLeadDeveloperMapping', { TeamLeadId: parseInt(m.teamLeadId, 10), DeveloperId: parseInt(m.developerId, 10) });
      if (!showResult(json, 'Mapping deleted.', 'Failed to delete mapping.')) setSaved((p) => [...p, m]);
    } catch (e) {
      setSaved((p) => [...p, m]);
      toast.error(e.message);
    }
  };

  const uniqueTLs = [...new Map(saved.map((m) => [m.teamLeadId, m.teamLeadName])).entries()].map(([id, name]) => ({ value: String(id), label: name }));
  const filtered = saved.filter((m) => {
    const q = search.toLowerCase();
    const ms = !q || String(m.developerName).toLowerCase().includes(q) || String(m.teamLeadName).toLowerCase().includes(q);
    return ms && (!tlFilter || String(m.teamLeadId) === tlFilter);
  });
  const grouped = filtered.reduce((acc, m) => {
    const k = String(m.teamLeadId);
    (acc[k] = acc[k] || { name: m.teamLeadName, items: [] }).items.push(m);
    return acc;
  }, {});

  return (
    <>
      <Card>
        <SectionHeader title="Team Lead → Developer" subtitle="Map developers under a Dev Team Lead" icon="plus-circle" />
        <View style={{ gap: 12 }}>
          <Select
            label="Team Lead"
            value={selTL}
            placeholder={teamLeads.length === 0 ? 'No team leads found' : 'Select Team Lead'}
            options={teamLeads.map((u) => ({ value: String(u.ID), label: userLabel(u) }))}
            onChange={setSelTL}
          />
          <Select
            label={`Developers${selDevs.length ? ` · ${selDevs.length} selected` : ''}`}
            multi
            value={selDevs}
            disabled={!selTL || devOptions.length === 0}
            placeholder={!selTL ? 'Select a team lead first' : devOptions.length === 0 ? 'No developers available' : 'Select Developers'}
            options={devOptions}
            onChange={setSelDevs}
          />
          <Button title={`Save ${selDevs.length > 1 ? `${selDevs.length} Mappings` : 'Mapping'}`} icon="plus" loading={saving} disabled={!selTL || !selDevs.length} onPress={add} />
        </View>
      </Card>
      <SavedList
        title="Saved Team Lead Mappings"
        count={filtered.length}
        total={saved.length}
        search={search}
        setSearch={setSearch}
        filter={tlFilter}
        setFilter={setTlFilter}
        filterOptions={uniqueTLs}
        filterLabel="All Team Leads"
        placeholder="Search developers, team leads…"
        emptyText="No team lead mappings configured yet."
      >
        {Object.entries(grouped).map(([tlId, g]) => (
          <View key={tlId} style={s.group}>
            <Row gap={8} style={{ marginBottom: 8 }}>
              <Feather name="user-check" size={14} color={hashColor(g.name)} />
              <Text style={s.groupTitle}>{g.name}</Text>
              <Pill label={String(g.items.length)} color={hashColor(g.name)} />
            </Row>
            <View style={{ gap: 6 }}>
              {g.items.map((m) => (
                <MappingRow key={m.id} title={m.developerName} onDelete={() => remove(m)} />
              ))}
            </View>
          </View>
        ))}
      </SavedList>
    </>
  );
}

/* --------------------------------------------------------------------- */
/* Tab 3: Module → Testing Lead                                          */
/* --------------------------------------------------------------------- */
function ModuleTestingLeadTab({ productOptions, products, testingLeads, saved, setSaved, reload, showResult, toast }) {
  const [selProduct, setSelProduct] = useState('');
  const [selModules, setSelModules] = useState([]);
  const [selLead, setSelLead] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [tlFilter, setTlFilter] = useState('');
  const { modules, loading } = useModules(selProduct);

  useEffect(() => setSelModules([]), [selProduct]);

  const add = async () => {
    const product = products.find((p) => String(p.id) === selProduct);
    const lead = testingLeads.find((u) => String(u.ID) === selLead);
    if (!product || !lead || !selModules.length) return;
    setSaving(true);
    try {
      const json = await api.postJson('saveModuleTestingLeadMapping', {
        ProductId: parseInt(selProduct, 10),
        ModuleIds: selModules.join(','),
        TestingLeadId: parseInt(selLead, 10),
        TestingLeadLoginName: lead.LoginName || '',
      });
      if (showResult(json, `${selModules.length} mapping${selModules.length > 1 ? 's' : ''} saved successfully.`, 'Failed to save mapping.')) {
        setSelModules([]);
        setSelLead('');
        reload();
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m) => {
    if (!(await confirmAsync('Remove mapping', `${m.moduleName} → ${m.testingLeadName}`, { confirmText: 'Remove', destructive: true }))) return;
    setSaved((prev) => prev.filter((x) => x.id !== m.id));
    try {
      const json = await api.postJson('deleteModuleTestingLeadMapping', {
        ProductId: parseInt(m.productId, 10),
        ModuleId: parseInt(m.moduleId, 10),
        TestingLeadId: parseInt(m.testingLeadId, 10),
      });
      if (!showResult(json, 'Mapping deleted.', 'Failed to delete mapping.')) setSaved((p) => [...p, m]);
    } catch (e) {
      setSaved((p) => [...p, m]);
      toast.error(e.message);
    }
  };

  const uniqueTLs = [...new Map(saved.map((m) => [m.testingLeadId, m.testingLeadName])).entries()].map(([id, name]) => ({ value: String(id), label: name }));
  const filtered = saved.filter((m) => {
    const q = search.toLowerCase();
    const ms = !q || m.moduleName.toLowerCase().includes(q) || m.productName.toLowerCase().includes(q) || String(m.testingLeadName).toLowerCase().includes(q);
    return ms && (!tlFilter || String(m.testingLeadId) === tlFilter);
  });

  return (
    <>
      <Card>
        <SectionHeader title="Module → Testing Lead" subtitle="Assign product modules to a Testing Lead" icon="plus-circle" color="#14B8A6" />
        <View style={{ gap: 12 }}>
          <Select label="Product" value={selProduct} options={productOptions} placeholder="Select Product" onChange={setSelProduct} />
          <Select
            label={`Module${selModules.length ? ` · ${selModules.length} selected` : ''}`}
            multi
            value={selModules}
            disabled={!selProduct || loading || modules.length === 0}
            placeholder={loading ? 'Loading modules…' : !selProduct ? 'Select a product first' : modules.length === 0 ? 'No modules found' : 'Select Modules…'}
            options={modules.map((m) => ({ value: String(m.id), label: m.name || '' }))}
            onChange={setSelModules}
          />
          <Select
            label="Testing Lead"
            value={selLead}
            disabled={selModules.length === 0}
            placeholder={selModules.length === 0 ? 'Select modules first' : testingLeads.length === 0 ? 'No testing leads found' : 'Select Testing Lead'}
            options={testingLeads.map((u) => ({ value: String(u.ID), label: userLabel(u) }))}
            onChange={setSelLead}
          />
          <Button title={`Save ${selModules.length > 1 ? `${selModules.length} Mappings` : 'Mapping'}`} icon="plus" loading={saving} disabled={!selProduct || !selModules.length || !selLead} onPress={add} />
        </View>
      </Card>
      <SavedList
        title="Saved Testing Lead Mappings"
        count={filtered.length}
        total={saved.length}
        search={search}
        setSearch={setSearch}
        filter={tlFilter}
        setFilter={setTlFilter}
        filterOptions={uniqueTLs}
        filterLabel="All Testing Leads"
        placeholder="Search modules, products"
        emptyText="No testing lead mappings configured yet."
      >
        {filtered.map((m) => (
          <MappingRow key={m.id} title={m.moduleName} subtitle={m.productName} badge={m.testingLeadName} onDelete={() => remove(m)} />
        ))}
      </SavedList>
    </>
  );
}

/* --------------------------------------------------------------------- */
/* Tab 4: Product Group Master                                           */
/* --------------------------------------------------------------------- */
function ProductGroupTab({ groups, reload, toast, session, showResult }) {
  const [groupName, setGroupName] = useState('');
  const [editingId, setEditingId] = useState(0);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = groups.filter((g) => !search.trim() || (g.name || '').toLowerCase().includes(search.toLowerCase()));
  const reset = () => {
    setGroupName('');
    setEditingId(0);
  };

  const save = async () => {
    const name = groupName.trim();
    if (!name) return toast.error('Enter a group name.');
    const gid = parseInt(editingId, 10) || 0;
    setSaving(true);
    try {
      const json = await api.post('saveProductGroup', { ID: String(gid), Name: name, AddedBy: String(parseInt(session.userId || '0', 10)) });
      if (showResult(json, gid ? 'Product group updated successfully.' : 'Product group saved successfully.', 'Failed to save product group.')) {
        reset();
        await reload();
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card>
        <SectionHeader title={editingId ? `Edit Product Group #${editingId}` : 'Add Product Group'} icon="folder-plus" color="#F59E0B" />
        <View style={{ gap: 12 }}>
          <TextField label="Group Name" value={groupName} onChangeText={setGroupName} placeholder="Enter group name" maxLength={100} onSubmitEditing={save} />
          <Row gap={10}>
            {editingId > 0 && <Button title="Cancel Edit" variant="secondary" style={{ flex: 1 }} onPress={reset} />}
            <Button title={editingId ? 'Update Group' : 'Save Group'} icon="save" style={{ flex: 1.4 }} loading={saving} disabled={!groupName.trim()} onPress={save} />
          </Row>
        </View>
      </Card>
      <SavedList title="Saved Product Groups" count={filtered.length} total={groups.length} search={search} setSearch={setSearch} placeholder="Search groups…" emptyText="No product groups yet. Save a group name above.">
        {filtered.map((g) => (
          <MappingRow
            key={g.id}
            title={g.name}
            subtitle={`Added by ${g.addedByName || '—'}${g.addedDateTime ? ` · ${fmtDateTime(g.addedDateTime)}` : ''}`}
            onPress={() => {
              setEditingId(g.id);
              setGroupName(g.name || '');
            }}
          />
        ))}
      </SavedList>
    </>
  );
}

/* --------------------------------------------------------------------- */
/* Tab 5: Product Group Mapping                                          */
/* --------------------------------------------------------------------- */
function GroupMappingTab({ groups, productOptions, productNameById, mappings, reload, toast, session, showResult }) {
  const s = useStyles();
  const [selGroupId, setSelGroupId] = useState('');
  const [selProductIds, setSelProductIds] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const applyGroup = (gid) => {
    setSelGroupId(gid);
    const ex = mappings.find((m) => String(m.groupId) === String(gid));
    if (ex) {
      setSelProductIds(ex.productIds.map(String));
      setIsEditing(true);
    } else {
      setSelProductIds([]);
      setIsEditing(false);
    }
  };
  const reset = () => {
    setSelGroupId('');
    setSelProductIds([]);
    setIsEditing(false);
  };

  const save = async () => {
    if (!selGroupId) return toast.error('Select a product group.');
    if (!selProductIds.length) return toast.error('Select at least one product.');
    setSaving(true);
    try {
      const json = await api.post('saveProductGroupMapping', {
        GroupId: String(selGroupId),
        ProductIds: selProductIds.join(','),
        MappedBy: String(parseInt(session.userId || '0', 10)),
      });
      if (showResult(json, isEditing ? 'Product Group mapping updated successfully.' : 'Product Group mapping saved successfully.', 'Failed to save product group mapping.')) {
        reset();
        await reload();
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = mappings.filter((m) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const names = (m.productIds || []).map((id) => productNameById[String(id)] || '').join(' ');
    return (m.groupName || '').toLowerCase().includes(q) || names.toLowerCase().includes(q) || (m.mappedByName || '').toLowerCase().includes(q);
  });

  return (
    <>
      <Card>
        <SectionHeader title={isEditing ? 'Edit Product Group Mapping' : 'Map Products to Group'} icon="link" color="#EC4899" />
        <View style={{ gap: 12 }}>
          <Select
            label="Group"
            value={selGroupId}
            placeholder={groups.length === 0 ? 'No groups found — create one in Product Groups' : 'Select Group'}
            options={groups.map((g) => ({ value: String(g.id), label: g.name }))}
            onChange={applyGroup}
          />
          <Select
            label={`Product Name${selProductIds.length ? ` · ${selProductIds.length} selected` : ''}`}
            multi
            value={selProductIds}
            disabled={!selGroupId || productOptions.length === 0}
            placeholder={!selGroupId ? 'Select a group first' : productOptions.length === 0 ? 'No products found' : 'Select Products…'}
            options={productOptions}
            onChange={setSelProductIds}
          />
          <Row gap={10}>
            {isEditing && <Button title="Cancel Edit" variant="secondary" style={{ flex: 1 }} onPress={reset} />}
            <Button title={isEditing ? 'Update Mapping' : 'Save Mapping'} icon="save" style={{ flex: 1.4 }} loading={saving} disabled={!selGroupId || !selProductIds.length} onPress={save} />
          </Row>
        </View>
      </Card>
      <SavedList title="Saved Group Mappings" count={filtered.length} total={mappings.length} search={search} setSearch={setSearch} placeholder="Search groups, products…" emptyText="No group mappings yet.">
        {filtered.map((m) => (
          <Pressable key={m.groupId} onPress={() => applyGroup(String(m.groupId))} style={({ pressed }) => [s.mapRow, { flexDirection: 'column', alignItems: 'stretch' }, pressed && { opacity: 0.8 }]}>
            <Row justify="space-between">
              <Text style={s.mapMain}>{m.groupName}</Text>
              <Pill label={`${m.productIds.length} products`} color="#EC4899" />
            </Row>
            <Row gap={6} wrap style={{ marginTop: 8 }}>
              {m.productIds.map((id) => (
                <Pill key={id} label={productNameById[String(id)] || `#${id}`} color={hashColor(String(id))} />
              ))}
            </Row>
            <Text style={[s.mapSub, { marginTop: 8 }]}>
              Mapped by {m.mappedByName || '—'}
              {m.mappingDateTime ? ` · ${fmtDateTime(m.mappingDateTime)}` : ''}
            </Text>
          </Pressable>
        ))}
      </SavedList>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  mapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: c.border,
  },
  mapMain: { color: c.text, fontWeight: '700', fontSize: 13.5, flexShrink: 1 },
  mapSub: { color: c.textMuted, fontSize: 11.5, marginTop: 2 },
  del: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: c.dangerSoft },
  group: { padding: 10, borderRadius: 16, borderWidth: 1, borderColor: c.border },
  groupTitle: { color: c.text, fontWeight: '800', fontSize: 13.5, flex: 1 },
}));
