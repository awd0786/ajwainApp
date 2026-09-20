export const colors = {
  bg: '#F4F6FB',
  surface: '#FFFFFF',
  border: '#E7E9F3',
  text: '#1E2333',
  textMuted: '#6B7280',
  textFaint: '#9CA3AF',

  primary: '#4F46E5',
  primarySoft: '#EEF0FF',
  indigo: '#4F46E5',
  indigoSoft: '#EEF2FF',
  violet: '#7C3AED',
  violetSoft: '#F3E8FF',
  teal: '#0D9488',
  tealSoft: '#CCFBF1',
  emerald: '#059669',
  emeraldSoft: '#D1FAE5',
  amber: '#D97706',
  amberSoft: '#FEF3C7',
  red: '#DC2626',
  redSoft: '#FEE2E2',
  orange: '#EA580C',
  orangeSoft: '#FFEDD5',
  cyan: '#0891B2',
  cyanSoft: '#CFFAFE',
  slate: '#475569',
  slateSoft: '#F1F5F9',

  gradientStart: '#3F7899',
  gradientEnd: '#2D6080',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radii = { sm: 8, md: 14, lg: 20, pill: 999 };

export const shadow = {
  card: {
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
};

export const STATUS_COLORS = {
  active: { bg: '#DBEAFE', fg: '#1D4ED8', dot: '#3B82F6' },
  closed: { bg: '#E5E7EB', fg: '#4B5563', dot: '#9CA3AF' },
  draft: { bg: '#FEF3C7', fg: '#B45309', dot: '#F59E0B' },
  reviewing: { bg: '#F3E8FF', fg: '#6D28D9', dot: '#8B5CF6' },
  testing: { bg: '#FFEDD5', fg: '#C2410C', dot: '#F97316' },
  resolved: { bg: '#D1FAE5', fg: '#047857', dot: '#10B981' },
  wait: { bg: '#FEF9C3', fg: '#A16207', dot: '#EAB308' },
  canceled: { bg: '#FEE2E2', fg: '#B91C1C', dot: '#EF4444' },
  'sit pass': { bg: '#CCFBF1', fg: '#0F766E', dot: '#14B8A6' },
  'sanity pass': { bg: '#DCFCE7', fg: '#15803D', dot: '#16A34A' },
  'under development': { bg: '#E0E7FF', fg: '#4338CA', dot: '#6366F1' },
  'in observation': { bg: '#FFEDD5', fg: '#C2410C', dot: '#FB923C' },
  'in testing': { bg: '#CFFAFE', fg: '#0E7490', dot: '#06B6D4' },
  'on support': { bg: '#D1FAE5', fg: '#047857', dot: '#059669' },
  'on product': { bg: '#ECFCCB', fg: '#4D7C0F', dot: '#65A30D' },
  'testing pending': { bg: '#FCE7F3', fg: '#BE185D', dot: '#E11D48' },
  'yet to be assigned': { bg: '#F1F5F9', fg: '#475569', dot: '#78716C' },
  'pending sanity merge': { bg: '#E0F2FE', fg: '#0369A1', dot: '#0284C7' },
  'client side testing': { bg: '#F3E8FF', fg: '#7E22CE', dot: '#A855F7' },
  'point dropped': { bg: '#FEE2E2', fg: '#991B1B', dot: '#EF4444' },
};

export function getStatusStyle(status) {
  const key = String(status || '').toLowerCase().trim();
  return STATUS_COLORS[key] || { bg: '#F3F4F6', fg: '#6B7280', dot: '#D1D5DB' };
}
