import React from 'react';
import { Pressable, StyleProp, View, ViewStyle, Platform } from 'react-native';
import { Text } from './Text';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme';
import { useStore } from '../store';
import { tv } from '../tv/manager';
import { Key } from '../tv/driver';

export const driver = tv;

export function useSendKey() {
  const haptics = useStore((s) => s.haptics);
  return (k: Key) => {
    if (haptics && Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    driver.sendKey(k);
  };
}

export function KeyButton({
  children, onPress, style, round,
}: { children: React.ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; round?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: pressed ? colors.surfacePressed : colors.surface,
          alignItems: 'center', justifyContent: 'center',
          borderRadius: round ? 999 : 14,
        },
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Text style={{ color: colors.text, fontSize: 22 }}>{children}</Text>
      ) : children}
    </Pressable>
  );
}

export const Divider = () => <View style={{ height: 1, backgroundColor: colors.line }} />;
