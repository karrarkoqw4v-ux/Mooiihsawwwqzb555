import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, View, LayoutChangeEvent } from 'react-native';
import { Text } from '../components/Text';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { useStore } from '../store';
import { useNav } from '../nav';
import AppsRow from '../components/AppsRow';
import DPad from '../components/DPad';
import NumPad from '../components/NumPad';
import BottomPanel from '../components/BottomPanel';
import { useSendKey } from '../components/common';
import TouchPad from '../components/TouchPad';
import { TOP } from './ui';

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
  const conn = useStore((s) => s.conn);
  const mode = useStore((s) => s.controlMode);
  const [w, setW] = useState(0);
  const [h, setH] = useState(0);
  const [page, setPage] = useState(startPage);
  const sv = useRef<ScrollView>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const nw = e.nativeEvent.layout.width;
    setW(nw); setH(e.nativeEvent.layout.height);
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
      {/* الشريط العلوي: تشغيل | اسم الجهاز | إعدادات (الاسم في المنتصف بدون قص) */}
      <View style={{ height: 56, marginTop: TOP + 6, justifyContent: 'center' }}>
        <Pressable onPress={() => send('power')} style={{ position: 'absolute', left: 20, padding: 6 }}>
          <Ionicons name="power" size={26} color={colors.red} />
        </Pressable>
        <Pressable onPress={() => nav.push('tvPicker')} style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '58%' }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: conn === 'connected' ? colors.green : conn === 'connecting' ? '#f5a623' : colors.red }} />
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 20, fontWeight: '800', flexShrink: 1 }}>{device?.name ?? 'اتصال بالتلفاز'}</Text>
          <Ionicons name="caret-down" size={12} color="#ddd" />
        </Pressable>
        <Pressable accessibilityLabel="الإعدادات" onPress={() => nav.push('settings')} style={{ position: 'absolute', right: 20, padding: 6 }}>
          <Ionicons name="settings-sharp" size={26} color="#cfcfd6" />
        </Pressable>
      </View>

      <View style={{ height: 124, marginTop: 4 }}><AppsRow /></View>

      {/* صفحتان: أرقام / أسهم */}
      <View style={{ flex: 1, justifyContent: 'center' }} onLayout={onLayout}>
        {w > 0 && <ScrollView
          ref={sv} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => w && setPage(Math.round(e.nativeEvent.contentOffset.x / w))}
          style={{ flexGrow: 0 }} onContentSizeChange={onSize}
        >
          <View style={{ width: w, alignItems: 'center' }}><NumPad width={Math.max(150, Math.min(290, w * 0.74))} /></View>
          <View style={{ width: w, alignItems: 'center' }}>{mode === 'touch' ? <TouchPad size={Math.max(140, Math.min(290, w * 0.7, h - 56))} /> : <DPad size={Math.max(120, Math.min(250, w * 0.62, h - 56))} />}</View>
        </ScrollView>}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 14 }}>
          {[0, 1].map((i) => (
            <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i === page ? '#ddd' : '#555' }} />
          ))}
        </View>
      </View>

      <View style={{ paddingBottom: 28 }}><BottomPanel onToggleNumpad={toggle} /></View>
    </View>
  );
}
