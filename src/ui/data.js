import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { makeStyles, radii, shadowFor, toneOf, useTheme } from '../theme/theme';

/* =========================================================================
   Segmented tabs (scrollable pill style)
   options: [{ label, value, count?, color?, icon? }]
   ========================================================================= */
export function Segmented({ options = [], value, onChange, style, scroll = true, size = 'md' }) {
  const { c } = useTheme();
  const s = useStyles();
  const content = options.map((o) => {
    const active = String(o.value) === String(value);
    const accent = o.color || c.primary;
    return (
      <Pressable
        key={String(o.value)}
        onPress={() => onChange?.(o.value)}
        style={({ pressed }) => [
          s.seg,
          size === 'sm' && { height: 32, paddingHorizontal: 11 },
          !scroll && { flex: 1, justifyContent: 'center' },
          active && { backgroundColor: accent, borderColor: accent, ...shadowFor(c, 1) },
          pressed && { opacity: 0.8 },
        ]}
      >
        {!!o.icon && <Feather name={o.icon} size={13} color={active ? '#fff' : c.textMuted} />}
        <Text style={[s.segText, active && { color: '#fff' }]} numberOfLines={1}>
          {o.label}
        </Text>
        {o.count != null && (
          <View style={[s.segCount, active && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
            <Text style={[s.segCountText, active && { color: '#fff' }]}>{o.count}</Text>
          </View>
        )}
      </Pressable>
    );
  });
  if (!scroll) return <View style={[s.segWrap, style]}>{content}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[{ gap: 8, paddingRight: 8 }, style]}>
      {content}
    </ScrollView>
  );
}

/* =========================================================================
   Stat tiles
   ========================================================================= */
export function StatCard({ label, value, icon, color, sub, onPress, active, style, compact }) {
  const { c, dark } = useTheme();
  const s = useStyles();
  const accent = color || c.primary;
  const t = toneOf(accent, dark);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        s.stat,
        shadowFor(c, 1),
        compact && { padding: 10, gap: 2 },
        active && { borderColor: accent, borderWidth: 1.6, backgroundColor: t.bg },
        pressed && { transform: [{ scale: 0.97 }] },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {!!icon && (
          <View style={[s.statIcon, { backgroundColor: t.bg }, compact && { width: 26, height: 26, borderRadius: 8, marginBottom: 2 }]}>
            <Feather name={icon} size={compact ? 13 : 15} color={accent} />
          </View>
        )}
        {active && <Feather name="filter" size={12} color={accent} />}
      </View>
      <Text style={[s.statValue, compact && { fontSize: 20 }]} numberOfLines={1} adjustsFontSizeToFit>
        {value ?? '—'}
      </Text>
      <Text style={s.statLabel} numberOfLines={2}>
        {label}
      </Text>
      {!!sub && <Text style={[s.statSub, { color: accent }]} numberOfLines={1}>{sub}</Text>}
    </Pressable>
  );
}

/** Two- or three-column grid of StatCards. */
export function StatGrid({ children, columns = 2, gap = 10, style }) {
  const items = React.Children.toArray(children).filter(Boolean);
  const basis = `${100 / columns}%`;
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -gap / 2 }, style]}>
      {items.map((ch, i) => (
        <View key={i} style={{ width: basis, paddingHorizontal: gap / 2, paddingBottom: gap }}>
          {ch}
        </View>
      ))}
    </View>
  );
}

/** Horizontally scrolling strip of compact stat chips. */
export function StatStrip({ items = [], style }) {
  const { c, dark } = useTheme();
  const s = useStyles();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[{ gap: 10, paddingRight: 6 }, style]}>
      {items.map((it) => {
        const accent = it.color || c.primary;
        const t = toneOf(accent, dark);
        return (
          <Pressable
            key={it.key || it.label}
            onPress={it.onPress}
            disabled={!it.onPress}
            style={({ pressed }) => [
              s.strip,
              shadowFor(c, 1),
              it.active && { borderColor: accent, borderWidth: 1.6, backgroundColor: t.bg },
              pressed && { transform: [{ scale: 0.96 }] },
            ]}
          >
            <View style={[s.stripDot, { backgroundColor: accent }]} />
            <View>
              <Text style={s.stripValue}>{it.value ?? 0}</Text>
              <Text style={s.stripLabel} numberOfLines={1}>{it.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* =========================================================================
   Client-side pagination: "load more" pattern for long lists
   ========================================================================= */
export function usePager(items, pageSize = 20, resetKey) {
  const [count, setCount] = useState(pageSize);
  useEffect(() => setCount(pageSize), [resetKey, pageSize]);
  const visible = useMemo(() => (items || []).slice(0, count), [items, count]);
  return {
    visible,
    hasMore: (items || []).length > count,
    loadMore: () => setCount((n) => n + pageSize),
    total: (items || []).length,
    shown: Math.min(count, (items || []).length),
  };
}

export function LoadMore({ pager, style }) {
  const { c } = useTheme();
  if (!pager) return null;
  return (
    <View style={[{ alignItems: 'center', paddingVertical: 14, gap: 8 }, style]}>
      <Text style={{ color: c.textFaint, fontSize: 11.5 }}>
        Showing {pager.shown} of {pager.total}
      </Text>
      {pager.hasMore && (
        <Pressable
          onPress={pager.loadMore}
          style={({ pressed }) => [
            { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, height: 38, borderRadius: 999, backgroundColor: c.primarySoft },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Feather name="chevrons-down" size={15} color={c.primary} />
          <Text style={{ color: c.primary, fontWeight: '800', fontSize: 13 }}>Load more</Text>
        </Pressable>
      )}
    </View>
  );
}

/* =========================================================================
   Action list (used inside a Sheet as a context menu)
   actions: [{ key, label, icon, color, onPress, disabled, hidden, sub }]
   ========================================================================= */
export function ActionList({ actions = [] }) {
  const { c, dark } = useTheme();
  const s = useStyles();
  const list = actions.filter((a) => a && !a.hidden);
  return (
    <View style={{ gap: 8 }}>
      {list.map((a) => {
        const accent = a.color || c.primary;
        const t = toneOf(accent, dark);
        return (
          <Pressable
            key={a.key || a.label}
            onPress={a.disabled ? undefined : a.onPress}
            style={({ pressed }) => [s.action, a.disabled && { opacity: 0.45 }, pressed && { opacity: 0.8 }]}
          >
            <View style={[s.actionIcon, { backgroundColor: t.bg }]}>
              <Feather name={a.icon || 'chevron-right'} size={17} color={accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.actionText}>{a.label}</Text>
              {!!a.sub && <Text style={s.actionSub}>{a.sub}</Text>}
            </View>
            <Feather name="chevron-right" size={16} color={c.textFaint} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Row of removable filter chips that summarises active filters. */
export function ActiveFilters({ items = [], onClearAll }) {
  const { c } = useTheme();
  const list = items.filter(Boolean);
  if (!list.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
      {list.map((it) => (
        <Pressable
          key={it.key}
          onPress={it.onClear}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 28, borderRadius: 999, backgroundColor: c.primarySoft }}
        >
          <Text style={{ color: c.primary, fontSize: 11.5, fontWeight: '700', maxWidth: 180 }} numberOfLines={1}>
            {it.label}
          </Text>
          <Feather name="x" size={12} color={c.primary} />
        </Pressable>
      ))}
      {!!onClearAll && list.length > 1 && (
        <Pressable onPress={onClearAll} style={{ paddingHorizontal: 8 }}>
          <Text style={{ color: c.red, fontSize: 11.5, fontWeight: '800' }}>Clear all</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  segWrap: { flexDirection: 'row', gap: 6, backgroundColor: c.bgAlt, padding: 4, borderRadius: radii.md },
  seg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  segText: { fontSize: 13, fontWeight: '700', color: c.textMuted },
  segCount: { minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, backgroundColor: c.bgAlt, alignItems: 'center' },
  segCountText: { fontSize: 10.5, fontWeight: '800', color: c.textMuted },
  stat: { backgroundColor: c.surface, borderRadius: radii.lg, padding: 14, gap: 4, borderWidth: c.dark ? 1 : 0, borderColor: c.border },
  statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statValue: { fontSize: 24, fontWeight: '800', color: c.text, letterSpacing: -0.5 },
  statLabel: { fontSize: 11.5, color: c.textMuted, fontWeight: '600' },
  statSub: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.surface,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minWidth: 104,
    borderWidth: c.dark ? 1 : 0,
    borderColor: c.border,
  },
  stripDot: { width: 8, height: 30, borderRadius: 4 },
  stripValue: { fontSize: 18, fontWeight: '800', color: c.text },
  stripLabel: { fontSize: 10.5, color: c.textMuted, fontWeight: '700', maxWidth: 130 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: c.border,
  },
  actionIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 14, fontWeight: '700', color: c.text },
  actionSub: { fontSize: 11.5, color: c.textMuted, marginTop: 1 },
}));
