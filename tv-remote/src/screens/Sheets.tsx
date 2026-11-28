import React, { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Text } from '../components/Text';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { useNav } from '../nav';
import { useStore } from '../store';
import { driver } from '../components/common';

// خلفية داكنة شبه معتمة مع زر إغلاق X أعلى اليسار، كما في الفيديو
function Sheet({ title, children }: { title?: string; children: React.ReactNode }) {
  const nav = useNav();
  return (
    <View style={{ flex: 1, backgroundColor: '#0d0d0fee' }}>
      <Pressable onPress={nav.pop} style={{ paddingTop: 64, paddingHorizontal: 20 }}>
        <Ionicons name="close" size={30} color="#ddd" />
      </Pressable>
      {title && <Text style={{ color: colors.text, fontSize: 24, paddingHorizontal: 22, marginTop: 22 }}>{title}</Text>}
      {children}
    </View>
  );
}

export function TvPickerSheet() {
  const addDevice = useStore((s) => s.addDevice);
  const devices = useStore((s) => s.devices);
  const [found, setFound] = useState(false);
  useEffect(() => driver.discover((d) => { addDevice(d); setFound(true); }), []);
  return (
    <Sheet title="التلفزيونات">
      <View style={{ marginTop: 50, alignItems: 'center', gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#e87a3d', opacity: found ? 1 : 0.4 + i * 0.25 }} />
          ))}
        </View>
      </View>
      <Text style={{ color: '#8d8d94', fontSize: 19, textAlign: 'right', paddingHorizontal: 24, marginTop: 50, lineHeight: 30 }}>
        يرجى التأكد من تشغيل التلفزيون الخاص بك والاتصال بنفس شبكة Wi-Fi.
      </Text>
      {devices.map((d) => (
        <Text key={d.id} style={{ color: colors.text, fontSize: 22, textAlign: 'right', paddingHorizontal: 24, marginTop: 26 }}>{d.name}</Text>
      ))}
    </Sheet>
  );
}

export function KeyboardSheet() {
  const [text, setText] = useState('');
  const prev = useRef('');
  const onChange = (t: string) => {
    if (t.length > prev.current.length) driver.sendText(t.slice(prev.current.length));
    else driver.sendKey('back');
    prev.current = t; setText(t);
  };
  return (
    <Sheet>
      <Text style={{ color: '#8d8d94', fontSize: 16, textAlign: 'right', paddingHorizontal: 24, marginTop: 40 }}>
        يتوقع البحث أن تكون لوحة مفاتيح التلفزيون مفتوحة بالفعل.
      </Text>
      <TextInput
        autoFocus value={text} onChangeText={onChange}
        placeholder="...ابدأ الطباعة" placeholderTextColor="#6b6b72"
        style={[{ color: colors.text, fontSize: 28, textAlign: 'right', paddingHorizontal: 24, marginTop: 60, fontFamily: 'Cairo_700Bold' }, { outlineStyle: 'none' } as any]}
      />
    </Sheet>
  );
}
