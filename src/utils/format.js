export function fmtDateTime(val) {
  if (!val) return '-';
  const d = new Date(val);
  if (isNaN(d)) return '-';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fmtExpectedDeliveryDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d)) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

export function getAgeing(addedDateTime, status) {
  if (!addedDateTime) return '-';
  if ((status || '').toLowerCase() === 'closed') return 'Closed';
  const added = new Date(addedDateTime);
  if (isNaN(added)) return '-';
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
  if (!targetDate) return { status: '', bg: '', fg: '' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  const overdueDays = Math.floor((today - target) / (1000 * 60 * 60 * 24));

  if (overdueDays <= 0) return { status: 'Scheduled', bg: '#D1FAE5', fg: '#047857' };
  if (overdueDays <= 3) return { status: 'Delayed', bg: '#FEF3C7', fg: '#B45309' };
  return { status: 'Severely Delayed', bg: '#FEE2E2', fg: '#B91C1C' };
}

export function isPatchCreatedToday(dateTimeStr) {
  if (!dateTimeStr) return false;
  const patchDate = new Date(dateTimeStr).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  return patchDate === today;
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
    return value.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !Number.isNaN(n));
  }
  return [];
}

export function rowProductId(r) {
  return String(r.Product ?? r.ProductId ?? r.productId ?? '');
}
