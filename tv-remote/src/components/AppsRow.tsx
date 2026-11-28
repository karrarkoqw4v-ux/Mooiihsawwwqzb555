import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useStore, TvApp } from '../store';
import { colors } from '../theme';
import { driver } from './common';

export const AppLogo = ({ app, size = 62 }: { app: TvApp; size?: number }) => (
  <View
    style={{
      width: size, height: size, borderRadius: size * 0.24, backgroundColor: app.bg,
      alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2a2a2e',
    }}
  >
    <Text
      style={{
        color: app.fg, fontWeight: '800', textAlign: 'center',
        fontSize: app.short.length > 3 ? size * 0.22 : size * 0.38, lineHeight: size * 0.28 + (app.short.includes('\n') ? 0 : 6),
      }}
    >
      {app.short}
    </Text>
  </View>
);

export default function AppsRow() {
  const apps = useStore((s) => s.apps);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 14 }}>
      {apps.map((a) => (
        <Pressable key={a.id} onPress={() => driver.launchApp(a.id)} style={{ alignItems: 'center', width: 72 }}>
          <AppLogo app={a} />
          <Text numberOfLines={2} style={{ color: colors.text, fontSize: 13, textAlign: 'center', marginTop: 6 }}>
            {a.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
