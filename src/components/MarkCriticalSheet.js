import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '../api/client';
import { rowsOf } from '../api/authFetch';
import { useAuth } from '../context/AuthContext';
import { Banner, Button, Select, Sheet, TextField } from '../ui';
import { useTheme, toneOf } from '../theme/theme';

/**
 * Port of MarkCriticalShared.jsx
 *  - canMarkCritical(role): Support | Product Owner
 *  - MarkCriticalSheet: GetVersions + GetProduct, POST MarkPointCritical
 *  - addMode: search a Bug ID via GetCurrentSprint
 */
const REMARKS_MAX = 200;

export const canMarkCritical = (role) => role === 'Support' || role === 'Product Owner';

const sprintLabel = (s) => {
  const name = s.SprintName || s.sprintName || `Sprint ${s.ID ?? s.id}`;
  const closed = s.IsClosed === true ? ' (Closed)' : '';
  const version = s.Version && s.Version !== 'NA' ? ` · ${s.Version}` : '';
  return `${name}${closed}${version}`;
};
const sprintIdOf = (s) => String(s.ID ?? s.id ?? '');
const sprintNameOf = (s) => String(s.SprintName ?? s.sprintName ?? '').trim();

export async function getCurrentSprint(bugId) {
  const id = String(bugId || '').trim();
  if (!id) return null;
  const payload = await api.get('getCurrentSprint', { bugId: id });
  const p = payload && typeof payload === 'object' ? payload : null;
  return {
    bugId: p?.BugId ?? p?.bugId ?? id,
    sprintId: p?.SprintId ?? p?.sprintId ?? null,
    title: p?.Title ?? p?.title ?? '',
    productName: p?.ProductName ?? p?.productName ?? '',
  };
}

export function MarkCriticalButton({ onPress, marked }) {
  const { c, dark } = useTheme();
  const t = toneOf(marked ? c.red : c.rose, dark);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg, borderWidth: 1, borderColor: t.border },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Feather name="flag" size={15} color={t.fg} />
    </Pressable>
  );
}

export default function MarkCriticalSheet({ visible, row, existing, onClose, onSaved, addMode = false }) {
  const { session } = useAuth();
  const [versions, setVersions] = useState([]);
  const [products, setProducts] = useState([]);
  const [allSprints, setAllSprints] = useState([]);
  const [productId, setProductId] = useState('');
  const [currentPatch, setCurrentPatch] = useState('');
  const [mainPatchSprint, setMainPatchSprint] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [bugId, setBugId] = useState('');
  const [currentSprintId, setCurrentSprintId] = useState('');
  const [loadingCurrentSprint, setLoadingCurrentSprint] = useState(false);
  const [bugTitle, setBugTitle] = useState('');
  const [bugProductName, setBugProductName] = useState('');

  const pointId = addMode ? bugId.trim() : row?.id ?? row?.Id ?? row?.ID ?? row?.PointId;
  const title = row?.title ?? row?.Title ?? '';
  const clientName = row?.ClientName ?? row?.clientName ?? '';
  const rowProductName = String(row?.product ?? row?.Product ?? row?.ProductName ?? row?.productName ?? existing?.product ?? '').trim();
  const rowProductId = String(row?.productId ?? row?.ProductId ?? existing?.productId ?? '').trim();

  // reset on open
  useEffect(() => {
    if (!visible) return;
    setRemarks(existing?.remarks || '');
    setError('');
    setSuccess('');
    setBugTitle('');
    setBugProductName('');
    setCurrentSprintId('');
    setCurrentPatch('');
    setMainPatchSprint('');
    setProductId('');
    setBugId(addMode ? '' : String(row?.id ?? row?.Id ?? row?.ID ?? row?.PointId ?? ''));
  }, [visible, addMode, row, existing]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      setLoadingMeta(true);
      try {
        const [versionPayload, productPayload] = await Promise.all([api.get('getVersions'), api.get('getProduct')]);
        if (cancelled) return;
        const versionList = rowsOf(versionPayload)
          .map((v) => ({ id: String(v.ID ?? v.Id ?? v.id ?? ''), name: String(v.VersionName ?? v.versionName ?? v.Name ?? v.name ?? '').trim() }))
          .filter((v) => v.name);
        const productList = Array.isArray(productPayload?.Product) ? productPayload.Product : [];
        const sprintList = Array.isArray(productPayload?.Sprint) ? productPayload.Sprint : [];
        setVersions(versionList);
        setProducts(productList);
        setAllSprints(sprintList);

        const byId = rowProductId ? productList.find((p) => String(p.id) === rowProductId) : null;
        const byName = productList.find((p) => String(p.name || '').toLowerCase() === rowProductName.toLowerCase());
        const match = byId || byName;
        if (match && !addMode) {
          setProductId(String(match.id));
          const related = sprintList.filter((s) => String(s.ProductId) === String(match.id));
          const raw = String(existing?.mainPatchSprint || '').trim();
          if (raw) {
            const hit = related.find((s) => sprintIdOf(s) === raw || sprintNameOf(s).toLowerCase() === raw.toLowerCase());
            setMainPatchSprint(hit ? sprintIdOf(hit) : '');
          }
        }
        const ev = String(existing?.clientPatchVersion || '').trim();
        if (ev) {
          const hit = versionList.find((v) => v.name.toLowerCase() === ev.toLowerCase() || v.id === ev);
          setCurrentPatch(hit ? hit.name : ev);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Unable to load dropdown data.');
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, existing?.clientPatchVersion, existing?.mainPatchSprint, rowProductId, rowProductName, addMode]);

  const handleSearchBug = async () => {
    const id = bugId.trim();
    if (!id) {
      setError('Please enter Bug ID.');
      return;
    }
    setLoadingCurrentSprint(true);
    setError('');
    setSuccess('');
    try {
      const result = await getCurrentSprint(id);
      const sprintId = result?.sprintId == null ? '' : String(result.sprintId);
      const productName = String(result?.productName || '').trim();
      setCurrentSprintId(sprintId);
      setBugTitle(String(result?.title || '').trim());
      setBugProductName(productName);
      if (productName) {
        const pm = products.find((p) => String(p.name || '').trim().toLowerCase() === productName.toLowerCase());
        if (pm) {
          const pid = String(pm.id);
          setProductId(pid);
          if (sprintId) {
            const sm = allSprints.find((s) => String(s.ProductId) === pid && sprintIdOf(s) === sprintId);
            setMainPatchSprint(sm ? sprintId : '');
          } else setMainPatchSprint('');
        } else {
          setProductId('');
          setMainPatchSprint('');
          setError(`Product "${productName}" is not available in the product list.`);
        }
      } else {
        setProductId('');
        setMainPatchSprint('');
        setError('Product not found for this Bug ID.');
      }
      if (!sprintId) setError((prev) => prev || 'No current sprint found for this Bug ID.');
    } catch (e) {
      setCurrentSprintId('');
      setBugTitle('');
      setBugProductName('');
      setProductId('');
      setMainPatchSprint('');
      setError(e.message || 'Unable to fetch Bug details.');
    } finally {
      setLoadingCurrentSprint(false);
    }
  };

  const relatedSprints = useMemo(() => (productId ? allSprints.filter((s) => String(s.ProductId) === String(productId)) : []), [allSprints, productId]);
  const openRelatedSprints = useMemo(
    () => relatedSprints.filter((s) => !(s.IsClosed === true || String(s.IsClosed).toLowerCase() === 'true')),
    [relatedSprints],
  );

  const handleSave = async () => {
    const version = currentPatch.trim();
    const id = String(pointId || '').trim();
    const remark = remarks.trim();
    if (!id) return setError('Bug ID is required.');
    if (!productId) return setError('Please select a product.');
    if (!version) return setError('Current Patch is required.');
    if (!mainPatchSprint) return setError('Main Patch Sprint is required.');
    if (!remark) return setError('Remarks is required.');
    if (remark.length > REMARKS_MAX) return setError(`Remarks must be ${REMARKS_MAX} characters or fewer.`);
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const msg = await api.post(
        'markPointCritical',
        {
          pointId: String(id),
          pointType: 'Bug',
          criticalMarkedBy: String(parseInt(session.userId || '0', 10)),
          clientVersion: version,
          remarks: remark,
          productId: String(productId),
          mainPatchSprint: String(mainPatchSprint),
        },
        { keepEmpty: true },
      );
      setSuccess(typeof msg === 'string' ? msg : msg?.message || 'Point critical marked successfully');
      setTimeout(() => {
        onSaved?.();
        onClose?.();
      }, 1200);
    } catch (e) {
      setError(e.message || 'Unable to mark as critical.');
    } finally {
      setSaving(false);
    }
  };

  const { c } = useTheme();

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      icon="flag"
      accent={c.rose}
      title={addMode ? 'Add Critical Point' : 'Mark Critical'}
      subtitle={addMode ? 'Add a bug directly to Critical Points' : `Bug #${pointId}${clientName ? ` · ${clientName}` : ''}`}
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={onClose} />
          <Button
            title={addMode ? 'Add Point' : existing ? 'Update' : 'Mark Critical'}
            color={c.rose}
            style={{ flex: 1.4 }}
            loading={saving}
            disabled={!!success || loadingMeta}
            onPress={handleSave}
          />
        </View>
      }
    >
      {addMode && (
        <View>
          <TextField
            label="Bug ID"
            required
            value={bugId}
            onChangeText={(t) => {
              setBugId(t.replace(/[^0-9]/g, ''));
              setError('');
              setBugTitle('');
              setBugProductName('');
              setCurrentSprintId('');
            }}
            keyboardType="number-pad"
            placeholder="Enter Bug ID"
            rightIcon={loadingCurrentSprint ? 'loader' : 'search'}
            onRightPress={handleSearchBug}
            onSubmitEditing={handleSearchBug}
          />
          {!!bugTitle && <Text style={{ marginTop: 8, color: c.text, fontWeight: '700', fontSize: 13, backgroundColor: c.surfaceAlt, padding: 10, borderRadius: 10 }}>{bugTitle}</Text>}
        </View>
      )}
      <Select
        label="Product"
        value={productId}
        disabled={loadingMeta || addMode}
        placeholder={loadingMeta ? 'Loading…' : addMode ? 'Search Bug ID to load product' : 'Select product'}
        options={products.map((p) => ({ label: p.name, value: String(p.id) }))}
        onChange={(v) => {
          setProductId(v);
          setMainPatchSprint('');
          setError('');
        }}
      />
      {!addMode && !!title && <Text style={{ color: c.textMuted, fontSize: 13, backgroundColor: c.surfaceAlt, padding: 10, borderRadius: 10 }}>{title}</Text>}
      <Select
        label="Client Current Patch Version / Fix Required"
        value={currentPatch}
        disabled={loadingMeta}
        placeholder={loadingMeta ? 'Loading…' : 'Select current patch'}
        options={versions.map((v) => ({ label: v.name, value: v.name }))}
        onChange={(v) => {
          setCurrentPatch(v);
          setError('');
        }}
      />
      <Select
        label="Main Patch Sprint"
        value={mainPatchSprint}
        disabled={loadingMeta || !productId}
        placeholder={
          loadingMeta ? 'Loading…' : !productId ? 'Select a product first' : relatedSprints.length === 0 ? 'No sprints for this product' : 'Select sprint'
        }
        options={openRelatedSprints.map((s) => ({ label: sprintLabel(s), value: sprintIdOf(s) }))}
        onChange={(v) => {
          setMainPatchSprint(v);
          setError('');
        }}
      />
      <TextField
        label="Remarks"
        value={remarks}
        onChangeText={(t) => {
          setRemarks(t);
          setError('');
        }}
        multiline
        numberOfLines={3}
        maxLength={REMARKS_MAX}
        showCount
        placeholder="Why is this point critical?"
      />
      <Banner type="error" text={error} />
      <Banner type="success" text={success} />
    </Sheet>
  );
}
