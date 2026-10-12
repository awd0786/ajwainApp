import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { makeStyles, radii, useTheme } from '../theme/theme';
import Sheet from './Sheet';
import { FieldLabel } from './Field';
import { SearchBar } from './Field';
import { Button } from './primitives';

/**
 * Searchable single / multi select that opens a bottom sheet.
 *
 *  options: [{ label, value, sub?, color?, disabled? }] or primitive strings
 *  value:   single -> any | multi -> array
 *  compact: renders as a pill (for filter bars)
 */
export default function Select({
  label,
  value,
  options = [],
  onChange,
  multi = false,
  placeholder = 'Select',
  searchable,
  disabled,
  required,
  compact,
  icon,
  clearable = true,
  allLabel,
  title,
  style,
  error,
  emptyText = 'No options',
  maxShown = 2,
}) {
  const s = useStyles();
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState([]);

  const opts = useMemo(
    () =>
      (options || []).map((o) =>
        o !== null && typeof o === 'object' ? { ...o, value: o.value, label: String(o.label ?? o.value ?? '') } : { label: String(o), value: o },
      ),
    [options],
  );
  const eq = (a, b) => String(a) === String(b);

  const selectedArr = multi ? (Array.isArray(value) ? value : []) : [];
  const display = useMemo(() => {
    if (multi) {
      if (!selectedArr.length) return '';
      const labels = selectedArr.map((v) => opts.find((o) => eq(o.value, v))?.label ?? String(v));
      if (labels.length <= maxShown) return labels.join(', ');
      return `${labels.slice(0, maxShown).join(', ')} +${labels.length - maxShown}`;
    }
    if (value === undefined || value === null || value === '') return '';
    return opts.find((o) => eq(o.value, value))?.label ?? String(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, opts, multi, selectedArr.join('|')]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return opts;
    return opts.filter((o) => o.label.toLowerCase().includes(t) || String(o.sub || '').toLowerCase().includes(t));
  }, [q, opts]);

  const showSearch = searchable ?? opts.length > 7;

  const openSheet = () => {
    if (disabled) return;
    setQ('');
    setDraft(selectedArr);
    setOpen(true);
  };

  const pick = (o) => {
    if (o.disabled) return;
    if (multi) {
      setDraft((d) => (d.some((x) => eq(x, o.value)) ? d.filter((x) => !eq(x, o.value)) : [...d, o.value]));
    } else {
      onChange?.(o.value, o);
      setOpen(false);
    }
  };

  const hasValue = multi ? selectedArr.length > 0 : !(value === undefined || value === null || value === '');

  const trigger = compact ? (
    <Pressable
      onPress={openSheet}
      style={({ pressed }) => [
        s.compact,
        hasValue && { borderColor: c.primary, backgroundColor: c.primarySoft },
        disabled && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {!!icon && <Feather name={icon} size={13} color={hasValue ? c.primary : c.textMuted} />}
      <Text style={[s.compactText, hasValue && { color: c.primary }]} numberOfLines={1}>
        {hasValue ? display : allLabel || label || placeholder}
      </Text>
      <Feather name="chevron-down" size={14} color={hasValue ? c.primary : c.textFaint} />
    </Pressable>
  ) : (
    <View style={style}>
      <FieldLabel label={label} required={required} />
      <Pressable
        onPress={openSheet}
        style={({ pressed }) => [s.field, !!error && { borderColor: c.danger }, disabled && { opacity: 0.55 }, pressed && { opacity: 0.85 }]}
      >
        {!!icon && <Feather name={icon} size={16} color={c.textFaint} />}
        <Text style={[s.fieldText, !hasValue && { color: c.textFaint }]} numberOfLines={1}>
          {hasValue ? display : allLabel || placeholder}
        </Text>
        {hasValue && clearable && !disabled ? (
          <Pressable hitSlop={10} onPress={() => onChange?.(multi ? [] : '', null)}>
            <Feather name="x" size={16} color={c.textFaint} />
          </Pressable>
        ) : (
          <Feather name="chevron-down" size={17} color={c.textFaint} />
        )}
      </Pressable>
      {!!error && typeof error === 'string' && <Text style={s.err}>{error}</Text>}
    </View>
  );

  return (
    <>
      {trigger}
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={title || label || placeholder}
        subtitle={multi ? `${draft.length} selected` : undefined}
        size={opts.length > 8 ? 'full' : 'auto'}
        scroll={false}
        contentStyle={{ padding: 0, gap: 0 }}
        footer={
          multi ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                title={draft.length === filtered.length && filtered.length ? 'Clear' : 'Select all'}
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() =>
                  setDraft(draft.length === filtered.length && filtered.length ? [] : filtered.filter((o) => !o.disabled).map((o) => o.value))
                }
              />
              <Button
                title="Apply"
                style={{ flex: 1.4 }}
                onPress={() => {
                  onChange?.(draft);
                  setOpen(false);
                }}
              />
            </View>
          ) : null
        }
      >
        {showSearch && (
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
            <SearchBar value={q} onChangeText={setQ} placeholder="Search options…" />
          </View>
        )}
        <FlatList
          data={!multi && allLabel ? [{ label: allLabel, value: '', __all: true }, ...filtered] : filtered}
          keyExtractor={(o, i) => `${String(o.value)}-${i}`}
          keyboardShouldPersistTaps="handled"
          style={opts.length > 8 ? { flex: 1 } : { maxHeight: 460 }}
          contentContainerStyle={{ paddingVertical: 6 }}
          ListEmptyComponent={<Text style={s.empty}>{emptyText}</Text>}
          renderItem={({ item: o }) => {
            const sel = multi ? draft.some((x) => eq(x, o.value)) : o.__all ? !hasValue : eq(o.value, value) && hasValue;
            return (
              <Pressable
                onPress={() => (o.__all ? (onChange?.('', null), setOpen(false)) : pick(o))}
                style={({ pressed }) => [s.opt, sel && { backgroundColor: c.primarySoft }, pressed && { opacity: 0.7 }, o.disabled && { opacity: 0.4 }]}
              >
                {multi ? (
                  <View style={[s.check, sel && { backgroundColor: c.primary, borderColor: c.primary }]}>
                    {sel && <Feather name="check" size={13} color="#fff" />}
                  </View>
                ) : (
                  !!o.color && <View style={[s.dot, { backgroundColor: o.color }]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[s.optText, sel && { color: c.primary, fontWeight: '800' }]}>{o.label}</Text>
                  {!!o.sub && <Text style={s.optSub}>{o.sub}</Text>}
                </View>
                {!multi && sel && <Feather name="check" size={17} color={c.primary} />}
              </Pressable>
            );
          }}
        />
      </Sheet>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 46,
    borderRadius: radii.md,
    borderWidth: 1.2,
    borderColor: c.border,
    backgroundColor: c.inputBg,
    paddingHorizontal: 12,
  },
  fieldText: { flex: 1, color: c.text, fontSize: 14, fontWeight: '500' },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    maxWidth: 230,
  },
  compactText: { fontSize: 12.5, fontWeight: '700', color: c.textMuted, flexShrink: 1 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 13 },
  optText: { fontSize: 14, color: c.text, fontWeight: '600' },
  optSub: { fontSize: 11.5, color: c.textMuted, marginTop: 2 },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.6, borderColor: c.borderStrong, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  empty: { textAlign: 'center', color: c.textFaint, padding: 30 },
  err: { color: c.danger, fontSize: 11.5, marginTop: 4, fontWeight: '600' },
}));
