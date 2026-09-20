import React, { useEffect, useMemo, useRef } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radii, shadow, getStatusStyle } from '../theme/theme';
import { getPriorityStatus } from '../utils/format';

export default function StatusChartModal({ visible, onClose, filtered, sprintLabel, productLabel }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 6 }),
      ]).start();
    } else {
      opacity.setValue(0);
      scale.setValue(0.94);
    }
  }, [visible]);

  const statusData = useMemo(() => {
    const map = {};
    filtered.forEach((r) => {
      const s = getPriorityStatus(r);
      if (s && s !== '-') map[s] = (map[s] || 0) + 1;
    });
    return Object.entries(map)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [filtered]);

  const total = filtered.length;
  const maxCount = Math.max(...statusData.map((d) => d.count), 1);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.sheet, { opacity, transform: [{ scale }] }]}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Status Breakdown</Text>
              <Text style={styles.subtitle}>
                {sprintLabel || 'All Sprints'} · {productLabel || 'All Products'} · {total} records
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Feather name="x" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
            {statusData.map(({ status, count }) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const barW = Math.max(Math.round((count / maxCount) * 100), 6);
              const { dot } = getStatusStyle(status);
              return (
                <View key={status} style={styles.barRow}>
                  <Text style={styles.barLabel} numberOfLines={1}>
                    {status}
                  </Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${barW}%`, backgroundColor: dot }]}>
                      <Text style={styles.barCount}>{count}</Text>
                    </View>
                  </View>
                  <Text style={styles.barPct}>{pct}%</Text>
                </View>
              );
            })}

            {statusData.length === 0 && <Text style={styles.emptyText}>No data for the current filters.</Text>}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{total}</Text>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,17,30,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  sheet: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 18,
    ...shadow.modal,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 11, color: colors.textFaint, marginTop: 2 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  barLabel: { width: 92, fontSize: 11, color: colors.textMuted, fontWeight: '600', textAlign: 'right' },
  barTrack: { flex: 1, height: 20, borderRadius: 999, backgroundColor: colors.bg, overflow: 'hidden' },
  barFill: { height: 20, borderRadius: 999, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 8, minWidth: 26 },
  barCount: { fontSize: 10, fontWeight: '700', color: '#fff' },
  barPct: { width: 34, fontSize: 11, color: colors.textFaint, textAlign: 'right' },
  emptyText: { textAlign: 'center', color: colors.textFaint, paddingVertical: 24, fontSize: 13 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 4,
  },
  totalLabel: { fontSize: 12, fontWeight: '700', color: colors.text },
  totalValue: { fontSize: 12, fontWeight: '800', color: colors.text },
});
