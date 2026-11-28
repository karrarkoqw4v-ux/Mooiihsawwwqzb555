import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { useStore } from '../store';
import { useNav } from '../nav';
import AppsRow from '../components/AppsRow';
import DPad from '../components/DPad';
import NumPad from '../components/NumPad';
import BottomPanel from '../components/BottomPanel';
import { useSendKey } from '../components/common';

export function AdBanner() {
  return (
    <View style={{ height: 50, backgroundColor: colors.adBg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 10 }}>
      <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: '#e8e8ec', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="wifi" size={20} color="#222" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#fff', fontSize: 13 }}>Router Settings</Text>
        <Text style={{ color: colors.sub, fontSize: 10 }}>WiFi Router Settings App</Text>
      </View>
      <View style={{ backgroundColor: '#2f6bff', borderRadius: 14, paddingHorizontal: 34, paddingVertical: 6 }}>
        <Text style={{ color: '#fff', fontSize: 13 }}>تثبيت</Text>
      </View>
    </View>
  );
}

export default function RemoteScreen({ startPage = 1 }: { startPage?: number }) {
  const nav = useNav();
  const send = useSendKey();
  const device = useStore((s) => s.devices.find((d) => d.id === s.activeId));
  const [w, setW] = useState(0);
  const [page, setPage] = useState(startPage);
  const sv = useRef<ScrollView>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const nw = e.nativeEvent.layout.width;
    setW(nw);
  };
  const inited = useRef(false);
  const onSize = () => {
    if (!inited.current && w) { inited.current = true; sv.current?.scrollTo({ x: w * startPage, animated: false }); }
  };
  const toggle = () => {
    const np = page === 0 ? 1 : 0;
    sv.current?.scrollTo({ x: w * np, animated: true });
    setPage(np);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AdBanner />
      {/* الشريط العلوي: تشغيل / اسم الجهاز / إعدادات */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 60 }}>
        <Pressable onPress={() => send('power')}><Ionicons name="power" size={26} color={colors.red} /></Pressable>
        <Pressable onPress={() => nav.push('tvPicker')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="caret-down" size={12} color="#ddd" />
          <Text style={{ color: colors.text, fontSize: 20 }}>{device?.name ?? 'لا يوجد جهاز'}</Text>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.red, marginTop: -8 }} />
        </Pressable>
        <Pressable onPress={() => nav.push('settings')}><Ionicons name="settings-sharp" size={26} color="#cfcfd6" /></Pressable>
      </View>

      <View style={{ height: 118, marginTop: 4 }}><AppsRow /></View>

      {/* صفحتان: أرقام / أسهم */}
      <View style={{ flex: 1, justifyContent: 'center' }} onLayout={onLayout}>
        <ScrollView
          ref={sv} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => w && setPage(Math.round(e.nativeEvent.contentOffset.x / w))}
          style={{ flexGrow: 0 }} onContentSizeChange={onSize}
        >
          <View style={{ width: w, alignItems: 'center' }}><NumPad width={Math.min(290, w * 0.74)} /></View>
          <View style={{ width: w, alignItems: 'center' }}><DPad size={Math.min(250, w * 0.62)} /></View>
        </ScrollView>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 14 }}>
          {[0, 1].map((i) => (
            <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i === page ? '#ddd' : '#555' }} />
          ))}
        </View>
      </View>

      <View style={{ paddingBottom: 22 }}><BottomPanel onToggleNumpad={toggle} /></View>
    </View>
  );
}
