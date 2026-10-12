import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeStyles, radii, useTheme, toneOf } from '../theme/theme';
import { markModalClosing, modalOpenDelay } from './modalGate';

const { height: SCREEN_H } = Dimensions.get('window');

/**
 * Bottom sheet used for every modal in the app (filters, forms, details,
 * confirmations). Pure RN Animated + Modal – no reanimated dependency.
 *
 *  size: 'auto' (content height, max 92%) | 'full' (92%) | 'half'
 */
export default function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  icon,
  accent,
  children,
  footer,
  size = 'auto',
  scroll = true,
  dismissable = true,
  headerRight,
  contentStyle,
}) {
  const s = useStyles();
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const y = useRef(new Animated.Value(SCREEN_H)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let timer;
    if (visible) {
      const open = () => {
        setMounted(true);
        Animated.parallel([
          Animated.timing(y, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
        ]).start();
      };
      const wait = mounted ? 0 : modalOpenDelay();
      if (wait > 0) timer = setTimeout(open, wait);
      else open();
    } else if (mounted) {
      markModalClosing(220);
      Animated.parallel([
        Animated.timing(y, { toValue: SCREEN_H, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
    return () => timer && clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;

  const maxH = SCREEN_H * 0.92;
  const sizeStyle =
    size === 'full' ? { height: maxH } : size === 'half' ? { height: SCREEN_H * 0.55 } : { maxHeight: maxH };
  const t = toneOf(accent || c.primary, dark);
  const Body = scroll ? ScrollView : View;

  return (
    <Modal visible transparent animationType="none" onRequestClose={dismissable ? onClose : undefined} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View style={[s.backdrop, { opacity: fade }]}>
          <Pressable style={{ flex: 1 }} onPress={dismissable ? onClose : undefined} />
        </Animated.View>
        <Animated.View style={[s.sheet, sizeStyle, { transform: [{ translateY: y }] }]}>
          <View style={s.handle} />
          {(title || subtitle) && (
            <View style={s.header}>
              {!!icon && (
                <View style={[s.iconBox, { backgroundColor: t.bg }]}>
                  <Feather name={icon} size={17} color={t.fg} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                {!!title && <Text style={s.title} numberOfLines={2}>{title}</Text>}
                {!!subtitle && <Text style={s.subtitle} numberOfLines={3}>{subtitle}</Text>}
              </View>
              {headerRight}
              {!!onClose && (
                <Pressable onPress={onClose} hitSlop={10} style={s.close}>
                  <Feather name="x" size={18} color={c.textMuted} />
                </Pressable>
              )}
            </View>
          )}
          <Body
            style={size === 'auto' ? { flexShrink: 1 } : { flex: 1 }}
            contentContainerStyle={scroll ? [s.content, contentStyle] : undefined}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {scroll ? children : <View style={[{ flex: 1 }, s.content, contentStyle]}>{children}</View>}
          </Body>
          {!!footer && <View style={[s.footer, { paddingBottom: 12 + insets.bottom }]}>{footer}</View>}
          {!footer && <View style={{ height: insets.bottom + 6 }} />}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Two-button footer row: [Cancel] [Primary]. */
export function SheetFooter({ children }) {
  return <View style={{ flexDirection: 'row', gap: 10 }}>{children}</View>;
}

const useStyles = makeStyles((c) => ({
  backdrop: { ...StyleAbs, backgroundColor: c.overlay },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.surface,
    borderTopLeftRadius: radii.xl + 4,
    borderTopRightRadius: radii.xl + 4,
    overflow: 'hidden',
    borderWidth: c.dark ? 1 : 0,
    borderColor: c.border,
  },
  handle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: c.borderStrong, marginTop: 8, marginBottom: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  iconBox: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16.5, fontWeight: '800', color: c.text },
  subtitle: { fontSize: 12, color: c.textMuted, marginTop: 2 },
  close: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceAlt },
  content: { padding: 18, gap: 14 },
  footer: { paddingHorizontal: 18, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface },
}));

const StyleAbs = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 };
