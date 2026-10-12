import React, { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { makeStyles, radii, useTheme } from '../theme/theme';
import { FieldLabel } from './Field';
import Sheet from './Sheet';
import { Button } from './primitives';
import { toYMD, toYMDHM, parseAnyDate, fmtDate, fmtDateTime } from '../utils/format';

/**
 * Date (or date-time) picker field.
 *   value: 'YYYY-MM-DD' | 'YYYY-MM-DDTHH:mm' | Date | null
 *   onChange(str) -> 'YYYY-MM-DD' (date) or 'YYYY-MM-DDTHH:mm' (datetime)
 */
export default function DateField({
  label,
  value,
  onChange,
  mode = 'date',
  minimumDate,
  maximumDate,
  placeholder = 'Select date',
  required,
  disabled,
  clearable = true,
  compact,
  style,
  error,
}) {
  const s = useStyles();
  const { c, dark } = useTheme();
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState(new Date());

  const current = parseAnyDate(value);
  const minD = parseAnyDate(minimumDate) || undefined;
  const maxD = parseAnyDate(maximumDate) || undefined;
  const out = (d) => (mode === 'datetime' ? toYMDHM(d) : toYMD(d));

  const open = () => {
    if (disabled) return;
    const base = current || new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: base,
        mode: 'date',
        minimumDate: minD,
        maximumDate: maxD,
        onChange: (ev, d) => {
          if (ev.type !== 'set' || !d) return;
          if (mode === 'datetime') {
            DateTimePickerAndroid.open({
              value: d,
              mode: 'time',
              is24Hour: true,
              onChange: (ev2, t) => {
                if (ev2.type !== 'set' || !t) return;
                const merged = new Date(d);
                merged.setHours(t.getHours(), t.getMinutes(), 0, 0);
                onChange?.(out(merged));
              },
            });
          } else {
            onChange?.(out(d));
          }
        },
      });
    } else {
      setDraft(base);
      setIosOpen(true);
    }
  };

  const display = current ? (mode === 'datetime' ? fmtDateTime(current) : fmtDate(current)) : '';

  return (
    <View style={style}>
      {!compact && <FieldLabel label={label} required={required} />}
      <Pressable
        onPress={open}
        style={({ pressed }) => [
          compact ? s.compact : s.field,
          compact && current && { borderColor: c.primary, backgroundColor: c.primarySoft },
          !!error && { borderColor: c.danger },
          disabled && { opacity: 0.55 },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Feather name="calendar" size={compact ? 13 : 16} color={current ? c.primary : c.textFaint} />
        <Text style={[compact ? s.compactText : s.text, !current && { color: compact ? c.textMuted : c.textFaint }, compact && current && { color: c.primary }]} numberOfLines={1}>
          {display || (compact ? label || placeholder : placeholder)}
        </Text>
        {current && clearable && !disabled ? (
          <Pressable hitSlop={10} onPress={() => onChange?.('')}>
            <Feather name="x" size={compact ? 13 : 16} color={c.textFaint} />
          </Pressable>
        ) : null}
      </Pressable>
      {!!error && typeof error === 'string' && <Text style={s.err}>{error}</Text>}

      {Platform.OS === 'ios' && (
        <Sheet
          visible={iosOpen}
          onClose={() => setIosOpen(false)}
          title={label || 'Select date'}
          footer={
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setIosOpen(false)} />
              <Button
                title="Done"
                style={{ flex: 1.4 }}
                onPress={() => {
                  onChange?.(out(draft));
                  setIosOpen(false);
                }}
              />
            </View>
          }
        >
          <DateTimePicker
            value={draft}
            mode={mode}
            display="inline"
            themeVariant={dark ? 'dark' : 'light'}
            accentColor={c.primary}
            minimumDate={minD}
            maximumDate={maxD}
            onChange={(_, d) => d && setDraft(d)}
          />
        </Sheet>
      )}
    </View>
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
  text: { flex: 1, color: c.text, fontSize: 14, fontWeight: '500' },
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
  },
  compactText: { fontSize: 12.5, fontWeight: '700', color: c.text },
  err: { color: c.danger, fontSize: 11.5, marginTop: 4, fontWeight: '600' },
}));
