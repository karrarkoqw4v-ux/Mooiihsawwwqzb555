import { create } from 'zustand';
import { TvDevice } from './tv/driver';

export interface TvApp { id: string; name: string; short: string; bg: string; fg: string; }

export const DEFAULT_APPS: TvApp[] = [
  { id: 'hbomax', name: 'HBO Max', short: 'HBO\nmax', bg: '#0b0b0d', fg: '#fff' },
  { id: 'appletv', name: 'Apple TV', short: ' tv', bg: '#0b0b0d', fg: '#fff' },
  { id: 'crunchyroll', name: 'Crunchyroll', short: '◐', bg: '#f47521', fg: '#fff' },
  { id: 'adtv', name: 'ADtv', short: 'AD', bg: '#0b0b0d', fg: '#fff' },
  { id: 'stc', name: 'stc tv', short: 'stc', bg: '#4f2d7f', fg: '#fff' },
  { id: 'prime', name: 'Prime Video', short: 'prime', bg: '#1a98ff', fg: '#fff' },
  { id: 'osn', name: '+OSN', short: 'osn', bg: '#0b0b0d', fg: '#fff' },
  { id: 'starz', name: 'STARZPLAY', short: 'STARZ', bg: '#0b0b0d', fg: '#4fe0c8' },
  { id: 'disney', name: '+Disney', short: 'D+', bg: '#0e3b43', fg: '#fff' },
  { id: 'noor', name: 'Noor Play', short: 'N', bg: '#c4162a', fg: '#fff' },
];

interface State {
  devices: TvDevice[];
  activeId: string | null;
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
  moveApp: (from: number, to: number) => void;
}

export const useStore = create<State>((set) => ({
  devices: [{ id: 'mock-1', name: 'hh', host: '192.168.1.20', brand: 'mock' }],
  activeId: 'mock-1',
  apps: DEFAULT_APPS,
  controlMode: 'dpad',
  haptics: true,
  holdRepeat: true,
  keepAwake: true,
  theater: false,
  set: (p) => set(p),
  addDevice: (d) =>
    set((s) => (s.devices.some((x) => x.id === d.id) ? s : { devices: [...s.devices, d], activeId: d.id })),
  renameDevice: (id, name) => set((s) => ({ devices: s.devices.map((d) => (d.id === id ? { ...d, name } : d)) })),
  removeDevice: (id) =>
    set((s) => ({ devices: s.devices.filter((d) => d.id !== id), activeId: s.activeId === id ? null : s.activeId })),
  removeApp: (id) => set((s) => ({ apps: s.apps.filter((a) => a.id !== id) })),
  moveApp: (from, to) =>
    set((s) => {
      const a = [...s.apps];
      const [x] = a.splice(from, 1);
      a.splice(to, 0, x);
      return { apps: a };
    }),
}));
