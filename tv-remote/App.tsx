import React from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavProvider, Route, useNav } from './src/nav';
import RemoteScreen from './src/screens/RemoteScreen';
import {
  BehaviorScreen, ConnectedDevicesScreen, ManageAppsScreen, RemoteStyleScreen, SettingsScreen,
} from './src/screens/SettingsScreens';
import { KeyboardSheet, TvPickerSheet } from './src/screens/Sheets';
import { colors } from './src/theme';
import Intro from './src/screens/Intro';
import AddAppScreen from './src/screens/AddAppScreen';
import { useFonts, Cairo_600SemiBold, Cairo_700Bold, Cairo_800ExtraBold } from '@expo-google-fonts/cairo';

function Router() {
  const { route } = useNav();
  switch (route) {
    case 'settings': return <SettingsScreen />;
    case 'remoteStyle': return <RemoteStyleScreen />;
    case 'behavior': return <BehaviorScreen />;
    case 'manageApps': return <ManageAppsScreen />;
    case 'devices': return <ConnectedDevicesScreen />;
    case 'tvPicker': return <TvPickerSheet />;
    case 'keyboard': return <KeyboardSheet />;
    case 'addApp': return <AddAppScreen />;
    default: return <RemoteScreen />;
  }
}

// ?route=settings يفتح شاشة معينة مباشرة (مفيد للمعاينة على الويب)
function initialRoute(): Route {
  try {
    const r = new URLSearchParams((globalThis as any).location?.search ?? '').get('route');
    return (r as Route) || 'remote';
  } catch { return 'remote'; }
}

export default function App() {
  const [intro, setIntro] = React.useState(!new URLSearchParams((globalThis as any).location?.search ?? '').get('route'));
  const [loaded] = useFonts({ Cairo_600SemiBold, Cairo_700Bold, Cairo_800ExtraBold });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <NavProvider initial={initialRoute()}>
        <Router />
      </NavProvider>
      {intro && <Intro onDone={() => setIntro(false)} />}
    </View>
  );
}
