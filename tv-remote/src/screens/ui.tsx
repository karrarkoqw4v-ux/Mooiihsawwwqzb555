import React from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { useNav } from '../nav';

// ترويسة شاشات الإعدادات: العنوان يمين وسهم الرجوع أقصى اليمين (RTL)
export function Screen({ title, children, scroll = true }: { title: string; children: React.ReactNode; scroll?: boolean }) {
  const nav = useNav();
  const Body: any = scroll ? ScrollView : View;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ height: 70, justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: 10 }}>
        <Pressable onPress={nav.pop} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
          <Ionicons name="arrow-forward" size={22} color={colors.text} />
          <Text style={{ color: colors.text, fontSize: 22 }}>{title}</Text>
        </Pressable>
      </View>
      <Body style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }}>{children}</Body>
    </View>
  );
}

export const SectionTitle = ({ children }: { children: string }) => (
  <Text style={{ color: colors.sub, fontSize: 17, textAlign: 'right', paddingHorizontal: 24, marginTop: 18, marginBottom: 8 }}>
    {children}
  </Text>
);

export function Row({ title, icon, onPress }: { title: string; icon?: any; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 24, height: 56 }}>
      <Text style={{ color: colors.text, fontSize: 20, flex: 1, textAlign: 'right' }}>{title}</Text>
      <Ionicons name={icon ?? 'chevron-back'} size={20} color={colors.sub} />
    </Pressable>
  );
}

export function ToggleRow({ title, desc, value, onChange }: { title: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row-reverse', paddingHorizontal: 24, paddingVertical: 12, gap: 14, alignItems: 'flex-start' }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 20, textAlign: 'right' }}>{title}</Text>
        <Text style={{ color: colors.sub, fontSize: 15, textAlign: 'right', marginTop: 4, lineHeight: 22 }}>{desc}</Text>
      </View>
      <Switch
        value={value} onValueChange={onChange}
        trackColor={{ true: colors.green, false: '#444' }} thumbColor="#fff"
      />
    </View>
  );
}
