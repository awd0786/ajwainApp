import React from 'react';
import { Pressable, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shadowFor, useTheme } from '../theme/theme';

/** Floating action button (bottom-right). */
export default function Fab({ icon = 'plus', label, onPress, color, style }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        { position: 'absolute', right: 18, bottom: 22 + insets.bottom, borderRadius: 20, ...shadowFor({ ...c, dark: false }, 3) },
        pressed && { transform: [{ scale: 0.96 }] },
        style,
      ]}
    >
      <LinearGradient
        colors={color ? [color, color] : [c.heroB, c.heroC]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ height: 56, minWidth: 56, borderRadius: 20, paddingHorizontal: label ? 20 : 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        <Feather name={icon} size={22} color="#fff" />
        {!!label && <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{label}</Text>}
      </LinearGradient>
    </Pressable>
  );
}
