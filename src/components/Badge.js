import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getStatusStyle } from '../theme/theme';

export default function Badge({ label, small }) {
  const { bg, fg } = getStatusStyle(label);
  return (
    <View style={[styles.pill, { backgroundColor: bg }, small && styles.pillSmall]}>
      <Text style={[styles.text, { color: fg }, small && styles.textSmall]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  pillSmall: { paddingHorizontal: 8, paddingVertical: 2 },
  text: { fontSize: 11, fontWeight: '700' },
  textSmall: { fontSize: 10 },
});
