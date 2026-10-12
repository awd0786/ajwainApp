import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

/* =========================================================================
   AJWAIN MOBILE – DESIGN TOKENS
   Light + dark palettes that follow the device setting automatically.
   Every screen reads colours through useTheme() / makeStyles(), never from
   hard-coded hex values, so both themes stay consistent.
   ========================================================================= */

const shared = {
  indigo: '#6366F1',
  violet: '#8B5CF6',
  teal: '#14B8A6',
  emerald: '#10B981',
  amber: '#F59E0B',
  red: '#EF4444',
  rose: '#F43F5E',
  orange: '#F97316',
  cyan: '#06B6D4',
  sky: '#0EA5E9',
  pink: '#EC4899',
  lime: '#84CC16',
  slate: '#64748B',
};

export const palettes = {
  light: {
    ...shared,
    dark: false,
    bg: '#F3F5FB',
    bgAlt: '#EAEEF8',
    surface: '#FFFFFF',
    surfaceAlt: '#F7F8FC',
    elevated: '#FFFFFF',
    border: '#E4E8F2',
    borderStrong: '#CDD4E4',
    text: '#111827',
    textMuted: '#5B6478',
    textFaint: '#98A0B3',
    primary: '#5B4BF5',
    primaryText: '#FFFFFF',
    primarySoft: '#EEEBFF',
    overlay: 'rgba(10,12,28,0.45)',
    heroA: '#1B1A4B',
    heroB: '#4B3FD6',
    heroC: '#7C5CF6',
    inputBg: '#F5F7FC',
    skeleton: '#E9EDF6',
    success: '#059669',
    successSoft: '#D1FAE5',
    warning: '#B45309',
    warningSoft: '#FEF3C7',
    danger: '#DC2626',
    dangerSoft: '#FEE2E2',
    info: '#0369A1',
    infoSoft: '#E0F2FE',
    shadow: '#0F172A',
  },
  dark: {
    ...shared,
    dark: true,
    bg: '#090C16',
    bgAlt: '#0E1222',
    surface: '#131829',
    surfaceAlt: '#1A2034',
    elevated: '#1C2238',
    border: '#252C44',
    borderStrong: '#343D5C',
    text: '#EEF1FA',
    textMuted: '#A3ABC2',
    textFaint: '#6B7491',
    primary: '#7C6CFF',
    primaryText: '#FFFFFF',
    primarySoft: '#251F4A',
    overlay: 'rgba(0,0,0,0.6)',
    heroA: '#0F1030',
    heroB: '#2C2585',
    heroC: '#5B3FD0',
    inputBg: '#0F1424',
    skeleton: '#1C2236',
    success: '#34D399',
    successSoft: '#182F33',
    warning: '#FBBF24',
    warningSoft: '#33301F',
    danger: '#F87171',
    dangerSoft: '#352330',
    info: '#38BDF8',
    infoSoft: '#172D40',
    shadow: '#000000',
  },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };
export const radii = { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };
export const font = {
  h1: 24,
  h2: 19,
  h3: 16,
  body: 14,
  small: 12.5,
  tiny: 11,
  micro: 10,
};

/* ------------------------------------------------------------------ */

const ThemeContext = createContext({ c: palettes.light, dark: false });

export function ThemeProvider({ children }) {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const value = useMemo(() => ({ c: dark ? palettes.dark : palettes.light, dark }), [dark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * makeStyles((c, dark) => ({ ... })) -> hook returning memoised styles for
 * the active theme.  Usage:  const useStyles = makeStyles(...); const s = useStyles();
 */
export function makeStyles(factory) {
  const cache = new Map();
  return function useStyles() {
    const { c, dark } = useTheme();
    const key = dark ? 'd' : 'l';
    if (!cache.has(key)) cache.set(key, factory(c, dark));
    return cache.get(key);
  };
}

export function shadowFor(c, level = 1) {
  if (c.dark) return { borderWidth: 1, borderColor: c.border };
  const map = {
    1: { shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
    2: { shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
    3: { shadowOpacity: 0.2, shadowRadius: 26, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  };
  return { shadowColor: c.shadow, ...(map[level] || map[1]) };
}

/* ------------------------------------------------------------------ */
/* Colour helpers                                                     */
/* ------------------------------------------------------------------ */

export function alpha(hex, a) {
  if (!hex || hex[0] !== '#') return hex;
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** Mix `hex` over an opaque `base` colour → opaque #rrggbb. */
export function blend(hex, base, a) {
  const rgb = (h) => {
    let x = String(h).replace('#', '');
    if (x.length === 3) x = x.split('').map((ch) => ch + ch).join('');
    return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16));
  };
  if (!hex || hex[0] !== '#') return hex;
  const f = rgb(hex);
  const b = rgb(base);
  const out = f.map((v, i) => Math.round(v * a + b[i] * (1 - a)));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * A soft background + strong foreground pair for any accent hex.
 * Colours are OPAQUE on purpose: a translucent background on a view that has
 * Android `elevation` lets the shadow show through as a grey box.
 */
export function toneOf(hex, dark) {
  const base = dark ? '#131829' : '#FFFFFF';
  return { fg: hex, bg: blend(hex, base, dark ? 0.2 : 0.12), border: blend(hex, base, dark ? 0.42 : 0.3) };
}

/** Chart / categorical series palette (works on both themes). */
export const SERIES = [
  '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#8B5CF6',
  '#EC4899', '#84CC16', '#F97316', '#0EA5E9', '#14B8A6', '#A855F7',
  '#64748B', '#E11D48', '#22C55E', '#EAB308',
];

export function seriesColor(i) {
  return SERIES[Math.abs(i) % SERIES.length];
}

/** Deterministic colour for a string (sprint / client names etc). */
export function hashColor(str) {
  const s = String(str || '');
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return SERIES[Math.abs(hash) % SERIES.length];
}

/* Status → accent colour. Keys are lower-cased Zentao / sprint statuses. */
export const STATUS_ACCENT = {
  active: '#3B82F6',
  closed: '#94A3B8',
  draft: '#F59E0B',
  reviewing: '#8B5CF6',
  testing: '#F97316',
  resolved: '#10B981',
  wait: '#EAB308',
  doing: '#6366F1',
  done: '#10B981',
  pause: '#F59E0B',
  cancel: '#EF4444',
  canceled: '#EF4444',
  cancelled: '#EF4444',
  pending: '#F59E0B',
  open: '#3B82F6',
  'in progress': '#6366F1',
  completed: '#10B981',
  'sit pass': '#14B8A6',
  'sanity pass': '#16A34A',
  'under development': '#6366F1',
  'in observation': '#FB923C',
  observation: '#F59E0B',
  sit: '#3B82F6',
  sanity: '#10B981',
  'in testing': '#06B6D4',
  'on support': '#059669',
  'on product': '#65A30D',
  'testing pending': '#E11D48',
  'yet to be assigned': '#78716C',
  'pending sanity merge': '#0284C7',
  'client side testing': '#A855F7',
  'point dropped': '#EF4444',
  scheduled: '#10B981',
  delayed: '#F59E0B',
  'severely delayed': '#EF4444',
  bug: '#EF4444',
  story: '#3B82F6',
  task: '#14B8A6',
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#10B981',
};

export function statusTone(status, dark) {
  const key = String(status || '').toLowerCase().trim();
  const hex = STATUS_ACCENT[key] || '#94A3B8';
  return toneOf(hex, dark);
}

// Legacy export so any older import keeps compiling.
export const colors = palettes.light;
