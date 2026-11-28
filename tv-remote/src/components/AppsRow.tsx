import React from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { useStore, TvApp } from '../store';
import { colors } from '../theme';
import { driver } from './common';

// شعار التطبيق: صورة حقيقية، أو أيقونة، أو حرف (للتطبيقات التي يضيفها المستخدم)
export const AppLogo = ({ app, size = 66 }: { app: TvApp; size?: number }) => {
  const r = size * 0.24;
  if (app.logo) {
    return <Image source={app.logo} style={{ width: size, height: size, borderRadius: r }} />;
  }
  const inner = app.icon ? (
    <Ionicons name={app.icon as any} size={size * 0.55} color={app.fg} />
  ) : (
    <Text style={{ color: app.fg, fontWeight: '800', fontSize: size * 0.3, textAlign: 'center', lineHeight: size * 0.34 }}>
      {app.short ?? app.name.slice(0, 1).toUpperCase()}
    </Text>
  );
  const box = { width: size, height: size, borderRadius: r, alignItems: 'center' as const, justifyContent: 'center' as const, overflow: 'hidden' as const };
  return app.gradient ? (
    <LinearGradient colors={app.gradient as any} start={{ x: 0.1, y: 1 }} end={{ x: 0.9, y: 0 }} style={box}>{inner}</LinearGradient>
  ) : (
    <View style={[box, { backgroundColor: app.bg }]}>{inner}</View>
  );
};

export default function AppsRow() {
  const apps = useStore((s) => s.apps);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 12 }}>
      {apps.map((a) => (
        <Pressable key={a.id} onPress={() => driver.launchApp(a.id)} style={{ alignItems: 'center', width: 86 }}>
          <AppLogo app={a} />
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: '#fff', fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 4, lineHeight: 20 }}>
            {a.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
