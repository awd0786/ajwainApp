import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeStyles, radii, toneOf, useTheme } from '../theme/theme';
import { markModalClosing } from '../ui/modalGate';
import { getVisibleGroups } from '../auth/navigationMap';
import { Avatar } from '../ui';

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_W = Math.min(330, SCREEN_W * 0.86);

/**
 * Side navigation drawer. Same 8 groups / order / role filtering as the web
 * Navbar (getVisibleGroups). `single` groups navigate on tap, `dropdown`
 * groups expand in place.
 */
export default function AppDrawer({ visible, currentPage, role, realName, loginName, onNavigate, onClose, onChangePassword, onBiometric, onLogout }) {
  const s = useStyles();
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(-DRAWER_W)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  const visibleGroups = useMemo(() => getVisibleGroups(role), [role]);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    const owner = visibleGroups.find((g) => g.type === 'dropdown' && g.items.some((i) => i.key === currentPage));
    if (owner) setExpanded((prev) => ({ ...prev, [owner.key]: true }));
  }, [currentPage, visibleGroups]);

  useEffect(() => {
    if (visible) setMounted(true);
    else if (mounted) markModalClosing(200);
    Animated.parallel([
      Animated.timing(translateX, { toValue: visible ? 0 : -DRAWER_W, duration: visible ? 260 : 200, useNativeDriver: true }),
      Animated.timing(backdrop, { toValue: visible ? 1 : 0, duration: visible ? 260 : 200, useNativeDriver: true }),
    ]).start(() => {
      if (!visible) setMounted(false);
    });
  }, [visible, translateX, backdrop]);

  if (!mounted) return null;

  const handleItemPress = (item) => {
    onClose?.();
    onNavigate?.(item.key);
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        <Animated.View style={[s.backdrop, { opacity: backdrop }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[s.drawer, { width: DRAWER_W, transform: [{ translateX }] }]}>
          <LinearGradient colors={[c.heroA, c.heroB, c.heroC]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.brand, { paddingTop: insets.top + 14 }]}>
            <View style={s.orb} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Image source={require('../assets/ajwain-app-icon.png')} style={s.brandLogo} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text style={s.brandTitle}>Ajwain</Text>
                <Text style={s.brandSub}>TrioTree Technologies Pvt. Ltd.</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10} style={s.closeBtn}>
                <Feather name="x" size={17} color="#fff" />
              </Pressable>
            </View>
            <View style={s.userCard}>
              <Avatar name={realName} size={38} color="rgba(255,255,255,0.25)" />
              <View style={{ flex: 1 }}>
                <Text style={s.userName} numberOfLines={1}>{realName || 'User'}</Text>
                <Text style={s.userMeta} numberOfLines={1}>
                  {loginName}
                  {role ? ` · ${role}` : ''}
                </Text>
              </View>
            </View>
          </LinearGradient>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10, gap: 4 }} showsVerticalScrollIndicator={false}>
            {visibleGroups.map((group) => {
              const isOpen = !!expanded[group.key];
              const ownsCurrent = group.items.some((i) => i.key === currentPage);
              const groupColor = group.items[0]?.color || c.primary;
              const t = toneOf(groupColor, dark);

              if (group.type === 'single') {
                const item = group.items[0];
                const active = currentPage === item.key;
                return (
                  <Pressable key={group.key} style={({ pressed }) => [s.groupRow, active && s.groupRowActive, pressed && { opacity: 0.75 }]} onPress={() => handleItemPress(item)}>
                    <View style={[s.groupIcon, { backgroundColor: active ? c.primary : t.bg }]}>
                      <Feather name={group.icon} size={16} color={active ? '#fff' : t.fg} />
                    </View>
                    <Text style={[s.groupLabel, active && s.groupLabelActive]}>{group.label}</Text>
                  </Pressable>
                );
              }

              return (
                <View key={group.key}>
                  <Pressable
                    style={({ pressed }) => [s.groupRow, ownsCurrent && !isOpen && s.groupRowActive, pressed && { opacity: 0.75 }]}
                    onPress={() => setExpanded((p) => ({ ...p, [group.key]: !p[group.key] }))}
                  >
                    <View style={[s.groupIcon, { backgroundColor: ownsCurrent ? c.primary : t.bg }]}>
                      <Feather name={group.icon} size={16} color={ownsCurrent ? '#fff' : t.fg} />
                    </View>
                    <Text style={[s.groupLabel, ownsCurrent && s.groupLabelActive]}>{group.label}</Text>
                    <Text style={s.groupCount}>{group.items.length}</Text>
                    <Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={15} color={c.textFaint} />
                  </Pressable>

                  {isOpen && (
                    <View style={s.subWrap}>
                      {group.items.map((item) => {
                        const active = currentPage === item.key;
                        return (
                          <Pressable key={item.key} style={({ pressed }) => [s.itemRow, active && s.itemRowActive, pressed && { opacity: 0.75 }]} onPress={() => handleItemPress(item)}>
                            <View style={[s.itemDot, { backgroundColor: item.color }]} />
                            <Text style={[s.itemLabel, active && s.itemLabelActive]} numberOfLines={2}>
                              {item.label}
                            </Text>
                            {active && <Feather name="check" size={14} color={c.primary} />}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <Pressable style={({ pressed }) => [s.bioRow, pressed && { opacity: 0.7 }]} onPress={() => (onClose?.(), onBiometric?.())}>
            <Feather name="shield" size={15} color={c.primary} />
            <Text style={[s.footerBtnText, { color: c.primary, flex: 1 }]}>Fingerprint / Face ID login</Text>
            <Feather name="chevron-right" size={15} color={c.textFaint} />
          </Pressable>
          <View style={[s.footer, { paddingBottom: insets.bottom + 10 }]}>
            <Pressable style={({ pressed }) => [s.footerBtn, pressed && { opacity: 0.7 }]} onPress={() => (onClose?.(), onChangePassword?.())}>
              <Feather name="lock" size={15} color={c.textMuted} />
              <Text style={s.footerBtnText}>Change Password</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [s.footerBtn, { backgroundColor: c.dangerSoft }, pressed && { opacity: 0.7 }]} onPress={() => (onClose?.(), onLogout?.())}>
              <Feather name="log-out" size={15} color={c.danger} />
              <Text style={[s.footerBtnText, { color: c.danger }]}>Sign out</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: c.overlay },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: c.surface,
    borderTopRightRadius: 26,
    borderBottomRightRadius: 26,
    overflow: 'hidden',
  },
  brand: { paddingHorizontal: 16, paddingBottom: 16, overflow: 'hidden' },
  orb: { position: 'absolute', right: -50, top: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.08)' },
  brandLogo: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)' },
  brandTitle: { fontSize: 19, fontWeight: '900', color: '#fff', letterSpacing: -0.3 },
  brandSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1, fontWeight: '600' },
  closeBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, padding: 10, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)' },
  userName: { color: '#fff', fontWeight: '800', fontSize: 13.5 },
  userMeta: { color: 'rgba(255,255,255,0.72)', fontSize: 11, marginTop: 1 },

  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 9, borderRadius: radii.md },
  groupRowActive: { backgroundColor: c.primarySoft },
  groupIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  groupLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: c.text },
  groupLabelActive: { color: c.primary },
  groupCount: {
    fontSize: 10.5,
    fontWeight: '800',
    color: c.textMuted,
    backgroundColor: c.bgAlt,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  subWrap: { marginLeft: 26, borderLeftWidth: 1.5, borderLeftColor: c.border, paddingLeft: 8, marginBottom: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 10, borderRadius: radii.sm },
  itemRowActive: { backgroundColor: c.primarySoft },
  itemDot: { width: 7, height: 7, borderRadius: 4 },
  itemLabel: { flex: 1, fontSize: 13, color: c.textMuted, fontWeight: '600' },
  itemLabelActive: { color: c.primary, fontWeight: '800' },

  footer: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border },
  footerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 42, borderRadius: radii.md, backgroundColor: c.surfaceAlt },
  bioRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 8, paddingHorizontal: 14, height: 42, borderRadius: radii.md, backgroundColor: c.primarySoft },
  footerBtnText: { fontSize: 12.5, color: c.textMuted, fontWeight: '800' },
}));
