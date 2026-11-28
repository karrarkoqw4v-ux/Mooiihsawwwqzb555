import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TvDevice } from './tv/driver';

export interface TvApp {
  id: string; name: string;
  logo?: any;            // صورة الشعار الحقيقي
  icon?: string;         // أيقونة Ionicons (للتطبيقات بدون صورة)
  short?: string;        // نص بديل
  bg: string; fg: string;
  gradient?: string[];
  custom?: boolean;
}

// كل التطبيقات المدعومة. المستخدم يضيف منها أو يضيف تطبيقه الخاص.
export const CATALOG: TvApp[] = [
  { id: 'hbomax', name: 'HBO Max', short: 'HBO\nmax', bg: '#0a1030', fg: '#fff', gradient: ['#001a4d', '#050510'] },
  { id: 'appletv', name: 'Apple TV', logo: require('../assets/apps/appletv.png'), bg: '#222', fg: '#fff' },
  { id: 'crunchyroll', name: 'Crunchyroll', logo: require('../assets/apps/crunchyroll.png'), bg: '#f47521', fg: '#fff' },
  { id: 'adtv', name: 'ADtv', logo: require('../assets/apps/adtv.png'), bg: '#1d1d22', fg: '#fff' },
  { id: 'noor', name: 'Noor Play', icon: 'play', bg: '#111', fg: '#b3153d' },
  { id: 'disney', name: '+Disney', logo: require('../assets/apps/disney.png'), bg: '#0e3b43', fg: '#fff' },
  { id: 'starz', name: 'STARZPLAY', logo: require('../assets/apps/starz.png'), bg: '#000', fg: '#fff' },
  { id: 'osn', name: '+OSN', logo: require('../assets/apps/osn.png'), bg: '#000', fg: '#fff' },
  { id: 'prime', name: 'Prime Video', logo: require('../assets/apps/prime.png'), bg: '#0a7bff', fg: '#fff' },
  { id: 'stc', name: 'stc tv', logo: require('../assets/apps/stc.png'), bg: '#4f0a8a', fg: '#fff' },
  { id: 'mbc', name: 'MBC Shahid', logo: require('../assets/apps/mbc.png'), bg: '#09c58a', fg: '#fff' },
  { id: 'youtube', name: 'YouTube', logo: require('../assets/apps/youtube.png'), bg: '#212121', fg: '#fff' },
  { id: 'netflix', name: 'Netflix', logo: require('../assets/apps/netflix.png'), bg: '#1a1a1a', fg: '#fff' },
  { id: 'tiktok', name: 'TikTok', icon: 'logo-tiktok', bg: '#000', fg: '#fff' },
  { id: 'instagram', name: 'Instagram', icon: 'logo-instagram', bg: '#c13584', fg: '#fff', gradient: ['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5'] },
  { id: 'twitter', name: 'X (Twitter)', icon: 'logo-twitter', bg: '#000', fg: '#fff' },
];

// الظاهرة أولاً في الريموت (حسب الفيديو + الجديدة)
export const DEFAULT_APPS: TvApp[] = [
  'hbomax', 'appletv', 'crunchyroll', 'adtv', 'noor', 'disney', 'starz', 'osn', 'prime', 'stc', 'mbc',
  'youtube', 'netflix', 'tiktok', 'instagram', 'twitter',
].map((id) => CATALOG.find((a) => a.id === id)!);

interface State {
  devices: TvDevice[];
  activeId: string | null;
  conn: 'idle' | 'connecting' | 'connected' | 'error';
  pc: { name: string; address: string } | null;   // الكمبيوتر المختار لمشاركة الملفات
  updateDevice: (id: string, p: Partial<TvDevice>) => void;
  apps: TvApp[];
  controlMode: 'touch' | 'dpad';
  haptics: boolean;
  holdRepeat: boolean;
  keepAwake: boolean;
  theater: boolean;
  set: (p: Partial<State>) => void;
  addDevice: (d: TvDevice) => void;
  renameDevice: (id: string, name: string) => void;
  removeDevice: (id: string) => void;
  removeApp: (id: string) => void;
  addApp: (a: TvApp) => void;
  moveApp: (from: number, to: number) => void;
}

export const useStore = create<State>()(persist((set) => ({
  devices: [],
  activeId: null,
  conn: 'idle',
  pc: null,
  updateDevice: (id, p) => set((s) => ({ devices: s.devices.map((d) => (d.id === id ? { ...d, ...p } : d)) })),
  apps: DEFAULT_APPS,
  controlMode: 'touch',
  haptics: true,
  holdRepeat: true,
  keepAwake: true,
  theater: false,
  set: (p) => set(p),
  addDevice: (d) =>
    set((s) => (s.devices.some((x) => x.id === d.id) ? s : { devices: [...s.devices, d] })),
  renameDevice: (id, name) => set((s) => ({ devices: s.devices.map((d) => (d.id === id ? { ...d, name } : d)) })),
  removeDevice: (id) =>
    set((s) => ({ devices: s.devices.filter((d) => d.id !== id), activeId: s.activeId === id ? null : s.activeId })),
  addApp: (a) => set((s) => (s.apps.some((x) => x.id === a.id) ? s : { apps: [...s.apps, a] })),
  removeApp: (id) => set((s) => ({ apps: s.apps.filter((a) => a.id !== id) })),
  moveApp: (from, to) =>
    set((s) => {
      const a = [...s.apps];
      const [x] = a.splice(from, 1);
      a.splice(to, 0, x);
      return { apps: a };
    }),
}), {
  name: 'tv-raymond',
  version: 2,
  migrate: (st: any) => ({ ...st, controlMode: 'touch' }),   // الافتراضي الجديد: لوحة لمس مثل Apple TV
  storage: createJSONStorage(() => AsyncStorage),
  // نحفظ الأجهزة والإعدادات فقط (التطبيقات تحتوي صور require فلا تُحفظ)
  partialize: (s) => ({ pc: s.pc, devices: s.devices, activeId: s.activeId, controlMode: s.controlMode, haptics: s.haptics, holdRepeat: s.holdRepeat, keepAwake: s.keepAwake, theater: s.theater }),
}));
