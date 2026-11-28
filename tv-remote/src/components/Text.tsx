import React from 'react';
import { StyleSheet, Text as RNText, TextProps } from 'react-native';

// خط Cairo الثخين: أوضح للعربي. الوزن الافتراضي 600، والأوزان العالية 700/800.
export function fontFor(weight?: string | number) {
  const w = Number(weight ?? 600);
  if (w >= 800) return 'Cairo_800ExtraBold';
  if (w >= 700) return 'Cairo_700Bold';
  return 'Cairo_600SemiBold';
}

export function Text({ style, ...rest }: TextProps) {
  const f = StyleSheet.flatten(style) || {};
  return <RNText {...rest} style={[style, { fontFamily: fontFor(f.fontWeight as any), fontWeight: undefined }]} />;
}
