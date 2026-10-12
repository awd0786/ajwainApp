import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { makeStyles, radii, shadowFor, statusTone, toneOf, useTheme, alpha } from '../theme/theme';

/* =========================================================================
   Card
   ========================================================================= */
export function Card({ children, style, onPress, onLongPress, padded = true, accent, flat }) {
  const s = useStyles();
  const { c } = useTheme();
  const body = (
    <>
      {!!accent && <View style={[s.accentBar, { backgroundColor: accent }]} />}
      {children}
    </>
  );
  const base = [s.card, !flat && shadowFor(c, 1), padded && s.cardPad, style];
  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        style={({ pressed }) => [...base, pressed && { transform: [{ scale: 0.985 }] }]}
      >
        {body}
      </Pressable>
    );
  }
  return <View style={base}>{body}</View>;
}

/* =========================================================================
   Button / IconButton
   ========================================================================= */
export function Button({
  title,
  icon,
  iconRight,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  full,
  color,
  style,
}) {
  const { c, dark } = useTheme();
  const s = useStyles();
  const accent = color || (variant === 'danger' ? c.red : variant === 'success' ? c.emerald : c.primary);
  const tone = toneOf(accent, dark);

  let bg = accent;
  let fg = '#fff';
  let border = 'transparent';
  if (variant === 'secondary') {
    bg = c.surface;
    fg = c.text;
    border = c.border;
  } else if (variant === 'ghost') {
    bg = 'transparent';
    fg = accent;
  } else if (variant === 'soft') {
    bg = tone.bg;
    fg = accent;
  } else if (variant === 'outline') {
    bg = 'transparent';
    fg = accent;
    border = tone.border;
  }
  const isGradient = variant === 'primary' && !color;
  const h = size === 'sm' ? 34 : size === 'lg' ? 52 : 44;
  const fs = size === 'sm' ? 12.5 : 14;
  const off = disabled || loading;

  const content = (
    <View style={[s.btnInner, { height: h }]}>
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          {!!icon && <Feather name={icon} size={size === 'sm' ? 14 : 16} color={fg} />}
          {!!title && <Text style={[s.btnText, { color: fg, fontSize: fs }]} numberOfLines={1}>{title}</Text>}
          {!!iconRight && <Feather name={iconRight} size={size === 'sm' ? 14 : 16} color={fg} />}
        </>
      )}
    </View>
  );

  return (
    <Pressable
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: isGradient ? 'transparent' : bg, borderColor: border, borderWidth: border === 'transparent' ? 0 : 1 },
        full && { alignSelf: 'stretch' },
        off && { opacity: 0.5 },
        pressed && !off && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {isGradient ? (
        <LinearGradient colors={[c.heroB, c.heroC]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.btnGrad}>
          {content}
        </LinearGradient>
      ) : (
        content
      )}
    </Pressable>
  );
}

export function IconButton({ icon, onPress, color, size = 18, variant = 'soft', badge, disabled, style, box = 38 }) {
  const { c, dark } = useTheme();
  const accent = color || c.primary;
  const tone = toneOf(accent, dark);
  const bg = variant === 'soft' ? tone.bg : variant === 'solid' ? accent : variant === 'surface' ? c.surface : 'transparent';
  const fg = variant === 'solid' ? '#fff' : accent;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      hitSlop={6}
      style={({ pressed }) => [
        {
          width: box,
          height: box,
          borderRadius: box / 2.6,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bg,
          borderWidth: variant === 'surface' ? 1 : 0,
          borderColor: c.border,
        },
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.75 },
        style,
      ]}
    >
      <Feather name={icon} size={size} color={fg} />
      {!!badge && (
        <View style={[stylesStatic.badge, { backgroundColor: c.red }]}>
          <Text style={stylesStatic.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

/* =========================================================================
   Pill (status / tag) and Chip (selectable)
   ========================================================================= */
export function Pill({ label, status, color, icon, size = 'sm', style, solid, numberOfLines = 1 }) {
  const { dark } = useTheme();
  const t = color ? toneOf(color, dark) : statusTone(status ?? label, dark);
  const small = size === 'sm';
  return (
    <View
      style={[
        stylesStatic.pill,
        { backgroundColor: solid ? t.fg : t.bg, paddingVertical: small ? 3 : 5, paddingHorizontal: small ? 8 : 11 },
        style,
      ]}
    >
      {!!icon && <Feather name={icon} size={small ? 10 : 12} color={solid ? '#fff' : t.fg} />}
      {!icon && !solid && <View style={[stylesStatic.dot, { backgroundColor: t.fg }]} />}
      <Text
        numberOfLines={numberOfLines}
        style={{ color: solid ? '#fff' : t.fg, fontSize: small ? 10.5 : 12, fontWeight: '700', flexShrink: 1 }}
      >
        {label ?? '-'}
      </Text>
    </View>
  );
}

export function Chip({ label, active, onPress, color, icon, count, style, disabled }) {
  const { c, dark } = useTheme();
  const accent = color || c.primary;
  const t = toneOf(accent, dark);
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        stylesStatic.chip,
        {
          backgroundColor: active ? accent : c.surface,
          borderColor: active ? accent : c.border,
        },
        disabled && { opacity: 0.45 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {!!icon && <Feather name={icon} size={13} color={active ? '#fff' : t.fg} />}
      <Text style={{ fontSize: 12.5, fontWeight: '700', color: active ? '#fff' : c.text }} numberOfLines={1}>
        {label}
      </Text>
      {count != null && (
        <View style={[stylesStatic.chipCount, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : t.bg }]}>
          <Text style={{ fontSize: 10.5, fontWeight: '800', color: active ? '#fff' : t.fg }}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

/* =========================================================================
   Layout helpers
   ========================================================================= */
export function Row({ children, style, gap = 8, wrap, align = 'center', justify }) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: align, gap, flexWrap: wrap ? 'wrap' : 'nowrap' },
        justify && { justifyContent: justify },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Divider({ style }) {
  const { c } = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: 10 }, style]} />;
}

export function SectionHeader({ title, subtitle, right, icon, color, style }) {
  const { c, dark } = useTheme();
  const t = toneOf(color || c.primary, dark);
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }, style]}>
      {!!icon && (
        <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name={icon} size={15} color={t.fg} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15.5, fontWeight: '800', color: c.text }} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={{ fontSize: 11.5, color: c.textMuted, marginTop: 1 }} numberOfLines={2}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

/** label / value pair used on detail cards. */
export function KV({ label, value, icon, mono, color, style, valueStyle, wide }) {
  const { c } = useTheme();
  return (
    <View style={[{ width: wide ? '100%' : '50%', paddingVertical: 6, paddingRight: 8 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        {!!icon && <Feather name={icon} size={11} color={c.textFaint} />}
        <Text style={{ fontSize: 10.5, color: c.textFaint, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }} numberOfLines={1}>
          {label}
        </Text>
      </View>
      {React.isValidElement(value) ? (
        <View style={{ marginTop: 3 }}>{value}</View>
      ) : (
        <Text
          style={[
            { fontSize: 13, color: color || c.text, fontWeight: '600', marginTop: 3 },
            mono && { fontVariant: ['tabular-nums'] },
            valueStyle,
          ]}
        >
          {value === undefined || value === null || value === '' ? '—' : String(value)}
        </Text>
      )}
    </View>
  );
}

export function KVGrid({ children, style }) {
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap' }, style]}>{children}</View>;
}

/** Small avatar circle with initials. */
export function Avatar({ name, size = 34, color }) {
  const { c } = useTheme();
  const initials = String(name || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const bg = color || c.primary;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.36 }}>{initials || 'U'}</Text>
    </View>
  );
}

/** Thin progress bar. value 0..1 */
export function Progress({ value = 0, color, height = 6, style }) {
  const { c } = useTheme();
  const v = Math.max(0, Math.min(1, Number(value) || 0));
  return (
    <View style={[{ height, borderRadius: height, backgroundColor: c.bgAlt, overflow: 'hidden' }, style]}>
      <View style={{ width: `${v * 100}%`, height: '100%', borderRadius: height, backgroundColor: color || c.primary }} />
    </View>
  );
}

/** Info / error / success banner. */
export function Banner({ type = 'info', text, style, onClose }) {
  const { c } = useTheme();
  const map = {
    info: [c.info, c.infoSoft, 'info'],
    error: [c.danger, c.dangerSoft, 'alert-circle'],
    success: [c.success, c.successSoft, 'check-circle'],
    warning: [c.warning, c.warningSoft, 'alert-triangle'],
  };
  const [fg, bg, icon] = map[type] || map.info;
  if (!text) return null;
  return (
    <View style={[{ flexDirection: 'row', gap: 8, padding: 11, borderRadius: radii.sm, backgroundColor: bg, alignItems: 'flex-start' }, style]}>
      <Feather name={icon} size={15} color={fg} style={{ marginTop: 1 }} />
      <Text style={{ color: fg, fontSize: 12.5, flex: 1, fontWeight: '600', lineHeight: 18 }}>{String(text)}</Text>
      {!!onClose && (
        <Pressable onPress={onClose} hitSlop={8}>
          <Feather name="x" size={14} color={fg} />
        </Pressable>
      )}
    </View>
  );
}

/** Gradient hero strip used at the top of dashboards. */
export function Hero({ title, subtitle, children, colors: grad, style, right }) {
  const { c } = useTheme();
  return (
    <LinearGradient
      colors={grad || [c.heroA, c.heroB, c.heroC]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ borderRadius: radii.xl, padding: 16, overflow: 'hidden' }, style]}
    >
      <View style={{ position: 'absolute', right: -40, top: -40, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.08)' }} />
      <View style={{ position: 'absolute', right: 30, bottom: -50, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.06)' }} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          {!!title && <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{title}</Text>}
          {!!subtitle && <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 3 }}>{subtitle}</Text>}
        </View>
        {right}
      </View>
      {children}
    </LinearGradient>
  );
}

export function HeroStat({ label, value, icon }) {
  return (
    <View style={{ flex: 1, minWidth: 70, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        {!!icon && <Feather name={icon} size={11} color="rgba(255,255,255,0.8)" />}
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10.5, fontWeight: '700' }} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 4 }} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  cardPad: { padding: 14 },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  btn: { borderRadius: radii.md, overflow: 'hidden' },
  btnGrad: { borderRadius: radii.md },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  btnText: { fontWeight: '800', letterSpacing: 0.2 },
}));

const stylesStatic = StyleSheet.create({
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
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, alignSelf: 'flex-start', maxWidth: '100%' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipCount: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, minWidth: 20, alignItems: 'center' },
});

export { alpha };
