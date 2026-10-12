import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/theme';

/**
 * Gradient app bar: menu / back, page title with its nav-group kicker,
 * plus right-hand actions supplied by the active page.
 * `actions`: [{ key, icon, onPress, badge?, tint? }]
 */
export default function AppHeader({ title, groupLabel, onMenu, actions = [], onBack, accent }) {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

  return (
    <LinearGradient
      colors={[c.heroA, c.heroB]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.wrap, { paddingTop: insets.top + 4 }]}
    >
      <View style={styles.row}>
        <Pressable onPress={onBack || onMenu} hitSlop={12} style={({ pressed }) => [styles.lead, pressed && { opacity: 0.7 }]}>
          <Feather name={onBack ? 'arrow-left' : 'menu'} size={20} color="#fff" />
        </Pressable>

        <View style={styles.titleWrap}>
          {!!groupLabel && groupLabel !== title && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {!!accent && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} />}
              <Text style={styles.kicker} numberOfLines={1}>
                {groupLabel}
              </Text>
            </View>
          )}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>

        <View style={styles.actions}>
          {actions.map((a) => (
            <Pressable key={a.key} onPress={a.onPress} hitSlop={8} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}>
              <Feather name={a.icon} size={18} color={a.tint || '#fff'} />
              {!!a.badge && (
                <View style={[styles.badge, { backgroundColor: c.rose }]}>
                  <Text style={styles.badgeText}>{a.badge > 99 ? '99+' : a.badge}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 46, gap: 10 },
  lead: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: { flex: 1 },
  kicker: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.68)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: { fontSize: 17, fontWeight: '800', color: '#fff', marginTop: 1, letterSpacing: -0.2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});
