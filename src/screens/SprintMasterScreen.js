import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '../api/client';
import useAsync from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';
import { useHeaderActions } from '../navigation/ShellContext';
import { makeStyles, useTheme } from '../theme/theme';
import { fmtDate, fmtDateIN, toYMD } from '../utils/format';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  DateField,
  Empty,
  ErrorState,
  Fab,
  KV,
  KVGrid,
  Loading,
  Pill,
  Row,
  Segmented,
  Select,
  Sheet,
  TextField,
  useToast,
} from '../ui';

/** Port of SprintMaster.jsx – GetProduct / CreateSprint / CloseSprint */
export default function SprintMasterScreen() {
  const s = useStyles();
  const { c } = useTheme();
  const toast = useToast();
  const { session } = useAuth();
  const { canCreateSprint, permissionsLoading } = usePermissions();

  const [selectedProduct, setSelectedProduct] = useState('');
  const [showClosed, setShowClosed] = useState(false);
  const [form, setForm] = useState(null); // {editingId, sprintName, version, isMaintenance, isPlanning, deliveryDate}
  const [saving, setSaving] = useState(false);
  const [closeModal, setCloseModal] = useState(null);
  const [closeDelivery, setCloseDelivery] = useState('1');
  const [closeRemarks, setCloseRemarks] = useState('');
  const [closing, setClosing] = useState(false);

  const q = useAsync(
    async () => {
      const data = await api.get('getProduct');
      return { products: Array.isArray(data?.Product) ? data.Product : [], sprints: Array.isArray(data?.Sprint) ? data.Sprint : [] };
    },
    [],
    { initial: { products: [], sprints: [] } },
  );
  const products = q.data.products;
  const allSprints = q.data.sprints;

  useEffect(() => {
    if (!selectedProduct && products.length) setSelectedProduct(String(products[0].id));
  }, [products, selectedProduct]);

  useHeaderActions([{ key: 'refresh', icon: 'refresh-cw', onPress: q.refresh }]);

  const filteredSprints = useMemo(
    () => (!selectedProduct ? [] : allSprints.filter((sp) => String(sp.ProductId) === String(selectedProduct) && (showClosed ? sp.IsClosed : !sp.IsClosed))),
    [allSprints, selectedProduct, showClosed],
  );
  const productSprints = allSprints.filter((sp) => String(sp.ProductId) === String(selectedProduct));
  const selectedProductName = products.find((p) => String(p.id) === String(selectedProduct))?.name ?? '';

  const guard = (msg) => {
    if (permissionsLoading) {
      toast.info('Please wait while permission is being checked.');
      return false;
    }
    if (!canCreateSprint) {
      toast.error(msg);
      return false;
    }
    return true;
  };

  const openCreate = () => {
    if (!guard('Access Denied: You are not authorized to create a sprint.')) return;
    if (!selectedProduct) return toast.warning('Select a product first.');
    setForm({ editingId: null, sprintName: '', version: '', isMaintenance: false, isPlanning: false, deliveryDate: '' });
  };

  const openEdit = (sp) => {
    if (sp.IsClosed) return;
    if (!guard('Access Denied: You are not authorized to update a sprint.')) return;
    setForm({
      editingId: sp.ID,
      sprintName: sp.SprintName ?? '',
      version: sp.Version ?? '',
      isMaintenance: !!sp.IsMaintenancePatch,
      isPlanning: !!sp.IsPlanning,
      deliveryDate: toYMD(sp.ExpectedDeliveryDate),
    });
  };

  const handleSave = async () => {
    if (!guard('Access Denied: You are not authorized to create or update a sprint.')) return;
    if (!selectedProduct) return toast.warning('Select a product first.');
    const trimmed = form.sprintName.trim();
    if (!trimmed) return toast.warning('Enter a sprint name.');
    const ver = form.version.trim();
    if (!ver) return toast.warning('Enter a version.');
    const { editingId, isMaintenance } = form;

    if (editingId === null) {
      const n = allSprints.filter((x) => String(x.ProductId) === String(selectedProduct) && !x.IsClosed && Boolean(x.IsMaintenancePatch) === isMaintenance).length;
      if (n >= 5) return toast.warning(`Maximum 5 open ${isMaintenance ? 'Maintenance' : 'Main'} Patch sprints are allowed for this product. Please close an existing sprint first.`);
    } else {
      const original = allSprints.find((x) => x.ID === editingId);
      if (original && Boolean(original.IsMaintenancePatch) !== isMaintenance) {
        const n = allSprints.filter((x) => String(x.ProductId) === String(selectedProduct) && x.ID !== editingId && !x.IsClosed && Boolean(x.IsMaintenancePatch) === isMaintenance).length;
        if (n >= 5) return toast.warning(`Maximum 2 open ${isMaintenance ? 'Maintenance' : 'Main'} Patch sprints are allowed. Cannot change the patch type.`);
      }
    }

    setSaving(true);
    try {
      const msg = await api.post(
        'createSprint',
        {
          id: editingId ?? 0,
          productId: selectedProduct,
          productName: selectedProductName,
          sprintName: trimmed,
          addedBy: parseInt(session.userId || '0', 10),
          addedByName: session.loginName || '',
          version: ver,
          isMaintenance: isMaintenance ? 'true' : 'false',
          isPlanning: form.isPlanning ? 'true' : 'false',
          deliveryDate: form.deliveryDate || '',
        },
        { keepEmpty: true },
      );
      const text = typeof msg === 'string' ? msg : msg?.message || '';
      if (String(text).toLowerCase().includes('success')) {
        toast.success(text || `Sprint "${trimmed}" ${editingId ? 'updated' : 'created'} successfully.`);
        setForm(null);
        q.refresh();
      } else toast.error(text || 'Failed to create sprint.');
    } catch (e) {
      toast.error(e.message || 'Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const askClose = (sp) => {
    const role = session.role || '';
    const userId = String(session.userId || '');
    if (role !== 'COO' && role !== 'CEO' && userId !== '15' && userId !== '14') {
      return toast.error('Access Denied: Only COO, CEO, or authorized users can close a sprint.');
    }
    setCloseModal(sp);
    setCloseDelivery('1');
    setCloseRemarks('');
  };

  const handleCloseSprint = async () => {
    if (!closeRemarks.trim()) return toast.warning('Closing remarks are mandatory.');
    setClosing(true);
    try {
      const data = await api.post(
        'closeSprint',
        { sprintId: closeModal.ID, closedBy: session.realName || '', isDeliveredOther: closeDelivery, closingRemarks: closeRemarks.trim() },
        { keepEmpty: true },
      );
      if (data?.success) {
        toast.success(data.message || 'Sprint closed successfully.');
        setCloseModal(null);
        q.refresh();
      } else toast.error(data?.message || 'Failed to close sprint.');
    } catch (e) {
      toast.error(e.message || 'Network error. Please try again.');
    } finally {
      setClosing(false);
    }
  };

  if (q.loading) return <Loading text="Loading sprints…" />;
  if (q.error) return <ErrorState message={q.error} onRetry={q.reload} />;

  const openCount = productSprints.filter((x) => !x.IsClosed).length;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 110 }}
        data={filteredSprints}
        keyExtractor={(sp, i) => String(sp.ID ?? i)}
        refreshing={q.refreshing}
        onRefresh={q.refresh}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <Select label="Product" icon="box" value={selectedProduct} options={products.map((p) => ({ label: p.name, value: String(p.id) }))} onChange={setSelectedProduct} clearable={false} />
            <Segmented
              scroll={false}
              value={showClosed ? 'closed' : 'open'}
              onChange={(v) => setShowClosed(v === 'closed')}
              options={[
                { label: 'Open', value: 'open', count: openCount, color: c.emerald },
                { label: 'Closed', value: 'closed', count: productSprints.length - openCount, color: c.slate },
              ]}
            />
            {!permissionsLoading && !canCreateSprint && <Banner type="info" text="You can view sprints. Creating or updating sprints requires the Sprint Creation permission." />}
          </View>
        }
        ListEmptyComponent={<Empty icon="zap" title="No sprints" subtitle={selectedProduct ? 'No sprints found for this product.' : 'Select a product to see its sprints.'} />}
        renderItem={({ item: sp, index }) => (
          <Card onPress={sp.IsClosed ? undefined : () => openEdit(sp)} accent={sp.IsClosed ? c.slate : sp.IsMaintenancePatch ? c.amber : c.indigo} style={sp.IsClosed && { opacity: 0.85 }}>
            <Row justify="space-between" align="flex-start">
              <View style={{ flex: 1 }}>
                <Text style={s.idx}>#{index + 1} · {sp.ProductName ?? selectedProductName}</Text>
                <Text style={s.name}>{sp.SprintName ?? '—'}</Text>
              </View>
              <Pill label={sp.IsClosed ? 'CLOSED' : 'OPEN'} color={sp.IsClosed ? c.slate : c.emerald} solid />
            </Row>
            <Row gap={6} wrap style={{ marginTop: 8 }}>
              <Pill label={sp.IsMaintenancePatch ? 'MAINTENANCE' : 'MAIN PATCH'} color={sp.IsMaintenancePatch ? c.amber : c.sky} />
              {!!sp.Version && <Pill label={sp.Version} icon="tag" color={c.violet} />}
              {sp.IsPlanning ? <Pill label="Planned" icon="calendar" color={c.teal} /> : null}
            </Row>
            <KVGrid style={{ marginTop: 6 }}>
              <KV label="Delivery Date" value={sp.ExpectedDeliveryDate ? fmtDateIN(sp.ExpectedDeliveryDate) : '—'} />
              <KV label="Planned Sprint" value={sp.IsPlanning ? 'Yes' : 'No'} />
              {sp.IsClosed && (
                <>
                  <KV
                    label="Delivery"
                    value={String(sp.IsDeliveredOther) === '1' ? 'Delivered' : String(sp.IsDeliveredOther) === '2' ? 'Other' : '—'}
                    color={String(sp.IsDeliveredOther) === '1' ? c.success : String(sp.IsDeliveredOther) === '2' ? c.orange : undefined}
                  />
                  <KV label="Closed By" value={sp.ClosedBy} />
                  <KV label="Closed On" value={sp.ClosedDateTime ? fmtDate(sp.ClosedDateTime) : '—'} />
                  <KV label="Remarks" value={sp.ClosingRemarks} wide />
                </>
              )}
            </KVGrid>
            {!sp.IsClosed && (
              <Row gap={8} style={{ marginTop: 8 }}>
                <Button size="sm" variant="soft" icon="edit-2" title="Edit" onPress={() => openEdit(sp)} />
                <Button size="sm" variant="soft" color={c.red} icon="x-circle" title="Close Sprint" onPress={() => askClose(sp)} />
              </Row>
            )}
          </Card>
        )}
      />
      {canCreateSprint && <Fab label="New Sprint" icon="plus" onPress={openCreate} />}

      <Sheet
        visible={!!form}
        onClose={() => setForm(null)}
        icon="zap"
        title={form?.editingId != null ? `Edit Sprint #${form.editingId}` : 'Create New Sprint'}
        subtitle={selectedProductName}
        footer={
          <Row gap={10}>
            <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setForm(null)} />
            <Button
              title={form?.editingId != null ? 'Update Sprint' : 'Save Sprint'}
              icon="save"
              style={{ flex: 1.4 }}
              loading={saving}
              disabled={!form?.sprintName.trim() || !form?.version.trim()}
              onPress={handleSave}
            />
          </Row>
        }
      >
        {form && (
          <>
            <TextField label="Sprint Name" required value={form.sprintName} onChangeText={(v) => setForm((f) => ({ ...f, sprintName: v }))} placeholder="e.g. Sprint 24" />
            <TextField label="Version" required value={form.version} onChangeText={(v) => setForm((f) => ({ ...f, version: v }))} placeholder="e.g. v1.2.0" autoCapitalize="none" />
            <DateField label="Delivery Date" value={form.deliveryDate} onChange={(v) => setForm((f) => ({ ...f, deliveryDate: v }))} />
            <Row gap={24}>
              <Checkbox label="Maintenance Patch" checked={form.isMaintenance} onChange={(v) => setForm((f) => ({ ...f, isMaintenance: v }))} color={c.amber} />
              <Checkbox label="Is Planned" checked={form.isPlanning} onChange={(v) => setForm((f) => ({ ...f, isPlanning: v }))} color={c.teal} />
            </Row>
          </>
        )}
      </Sheet>

      <Sheet
        visible={!!closeModal}
        onClose={() => !closing && setCloseModal(null)}
        icon="x-circle"
        accent={c.red}
        title="Close Sprint"
        subtitle={closeModal?.SprintName}
        footer={
          <Row gap={10}>
            <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setCloseModal(null)} disabled={closing} />
            <Button title="Close Sprint" icon="x-circle" color={c.red} style={{ flex: 1.4 }} loading={closing} disabled={!closeRemarks.trim()} onPress={handleCloseSprint} />
          </Row>
        }
      >
        <View>
          <Text style={s.lbl}>Delivery Type</Text>
          <Segmented
            scroll={false}
            value={closeDelivery}
            onChange={setCloseDelivery}
            options={[
              { label: 'Delivered', value: '1', icon: 'check', color: c.emerald },
              { label: 'Other', value: '2', icon: 'more-horizontal', color: c.orange },
            ]}
          />
        </View>
        <TextField label="Closing Remarks" required value={closeRemarks} onChangeText={setCloseRemarks} placeholder="Enter closing remarks…" multiline numberOfLines={3} />
        <Row gap={6}>
          <Feather name="info" size={12} color={c.textFaint} />
          <Text style={{ color: c.textFaint, fontSize: 11.5 }}>Closed by {session.realName}</Text>
        </Row>
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  idx: { color: c.textFaint, fontSize: 11.5, fontWeight: '700' },
  name: { color: c.text, fontSize: 16, fontWeight: '800', marginTop: 2 },
  lbl: { fontSize: 11.5, fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
}));
