import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '../components/Text';

const CREAM = '#FAF3E8';

// نجمة مشعة: 12 بتلة
function Burst({ size }: { size: number }) {
  const c = size / 2;
  return (
    <Svg width={size} height={size}>
      <G>
        {Array.from({ length: 12 }).map((_, k) => {
          const len = k % 2 === 0 ? c * 0.95 : c * 0.68;
          return (
            <Path
              key={k}
              d={`M ${c} ${c - len} Q ${c + c * 0.1} ${c - len * 0.4} ${c} ${c} Q ${c - c * 0.1} ${c - len * 0.4} ${c} ${c - len} Z`}
              fill={CREAM}
              rotation={k * 30}
              origin={`${c}, ${c}`}
            />
          );
        })}
        <Circle cx={c} cy={c} r={c * 0.12} fill={CREAM} />
      </G>
    </Svg>
  );
}

// دخول متحرك: نجمة تدور وتكبر + حلقات نبض + ظهور الاسم ثم اختفاء ناعم
export default function Intro({ onDone }: { onDone: () => void }) {
  const burst = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const done = useRef(false);
  const finish = () => { if (!done.current) { done.current = true; onDone(); } };
  const title = useRef(new Animated.Value(0)).current;
  const sub = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loops: Animated.CompositeAnimation[] = [];
    const pulse = (v: Animated.Value, delay: number) => {
      const a = Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]));
      loops.push(a); a.start();
    };
    pulse(ring, 0); pulse(ring2, 700);
    const safety = setTimeout(finish, 5000);   // مهما حصل، الدخول لا يعلق أكثر من 5 ثواني
    Animated.sequence([
      Animated.timing(burst, { toValue: 1, duration: 1100, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(title, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(sub, { toValue: 1, duration: 900, delay: 250, useNativeDriver: true }),
      ]),
      Animated.delay(700),
      Animated.timing(out, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]).start(finish);
    return () => { clearTimeout(safety); loops.forEach((l) => l.stop()); };
  }, []);

  const scale = burst.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const rot = burst.interpolate({ inputRange: [0, 1], outputRange: ['-180deg', '0deg'] });
  const ringStyle = (p: Animated.Value) => ({
    position: 'absolute' as const, width: 180, height: 180, borderRadius: 90, borderWidth: 2, borderColor: 'rgba(217,119,87,0.75)',
    opacity: Animated.multiply(burst, p.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] })),
    transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.8, 2.3] }) }],
  });

  return (
    <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, opacity: out }}>
      <LinearGradient colors={['#262628', '#171719', '#0c0c0d']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 200, height: 200, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={ringStyle(ring)} />
          <Animated.View style={ringStyle(ring2)} />
          <Animated.View style={{ transform: [{ scale }, { rotate: rot }], opacity: burst }}>
            <Burst size={150} />
          </Animated.View>
        </View>
        <Animated.View style={{ opacity: title, transform: [{ translateY: title.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }], marginTop: 36 }}>
          <Text style={{ color: CREAM, fontSize: 44, fontWeight: '800', letterSpacing: 1 }}>TV Raymond</Text>
        </Animated.View>
        <Animated.View style={{ opacity: sub, marginTop: 6 }}>
          <Text style={{ color: 'rgba(250,243,232,0.7)', fontSize: 17, fontWeight: '600' }}>ريموت تلفزيونك بين إيدك</Text>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}
