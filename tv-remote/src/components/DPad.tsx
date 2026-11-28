import React, { useState } from 'react';
import { View, GestureResponderEvent } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { Key } from '../tv/driver';
import { useSendKey } from './common';

type Dir = 'up' | 'down' | 'left' | 'right' | 'ok';

// يحسب الاتجاه من مكان اللمس داخل الدائرة
function dirAt(x: number, y: number, size: number): Dir {
  const c = size / 2;
  const dx = x - c, dy = y - c;
  if (Math.hypot(dx, dy) < size * 0.19) return 'ok';
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

// قطاع (trapezoid) للاتجاه المضغوط: من الدائرة الداخلية إلى الحلقة الخارجية
function wedge(dir: Dir, size: number) {
  const c = size / 2, R = size / 2 - 3, r = size * 0.19;
  const a = (deg: number, rad: number) => [
    c + rad * Math.cos((deg * Math.PI) / 180),
    c + rad * Math.sin((deg * Math.PI) / 180),
  ];
  const mid = { right: 0, down: 90, left: 180, up: 270 }[dir as Exclude<Dir, 'ok'>];
  const [x1, y1] = a(mid - 45, r), [x2, y2] = a(mid + 45, r);
  const [x3, y3] = a(mid + 45, R), [x4, y4] = a(mid - 45, R);
  return `M${x1},${y1} L${x4},${y4} A${R},${R} 0 0 1 ${x3},${y3} L${x2},${y2} A${r},${r} 0 0 0 ${x1},${y1} Z`;
}

export default function DPad({ size = 250 }: { size?: number }) {
  const send = useSendKey();
  const [down, setDown] = useState<Dir | null>(null);
  const c = size / 2;

  const start = (e: GestureResponderEvent) => {
    const d = dirAt(e.nativeEvent.locationX, e.nativeEvent.locationY, size);
    setDown(d);
    send(d === 'ok' ? 'ok' : (d as Key));
  };
  const arrow = (name: any, style: object) => (
    <Ionicons name={name} size={22} color="#d8d8de" style={[{ position: 'absolute' }, style]} />
  );

  return (
    <View
      style={{ width: size, height: size }}
      onStartShouldSetResponder={() => true}
      onResponderGrant={start}
      onResponderRelease={() => setDown(null)}
      onResponderTerminate={() => setDown(null)}
    >
      <Svg width={size} height={size} pointerEvents="none">
        <Defs>
          <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.ringA} />
            <Stop offset="1" stopColor={colors.ringB} />
          </LinearGradient>
        </Defs>
        <Circle cx={c} cy={c} r={c - 3} fill="#1b1b1e" stroke="url(#ring)" strokeWidth={2} />
        {down && down !== 'ok' && <Path d={wedge(down, size)} fill="#76767c" opacity={0.85} />}
        <Circle
          cx={c} cy={c} r={size * 0.19}
          fill={down === 'ok' ? '#2a2a33' : '#1b1b1e'} stroke={colors.ringA} strokeWidth={1.5}
        />
      </Svg>
      {arrow('chevron-up', { top: size * 0.09, left: c - 11 })}
      {arrow('chevron-down', { bottom: size * 0.09, left: c - 11 })}
      {arrow('chevron-back', { left: size * 0.09, top: c - 11 })}
      {arrow('chevron-forward', { right: size * 0.09, top: c - 11 })}
    </View>
  );
}
