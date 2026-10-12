import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';
import { toYMD } from './format';

/**
 * Build an .xlsx in the cache directory and open the native share sheet.
 *
 *   exportExcel('SprintPoints', [
 *     { name: 'Points', rows, columns: [{ header: 'ID', value: r => r.PointId }, …] },
 *   ]);
 *
 * `columns` is optional – without it every key of the row objects is used.
 */
export async function exportExcel(fileName, sheets) {
  const wb = XLSX.utils.book_new();
  (Array.isArray(sheets) ? sheets : [sheets]).forEach((sh, i) => {
    const rows = sh.rows || [];
    let aoa;
    if (sh.columns && sh.columns.length) {
      aoa = [
        sh.columns.map((c) => c.header),
        ...rows.map((r, idx) =>
          sh.columns.map((c) => {
            const v = typeof c.value === 'function' ? c.value(r, idx) : r[c.key ?? c.value];
            return v === undefined || v === null ? '' : v;
          }),
        ),
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = sh.columns.map((c) => ({ wch: c.width || Math.min(48, Math.max(10, String(c.header).length + 4)) }));
      XLSX.utils.book_append_sheet(wb, ws, (sh.name || `Sheet${i + 1}`).slice(0, 31));
    } else {
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, (sh.name || `Sheet${i + 1}`).slice(0, 31));
    }
  });
  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const safe = String(fileName || 'Export').replace(/[^\w\-]+/g, '_');
  const uri = `${FileSystem.cacheDirectory}${safe}_${toYMD(new Date())}.xlsx`;
  await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: `Export ${safe}`,
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
    });
  }
  return uri;
}

/** CSV variant (web PendingReplicationBugs exports CSV). */
export async function exportCsv(fileName, columns, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [columns.map((c) => esc(c.header)).join(','), ...rows.map((r, i) => columns.map((c) => esc(typeof c.value === 'function' ? c.value(r, i) : r[c.key ?? c.value])).join(','))];
  const safe = String(fileName || 'Export').replace(/[^\w\-]+/g, '_');
  const uri = `${FileSystem.cacheDirectory}${safe}_${toYMD(new Date())}.csv`;
  await FileSystem.writeAsStringAsync(uri, '﻿' + lines.join('\r\n'));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: `Export ${safe}`, UTI: 'public.comma-separated-values-text' });
  }
  return uri;
}

export function openUrl(url) {
  if (!url) return;
  Linking.openURL(url).catch(() => {});
}

/** Save a base64 payload to the cache and open the share / open-with sheet. */
export async function shareBase64File(base64, fileName = 'attachment', mimeType = 'application/octet-stream') {
  const clean = String(base64 || '').replace(/^data:.*?;base64,/, '').replace(/\s/g, '');
  if (!clean) throw new Error('Document content was not returned.');
  const safe = String(fileName || 'attachment').replace(/[\\/:*?"<>|]+/g, '_');
  const uri = `${FileSystem.cacheDirectory}${Date.now()}_${safe}`;
  await FileSystem.writeAsStringAsync(uri, clean, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType, dialogTitle: safe });
  }
  return uri;
}

export function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Render a simple landscape PDF table (web: jsPDF + autoTable) and open the
 * share / preview sheet.  columns: [{ header, value(row, i) }]
 */
export async function exportPdfTable({ title, subtitle, columns, rows, fileName = 'Report' }) {
  const Print = await import('expo-print');
  const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<!doctype html><html><head><meta charset="utf-8"/>
  <style>
    @page { size: A4 landscape; margin: 14px; }
    body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color:#111827; }
    h1 { font-size: 16px; margin: 0 0 2px; } p { font-size: 10px; color:#6b7280; margin:0 0 10px; }
    table { width:100%; border-collapse: collapse; font-size: 8.5px; }
    th { background:#4338ca; color:#fff; text-align:left; padding:5px 4px; }
    td { padding:4px; border-bottom:1px solid #e5e7eb; vertical-align: top; }
    tr:nth-child(even) td { background:#f5f7ff; }
  </style></head><body>
  <h1>${esc(title)}</h1><p>${esc(subtitle || '')}</p>
  <table><thead><tr>${columns.map((c) => `<th>${esc(c.header)}</th>`).join('')}</tr></thead>
  <tbody>${rows.map((r, i) => `<tr>${columns.map((c) => `<td>${esc(c.value(r, i))}</td>`).join('')}</tr>`).join('')}</tbody></table>
  </body></html>`;
  const { uri } = await Print.printToFileAsync({ html, width: 842, height: 595 });
  const safe = String(fileName).replace(/[^\w\-]+/g, '_');
  const target = `${FileSystem.cacheDirectory}${safe}_${toYMD(new Date())}.pdf`;
  try {
    await FileSystem.moveAsync({ from: uri, to: target });
  } catch {
    /* keep original uri */
  }
  const finalUri = (await FileSystem.getInfoAsync(target)).exists ? target : uri;
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(finalUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: title });
  return finalUri;
}
