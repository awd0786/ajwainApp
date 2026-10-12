import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../theme/theme';

/**
 * Tiny HTML renderer for Zentao / rich-editor content (descriptions and
 * comments). Supports p, br, div, b/strong, i/em, u, s/strike, pre/code,
 * ul/ol/li, h1-h6 and common entities. Anything else is rendered as text.
 */
const ENT = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };
const decode = (s) => s.replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/g, (m) => ENT[m] || m).replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

function parse(html) {
  const tokens = [];
  const re = /<\/?([a-zA-Z0-9]+)[^>]*>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[2] != null) tokens.push({ t: 'text', v: decode(m[2]) });
    else tokens.push({ t: m[0][1] === '/' ? 'close' : m[0].endsWith('/>') ? 'void' : 'open', tag: m[1].toLowerCase() });
  }
  return tokens;
}

export default function HtmlText({ html, style, color, size = 13.5 }) {
  const { c } = useTheme();
  const blocks = useMemo(() => {
    const src = String(html || '');
    if (!/<[a-z][\s\S]*>/i.test(src)) return [{ kind: 'p', runs: [{ text: decode(src), fmt: {} }] }];
    const out = [];
    let cur = { kind: 'p', runs: [] };
    const fmt = { b: 0, i: 0, u: 0, s: 0, code: 0 };
    const listStack = [];
    const flush = (kind = 'p', extra = {}) => {
      if (cur.runs.some((r) => r.text.trim())) out.push(cur);
      cur = { kind, runs: [], ...extra };
    };
    for (const tk of parse(src)) {
      if (tk.t === 'text') {
        const txt = cur.kind === 'pre' ? tk.v : tk.v.replace(/\s+/g, ' ');
        if (txt) cur.runs.push({ text: txt, fmt: { ...fmt } });
        continue;
      }
      const tag = tk.tag;
      const open = tk.t === 'open';
      if (tag === 'br') {
        cur.runs.push({ text: '\n', fmt: {} });
      } else if (['b', 'strong'].includes(tag)) fmt.b += open ? 1 : -1;
      else if (['i', 'em'].includes(tag)) fmt.i += open ? 1 : -1;
      else if (tag === 'u') fmt.u += open ? 1 : -1;
      else if (['s', 'strike', 'del'].includes(tag)) fmt.s += open ? 1 : -1;
      else if (tag === 'code') fmt.code += open ? 1 : -1;
      else if (tag === 'ul' || tag === 'ol') {
        if (open) listStack.push({ type: tag, n: 0 });
        else listStack.pop();
        flush();
      } else if (tag === 'li') {
        if (open) {
          const l = listStack[listStack.length - 1];
          if (l) l.n += 1;
          flush('li', { bullet: l?.type === 'ol' ? `${l.n}.` : '•', depth: Math.max(0, listStack.length - 1) });
        } else flush();
      } else if (tag === 'pre') {
        flush(open ? 'pre' : 'p');
      } else if (/^h[1-6]$/.test(tag)) {
        if (open) {
          flush('h');
          fmt.b += 1;
        } else {
          fmt.b -= 1;
          flush();
        }
      } else if (['p', 'div', 'tr', 'blockquote'].includes(tag)) {
        flush();
      }
    }
    flush();
    return out;
  }, [html]);

  const base = { color: color || c.text, fontSize: size, lineHeight: size * 1.5 };
  const runStyle = (f) => ({
    fontWeight: f.b > 0 ? '800' : undefined,
    fontStyle: f.i > 0 ? 'italic' : undefined,
    textDecorationLine: f.u > 0 && f.s > 0 ? 'underline line-through' : f.u > 0 ? 'underline' : f.s > 0 ? 'line-through' : undefined,
    fontFamily: f.code > 0 ? 'monospace' : undefined,
    backgroundColor: f.code > 0 ? c.bgAlt : undefined,
  });

  return (
    <View style={[{ gap: 6 }, style]}>
      {blocks.map((b, i) => {
        const runs = b.runs.map((r, j) => (
          <Text key={j} style={runStyle(r.fmt)}>
            {r.text}
          </Text>
        ));
        if (b.kind === 'li')
          return (
            <View key={i} style={{ flexDirection: 'row', gap: 6, paddingLeft: 6 + (b.depth || 0) * 14 }}>
              <Text style={[base, { color: c.textMuted }]}>{b.bullet}</Text>
              <Text style={[base, { flex: 1 }]}>{runs}</Text>
            </View>
          );
        if (b.kind === 'pre')
          return (
            <Text key={i} style={[base, { fontFamily: 'monospace', fontSize: size - 1.5, backgroundColor: c.bgAlt, padding: 10, borderRadius: 10 }]}>
              {runs}
            </Text>
          );
        if (b.kind === 'h')
          return (
            <Text key={i} style={[base, { fontSize: size + 2, fontWeight: '800' }]}>
              {runs}
            </Text>
          );
        return (
          <Text key={i} style={base}>
            {runs}
          </Text>
        );
      })}
    </View>
  );
}

/** Plain text -> safe HTML (used when posting comments from the app). */
export function textToHtml(text) {
  const esc = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return esc
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}
