import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Text } from '../components/Text';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { colors } from '../theme';
import { useStore } from '../store';
import { useNav } from '../nav';
import { Divider } from '../components/common';
import { AppLogo } from '../components/AppsRow';
import { Row, Screen, SectionTitle, ToggleRow } from './ui';

export function SettingsScreen() {
  const nav = useNav();
  return (
    <Screen title="إعدادات">
      <SectionTitle>بعيد</SectionTitle>
      <Row title="التخطيط عن بعد" onPress={() => nav.push('remoteStyle')} />
      <Row title="السلوك عن بعد" onPress={() => nav.push('behavior')} />
      <Row title="إدارة التطبيقات" onPress={() => nav.push('manageApps')} />
      <Row title="الأجهزة المتصلة" onPress={() => nav.push('devices')} />
      <Divider />
      <SectionTitle>طلب</SectionTitle>
      <Row title="الأسئلة الشائعة" />
      <Row title="شارك مع الأصدقاء" icon="arrow-redo" />
      <Row title="معدل ومراجعة" icon="star" />
      <Row title="استجابة" icon="chatbox-ellipses" />
      <Row title="قانوني" />
      <Row title="تفعيل قسط" icon="ribbon-outline" />
    </Screen>
  );
}

function Card({ selected, title, desc, children, onPress }: any) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        marginHorizontal: 22, marginTop: 14, padding: 14, borderRadius: 16, backgroundColor: colors.surface,
        borderWidth: 1.5, borderColor: selected ? colors.blue : 'transparent', flexDirection: 'row-reverse', gap: 14,
      }}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: selected ? colors.blue : '#888', alignItems: 'center', justifyContent: 'center' }}>
            {selected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blue }} />}
          </View>
          <Text style={{ color: colors.text, fontSize: 20 }}>{title}</Text>
        </View>
        <Text style={{ color: colors.sub, fontSize: 15, textAlign: 'right', marginTop: 8, lineHeight: 22 }}>{desc}</Text>
      </View>
      {children}
    </Pressable>
  );
}

export function RemoteStyleScreen() {
  const mode = useStore((s) => s.controlMode);
  const set = useStore((s) => s.set);
  return (
    <Screen title="التخطيط عن بعد">
      <SectionTitle>ملاحة</SectionTitle>
      <Card selected={mode === 'touch'} title="لوحة اللمس" desc="انتقل بلوحة اللمس: القائمة، سريعة ومريحة." onPress={() => set({ controlMode: 'touch' })}>
        <View style={{ width: 84, height: 84, borderRadius: 14, backgroundColor: '#3a3a3e' }} />
      </Card>
      <Card selected={mode === 'dpad'} title="D-وسادة" desc="اضغط على التحكم القائم على التحكم، كما هو موجود في جهاز التحكم الأصلي." onPress={() => set({ controlMode: 'dpad' })}>
        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: '#3a3a3e', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#55555a' }} />
        </View>
      </Card>
      <SectionTitle>وصول سريع</SectionTitle>
      <Card selected title="التطبيقات" desc="افتح التطبيقات المثبتة على تلفزيونك بسهولة." />
    </Screen>
  );
}

export function BehaviorScreen() {
  const s = useStore();
  return (
    <Screen title="إعدادات">
      <SectionTitle>السلوك عن بعد</SectionTitle>
      <ToggleRow title="ردود الفعل اللمسية" desc="رد فعل اهتزاز خفيف عند الضغط على أزرار التحكم عن بعد." value={s.haptics} onChange={(v) => s.set({ haptics: v })} />
      <ToggleRow title="الضغط السلس" desc="حاول تقليد السلوك الطبيعي عن بعد عندما تضغط مع الاستمرار على مستوى الصوت والقناة ومفاتيح التنقل." value={s.holdRepeat} onChange={(v) => s.set({ holdRepeat: v })} />
      <ToggleRow title="إبقاء الشاشة مفتوحة" desc="ستظل شاشتك قيد التشغيل أثناء استخدام جهاز التحكم عن بعد، لذا لن تحتاج إلى الاستمرار في إلغاء قفلها." value={s.keepAwake} onChange={(v) => s.set({ keepAwake: v })} />
      <ToggleRow title="وضع المسرح" desc="يقوم بتعتيم الشاشة عند عدم استخدامها لتوفير الطاقة ومنع الإزعاج أثناء المشاهدة." value={s.theater} onChange={(v) => s.set({ theater: v })} />
    </Screen>
  );
}

export function ManageAppsScreen() {
  const apps = useStore((s) => s.apps);
  const remove = useStore((s) => s.removeApp);
  const move = useStore((s) => s.moveApp);
  const nav = useNav();
  return (
    <Screen title="إعدادات">
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginTop: 14 }}>
        <Text style={{ color: colors.sub, fontSize: 18 }}>إدارة التطبيقات</Text>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <Pressable onPress={() => nav.push('addApp')}><Ionicons name="add-circle" size={30} color={colors.blue} /></Pressable>
          <Ionicons name="ellipsis-vertical" size={20} color={colors.sub} />
        </View>
      </View>
      {apps.map((a, i) => (
        <View key={a.id} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingHorizontal: 20, height: 60, marginTop: 4, backgroundColor: colors.surface, marginHorizontal: 14, borderRadius: 12 }}>
          <Pressable onPress={() => remove(a.id)}><Ionicons name="close-circle" size={24} color={colors.red} /></Pressable>
          <AppLogo app={a} size={34} />
          <Text style={{ color: colors.text, fontSize: 19, flex: 1, textAlign: 'right' }}>{a.name}</Text>
          <Pressable onPress={() => move(i, Math.max(0, i - 1))}><MaterialIcons name="drag-handle" size={24} color={colors.sub} /></Pressable>
        </View>
      ))}
    </Screen>
  );
}

export function ConnectedDevicesScreen() {
  const device = useStore((s) => s.devices.find((d) => d.id === s.activeId));
  const rename = useStore((s) => s.renameDevice);
  const remove = useStore((s) => s.removeDevice);
  const nav = useNav();
  const [name, setName] = useState(device?.name ?? '');
  return (
    <Screen title="الأجهزة المتصلة" scroll={false}>
      <Text style={{ color: colors.sub, fontSize: 18, textAlign: 'center', marginTop: 24, letterSpacing: 2 }}>AI PONT</Text>
      <Text style={{ color: colors.text, fontSize: 22, textAlign: 'center', marginTop: 26 }}>لقب الجهاز</Text>
      <TextInput
        value={name} onChangeText={setName}
        style={{ color: colors.text, fontSize: 26, marginHorizontal: 50, marginTop: 40, borderBottomWidth: 2, borderBottomColor: colors.accent, paddingBottom: 6 }}
      />
      <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 24, marginTop: 34 }}>
        <Pressable
          onPress={() => { if (device) rename(device.id, name); nav.pop(); }}
          style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: '#fff', fontSize: 18 }}>تحديث</Text>
        </Pressable>
        <Pressable
          onPress={() => { if (device) remove(device.id); nav.pop(); }}
          style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: '#fff', fontSize: 18 }}>حذف</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
