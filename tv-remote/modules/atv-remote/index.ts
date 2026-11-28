import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

export type FoundTv = { name: string; host: string; mac: string; brand: 'androidtv' };

type Native = {
  discover(timeoutMs: number): Promise<FoundTv[]>;
  pairStart(host: string): Promise<boolean>;
  pairFinish(code: string): Promise<boolean>;
  connect(host: string): Promise<{ model: string; vendor: string }>;
  key(code: number): Promise<void>;
  text(text: string): Promise<void>;
  launch(link: string): Promise<void>;
  disconnect(): void;
  addListener(event: 'found', cb: (e: FoundTv) => void): { remove(): void };
  addListener(event: 'keyboard', cb: (e: { text: string }) => void): { remove(): void };
  addListener(event: 'closed', cb: (e: { host: string }) => void): { remove(): void };
};

export const Atv: Native | null = Platform.OS === 'android' ? requireOptionalNativeModule<Native>('AtvRemote') : null;
