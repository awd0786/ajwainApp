import React, { useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '../api/client';
import useAsync from '../hooks/useAsync';
import { useHeaderActions } from '../navigation/ShellContext';
import { hashColor, makeStyles, useTheme } from '../theme/theme';
import {
  Avatar,
  Banner,
  Button,
  Card,
  Checkbox,
  Empty,
  ErrorState,
  Fab,
  Loading,
  Pill,
  Row,
  SearchBar,
  Select,
  Sheet,
  StatStrip,
  TextField,
  useToast,
} from '../ui';

/** Port of UserMaster.jsx – GetAjwainUserList / SaveUpdateAjwainUser */

export const ROLE_OPTIONS = [
  'CEO',
  'COO',
  'Dev Team Lead',
  'Developer',
  'Product Head',
  'Product Owner',
  'Product Team (Designer)',
  'Sales',
  'Support',
  'Testing',
  'Testing Lead',
];
const RESOURCE_TYPES = ['Expert', 'Intermediate', 'Junior', 'Senior'];

const emptyForm = { ID: 0, LoginName: '', RealName: '', Role: '', Password: '', ConfirmPassword: '', Deleted: false, IsLocked: false, ResourceType: '' };

const normalizeUser = (u) => ({
  ID: Number(u.ID ?? u.id ?? 0),
  LoginName: u.LoginName ?? u.loginName ?? '',
  RealName: u.RealName ?? u.realName ?? '',
  Role: u.Role ?? u.role ?? '',
  Password: '',
  ConfirmPassword: '',
  Deleted: Boolean(u.Deleted),
  IsLocked: Boolean(u.IsLocked),
  ResourceType: u.ResourceType ?? u.resourceType ?? '',
});

export default function UserMasterScreen() {
  const s = useStyles();
  const { c } = useTheme();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [form, setForm] = useState(null); // null = closed
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const usersQ = useAsync(
    async () => {
      const data = await api.get('getAjwainUserList');
      const list = Array.isArray(data) ? data : Array.isArray(data?.users) ? data.users : Array.isArray(data?.data) ? data.data : [];
      return list.map(normalizeUser);
    },
    [],
    { initial: [] },
  );
  const users = usersQ.data || [];

  useHeaderActions([{ key: 'refresh', icon: 'refresh-cw', onPress: usersQ.reload }]);

  const filtered = useMemo(() => {
    const v = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter && u.Role !== roleFilter) return false;
      if (!v) return true;
      return [u.ID, u.LoginName, u.RealName, u.Role, u.ResourceType].join(' ').toLowerCase().includes(v);
    });
  }, [users, search, roleFilter]);

  const isEditing = editingId !== null;
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setFormError('');
  };
  const openEdit = (u) => {
    setEditingId(u.ID);
    setForm({ ...u, Password: '', ConfirmPassword: '' });
    setFormError('');
  };

  const handleSave = async () => {
    const loginName = form.LoginName.trim();
    const realName = form.RealName.trim();
    const role = form.Role.trim();
    const resourceType = form.ResourceType.trim();
    if (!loginName) return setFormError('Login Name is required.');
    if (!realName) return setFormError('Real Name is required.');
    if (!role) return setFormError('Role is required.');
    if (!isEditing && !form.Password.trim()) return setFormError('Password is required for a new user.');
    if (form.Password.trim() || form.ConfirmPassword.trim()) {
      if (!form.Password.trim()) return setFormError('Please enter the password.');
      if (!form.ConfirmPassword.trim()) return setFormError('Please confirm the password.');
      if (form.Password !== form.ConfirmPassword) return setFormError('Password and Confirm Password do not match.');
    }
    if (!resourceType) return setFormError('Resource Type is required.');
    setSaving(true);
    setFormError('');
    try {
      const data = await api.post(
        'saveUpdateAjwainUser',
        {
          ID: String(form.ID || 0),
          LoginName: loginName,
          RealName: realName,
          Role: role,
          Password: form.Password || '',
          Deleted: form.Deleted ? 'true' : 'false',
          IsLocked: form.IsLocked ? 'true' : 'false',
          ResourceType: resourceType,
        },
        { keepEmpty: true },
      );
      if (data?.success) {
        toast.success(data.message || `User ${isEditing ? 'updated' : 'created'} successfully.`);
        setForm(null);
        setEditingId(null);
        usersQ.refresh();
      } else {
        setFormError(data?.message || 'Unable to save user. Please check the entered details.');
      }
    } catch (e) {
      setFormError(e.message || 'Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const mismatch = form && form.Password && form.ConfirmPassword && form.Password !== form.ConfirmPassword;
  const canSave =
    form &&
    !saving &&
    form.LoginName.trim() &&
    form.RealName.trim() &&
    form.Role.trim() &&
    form.ResourceType.trim() &&
    !(!isEditing && (!form.Password.trim() || !form.ConfirmPassword.trim() || form.Password !== form.ConfirmPassword)) &&
    !(isEditing && (form.Password.trim() || form.ConfirmPassword.trim()) && form.Password !== form.ConfirmPassword);

  if (usersQ.loading) return <Loading text="Loading users…" />;
  if (usersQ.error) return <ErrorState message={usersQ.error} onRetry={usersQ.reload} />;

  const active = users.filter((u) => !u.Deleted).length;
  const locked = users.filter((u) => u.IsLocked).length;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 110 }}
        data={filtered}
        keyExtractor={(u) => String(u.ID)}
        refreshing={usersQ.refreshing}
        onRefresh={usersQ.refresh}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <StatStrip
              items={[
                { key: 'all', label: 'Total users', value: users.length, color: c.indigo },
                { key: 'active', label: 'Active', value: active, color: c.emerald },
                { key: 'deleted', label: 'Deleted', value: users.length - active, color: c.red },
                { key: 'locked', label: 'Locked', value: locked, color: c.amber },
              ]}
            />
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search login, name, role…" />
            <Row>
              <Select compact icon="shield" label="Role" allLabel="All roles" value={roleFilter} options={ROLE_OPTIONS} onChange={setRoleFilter} />
              <Text style={s.count}>{filtered.length} user{filtered.length === 1 ? '' : 's'}</Text>
            </Row>
          </View>
        }
        ListEmptyComponent={<Empty icon="users" title="No users found" subtitle={search ? 'No users match your search.' : 'No users are available.'} />}
        renderItem={({ item: u }) => (
          <Card onPress={() => openEdit(u)} style={u.Deleted && { opacity: 0.65 }}>
            <Row gap={12}>
              <Avatar name={u.RealName || u.LoginName} color={hashColor(u.Role)} size={42} />
              <View style={{ flex: 1 }}>
                <Text style={s.name} numberOfLines={1}>{u.RealName || '—'}</Text>
                <Row gap={5} style={{ marginTop: 2 }}>
                  <Feather name="at-sign" size={11} color={c.textFaint} />
                  <Text style={s.login} numberOfLines={1}>{u.LoginName || '—'}</Text>
                  <Text style={s.idTxt}>#{u.ID}</Text>
                </Row>
              </View>
              <Feather name="edit-2" size={16} color={c.textFaint} />
            </Row>
            <Row gap={6} wrap style={{ marginTop: 10 }}>
              <Pill label={u.Role || '—'} color={hashColor(u.Role)} />
              <Pill label={u.ResourceType || '—'} color={c.slate} />
              <Pill label={u.Deleted ? 'Deleted' : 'Active'} color={u.Deleted ? c.red : c.emerald} />
              <Pill label={u.IsLocked ? 'Locked' : 'Unlocked'} icon={u.IsLocked ? 'lock' : 'unlock'} color={u.IsLocked ? c.amber : c.teal} />
            </Row>
          </Card>
        )}
      />
      <Fab label="New User" icon="user-plus" onPress={openNew} />

      <Sheet
        visible={!!form}
        onClose={() => setForm(null)}
        icon={isEditing ? 'edit-3' : 'user-plus'}
        title={isEditing ? `Edit User #${editingId}` : 'Create New User'}
        subtitle="Ajwain user account"
        size="full"
        footer={
          <Row gap={10}>
            <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setForm(null)} disabled={saving} />
            <Button title={isEditing ? 'Update User' : 'Save User'} icon="save" style={{ flex: 1.4 }} loading={saving} disabled={!canSave} onPress={handleSave} />
          </Row>
        }
      >
        {form && (
          <>
            <TextField label="Login Name" required value={form.LoginName} onChangeText={(v) => update('LoginName', v)} placeholder="Enter login name" maxLength={50} autoCapitalize="none" />
            <TextField label="Real Name" required value={form.RealName} onChangeText={(v) => update('RealName', v)} placeholder="Enter real name" maxLength={200} />
            <Select label="Role" required value={form.Role} options={ROLE_OPTIONS} placeholder="Select Role" onChange={(v) => update('Role', v)} />
            <Select label="Resource Type" required value={form.ResourceType} options={RESOURCE_TYPES} placeholder="Select Resource Type" onChange={(v) => update('ResourceType', v)} />
            <TextField
              label="Password"
              required={!isEditing}
              value={form.Password}
              onChangeText={(v) => update('Password', v)}
              placeholder={isEditing ? 'Leave blank to keep current password' : 'Enter password'}
              secure
              maxLength={200}
              autoCapitalize="none"
            />
            <TextField
              label="Confirm Password"
              required={!isEditing}
              value={form.ConfirmPassword}
              onChangeText={(v) => update('ConfirmPassword', v)}
              placeholder={isEditing ? 'Leave blank if password is unchanged' : 'Re-enter password'}
              secure
              maxLength={200}
              autoCapitalize="none"
              error={mismatch ? 'Passwords do not match.' : null}
            />
            <Row gap={24}>
              <Checkbox label="Deleted" checked={form.Deleted} onChange={(v) => update('Deleted', v)} color={c.red} />
              <Checkbox label={form.IsLocked ? 'Locked' : 'Unlocked'} checked={form.IsLocked} onChange={(v) => update('IsLocked', v)} color={c.amber} />
            </Row>
            <Banner type="error" text={formError} />
          </>
        )}
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  count: { marginLeft: 'auto', color: c.textFaint, fontSize: 12, fontWeight: '700' },
  name: { color: c.text, fontSize: 15, fontWeight: '800' },
  login: { color: c.textMuted, fontSize: 12.5, fontWeight: '600', flexShrink: 1 },
  idTxt: { color: c.textFaint, fontSize: 11.5, fontWeight: '700' },
}));
