import { modalOpenDelay } from './modalGate';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, shadowFor, useTheme, toneOf } from '../theme/theme';
import { Button } from './primitives';

/* =========================================================================
   Loading / Empty / Error states
   ========================================================================= */
export function Loading({ text = 'Loading…', style, inline }) {
  const { c } = useTheme();
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);
  if (inline) {
    return (
      <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 }, style]}>
        <ActivityIndicator size="small" color={c.primary} />
        <Text style={{ color: c.textMuted, fontSize: 12.5 }}>{text}</Text>
      </View>
    );
  }
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 14 }, style]}>
      <Animated.View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          borderWidth: 4,
          borderColor: c.primarySoft,
          borderTopColor: c.primary,
          borderRightColor: c.violet,
          transform: [{ rotate }],
        }}
      />
      <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

export function Empty({ icon = 'inbox', title = 'Nothing here yet', subtitle, action, style }) {
  const { c, dark } = useTheme();
  const t = toneOf(c.primary, dark);
  return (
    <View style={[{ alignItems: 'center', paddingVertical: 46, paddingHorizontal: 24, gap: 8 }, style]}>
      <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
        <Feather name={icon} size={26} color={t.fg} />
      </View>
      <Text style={{ color: c.text, fontSize: 15, fontWeight: '800', textAlign: 'center' }}>{title}</Text>
      {!!subtitle && <Text style={{ color: c.textMuted, fontSize: 12.5, textAlign: 'center', lineHeight: 18 }}>{subtitle}</Text>}
      {action}
    </View>
  );
}

export function ErrorState({ message, onRetry, style }) {
  const { c, dark } = useTheme();
  const t = toneOf(c.red, dark);
  return (
    <View style={[{ alignItems: 'center', paddingVertical: 46, paddingHorizontal: 24, gap: 8 }, style]}>
      <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
        <Feather name="wifi-off" size={26} color={t.fg} />
      </View>
      <Text style={{ color: c.text, fontSize: 15, fontWeight: '800' }}>Failed to load data</Text>
      {!!message && <Text style={{ color: c.textMuted, fontSize: 12.5, textAlign: 'center' }}>{String(message)}</Text>}
      {!!onRetry && <Button title="Retry" icon="refresh-cw" size="sm" variant="soft" onPress={onRetry} style={{ marginTop: 8 }} />}
    </View>
  );
}

/* =========================================================================
   Toasts
   ========================================================================= */
const ToastContext = createContext({ show: () => {}, success: () => {}, error: () => {}, info: () => {} });

export function ToastProvider({ children }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState(null);
  const y = useRef(new Animated.Value(-120)).current;
  const timer = useRef(null);

  const hide = useCallback(() => {
    Animated.timing(y, { toValue: -140, duration: 200, useNativeDriver: true }).start(() => setToast(null));
  }, [y]);

  const show = useCallback(
    (type, text, ms = 2800) => {
      if (!text) return;
      clearTimeout(timer.current);
      setToast({ type, text: String(text), id: Date.now() });
      y.setValue(-120);
      Animated.spring(y, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
      timer.current = setTimeout(hide, ms);
    },
    [y, hide],
  );

  const api = React.useMemo(
    () => ({
      show,
      success: (t) => show('success', t),
      error: (t) => show('error', t, 3800),
      info: (t) => show('info', t),
      warning: (t) => show('warning', t, 3400),
    }),
    [show],
  );

  const map = {
    success: [c.emerald, 'check-circle'],
    error: [c.red, 'alert-octagon'],
    info: [c.primary, 'info'],
    warning: [c.amber, 'alert-triangle'],
  };
  const [accent, icon] = map[toast?.type] || map.info;

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="box-none"
          style={{ position: 'absolute', left: 14, right: 14, top: insets.top + 8, transform: [{ translateY: y }], zIndex: 9999, elevation: 30 }}
        >
          <Pressable
            onPress={hide}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              padding: 14,
              borderRadius: radii.md,
              backgroundColor: c.elevated,
              borderLeftWidth: 4,
              borderLeftColor: accent,
              ...shadowFor(c, 3),
            }}
          >
            <Feather name={icon} size={18} color={accent} />
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 13, flex: 1 }}>{toast.text}</Text>
          </Pressable>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/** Promise-based native confirm. */
export function confirmAsync(title, message, { confirmText = 'Confirm', destructive } = {}) {
  return new Promise((resolve) => {
    // iOS: wait until any sheet that is closing has fully dismissed, or the alert never shows.
    setTimeout(() => Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]), modalOpenDelay());
  });
}
