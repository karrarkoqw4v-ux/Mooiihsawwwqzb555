import React, { useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { useSendKey } from './common';
import { Key } from '../tv/driver';

const STEP = 42; // كل 42 بكسل سحب = ضغطة اتجاه (مثل ريموت Apple TV)

// سطح لمس بنمط ريموت Apple TV: اسحب للتنقل، المس للاختيار
export default function TouchPad({ size = 270 }: { size?: number }) {
  const send = useSendKey();
  const sendRef = useRef(send); sendRef.current = send;
  const [hot, setHot] = useState<string | null>(null);
  const st = useRef({ x: 0, y: 0, moved: false });
  const flash = (k: string) => { setHot(k); setTimeout(() => setHot(null), 140); };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { st.current = { x: 0, y: 0, moved: false }; },
      onPanResponderMove: (_, g) => {
        const s = st.current;
        const dx = g.dx - s.x, dy = g.dy - s.y;
        if (Math.abs(dx) < STEP && Math.abs(dy) < STEP) return;
        const k: Key = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        sendRef.current(k); flash(k);
        s.x = g.dx; s.y = g.dy; s.moved = true;
      },
      onPanResponderRelease: (_, g) => {
        if (!st.current.moved && Math.hypot(g.dx, g.dy) < 12) { sendRef.current('ok'); flash('ok'); }
      },
    }),
  ).current;

  const arrow = (name: any, k: string, pos: object) => (
    <Ionicons name={name} size={26} color={hot === k ? '#fff' : '#6d6d72'} style={[{ position: 'absolute' }, pos]} />
  );
  return (
    <View {...pan.panHandlers} style={{ width: size, height: size }}>
      <LinearGradient
        colors={hot ? ['#3b3b40', '#26262a'] : ['#2c2c2f', '#1b1b1d']}
        start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
        style={{ flex: 1, borderRadius: size / 2, borderWidth: 1, borderColor: '#3a3a3f', alignItems: 'center', justifyContent: 'center' }}
      >
        {arrow('chevron-up', 'up', { top: 18, alignSelf: 'center' })}
        {arrow('chevron-down', 'down', { bottom: 18, alignSelf: 'center' })}
        {arrow('chevron-back', 'left', { left: 18 })}
        {arrow('chevron-forward', 'right', { right: 18 })}
        <View style={{ width: size * 0.3, height: size * 0.3, borderRadius: size * 0.15, backgroundColor: hot === 'ok' ? '#4a4a50' : '#232326', borderWidth: 1, borderColor: '#3a3a3f', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#9a9aa0', fontSize: 15, fontWeight: '700' }}>OK</Text>
        </View>
      </LinearGradient>
    </View>
  );
}
