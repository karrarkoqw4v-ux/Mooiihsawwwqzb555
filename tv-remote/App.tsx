import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { NavProvider, Route, useNav } from './src/nav';
import RemoteScreen from './src/screens/RemoteScreen';
import {
  BehaviorScreen, ConnectedDevicesScreen, ManageAppsScreen, RemoteStyleScreen, SettingsScreen,
} from './src/screens/SettingsScreens';
import { KeyboardSheet, PairSheet, TvPickerSheet, kb } from './src/screens/Sheets';
import { colors } from './src/theme';
import { tv } from './src/tv/manager';
import { useStore } from './src/store';
import Intro from './src/screens/Intro';
import ShareScreen from './src/screens/ShareScreen';
import AddAppScreen from './src/screens/AddAppScreen';
import { useFonts, Cairo_600SemiBold, Cairo_700Bold, Cairo_800ExtraBold } from '@expo-google-fonts/cairo';

class Boundary extends React.Component<{ children: React.ReactNode }, { err?: Error }> {
  state: { err?: Error } = {};
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24, paddingTop: 70 }}>
        <Text selectable style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>صار خطأ في التطبيق</Text>
        <Text selectable style={{ color: '#e5484d', marginTop: 12 }}>{String(this.state.err?.message)}</Text>
        <Text selectable style={{ color: '#b0b0b8', marginTop: 12, fontSize: 11 }}>{String(this.state.err?.stack).slice(0, 1500)}</Text>
      </View>
    );
  }
}

const OVERLAYS: Route[] = ['tvPicker', 'keyboard', 'pair'];

function Router() {
  const nav = useNav();
  const { route } = nav;
  const pairingFor = useStore((x) => x.pairingFor);
  const routeRef = React.useRef(route); routeRef.current = route;

  // التلفزيون فتح حقل كتابة (بحث...) => نفتح لوحة المفاتيح على الجوال تلقائياً
  React.useEffect(() => tv.onKeyboard((text) => {
    kb.text = text;
    if (routeRef.current !== 'keyboard') nav.push('keyboard');
  }), []);
  // جهاز Android TV يحتاج اقتران (مثلاً عند الاتصال التلقائي) => نفتح شاشة الرمز
  React.useEffect(() => { if (pairingFor && route === 'remote') nav.push('pair'); }, [pairingFor, route]);

  const overlay = OVERLAYS.includes(route);
  let page: React.ReactNode;
  switch (route) {
    case 'settings': page = <SettingsScreen />; break;
    case 'remoteStyle': page = <RemoteStyleScreen />; break;
    case 'behavior': page = <BehaviorScreen />; break;
    case 'manageApps': page = <ManageAppsScreen />; break;
    case 'devices': page = <ConnectedDevicesScreen />; break;
    case 'tvPicker': page = <TvPickerSheet />; break;
    case 'keyboard': page = <KeyboardSheet />; break;
    case 'pair': page = <PairSheet />; break;
    case 'addApp': page = <AddAppScreen />; break;
    case 'pcShare': page = <ShareScreen />; break;
    default: page = <RemoteScreen />;
  }
  // النوافذ تُرسم فوق الريموت بخلفية شفافة ضبابية
  return (
    <>
      {overlay ? <RemoteScreen /> : page}
      {overlay && (
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={70} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,8,10,0.5)' }]} />
          {page}
        </View>
      )}
    </>
  );
}

// ?route=settings يفتح شاشة معينة مباشرة (للمعاينة على الويب فقط).
// ملاحظة: على أندرويد دالة URLSearchParams.get غير مدعومة وترمي خطأ، فنحصرها بالويب.
function routeParam(): string | null {
  if (Platform.OS !== 'web') return null;
  try { return new URLSearchParams((globalThis as any).location?.search ?? '').get('route'); } catch { return null; }
}
function initialRoute(): Route { return (routeParam() as Route) || 'remote'; }

function Main() {
  const [intro, setIntro] = React.useState(!routeParam());
  const [, fontError] = useFonts({ Cairo_600SemiBold, Cairo_700Bold, Cairo_800ExtraBold });
  // لا نمنع ظهور التطبيق بانتظار الخطوط: إن تأخرت أو فشلت يستعمل خط النظام مؤقتاً
  React.useEffect(() => { if (fontError) console.error('FONT ERROR: ' + fontError.message); }, [fontError]);
  React.useEffect(() => {
    if (Platform.OS === 'android') {   // شريط أندرويد السفلي بنفس لون التطبيق (بدل الأبيض)
      NavigationBar.setBackgroundColorAsync(colors.bg).catch(() => {});
      NavigationBar.setButtonStyleAsync('light').catch(() => {});
    }
  }, []);
  React.useEffect(() => {
    // يتصل تلقائياً بآخر تلفزيون محفوظ
    const t = setTimeout(() => {
      const { devices, activeId } = useStore.getState();
      const d = devices.find((x) => x.id === activeId);
      if (d) tv.connect(d);
    }, 300);
    return () => clearTimeout(t);
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, direction: 'ltr' }}>
      <StatusBar style="light" />
      <NavProvider initial={initialRoute()}>
        <Router />
      </NavProvider>
      {intro && <Intro onDone={() => setIntro(false)} />}
    </View>
  );
}

export default function App() {
  return <Boundary><Main /></Boundary>;
}
