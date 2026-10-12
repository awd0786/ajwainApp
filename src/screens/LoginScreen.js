import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiUrl } from '../api/config';
import { useAuth } from '../context/AuthContext';
import { makeStyles, radii, shadowFor, useTheme } from '../theme/theme';
import { Banner, Button } from '../ui';

const HISTREE_LOGO = require('../assets/HISTree-logo.png');
const HISTREE_LOGO_DARK = require('../assets/HISTree-logo-dark.png'); // "Tree" in white for dark mode
const APP_ICON = require('../assets/ajwain-app-icon.png');

/** Port of Login.jsx – POST /Zentao/Login { loginName, password }. */
export default function LoginScreen() {
  const { login } = useAuth();
  const s = useStyles();
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();

  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState('');
  const pwdRef = useRef(null);

  const enter = useRef(new Animated.Value(0)).current;
  const orb = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(orb, { toValue: 1, duration: 4500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(orb, { toValue: 0, duration: 4500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
  }, [enter, orb]);

  const handleLogin = async () => {
    setError('');
    if (!userName.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('login'), {
        method: 'POST',
        headers: { accept: '*/*', 'Content-Type': 'application/json-patch+json' },
        body: JSON.stringify({ loginName: userName.trim(), password }),
      });
      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (res.ok && data?.success) {
        await login(data);
      } else {
        setError(data?.message || 'Invalid credentials.');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  const orbY = orb.interpolate({ inputRange: [0, 1], outputRange: [0, 30] });

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <LinearGradient colors={[c.heroA, c.heroB, c.heroC]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, { paddingTop: insets.top + 30 }]}>
        <Animated.View style={[s.orbA, { transform: [{ translateY: orbY }] }]} />
        <Animated.View style={[s.orbB, { transform: [{ translateY: Animated.multiply(orbY, -1) }] }]} />
        <Animated.View style={{ opacity: enter, alignItems: 'center' }}>
          <View style={s.appIconWrap}>
            <Image source={APP_ICON} style={s.appIcon} resizeMode="contain" />
          </View>
          <Text style={s.brand}>Ajwain</Text>
          <Text style={s.brandSub}>Sprint · Patch · SLA command centre</Text>
        </Animated.View>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, marginTop: -46 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled" bounces={false}>
          <Animated.View style={[s.card, shadowFor(c, 2), { opacity: enter, transform: [{ translateY }] }]}>
            <Image source={dark ? HISTREE_LOGO_DARK : HISTREE_LOGO} style={s.logo} resizeMode="contain" />
            <Text style={s.welcome}>Welcome back</Text>
            <Text style={s.subWelcome}>Sign in with your Zentao account to continue.</Text>

            <Text style={s.label}>Username</Text>
            <View style={[s.inputWrap, focused === 'u' && { borderColor: c.primary, backgroundColor: c.surface }]}>
              <Feather name="user" size={17} color={focused === 'u' ? c.primary : c.textFaint} />
              <TextInput
                value={userName}
                onChangeText={(t) => {
                  setUserName(t);
                  if (error) setError('');
                }}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                style={s.input}
                placeholder="Enter username"
                placeholderTextColor={c.textFaint}
                returnKeyType="next"
                onSubmitEditing={() => pwdRef.current?.focus()}
                onFocus={() => setFocused('u')}
                onBlur={() => setFocused('')}
              />
            </View>

            <Text style={[s.label, { marginTop: 14 }]}>Password</Text>
            <View style={[s.inputWrap, focused === 'p' && { borderColor: c.primary, backgroundColor: c.surface }]}>
              <Feather name="lock" size={17} color={focused === 'p' ? c.primary : c.textFaint} />
              <TextInput
                ref={pwdRef}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  if (error) setError('');
                }}
                secureTextEntry={!showPassword}
                editable={!loading}
                style={s.input}
                placeholder="Enter password"
                placeholderTextColor={c.textFaint}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                onFocus={() => setFocused('p')}
                onBlur={() => setFocused('')}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
                <Feather name={showPassword ? 'eye-off' : 'eye'} size={17} color={c.textFaint} />
              </Pressable>
            </View>

            {!!error && <Banner type="error" text={error} style={{ marginTop: 14 }} />}

            <Button title={loading ? 'Signing in…' : 'Sign in'} iconRight={loading ? undefined : 'arrow-right'} size="lg" loading={loading} onPress={handleLogin} style={{ marginTop: 22 }} />
          </Animated.View>

          <Text style={s.footer}>© {new Date().getFullYear()} TrioTree Technologies · HISTree</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  hero: { paddingBottom: 70, alignItems: 'center', overflow: 'hidden', borderBottomLeftRadius: 36, borderBottomRightRadius: 36 },
  orbA: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.08)', top: -60, right: -60 },
  orbB: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.06)', bottom: -40, left: -30 },
  appIconWrap: { width: 74, height: 74, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  appIcon: { width: 58, height: 58, borderRadius: 16 },
  brand: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: -0.6 },
  brandSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4, fontWeight: '600' },
  card: { backgroundColor: c.surface, borderRadius: radii.xl + 4, padding: 22 },
  logo: { width: 150, height: 44, alignSelf: 'center', marginBottom: 10 },
  welcome: { fontSize: 22, fontWeight: '900', color: c.text, textAlign: 'center' },
  subWelcome: { fontSize: 13, color: c.textMuted, textAlign: 'center', marginTop: 4, marginBottom: 22 },
  label: { fontSize: 11.5, fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1.4,
    borderColor: c.border,
    backgroundColor: c.inputBg,
    paddingHorizontal: 14,
  },
  input: { flex: 1, color: c.text, fontSize: 15, paddingVertical: 0 },
  footer: { textAlign: 'center', color: c.textFaint, fontSize: 11.5, marginTop: 22 },
}));
