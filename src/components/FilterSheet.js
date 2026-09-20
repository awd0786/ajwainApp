import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Animated,
  Dimensions,
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radii, shadow } from '../theme/theme';

const { height: SCREEN_H } = Dimensions.get('window');

/**
 * A single reusable "select" control used for Group / Product / Sprint /
 * Client / Status filters. Tapping the trigger opens a searchable sheet
 * that slides up from the bottom. Supports single or multi select.
 *
 * options: [{ label, value, count? }]
 */
export default function FilterSheet({
  label,
  placeholder = 'Select',
  options,
  value,
  onChange,
  multi = false,
  accent = colors.primary,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const selectedValues = multi ? (Array.isArray(value) ? value : []) : value ? [value] : [];

  const openSheet = () => {
    if (disabled) return;
    setOpen(true);
    setQuery('');
  };

  useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [open]);

  const closeSheet = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setOpen(false));
  };

  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));

  const toggle = (val) => {
    if (multi) {
      const next = selectedValues.includes(val)
        ? selectedValues.filter((v) => v !== val)
        : [...selectedValues, val];
      onChange(next);
    } else {
      onChange(val === value ? '' : val);
      closeSheet();
    }
  };

  const clearAll = () => {
    onChange(multi ? [] : '');
    if (!multi) closeSheet();
  };

  const displayText =
    selectedValues.length === 0
      ? placeholder
      : selectedValues.length === 1
      ? options.find((o) => o.value === selectedValues[0])?.label || selectedValues[0]
      : `${selectedValues.length} selected`;

  return (
    <>
      <TouchableOpacity
        onPress={openSheet}
        activeOpacity={0.7}
        disabled={disabled}
        style={[styles.trigger, disabled && styles.triggerDisabled]}
      >
        <Text numberOfLines={1} style={[styles.triggerText, selectedValues.length > 0 && { color: colors.text, fontWeight: '600' }]}>
          {displayText}
        </Text>
        <Feather name="chevron-down" size={14} color={colors.textFaint} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="none" onRequestClose={closeSheet}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
        </Animated.View>
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.sheetHeader}>
            <View style={[styles.sheetHandle]} />
            <View style={styles.sheetTitleRow}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <TouchableOpacity onPress={closeSheet} hitSlop={10}>
                <Feather name="x" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.searchBox}>
              <Feather name="search" size={14} color={colors.textFaint} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={`Search ${label.toLowerCase()}`}
                placeholderTextColor={colors.textFaint}
                style={styles.searchInput}
              />
            </View>
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.value)}
            style={{ maxHeight: SCREEN_H * 0.5 }}
            ListHeaderComponent={
              <TouchableOpacity style={styles.optionRow} onPress={clearAll}>
                <Text style={[styles.optionLabel, selectedValues.length === 0 && { color: accent, fontWeight: '700' }]}>
                  {multi ? 'All' : placeholder}
                </Text>
              </TouchableOpacity>
            }
            renderItem={({ item }) => {
              const isSelected = selectedValues.includes(item.value);
              return (
                <TouchableOpacity style={styles.optionRow} onPress={() => toggle(item.value)}>
                  {multi && (
                    <View style={[styles.checkbox, isSelected && { backgroundColor: accent, borderColor: accent }]}>
                      {isSelected && <Feather name="check" size={12} color="#fff" />}
                    </View>
                  )}
                  <Text
                    style={[styles.optionLabel, isSelected && { color: accent, fontWeight: '700' }]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                  {item.count != null && (
                    <View style={[styles.countPill, isSelected && { backgroundColor: accent + '22' }]}>
                      <Text style={[styles.countText, isSelected && { color: accent }]}>{item.count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={styles.emptyText}>No results found</Text>}
          />
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minWidth: 120,
  },
  triggerDisabled: { opacity: 0.5 },
  triggerText: { fontSize: 12.5, color: colors.textFaint, flexShrink: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,17,30,0.45)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingBottom: 24,
    ...shadow.modal,
  },
  sheetHeader: { paddingHorizontal: 18, paddingTop: 10 },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 10,
  },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.text, padding: 0 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionLabel: { flex: 1, fontSize: 14, color: colors.text },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPill: { backgroundColor: colors.slateSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  countText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  emptyText: { textAlign: 'center', color: colors.textFaint, padding: 20, fontSize: 13 },
});
