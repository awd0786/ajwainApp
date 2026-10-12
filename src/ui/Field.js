import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { makeStyles, radii, useTheme } from '../theme/theme';

export function FieldLabel({ label, required, hint, right }) {
  const s = useStyles();
  if (!label) return null;
  return (
    <View style={s.labelRow}>
      <Text style={s.label} numberOfLines={2}>
        {label}
        {required ? <Text style={s.req}> *</Text> : null}
      </Text>
      {!!hint && <Text style={s.hint}>{hint}</Text>}
      {right}
    </View>
  );
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  numberOfLines = 4,
  keyboardType,
  required,
  error,
  maxLength,
  editable = true,
  icon,
  rightIcon,
  onRightPress,
  secure,
  style,
  inputStyle,
  autoCapitalize = 'sentences',
  showCount,
  onSubmitEditing,
  returnKeyType,
  autoFocus,
}) {
  const s = useStyles();
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secure);
  return (
    <View style={style}>
      <FieldLabel
        label={label}
        required={required}
        hint={showCount && maxLength ? `${String(value || '').length}/${maxLength}` : undefined}
      />
      <View
        style={[
          s.box,
          multiline && { alignItems: 'flex-start', minHeight: 22 * numberOfLines },
          focused && { borderColor: c.primary },
          !!error && { borderColor: c.danger },
          !editable && { opacity: 0.6 },
        ]}
      >
        {!!icon && <Feather name={icon} size={16} color={c.textFaint} style={multiline ? { marginTop: 12 } : null} />}
        <TextInput
          value={value == null ? '' : String(value)}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.textFaint}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : 1}
          keyboardType={keyboardType}
          maxLength={maxLength}
          editable={editable}
          secureTextEntry={hidden}
          autoCapitalize={autoCapitalize}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          autoFocus={autoFocus}
          style={[s.input, multiline && { textAlignVertical: 'top', paddingTop: 11, minHeight: 22 * numberOfLines }, inputStyle]}
        />
        {secure && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={8}>
            <Feather name={hidden ? 'eye' : 'eye-off'} size={16} color={c.textFaint} />
          </Pressable>
        )}
        {!!rightIcon && (
          <Pressable onPress={onRightPress} hitSlop={8} style={{ padding: 2 }}>
            <Feather name={rightIcon} size={17} color={c.primary} />
          </Pressable>
        )}
      </View>
      {!!error && typeof error === 'string' && <Text style={s.err}>{error}</Text>}
    </View>
  );
}

export function SearchBar({ value, onChangeText, placeholder = 'Search…', style, onSubmit, autoFocus }) {
  const s = useStyles();
  const { c } = useTheme();
  return (
    <View style={[s.search, style]}>
      <Feather name="search" size={16} color={c.textFaint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textFaint}
        style={s.searchInput}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        autoCorrect={false}
        autoCapitalize="none"
        autoFocus={autoFocus}
      />
      {!!value && (
        <Pressable onPress={() => onChangeText('')} hitSlop={8}>
          <Feather name="x-circle" size={16} color={c.textFaint} />
        </Pressable>
      )}
    </View>
  );
}

/** On/off switch row styled as a card toggle. */
export function ToggleRow({ label, value, onChange, description, disabled, color }) {
  const s = useStyles();
  const { c } = useTheme();
  const accent = color || c.primary;
  return (
    <Pressable onPress={disabled ? undefined : () => onChange(!value)} style={[s.toggleRow, disabled && { opacity: 0.5 }]}>
      <View style={{ flex: 1 }}>
        <Text style={s.toggleLabel}>{label}</Text>
        {!!description && <Text style={s.hint}>{description}</Text>}
      </View>
      <View style={[s.track, { backgroundColor: value ? accent : c.borderStrong }]}>
        <View style={[s.thumb, { transform: [{ translateX: value ? 18 : 0 }] }]} />
      </View>
    </Pressable>
  );
}

/** Square checkbox with label. */
export function Checkbox({ checked, onChange, label, disabled, color, size = 20 }) {
  const { c } = useTheme();
  const accent = color || c.primary;
  return (
    <Pressable
      onPress={disabled ? undefined : () => onChange?.(!checked)}
      hitSlop={6}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: disabled ? 0.45 : 1 }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 6,
          borderWidth: 1.6,
          borderColor: checked ? accent : c.borderStrong,
          backgroundColor: checked ? accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked && <Feather name="check" size={size - 6} color="#fff" />}
      </View>
      {!!label && <Text style={{ color: c.text, fontSize: 13.5, fontWeight: '600', flexShrink: 1 }}>{label}</Text>}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 },
  label: { flex: 1, fontSize: 11.5, fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  req: { color: c.danger },
  hint: { fontSize: 11, color: c.textFaint },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radii.md,
    borderWidth: 1.2,
    borderColor: c.border,
    backgroundColor: c.inputBg,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  input: { flex: 1, color: c.text, fontSize: 14, paddingVertical: 10 },
  err: { color: c.danger, fontSize: 11.5, marginTop: 4, fontWeight: '600' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, color: c.text, fontSize: 14, paddingVertical: 0 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.inputBg,
  },
  toggleLabel: { fontSize: 13.5, fontWeight: '700', color: c.text },
  track: { width: 44, height: 26, borderRadius: 13, padding: 3 },
  thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
}));
