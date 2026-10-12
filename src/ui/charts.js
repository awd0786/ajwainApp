import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { seriesColor, useTheme } from '../theme/theme';

/* =========================================================================
   Donut chart
   data: [{ label, value, color? }]
   ========================================================================= */
export function Donut({ data = [], size = 170, thickness = 24, centerLabel = 'Total', centerValue, onPressItem, showLegend = true, legendColumns = 2 }) {
  const { c } = useTheme();
  const [active, setActive] = useState(null);
  const items = data.filter((d) => Number(d.value) > 0).map((d, i) => ({ ...d, color: d.color || seriesColor(i) }));
  const total = items.reduce((a, b) => a + Number(b.value), 0);
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const activeItem = active != null ? items[active] : null;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.bgAlt} strokeWidth={thickness} fill="none" />
            {total > 0 &&
              items.map((d, i) => {
                const len = (Number(d.value) / total) * circ;
                const el = (
                  <Circle
                    key={i}
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    stroke={d.color}
                    strokeWidth={active === i ? thickness + 6 : thickness}
                    strokeDasharray={`${Math.max(0, len - 2)} ${circ}`}
                    strokeDashoffset={-offset}
                    fill="none"
                    strokeLinecap="butt"
                    onPress={() => setActive(active === i ? null : i)}
                  />
                );
                offset += len;
                return el;
              })}
          </G>
        </Svg>
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
          <Text style={{ fontSize: 24, fontWeight: '800', color: activeItem ? activeItem.color : c.text }}>
            {activeItem ? activeItem.value : centerValue ?? total}
          </Text>
          <Text style={{ fontSize: 11, color: c.textMuted, fontWeight: '700', maxWidth: size - thickness * 2 - 10, textAlign: 'center' }} numberOfLines={2}>
            {activeItem ? activeItem.label : centerLabel}
          </Text>
        </View>
      </View>
      {showLegend && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, alignSelf: 'stretch' }}>
          {items.map((d, i) => (
            <Pressable
              key={i}
              onPress={() => (onPressItem ? onPressItem(d) : setActive(active === i ? null : i))}
              style={{ width: `${100 / legendColumns}%`, flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 5, paddingRight: 6 }}
            >
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: d.color }} />
              <Text style={{ flex: 1, fontSize: 12, color: c.textMuted, fontWeight: active === i ? '800' : '600' }} numberOfLines={1}>
                {d.label}
              </Text>
              <Text style={{ fontSize: 12, color: c.text, fontWeight: '800' }}>{d.value}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

/* =========================================================================
   Horizontal bar list (ranking style)
   data: [{ label, value, color?, sub? }]
   ========================================================================= */
export function HBars({ data = [], max, onPressItem, showValue = true, limit, color, valueSuffix = '' }) {
  const { c } = useTheme();
  const items = limit ? data.slice(0, limit) : data;
  const m = max || Math.max(1, ...items.map((d) => Number(d.value) || 0));
  return (
    <View style={{ gap: 11 }}>
      {items.map((d, i) => {
        const col = d.color || color || seriesColor(i);
        const w = Math.max(2, ((Number(d.value) || 0) / m) * 100);
        return (
          <Pressable key={`${d.label}-${i}`} onPress={onPressItem ? () => onPressItem(d) : undefined} disabled={!onPressItem}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5, gap: 8 }}>
              <Text style={{ flex: 1, fontSize: 12.5, color: c.text, fontWeight: '600' }} numberOfLines={1}>
                {d.label}
              </Text>
              {showValue && (
                <Text style={{ fontSize: 12.5, color: c.text, fontWeight: '800' }}>
                  {d.value}
                  {valueSuffix}
                  {d.sub ? <Text style={{ color: c.textFaint, fontWeight: '600' }}>{`  ${d.sub}`}</Text> : null}
                </Text>
              )}
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: c.bgAlt, overflow: 'hidden' }}>
              <View style={{ width: `${w}%`, height: '100%', borderRadius: 4, backgroundColor: col }} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/* =========================================================================
   Vertical bar chart – single, grouped or stacked series.
   labels: ['A','B'] ; series: [{ name, color, values: [..] }]
   ========================================================================= */
export function Bars({ labels = [], series = [], height = 200, stacked = false, barWidth, onPressBar, showValues = true, labelWidth = 64 }) {
  const { c } = useTheme();
  const n = labels.length;
  const ser = series.map((s, i) => ({ ...s, color: s.color || seriesColor(i) }));
  const groupW = Math.max(labelWidth, (barWidth || (stacked ? 26 : 16)) * (stacked ? 1 : ser.length) + 18);
  const chartW = Math.max(groupW * n, 280);
  const totals = labels.map((_, li) => (stacked ? ser.reduce((a, s) => a + (Number(s.values[li]) || 0), 0) : Math.max(0, ...ser.map((s) => Number(s.values[li]) || 0))));
  const maxV = Math.max(1, ...totals);
  const topPad = 18;
  const plotH = height - topPad;
  const bw = barWidth || (stacked ? 26 : Math.min(22, (groupW - 18) / Math.max(1, ser.length)));

  const gridLines = [0.25, 0.5, 0.75, 1];

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <Svg width={chartW} height={height}>
            {gridLines.map((g) => (
              <Line key={g} x1={0} x2={chartW} y1={topPad + plotH * (1 - g)} y2={topPad + plotH * (1 - g)} stroke={c.border} strokeDasharray="3 4" strokeWidth={1} />
            ))}
            {labels.map((lab, li) => {
              const gx = li * groupW + (groupW - (stacked ? bw : bw * ser.length)) / 2;
              if (stacked) {
                let acc = 0;
                const total = totals[li];
                return (
                  <G key={li}>
                    {ser.map((s, si) => {
                      const v = Number(s.values[li]) || 0;
                      const h = (v / maxV) * plotH;
                      const y = topPad + plotH - acc - h;
                      acc += h;
                      if (!v) return null;
                      return <Rect key={si} x={gx} y={y} width={bw} height={h} fill={s.color} rx={si === ser.length - 1 ? 4 : 0} onPress={onPressBar ? () => onPressBar(li, si) : undefined} />;
                    })}
                    {showValues && total > 0 && (
                      <SvgText x={gx + bw / 2} y={topPad + plotH - (total / maxV) * plotH - 5} fontSize={10} fontWeight="700" fill={c.textMuted} textAnchor="middle">
                        {total}
                      </SvgText>
                    )}
                  </G>
                );
              }
              return (
                <G key={li}>
                  {ser.map((s, si) => {
                    const v = Number(s.values[li]) || 0;
                    const h = Math.max(v ? 2 : 0, (v / maxV) * plotH);
                    const x = gx + si * bw;
                    return (
                      <G key={si}>
                        <Rect x={x + 1} y={topPad + plotH - h} width={bw - 2} height={h} fill={s.color} rx={4} onPress={onPressBar ? () => onPressBar(li, si) : undefined} />
                        {showValues && v > 0 && (
                          <SvgText x={x + bw / 2} y={topPad + plotH - h - 4} fontSize={9.5} fontWeight="700" fill={c.textMuted} textAnchor="middle">
                            {v}
                          </SvgText>
                        )}
                      </G>
                    );
                  })}
                </G>
              );
            })}
          </Svg>
          <View style={{ flexDirection: 'row', width: chartW }}>
            {labels.map((lab, li) => (
              <Text key={li} style={{ width: groupW, textAlign: 'center', fontSize: 10, color: c.textMuted, fontWeight: '600', paddingHorizontal: 2 }} numberOfLines={2}>
                {lab}
              </Text>
            ))}
          </View>
        </View>
      </ScrollView>
      {ser.length > 1 && <Legend items={ser.map((s) => ({ label: s.name, color: s.color }))} style={{ marginTop: 10 }} />}
    </View>
  );
}

/* =========================================================================
   Line chart (multi series)
   ========================================================================= */
export function LineChart({ labels = [], series = [], height = 190, pointGap = 56 }) {
  const { c } = useTheme();
  const ser = series.map((s, i) => ({ ...s, color: s.color || seriesColor(i) }));
  const n = labels.length;
  const w = Math.max(300, n * pointGap);
  const pad = { l: 12, r: 16, t: 16, b: 8 };
  const plotW = w - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const maxV = Math.max(1, ...ser.flatMap((s) => s.values.map((v) => Number(v) || 0)));
  const x = (i) => pad.l + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v) => pad.t + plotH - ((Number(v) || 0) / maxV) * plotH;
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <Svg width={w} height={height}>
            {[0.25, 0.5, 0.75, 1].map((g) => (
              <Line key={g} x1={pad.l} x2={w - pad.r} y1={pad.t + plotH * (1 - g)} y2={pad.t + plotH * (1 - g)} stroke={c.border} strokeDasharray="3 4" />
            ))}
            {ser.map((s, si) => {
              const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
              const area = `M${x(0)},${pad.t + plotH} ` + s.values.map((v, i) => `L${x(i)},${y(v)}`).join(' ') + ` L${x(n - 1)},${pad.t + plotH} Z`;
              return (
                <G key={si}>
                  {ser.length === 1 && <Path d={area} fill={s.color} opacity={0.12} />}
                  <Polyline points={pts} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
                  {s.values.map((v, i) => (
                    <G key={i}>
                      <Circle cx={x(i)} cy={y(v)} r={3.5} fill={c.surface} stroke={s.color} strokeWidth={2} />
                      {ser.length === 1 && (
                        <SvgText x={x(i)} y={y(v) - 8} fontSize={9.5} fill={c.textMuted} fontWeight="700" textAnchor="middle">
                          {v}
                        </SvgText>
                      )}
                    </G>
                  ))}
                </G>
              );
            })}
          </Svg>
          <View style={{ flexDirection: 'row', width: w, paddingLeft: pad.l - pointGap / 2 + (n <= 1 ? plotW / 2 : 0) }}>
            {labels.map((l, i) => (
              <Text
                key={i}
                style={{ width: n <= 1 ? pointGap : plotW / Math.max(1, n - 1), textAlign: 'center', fontSize: 9.5, color: c.textMuted }}
                numberOfLines={1}
              >
                {l}
              </Text>
            ))}
          </View>
        </View>
      </ScrollView>
      {ser.length > 1 && <Legend items={ser.map((s) => ({ label: s.name, color: s.color }))} style={{ marginTop: 10 }} />}
    </View>
  );
}

/* =========================================================================
   Stacked single bar (segments of a whole)
   ========================================================================= */
export function SegmentBar({ segments = [], height = 10, style }) {
  const { c } = useTheme();
  const total = segments.reduce((a, s) => a + (Number(s.value) || 0), 0);
  return (
    <View style={[{ flexDirection: 'row', height, borderRadius: height, overflow: 'hidden', backgroundColor: c.bgAlt }, style]}>
      {total > 0 &&
        segments.map((s, i) =>
          Number(s.value) > 0 ? <View key={i} style={{ flex: Number(s.value), backgroundColor: s.color || seriesColor(i) }} /> : null,
        )}
    </View>
  );
}

export function Legend({ items = [], style }) {
  const { c } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, style]}>
      {items.map((it, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: it.color || seriesColor(i) }} />
          <Text style={{ fontSize: 11.5, color: c.textMuted, fontWeight: '600' }}>
            {it.label}
            {it.value != null ? `  ${it.value}` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Ring gauge for a single percentage. */
export function Ring({ value = 0, size = 64, thickness = 7, color, label }) {
  const { c } = useTheme();
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.bgAlt} strokeWidth={thickness} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color || c.primary}
            strokeWidth={thickness}
            fill="none"
            strokeDasharray={`${(v / 100) * circ} ${circ}`}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: size * 0.22, fontWeight: '800', color: c.text }}>{label ?? `${Math.round(v)}%`}</Text>
      </View>
    </View>
  );
}

export { useMemo };
