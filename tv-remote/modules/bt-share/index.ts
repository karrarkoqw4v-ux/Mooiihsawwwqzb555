import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

export type PairedDevice = { name: string; address: string; kind: 'computer' | 'phone' | 'audio' | 'other' };

type Native = {
  isAvailable(): boolean;
  isEnabled(): boolean;
  getPairedDevices(): Promise<PairedDevice[]>;
  sendFile(address: string, uri: string, name: string, size: number): Promise<boolean>;
  sendText(address: string, name: string, text: string): Promise<boolean>;
  shareViaSystem(uris: string[], mime: string): void;
  cancel(): void;
  addListener(event: 'progress', cb: (e: { sent: number; total: number }) => void): { remove(): void };
};

// null على الويب/آيفون: الميزة تعمل على أندرويد فقط
export const BtShare: Native | null = Platform.OS === 'android' ? requireOptionalNativeModule<Native>('BtShare') : null;
