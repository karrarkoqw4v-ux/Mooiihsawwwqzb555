import React from 'react';
import { Text, View } from 'react-native';
import { KeyButton, useSendKey } from './common';
import { colors } from '../theme';
import { Key } from '../tv/driver';

// الترتيب كما في الفيديو (من اليسار لليمين): 3 2 1 / 6 5 4 / 9 8 7 / Menu 0 TV
const ROWS: string[][] = [
  ['3', '2', '1'],
  ['6', '5', '4'],
  ['9', '8', '7'],
  ['Menu', '0', 'TV'],
];

export default function NumPad({ width = 260 }: { width?: number }) {
  const send = useSendKey();
  const gap = 10;
  const cell = (width - gap * 2) / 3;
  return (
    <View style={{ width, gap }}>
      {ROWS.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row', gap }}>
          {row.map((k) => (
            <KeyButton
              key={k}
              style={{ width: cell, height: cell * 0.78 }}
              onPress={() =>
                send(k === 'Menu' ? 'menu' : k === 'TV' ? 'tv' : (`num_${k}` as Key))
              }
            >
              <Text style={{ color: colors.text, fontSize: k.length > 1 ? 17 : 24 }}>{k}</Text>
            </KeyButton>
          ))}
        </View>
      ))}
    </View>
  );
}
