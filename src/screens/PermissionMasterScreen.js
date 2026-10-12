import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '../api/client';
import { usePermissions } from '../context/PermissionContext';
import { useAuth } from '../context/AuthContext';
import { useHeaderActions } from '../navigation/ShellContext';
import { hashColor, makeStyles, toneOf, useTheme } from '../theme/theme';
import { Avatar, Banner, Button, Card, Empty, Loading, Page, Pill, Row, SectionHeader, Select, useToast } from '../ui';

/** Port of AjwainPermission.jsx – GetPermissionData / SaveUpdateAjwainPermission */

const DEFAULT_PERMISSIONS = { IsAddPoint: false, IsPointDrop: false, IsSprintChange: false, IsCriticalPointAdd: false, IsSprintCreation: false };
const ITEMS = [
  { key: 'IsAddPoint', label: 'Add Point', description: 'Allow the user to add a new point.', icon: 'plus-circle', color: '#6366F1' },
  { key: 'IsPointDrop', label: 'Point Drop', description: 'Allow the user to drop a point.', icon: 'x-octagon', color: '#EF4444' },
  { key: 'IsSprintChange', label: 'Sprint Change', description: 'Allow the user to change the sprint.', icon: 'repeat', color: '#F59E0B' },
  { key: 'IsCriticalPointAdd', label: 'Critical Point Add', description: 'Allow the user to add or mark a Critical Point.', icon: 'flag', color: '#F43F5E' },
  { key: 'IsSprintCreation', label: 'Sprint Creation', description: 'Allow the user to create and update sprints.', icon: 'zap', color: '#10B981' },
];

export default function PermissionMasterScreen() {
  const s = useStyles();
  const { c, dark } = useTheme();
  const toast = useToast();
  const { session } = useAuth();
  const { reloadPermissions } = usePermissions();

  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
  const [recordId, setRecordId] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingPerm, setLoadingPerm] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await api.get('getPermissionData', { userId: 0 });
      setUsers(Array.isArray(data?.users) ? data.users : []);
    } catch (e) {
      toast.error(e.message || 'Unable to load users.');
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchPermission = async (userId) => {
    setLoadingPerm(true);
    try {
      const data = await api.get('getPermissionData', { userId });
      const saved = Array.isArray(data?.permissions) && data.permissions.length ? data.permissions[0] : null;
      if (saved) {
        setRecordId(saved.ID ?? null);
        setPermissions({
          IsAddPoint: Boolean(saved.IsAddPoint),
          IsPointDrop: Boolean(saved.IsPointDrop),
          IsSprintChange: Boolean(saved.IsSprintChange),
          IsCriticalPointAdd: Boolean(saved.IsCriticalPointAdd),
          IsSprintCreation: Boolean(saved.IsSprintCreation),
        });
      } else {
        setRecordId(null);
        setPermissions(DEFAULT_PERMISSIONS);
      }
    } catch (e) {
      toast.error(e.message || 'Unable to load user permission.');
    } finally {
      setLoadingPerm(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeUser = (id) => {
    setSelectedUserId(id);
    setPermissions(DEFAULT_PERMISSIONS);
    setRecordId(null);
    if (id) fetchPermission(id);
  };

  const save = async () => {
    if (!selectedUserId) return toast.warning('Please select a user.');
    setSaving(true);
    try {
      const result = await api.post(
        'saveUpdateAjwainPermission',
        {
          UserId: selectedUserId,
          IsAddPoint: String(permissions.IsAddPoint),
          IsPointDrop: String(permissions.IsPointDrop),
          IsSprintChange: String(permissions.IsSprintChange),
          IsCriticalPointAdd: String(permissions.IsCriticalPointAdd),
          IsSprintCreation: String(permissions.IsSprintCreation),
        },
        { headers: { 'Content-Type': 'application/json' } },
      );
      toast.success(typeof result === 'string' ? result : result?.message || result?.Message || 'Permission saved successfully.');
      await fetchPermission(selectedUserId);
      if (String(selectedUserId) === String(session.userId)) reloadPermissions?.();
    } catch (e) {
      toast.error(e.message || 'Unable to save permission.');
    } finally {
      setSaving(false);
    }
  };

  useHeaderActions([{ key: 'refresh', icon: 'refresh-cw', onPress: () => (selectedUserId ? fetchPermission(selectedUserId) : fetchUsers()) }], [selectedUserId]);

  const user = users.find((u) => String(u.ID) === String(selectedUserId));
  const enabled = Object.values(permissions).filter(Boolean).length;

  return (
    <Page>
      <Card style={{ gap: 12 }}>
        <SectionHeader title="Ajwain Permission" subtitle="Grant feature-level access per user" icon="shield" />
        <Select
          label="User"
          icon="user"
          value={selectedUserId}
          placeholder={loadingUsers ? 'Loading users…' : 'Select user'}
          options={users.map((u) => ({ value: String(u.ID), label: u.RealName || u.LoginName, sub: `${u.LoginName || ''} · #${u.ID}` }))}
          onChange={changeUser}
          searchable
        />
        {user && (
          <Row gap={12} style={s.userRow}>
            <Avatar name={user.RealName || user.LoginName} color={hashColor(user.LoginName)} size={42} />
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{user.RealName}</Text>
              <Text style={s.meta}>
                {user.LoginName} · ID {user.ID}
              </Text>
            </View>
            <Pill label={recordId ? `Record #${recordId}` : 'New record'} color={recordId ? c.indigo : c.amber} />
          </Row>
        )}
      </Card>

      {!selectedUserId ? (
        <Empty icon="shield" title="Select a user" subtitle="Choose a user to view and change their Ajwain permissions." />
      ) : loadingPerm ? (
        <Loading text="Loading permission…" />
      ) : (
        <>
          <Row>
            <Text style={s.section}>Permissions</Text>
            <Pill label={`${enabled}/${ITEMS.length} enabled`} color={c.primary} style={{ marginLeft: 'auto' }} />
          </Row>
          {ITEMS.map((it) => {
            const on = !!permissions[it.key];
            const t = toneOf(it.color, dark);
            return (
              <Pressable key={it.key} onPress={() => setPermissions((p) => ({ ...p, [it.key]: !p[it.key] }))}>
                <Card style={[on && { borderWidth: 1.6, borderColor: it.color }]}>
                  <Row gap={12}>
                    <View style={[s.icon, { backgroundColor: t.bg }]}>
                      <Feather name={it.icon} size={18} color={it.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Row gap={6}>
                        <Text style={[s.label, on && { color: it.color }]}>{it.label}</Text>
                        {on && <Pill label="Enabled" icon="check" color={it.color} />}
                      </Row>
                      <Text style={s.desc}>{it.description}</Text>
                    </View>
                    <View style={[s.track, { backgroundColor: on ? it.color : c.borderStrong }]}>
                      <View style={[s.thumb, { transform: [{ translateX: on ? 18 : 0 }] }]} />
                    </View>
                  </Row>
                </Card>
              </Pressable>
            );
          })}
          <Banner type="info" text="Role-based access (CEO, COO, Product Head, Product Owner) still applies on top of these flags." />
          <Button title="Save Permission" icon="save" size="lg" loading={saving} onPress={save} />
        </>
      )}
    </Page>
  );
}

const useStyles = makeStyles((c) => ({
  userRow: { padding: 12, borderRadius: 16, backgroundColor: c.surfaceAlt },
  name: { color: c.text, fontWeight: '800', fontSize: 15 },
  meta: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  section: { color: c.text, fontWeight: '800', fontSize: 16 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  label: { color: c.text, fontWeight: '800', fontSize: 14.5 },
  desc: { color: c.textMuted, fontSize: 12, marginTop: 3 },
  track: { width: 44, height: 26, borderRadius: 13, padding: 3 },
  thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
}));
