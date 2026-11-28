import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, PermissionsAndroid, Platform, Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Text } from '../components/Text';
import { colors } from '../theme';
import { useStore } from '../store';
import { BtShare, PairedDevice } from '../../modules/bt-share';
import { Screen, SectionTitle } from './ui';

type Job = { id: number; name: string; size: number; uri?: string; text?: string; status: 'wait' | 'send' | 'done' | 'error'; sent: number; err?: string };

const fmt = (n: number) => (n >= 1e9 ? (n / 1e9).toFixed(2) + ' GB' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' MB' : n >= 1e3 ? Math.round(n / 1e3) + ' KB' : n + ' B');
const ICON: Record<string, any> = { computer: 'laptop-outline', phone: 'phone-portrait-outline', audio: 'headset-outline', other: 'bluetooth-outline' };
const webMock = Platform.OS === 'web' && typeof location !== 'undefined' && location.search.includes('mock=1');
const MOCK: PairedDevice[] = [
  { name: 'LAPTOP-RAYMOND', address: 'AA:BB:CC:00:11:22', kind: 'computer' },
  { name: 'Galaxy Buds', address: 'AA:BB:CC:00:11:33', kind: 'audio' },
];

const Btn = ({ icon, label, onPress, primary, disabled }: { icon: any; label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) => (
  <Pressable
    onPress={onPress} disabled={disabled}
    style={({ pressed }) => ({
      flex: 1, minWidth: 100, height: 84, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 6,
      backgroundColor: primary ? colors.accent : pressed ? colors.surfacePressed : colors.surface, opacity: disabled ? 0.5 : 1,
    })}
  >
    <Ionicons name={icon} size={28} color="#fff" />
    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{label}</Text>
  </Pressable>
);

export default function ShareScreen() {
  const pc = useStore((s) => s.pc);
  const set = useStore((s) => s.set);
  const [devices, setDevices] = useState<PairedDevice[]>([]);
  const [problem, setProblem] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [link, setLink] = useState('');
  const running = useRef(false);
  const nextId = useRef(1);
  const jobsRef = useRef<Job[]>([]); jobsRef.current = jobs;

  const load = useCallback(async () => {
    setProblem(''); setLoading(true);
    try {
      if (webMock) { setDevices(MOCK); return; }
      if (!BtShare || !BtShare.isAvailable()) { setProblem('هذه الميزة تعمل على أندرويد فقط، وجهازك لا يدعم البلوتوث.'); return; }
      if (Platform.OS === 'android' && Number(Platform.Version) >= 31) {
        const r = await PermissionsAndroid.request('android.permission.BLUETOOTH_CONNECT' as any);
        if (r !== PermissionsAndroid.RESULTS.GRANTED) { setProblem('اسمح للتطبيق بالوصول للبلوتوث ثم اضغط تحديث.'); return; }
      }
      if (!BtShare.isEnabled()) { setProblem('البلوتوث مطفي. شغّله ثم اضغط تحديث.'); return; }
      const list = await BtShare.getPairedDevices();
      list.sort((a, b) => (a.kind === 'computer' ? 0 : 1) - (b.kind === 'computer' ? 0 : 1));
      setDevices(list);
      if (list.length === 0) setProblem('ما في أجهزة مقترنة. اقترن بالكمبيوتر أول من إعدادات البلوتوث.');
    } catch (e: any) {
      setProblem('تعذر قراءة أجهزة البلوتوث: ' + (e?.message ?? ''));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // قائمة انتظار: ملف واحد في كل مرة
  const pump = useCallback(async () => {
    if (running.current || !pc) return;
    const job = jobsRef.current.find((j) => j.status === 'wait');
    if (!job) return;
    running.current = true;
    const upd = (p: Partial<Job>) => setJobs((js) => js.map((j) => (j.id === job.id ? { ...j, ...p } : j)));
    upd({ status: 'send', sent: 0 });
    const sub = BtShare?.addListener('progress', (e) => upd({ sent: e.sent }));
    try {
      if (webMock) { await new Promise((r) => setTimeout(r, 400)); }
      else if (job.text != null) await BtShare!.sendText(pc.address, job.name, job.text);
      else await BtShare!.sendFile(pc.address, job.uri!, job.name, job.size);
      upd({ status: 'done', sent: job.size });
    } catch (e: any) {
      upd({ status: 'error', err: e?.message ?? 'فشل الإرسال' });
    } finally {
      sub?.remove();
      running.current = false;
      setTimeout(pump, 50);
    }
  }, [pc]);

  const enqueue = (items: Omit<Job, 'id' | 'status' | 'sent'>[]) => {
    setJobs((js) => [...js, ...items.map((i) => ({ ...i, id: nextId.current++, status: 'wait' as const, sent: 0 }))]);
    setTimeout(pump, 30);
  };

  const pickFiles = async () => {
    const r = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: false, type: '*/*' });
    if (r.canceled) return;
    enqueue(r.assets.map((a) => ({ name: a.name, size: a.size ?? -1, uri: a.uri })));
  };
  const pickMedia = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, quality: 1 });
    if (r.canceled) return;
    enqueue(r.assets.map((a, i) => ({ name: a.fileName ?? `media-${Date.now()}-${i}.${a.type === 'video' ? 'mp4' : 'jpg'}`, size: a.fileSize ?? -1, uri: a.uri })));
  };
  const sendLink = () => {
    const u = link.trim();
    if (!u) return;
    enqueue([{ name: 'link.url', size: u.length, text: `[InternetShortcut]\r\nURL=${u}\r\n` }]);
    setLink('');
  };
  const viaSystem = async () => {
    const r = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: false, type: '*/*' });
    if (r.canceled) return;
    BtShare?.shareViaSystem(r.assets.map((a) => a.uri), '*/*');
  };

  // ---------- اختيار الكمبيوتر ----------
  if (!pc) {
    return (
      <Screen title="مشاركة الكمبيوتر">
        <Text style={{ color: colors.sub, fontSize: 16, textAlign: 'right', paddingHorizontal: 24, marginTop: 8 }}>
          اختر الكمبيوتر من الأجهزة المقترنة بالبلوتوث مع جوالك:
        </Text>
        {problem ? <Text style={{ color: '#f5a623', fontSize: 16, fontWeight: '700', textAlign: 'right', paddingHorizontal: 24, marginTop: 18 }}>{problem}</Text> : null}
        {devices.map((d) => (
          <Pressable key={d.address} onPress={() => set({ pc: { name: d.name, address: d.address } })}
            style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 14, marginHorizontal: 16, marginTop: 10, padding: 16, borderRadius: 16, backgroundColor: colors.surface }}>
            <Ionicons name={ICON[d.kind]} size={30} color={d.kind === 'computer' ? '#fff' : colors.sub} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 19, fontWeight: '700', textAlign: 'right' }}>{d.name}</Text>
              <Text style={{ color: colors.sub, fontSize: 13, textAlign: 'right' }}>{d.kind === 'computer' ? 'كمبيوتر' : 'جهاز بلوتوث'} · {d.address}</Text>
            </View>
            <Ionicons name="chevron-back" size={20} color={colors.sub} />
          </Pressable>
        ))}
        <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 20 }}>
          <Btn icon="refresh" label="تحديث" onPress={load} />
          <Btn icon="bluetooth" label="اقتران جهاز جديد" onPress={() => Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS').catch(() => Linking.openSettings())} />
        </View>
        {loading ? <Text style={{ color: colors.sub, textAlign: 'center', marginTop: 16 }}>جاري البحث…</Text> : null}
      </Screen>
    );
  }

  // ---------- الإرسال ----------
  return (
    <Screen title="مشاركة الكمبيوتر">
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 14, marginHorizontal: 16, marginTop: 6, padding: 16, borderRadius: 16, backgroundColor: colors.surface }}>
        <Ionicons name="laptop-outline" size={30} color="#fff" />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.sub, fontSize: 13, textAlign: 'right' }}>سيتم الإرسال إلى</Text>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'right' }}>{pc.name}</Text>
        </View>
        <Pressable onPress={() => set({ pc: null })}><Text style={{ color: colors.blue, fontSize: 15, fontWeight: '700' }}>تغيير</Text></Pressable>
      </View>

      <View style={{ marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: '#2a2316' }}>
        <Text style={{ color: '#f5c76b', fontSize: 14, fontWeight: '700', textAlign: 'right', lineHeight: 22 }}>
          على الكمبيوتر (ويندوز) افتح: إعدادات البلوتوث ← إرسال أو استقبال ملفات ← استقبال ملفات. وخلّي الشاشة مفتوحة لين يخلص الإرسال.
        </Text>
      </View>

      <SectionTitle>وش تبي ترسل؟</SectionTitle>
      <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16 }}>
        <Btn icon="document-outline" label="ملفات" onPress={pickFiles} primary />
        <Btn icon="images-outline" label="صور وفيديو" onPress={pickMedia} primary />
      </View>

      <View style={{ flexDirection: 'row-reverse', gap: 10, paddingHorizontal: 16, marginTop: 12, alignItems: 'center' }}>
        <TextInput
          value={link} onChangeText={setLink} placeholder="الصق رابط هنا" placeholderTextColor="#777" autoCapitalize="none" autoCorrect={false}
          style={[{ flex: 1, height: 52, borderRadius: 14, backgroundColor: colors.surface, color: '#fff', fontSize: 16, paddingHorizontal: 14, textAlign: 'right', fontFamily: 'Cairo_600SemiBold' }, { outlineStyle: 'none' } as any]}
        />
        <Pressable onPress={sendLink} style={{ height: 52, paddingHorizontal: 20, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>إرسال رابط</Text>
        </Pressable>
      </View>

      {jobs.length > 0 && <SectionTitle>الإرسال</SectionTitle>}
      {jobs.map((j) => {
        const pct = j.size > 0 ? Math.min(1, j.sent / j.size) : j.status === 'done' ? 1 : 0;
        return (
          <View key={j.id} style={{ marginHorizontal: 16, marginTop: 8, padding: 14, borderRadius: 14, backgroundColor: colors.surface }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
              <Ionicons name={j.status === 'done' ? 'checkmark-circle' : j.status === 'error' ? 'alert-circle' : 'time-outline'} size={24}
                color={j.status === 'done' ? colors.green : j.status === 'error' ? colors.red : colors.sub} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'right' }}>{j.name}</Text>
                <Text style={{ color: colors.sub, fontSize: 13, textAlign: 'right' }}>
                  {j.status === 'wait' ? 'بالانتظار' : j.status === 'send' ? `جاري الإرسال ${Math.round(pct * 100)}% · ${fmt(j.sent)}${j.size > 0 ? ' / ' + fmt(j.size) : ''}` : j.status === 'done' ? `تم الإرسال · ${j.size > 0 ? fmt(j.size) : ''}` : j.err}
                </Text>
              </View>
              {j.status === 'send' && <Pressable onPress={() => BtShare?.cancel()}><Ionicons name="close-circle" size={26} color={colors.red} /></Pressable>}
            </View>
            {j.status === 'send' && (
              <View style={{ height: 6, borderRadius: 3, backgroundColor: '#3a3a3e', marginTop: 10, overflow: 'hidden' }}>
                <View style={{ height: 6, width: `${pct * 100}%`, backgroundColor: colors.accent }} />
              </View>
            )}
          </View>
        );
      })}

      <Pressable onPress={viaSystem} style={{ marginTop: 22, alignItems: 'center', padding: 12 }}>
        <Text style={{ color: colors.sub, fontSize: 14, fontWeight: '700' }}>إذا ما اشتغل: إرسال عبر نافذة أندرويد</Text>
      </Pressable>
    </Screen>
  );
}
