import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Sheet from './Sheet';
import { Button } from './primitives';
import { useTheme } from '../theme/theme';

/** Bottom sheet that hosts a page's filter controls with Apply / Clear. */
export default function FilterSheet({ visible, onClose, onApply, onClear, children, title = 'Filters', subtitle }) {
  const { c } = useTheme();
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon="sliders"
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {!!onClear && <Button title="Clear" icon="rotate-ccw" variant="secondary" style={{ flex: 1 }} onPress={onClear} />}
          <Button
            title="Apply"
            icon="check"
            style={{ flex: 1.4 }}
            onPress={() => {
              onApply?.();
              onClose?.();
            }}
          />
        </View>
      }
    >
      {children}
    </Sheet>
  );
}

/** Pill button that opens a FilterSheet, showing the active filter count. */
export function FilterButton({ count = 0, onPress, label = 'Filters' }) {
  const { c } = useTheme();
  const active = count > 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          height: 36,
          paddingHorizontal: 13,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: active ? c.primary : c.border,
          backgroundColor: active ? c.primary : c.surface,
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Feather name="sliders" size={14} color={active ? '#fff' : c.textMuted} />
      <Text style={{ fontSize: 12.5, fontWeight: '800', color: active ? '#fff' : c.textMuted }}>{label}</Text>
      {active && (
        <View style={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
          <Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '900' }}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}
