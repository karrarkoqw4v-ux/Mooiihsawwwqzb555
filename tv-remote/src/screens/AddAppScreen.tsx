import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/Text';
import { colors } from '../theme';
import { CATALOG, useStore } from '../store';
import { AppLogo } from '../components/AppsRow';
import { Screen, SectionTitle } from './ui';

const PALETTE = ['#6c5ce7', '#e5484d', '#0a7bff', '#09c58a', '#f47521', '#c13584'];

export default function AddAppScreen() {
  const apps = useStore((s) => s.apps);
  const addApp = useStore((s) => s.addApp);
  const [name, setName] = useState('');
  const [appId, setAppId] = useState('');
  const available = CATALOG.filter((c) => !apps.some((a) => a.id === c.id));

  const addCustom = () => {
    if (!name.trim()) return;
    const id = 'custom-' + Date.now();
    addApp({ id, name: name.trim(), bg: PALETTE[apps.length % PALETTE.length], fg: '#fff', custom: true, short: appId });
    setName(''); setAppId('');
  };

  return (
    <Screen title="إضافة تطبيق">
      <SectionTitle>تطبيقات مدعومة</SectionTitle>
      {available.length === 0 && (
        <Text style={{ color: colors.sub, textAlign: 'right', paddingHorizontal: 24, fontSize: 16 }}>كل التطبيقات المدعومة مضافة.</Text>
      )}
      {available.map((a) => (
        <View key={a.id} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingHorizontal: 20, height: 62, marginTop: 6, backgroundColor: colors.surface, marginHorizontal: 14, borderRadius: 12 }}>
          <AppLogo app={a} size={40} />
          <Text style={{ color: '#fff', fontSize: 19, fontWeight: '700', flex: 1, textAlign: 'right' }}>{a.name}</Text>
          <Pressable onPress={() => addApp(a)}><Ionicons name="add-circle" size={30} color={colors.blue} /></Pressable>
        </View>
      ))}

      <SectionTitle>تطبيق مخصص</SectionTitle>
      <View style={{ marginHorizontal: 14, gap: 10 }}>
        {[
          { v: name, s: setName, ph: 'اسم التطبيق' },
          { v: appId, s: setAppId, ph: 'معرّف التطبيق على التلفزيون (اختياري)' },
        ].map((f, i) => (
          <TextInput
            key={i} value={f.v} onChangeText={f.s} placeholder={f.ph} placeholderTextColor="#777"
            style={[{ color: '#fff', fontSize: 18, textAlign: 'right', backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 16, height: 52, fontFamily: 'Cairo_600SemiBold' }, { outlineStyle: 'none' } as any]}
          />
        ))}
        <Pressable onPress={addCustom} style={{ height: 52, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>إضافة</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
