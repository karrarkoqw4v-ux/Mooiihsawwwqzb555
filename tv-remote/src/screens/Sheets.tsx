import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Text } from '../components/Text';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { useNav } from '../nav';
import { useStore } from '../store';
import { driver } from '../components/common';
import { TOP } from './ui';
import { scanNetwork } from '../tv/scan';
import { TvDevice } from '../tv/driver';

// خلفية داكنة شبه معتمة مع زر إغلاق X أعلى اليسار، كما في الفيديو
function Sheet({ title, children }: { title?: string; children: React.ReactNode }) {
  const nav = useNav();
  return (
    <View style={{ flex: 1, backgroundColor: '#0d0d0fee' }}>
      <Pressable onPress={nav.pop} style={{ paddingTop: TOP + 16, paddingHorizontal: 20 }}>
        <Ionicons name="close" size={30} color="#ddd" />
      </Pressable>
      {title && <Text style={{ color: colors.text, fontSize: 24, paddingHorizontal: 22, marginTop: 22 }}>{title}</Text>}
      {children}
    </View>
  );
}

const BRAND: Record<string, string> = { roku: 'Roku', samsung: 'Samsung', lg: 'LG' };

export function TvPickerSheet() {
  const nav = useNav();
  const devices = useStore((s) => s.devices);
  const conn = useStore((s) => s.conn);
  const activeId = useStore((s) => s.activeId);
  const addDevice = useStore((s) => s.addDevice);
  const [scanning, setScanning] = useState(true);
  const [err, setErr] = useState('');
  const [round, setRound] = useState(0);
  const auto = useRef(conn !== 'connected');

  const connect = async (d: TvDevice) => { await driver.connect(d); if (useStore.getState().conn === 'connected') nav.pop(); };

  useEffect(() => {
    let cancelled = false;
    setScanning(true); setErr('');
    scanNetwork((d) => {
      addDevice(d);
      if (auto.current) { auto.current = false; connect(d); }   // أول تلفزيون يظهر يتصل تلقائياً
    }, () => cancelled)
      .catch(() => setErr('تأكد أن الجوال متصل بشبكة Wi-Fi'))
      .finally(() => !cancelled && setScanning(false));
    return () => { cancelled = true; };
  }, [round]);

  return (
    <Sheet title="التلفزيونات">
      <View style={{ marginTop: 36, alignItems: 'center', height: 30, justifyContent: 'center' }}>
        {scanning || conn === 'connecting' ? <ActivityIndicator color="#e87a3d" size="large" /> : null}
      </View>
      <Text style={{ color: '#b0b0b8', fontSize: 18, fontWeight: '600', textAlign: 'right', paddingHorizontal: 24, marginTop: 24, lineHeight: 28 }}>
        {err || (conn === 'connecting' ? 'جاري الاتصال… وافق على الطلب في التلفزيون إذا ظهر.' : conn === 'error' ? 'تعذر الاتصال. جرّب مرة ثانية.' : scanning ? 'جاري البحث عن التلفزيونات في الشبكة…' : devices.length ? 'اختر تلفزيونك' : 'ما لقيت تلفزيون. تأكد أنه شغال وبنفس شبكة Wi-Fi.')}
      </Text>
      {devices.map((d) => (
        <Pressable key={d.id} onPress={() => connect(d)} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingHorizontal: 24, height: 64 }}>
          <Ionicons name="tv-outline" size={26} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'right' }}>{d.name}</Text>
            <Text style={{ color: '#8d8d94', fontSize: 14, textAlign: 'right' }}>{BRAND[d.brand]} · {d.host}</Text>
          </View>
          {d.id === activeId && conn === 'connected' && <Ionicons name="checkmark-circle" size={24} color="#34c759" />}
        </Pressable>
      ))}
      {!scanning && (
        <Pressable onPress={() => setRound((r) => r + 1)} style={{ margin: 24, height: 52, borderRadius: 14, backgroundColor: '#6c5ce7', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>إعادة البحث</Text>
        </Pressable>
      )}
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
