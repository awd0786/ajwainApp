import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Banner, Button, Sheet, TextField } from '../ui';
import { useAuth } from '../context/AuthContext';
import { useTheme, toneOf } from '../theme/theme';
import { loginRequest } from '../api/loginApi';
import { authenticate, disableBiometric, enableBiometric, getBiometricInfo, getStoredCredentials, isBiometricEnabled } from '../auth/biometric';

/** Drawer → "Biometric login": turn fingerprint / Face ID sign-in on or off. */
export default function BiometricSheet({ visible, onClose }) {
  const { session } = useAuth();
  const { c, dark } = useTheme();
  const [info, setInfo] = useState({ available: false, label: 'Biometrics', icon: 'shield' });
  const [enabled, setEnabled] = useState(false);
  const [owner, setOwner] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setPassword('');
    setMsg(null);
    (async () => {
      const [i, e, creds] = await Promise.all([getBiometricInfo(), isBiometricEnabled(), getStoredCredentials()]);
      setInfo(i);
      setEnabled(e);
      setOwner(creds?.loginName || '');
    })();
  }, [visible]);

  const turnOn = async () => {
    if (!password) return setMsg({ type: 'error', text: 'Enter your password to confirm.' });
    setBusy(true);
    setMsg(null);
    const res = await loginRequest(session.loginName, password);
    if (!res.ok) {
      setBusy(false);
      return setMsg({ type: 'error', text: res.message });
    }
    const auth = await authenticate(`Confirm ${info.label} for Ajwain`);
    if (!auth.ok && auth.message) setMsg({ type: 'error', text: auth.message });
    if (auth.ok) {
      await enableBiometric(session.loginName, password);
      setEnabled(true);
      setOwner(session.loginName);
      setPassword('');
      setMsg({ type: 'success', text: `${info.label} login is on. The app will ask for it every time it opens.` });
    }
    setBusy(false);
  };

  const turnOff = async () => {
    await disableBiometric();
    setEnabled(false);
    setOwner('');
    setMsg({ type: 'info', text: `${info.label} login is off.` });
  };

  const t = toneOf(enabled ? c.emerald : c.slate, dark);

  return (
    <Sheet visible={visible} onClose={onClose} title="Biometric login" subtitle={info.label} icon="shield">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: t.bg }}>
        <Feather name={info.icon} size={24} color={t.fg} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontWeight: '800', fontSize: 14.5 }}>{enabled ? 'On' : 'Off'}</Text>
          <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 2 }}>
            {info.expoGoBlocked
              ? 'Face ID works only in the installed Ajwain app (APK / App Store build), not in Expo Go.'
              : !info.hasHardware
              ? 'This device has no fingerprint or face sensor.'
              : !info.enrolled
                ? `No ${info.label} is set up on this device. Add one in the phone's Settings first.`
                : enabled
                  ? `Signed in as ${owner}. Ajwain asks for ${info.label} on every launch.`
                  : `Use ${info.label} instead of your password when you open Ajwain.`}
          </Text>
        </View>
      </View>

      {info.available && !enabled && (
        <TextField label="Confirm your password" value={password} onChangeText={setPassword} secure icon="key" autoCapitalize="none" placeholder="Current password" />
      )}
      {!!msg && <Banner type={msg.type} text={msg.text} />}
      {info.available &&
        (enabled ? (
          <Button title={`Turn off ${info.label}`} icon="x-circle" variant="danger" onPress={turnOff} />
        ) : (
          <Button title={`Turn on ${info.label}`} icon="check" loading={busy} onPress={turnOn} />
        ))}
    </Sheet>
  );
}
