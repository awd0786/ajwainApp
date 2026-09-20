import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated, Pressable, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radii, shadow } from '../theme/theme';

const { height: SCREEN_H } = Dimensions.get('window');

/**
 * actions: [{ key, label, icon, danger?, onPress }]
 */
export default function ActionSheet({ visible, title, subtitle, actions = [], onClose }) {
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : SCREEN_H,
      duration: visible ? 260 : 200,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <Pressable onPress={() => {}}>
            <View style={styles.handle} />
            {!!title && <Text style={styles.title}>{title}</Text>}
            {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

            {actions.map((a) => (
              <TouchableOpacity
                key={a.key}
                style={styles.actionRow}
                onPress={() => {
                  onClose();
                  a.onPress?.();
                }}
              >
                <Feather name={a.icon || 'chevron-right'} size={16} color={a.danger ? colors.red : colors.primary} />
                <Text style={[styles.actionLabel, a.danger && { color: colors.red }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}

            {actions.length === 0 && <Text style={styles.emptyText}>No actions available for this point.</Text>}

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,17,30,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: 18,
    paddingBottom: 30,
    ...shadow.modal,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
  subtitle: { fontSize: 12, color: colors.textFaint, marginBottom: 14 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  actionLabel: { fontSize: 14.5, color: colors.text, fontWeight: '500' },
  emptyText: { fontSize: 13, color: colors.textFaint, paddingVertical: 20, textAlign: 'center' },
  cancelBtn: { marginTop: 14, backgroundColor: colors.bg, borderRadius: radii.md, paddingVertical: 12, alignItems: 'center' },
  cancelText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
});
