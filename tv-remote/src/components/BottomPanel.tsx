import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { KeyButton, useSendKey } from './common';
import { colors } from '../theme';
import { useNav } from '../nav';

const Rocker = ({ label, plus, minus }: { label: string; plus: () => void; minus: () => void }) => (
  <View
    style={{
      width: 62, height: 190, borderRadius: 31, backgroundColor: colors.surface,
      alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6,
    }}
  >
    <KeyButton round style={{ width: 52, height: 52, backgroundColor: 'transparent' }} onPress={plus}>
      {label === 'VOL' ? <Ionicons name="add" size={24} color="#ddd" /> : <Ionicons name="chevron-up" size={22} color="#ddd" />}
    </KeyButton>
    <Text style={{ color: colors.text, fontSize: 15, letterSpacing: 0.5 }}>{label}</Text>
    <KeyButton round style={{ width: 52, height: 52, backgroundColor: 'transparent' }} onPress={minus}>
      {label === 'VOL' ? <Ionicons name="remove" size={24} color="#ddd" /> : <Ionicons name="chevron-down" size={22} color="#ddd" />}
    </KeyButton>
  </View>
);

export default function BottomPanel({ onToggleNumpad }: { onToggleNumpad: () => void }) {
  const send = useSendKey();
  const nav = useNav();
  const B = ({ children, onPress }: { children: React.ReactNode; onPress: () => void }) => (
    <KeyButton round style={{ width: 62, height: 62 }} onPress={onPress}>{children}</KeyButton>
  );
  const ic = (n: any) => <Ionicons name={n} size={26} color="#ddd" />;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18 }}>
      <Rocker label="CH" plus={() => send('ch_up')} minus={() => send('ch_down')} />
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <B onPress={onToggleNumpad}><MaterialCommunityIcons name="dots-grid" size={28} color="#ddd" /></B>
          <B onPress={() => send('home')}>{ic('home-outline')}</B>
          <B onPress={() => nav.push('keyboard')}><MaterialCommunityIcons name="keyboard-outline" size={28} color="#ddd" /></B>
        </View>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <B onPress={() => send('back')}>{ic('arrow-undo-outline')}</B>
          <B onPress={() => {}}>{ic('mic')}</B>
          <B onPress={() => send('mute')}>{ic('volume-mute-outline')}</B>
        </View>
      </View>
      <Rocker label="VOL" plus={() => send('vol_up')} minus={() => send('vol_down')} />
    </View>
  );
}
