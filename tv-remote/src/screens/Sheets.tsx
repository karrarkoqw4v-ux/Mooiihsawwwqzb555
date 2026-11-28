import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Text } from '../components/Text';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { useNav } from '../nav';
import { useStore } from '../store';
import { driver } from '../components/common';
import { TOP } from './ui';
import { scanNetwork, scanDiag } from '../tv/scan';
import { TvDevice } from '../tv/driver';
import { Atv } from '../../modules/atv-remote';

// نص حقل الكتابة الحالي في التلفزيون (يصل مع حدث فتح لوحة المفاتيح)
export const kb = { text: '' };

// نافذة شفافة فوق الريموت (الخلفية الضبابية تضعها الشاشة الأم)، مع زر إغلاق X
function Sheet({ title, children }: { title?: string; children: React.ReactNode }) {
  const nav = useNav();
  return (
    <View style={{ flex: 1 }}>
      <Pressable onPress={nav.pop} hitSlop={16} style={{ paddingTop: TOP + 16, paddingHorizontal: 22, alignSelf: 'flex-start' }}>
        <Ionicons name="close" size={32} color="#eee" />
      </Pressable>
      {title && <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', paddingHorizontal: 22, marginTop: 14 }}>{title}</Text>}
      {children}
    </View>
  );
}

const BRAND: Record<string, string> = { roku: 'Roku', samsung: 'Samsung', lg: 'LG', androidtv: 'Android TV' };

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

  const connect = async (d: TvDevice) => {
    await driver.connect(d);
    const st = useStore.getState();
    if (st.conn === 'connected') nav.pop();
    else if (st.pairingFor) nav.replace('pair');
  };

  useEffect(() => {
    let cancelled = false;
    setScanning(true); setErr('');
    scanNetwork((d) => {
      addDevice(d);
      useStore.getState().updateDevice(d.id, { name: d.name, address: d.address, host: d.host });   // يحدّث الاسم والعنوان
      if (auto.current) { auto.current = false; connect(d); }   // أول تلفزيون يظهر يتصل تلقائياً
    }, () => cancelled)
      .catch(() => setErr('تأكد أن الجوال متصل بشبكة Wi-Fi'))
      .finally(() => !cancelled && setScanning(false));
    return () => { cancelled = true; };
  }, [round]);

  const status =
    err || (conn === 'connecting' ? 'جاري الاتصال…' : conn === 'error' ? 'تعذر الاتصال. جرّب مرة ثانية.'
      : scanning ? 'جاري البحث عن التلفزيونات في الشبكة…' : devices.length ? 'اختر تلفزيونك' : 'ما لقيت تلفزيون. تأكد أنه شغال وبنفس شبكة Wi-Fi.');

  return (
    <Sheet title="التلفزيونات">
      <View style={{ marginTop: 22 }}>
        {devices.map((d) => {
          const on = d.id === activeId && conn === 'connected';
          return (
            <Pressable key={d.id} onPress={() => connect(d)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 18, marginBottom: 12, padding: 16, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)' }}>
              {on
                ? <View style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.45)' }}><Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>متصل</Text></View>
                : <Ionicons name="chevron-back" size={22} color="#bbb" />}
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'right' }}>{d.name}</Text>
                <Text numberOfLines={1} style={{ color: '#d0d0d6', fontSize: 14, textAlign: 'right' }}>{d.address ?? d.host} · {BRAND[d.brand]}</Text>
              </View>
              <Ionicons name="tv-outline" size={34} color="#fff" />
            </Pressable>
          );
        })}
      </View>
      <View style={{ alignItems: 'center', height: 34, justifyContent: 'center', marginTop: 8 }}>
        {scanning || conn === 'connecting' ? <ActivityIndicator color="#fff" size="small" /> : null}
      </View>
      <Text style={{ color: '#c4c4cc', fontSize: 17, fontWeight: '600', textAlign: 'right', paddingHorizontal: 24, marginTop: 14 }}>{status}</Text>
      <Text style={{ color: '#9d9da5', fontSize: 14, fontWeight: '600', textAlign: 'right', paddingHorizontal: 24, marginTop: 6 }}>
        يرجى التأكد من تشغيل التلفزيون والاتصال بنفس شبكة Wi-Fi.
      </Text>
      {!scanning && devices.length === 0 && scanDiag.text ? (
        <Text selectable style={{ color: '#8a8a92', fontSize: 12, textAlign: 'right', paddingHorizontal: 24, marginTop: 10 }}>{scanDiag.text}</Text>
      ) : null}
      {!scanning && (
        <Pressable onPress={() => setRound((r) => r + 1)} style={{ margin: 24, height: 52, borderRadius: 16, backgroundColor: 'rgba(108,92,231,0.9)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>إعادة البحث</Text>
        </Pressable>
      )}
    </Sheet>
  );
}

// اقتران Android TV: يظهر رمز من 6 خانات على التلفزيون ونكتبه هنا (مرة واحدة فقط)
export function PairSheet() {
  const nav = useNav();
  const id = useStore((s) => s.pairingFor);
  const dev = useStore((s) => s.devices.find((d) => d.id === id));
  const [step, setStep] = useState<'start' | 'code' | 'finish'>('start');
  const [msg, setMsg] = useState('');
  const [code, setCode] = useState('');
  const dead = useRef(false);

  const start = async (note = '') => {
    if (!dev || !Atv) return;
    setStep('start'); setMsg(note); setCode('');
    try { await Atv.pairStart(dev.host); if (!dead.current) setStep('code'); }
    catch (e: any) { if (!dead.current) setMsg(e?.message ?? 'تعذر بدء الاقتران'); }
  };
  useEffect(() => { start(); return () => { dead.current = true; }; }, []);

  const submit = async (c: string) => {
    if (!dev || !Atv) return;
    setStep('finish');
    try {
      await Atv.pairFinish(c);
      useStore.getState().updateDevice(dev.id, { token: 'paired' });
      useStore.setState({ pairingFor: null });
      await driver.connect({ ...dev, token: 'paired' });
      nav.pop();
    } catch (e: any) {
      start(e?.code === 'BAD_CODE' ? 'الرمز غير صحيح. طلعنا رمز جديد على التلفزيون، اكتبه.' : (e?.message ?? 'فشل الاقتران') + ' — طلعنا رمز جديد.');
    }
  };

  return (
    <Sheet title="اقتران التلفزيون">
      <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'right', paddingHorizontal: 24, marginTop: 26 }}>{dev?.name}</Text>
      {step === 'start' && (
        <View style={{ alignItems: 'center', marginTop: 40 }}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={{ color: '#d0d0d6', fontSize: 17, fontWeight: '600', marginTop: 16 }}>جاري طلب رمز الاقتران من التلفزيون…</Text>
        </View>
      )}
      {step !== 'start' && (
        <>
          <Text style={{ color: '#d0d0d6', fontSize: 17, fontWeight: '600', textAlign: 'right', paddingHorizontal: 24, marginTop: 14, lineHeight: 28 }}>
            طلع على شاشة التلفزيون رمز من 6 خانات (أرقام وحروف A إلى F). اكتبه هنا:
          </Text>
          <TextInput
            value={code} onChangeText={(t) => { const c = t.replace(/[^0-9a-fA-F]/g, '').toUpperCase().slice(0, 6); setCode(c); if (c.length === 6) submit(c); }}
            autoFocus maxLength={6} autoCapitalize="characters" autoCorrect={false} editable={step === 'code'}
            placeholder="______" placeholderTextColor="#666"
            style={[{ color: '#fff', fontSize: 44, letterSpacing: 10, textAlign: 'center', marginTop: 30, fontFamily: 'Cairo_800ExtraBold' }, { outlineStyle: 'none' } as any]}
          />
          {step === 'finish' && <ActivityIndicator color="#fff" style={{ marginTop: 14 }} />}
        </>
      )}
      {msg ? <Text style={{ color: '#f5a623', fontSize: 16, fontWeight: '700', textAlign: 'right', paddingHorizontal: 24, marginTop: 20 }}>{msg}</Text> : null}
    </Sheet>
  );
}

export function KeyboardSheet() {
  const [text, setText] = useState(kb.text);
  const prev = useRef(kb.text);
  const onChange = (t: string) => {
    if (t.length > prev.current.length) driver.sendText(t.slice(prev.current.length));
    else for (let i = 0; i < prev.current.length - t.length; i++) driver.sendKey('del');
    prev.current = t; setText(t);
  };
  return (
    <Sheet>
      <Text style={{ color: '#c4c4cc', fontSize: 16, fontWeight: '600', textAlign: 'right', paddingHorizontal: 24, marginTop: 40 }}>
        اكتب هنا وينرسل مباشرة لحقل البحث في التلفزيون.
      </Text>
      <TextInput
        autoFocus value={text} onChangeText={onChange}
        placeholder="...ابدأ الطباعة" placeholderTextColor="#8a8a92"
        style={[{ color: '#fff', fontSize: 30, textAlign: 'right', paddingHorizontal: 24, marginTop: 40, fontFamily: 'Cairo_700Bold' }, { outlineStyle: 'none' } as any]}
      />
    </Sheet>
  );
}
