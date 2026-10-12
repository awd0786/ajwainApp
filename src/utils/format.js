/* =========================================================================
   Date / value formatting helpers shared by every screen.
   ========================================================================= */

const pad = (n) => String(n).padStart(2, '0');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Accepts Date | ISO string | 'YYYY-MM-DD' | 'DD-MM-YYYY' | 'DD/MM/YYYY'. */
export function parseAnyDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  const s = String(v).trim();
  if (!s || s.startsWith('0001-01-01')) return null;
  // 'YYYY-MM-DD' -> local date (avoid UTC shift)
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = /^(\d{2})[-/](\d{2})[-/](\d{4})(?:[ T](\d{2}):(\d{2}))?/.exec(s);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

export function toYMD(d) {
  const x = parseAnyDate(d);
  if (!x) return '';
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

export function toYMDHM(d) {
  const x = parseAnyDate(d);
  if (!x) return '';
  return `${toYMD(x)}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

/** 11 Oct 2026 */
export function fmtDate(val, fallback = '—') {
  const d = parseAnyDate(val);
  if (!d) return fallback;
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** 11 Oct 2026, 14:05 */
export function fmtDateTime(val, fallback = '—') {
  const d = parseAnyDate(val);
  if (!d) return fallback;
  return `${fmtDate(d)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** dd/mm/yyyy (web toLocaleDateString('en-IN')) */
export function fmtDateIN(val, fallback = '—') {
  const d = parseAnyDate(val);
  if (!d) return fallback;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** dd-mm-yyyy */
export function fmtExpectedDeliveryDate(value) {
  const d = parseAnyDate(value);
  if (!d) return '';
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

export function daysBetween(a, b = new Date()) {
  const x = parseAnyDate(a);
  const y = parseAnyDate(b);
  if (!x || !y) return null;
  const A = new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const B = new Date(y.getFullYear(), y.getMonth(), y.getDate());
  return Math.round((B - A) / 86400000);
}

export function getAgeing(addedDateTime, status) {
  if (!addedDateTime) return '-';
  if ((status || '').toLowerCase() === 'closed') return 'Closed';
  const added = parseAnyDate(addedDateTime);
  if (!added) return '-';
  const days = Math.floor((Date.now() - added) / (1000 * 60 * 60 * 24));
  return `${days} Day${days !== 1 ? 's' : ''}`;
}

export function getPriorityStatus(row) {
  if (!row) return '-';
  if (row.PointDrop) return 'Point Dropped';
  if (row.IsClientSideTesting) return 'Client Side Testing';
  return row.CurrentStatus || '-';
}

export function getTargetDateStatus(targetDate) {
  if (!targetDate) return { status: '', color: '' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseAnyDate(targetDate);
  if (!target) return { status: '', color: '' };
  target.setHours(0, 0, 0, 0);
  const overdueDays = Math.floor((today - target) / (1000 * 60 * 60 * 24));
  if (overdueDays <= 0) return { status: 'Scheduled', color: '#10B981', overdueDays };
  if (overdueDays <= 3) return { status: 'Delayed', color: '#F59E0B', overdueDays };
  return { status: 'Severely Delayed', color: '#EF4444', overdueDays };
}

export function isPatchCreatedToday(dateTimeStr) {
  const d = parseAnyDate(dateTimeStr);
  if (!d) return false;
  return toYMD(d) === toYMD(new Date());
}

export function parseProductIds(value) {
  if (Array.isArray(value)) return value.map(Number).filter((n) => !Number.isNaN(n));
  if (value == null || value === '') return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(Number).filter((n) => !Number.isNaN(n));
    } catch {
      /* comma separated fallback below */
    }
    return value
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n));
  }
  if (typeof value === 'number') return [value];
  return [];
}

export function rowProductId(r) {
  return String(r.Product ?? r.ProductId ?? r.productId ?? '');
}

export function truthy(v) {
  if (v === true || v === 1) return true;
  const s = String(v).toLowerCase();
  return s === 'true' || s === '1';
}

export function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export function uniq(arr) {
  return [...new Set((arr || []).filter((x) => x !== undefined && x !== null && x !== ''))];
}

export function uniqSorted(arr) {
  return uniq(arr).sort((a, b) => String(a).localeCompare(String(b)));
}

export function groupCount(rows, keyFn) {
  const m = new Map();
  (rows || []).forEach((r) => {
    const k = keyFn(r) ?? '—';
    m.set(k, (m.get(k) || 0) + 1);
  });
  return [...m.entries()].map(([label, value]) => ({ label: String(label), value })).sort((a, b) => b.value - a.value);
}

export function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function initials(name) {
  return String(name || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** "1h 30m" from hours (decimal). */
export function fmtHours(h) {
  const n = Number(h);
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n * 100) / 100}h`;
}
