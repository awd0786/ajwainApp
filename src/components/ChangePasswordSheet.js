import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Banner, Button, Sheet, TextField } from '../ui';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

/** Port of ChangePasswordSlider.jsx – POST ChangePasswordSLADashboard?account=&password= */
export default function ChangePasswordSheet({ visible, onClose }) {
  const { session } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSave = newPassword.length > 0 && confirmPassword.length > 0 && !mismatch && !saving;

  useEffect(() => {
    if (visible) {
      setNewPassword('');
      setConfirmPassword('');
      setMessage(null);
    }
  }, [visible]);

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setMessage(null);
    try {
      const data = await api.post('changePassword', { account: session.loginName, password: newPassword });
      if (data && data.success) {
        setMessage({ type: 'success', text: data.message || 'Password changed successfully.' });
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setMessage({ type: 'error', text: data?.message || 'Failed to change password.' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: e.message || 'An unexpected error occurred.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Change Password"
      subtitle="Update your account password"
      icon="lock"
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={onClose} />
          <Button title="Update" icon="check" style={{ flex: 1.4 }} loading={saving} disabled={!canSave} onPress={save} />
        </View>
      }
    >
      <TextField label="Account" value={session.loginName} editable={false} icon="user" />
      <TextField label="New Password" value={newPassword} onChangeText={setNewPassword} secure placeholder="Enter new password" icon="key" autoCapitalize="none" />
      <TextField
        label="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secure
        placeholder="Re-enter new password"
        icon="key"
        autoCapitalize="none"
        error={mismatch ? 'Passwords do not match' : null}
      />
      {message && <Banner type={message.type} text={message.text} />}
    </Sheet>
  );
}
