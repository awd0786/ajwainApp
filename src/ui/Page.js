import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/theme';

/**
 * Standard scrolling page body with pull-to-refresh.
 */
export default function Page({ children, refreshing = false, onRefresh, scroll = true, contentStyle, style, gap = 14, padded = true, header }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  if (!scroll) {
    return <View style={[{ flex: 1, backgroundColor: c.bg }, style]}>{children}</View>;
  }
  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: c.bg }, style]}
      contentContainerStyle={[{ padding: padded ? 16 : 0, gap, paddingBottom: 28 + insets.bottom }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      stickyHeaderIndices={header ? [0] : undefined}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} progressBackgroundColor={c.surface} /> : undefined
      }
    >
      {header ? <View style={{ backgroundColor: c.bg, marginHorizontal: -16, paddingHorizontal: 16, paddingBottom: 8, marginTop: -16, paddingTop: 12 }}>{header}</View> : null}
      {children}
    </ScrollView>
  );
}
