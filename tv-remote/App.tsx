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
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <NavProvider initial={initialRoute()}>
        <Router />
      </NavProvider>
    </View>
  );
}
