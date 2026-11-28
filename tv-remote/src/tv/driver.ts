// واجهة موحدة لكل أنواع التلفزيونات. كل بروتوكول (Samsung/LG/Android TV/Roku) ينفذها لاحقاً.
export type Key =
  | 'up' | 'down' | 'left' | 'right' | 'ok'
  | 'back' | 'home' | 'menu' | 'tv'
  | 'power' | 'mute'
  | 'vol_up' | 'vol_down' | 'ch_up' | 'ch_down'
  | 'num_0' | 'num_1' | 'num_2' | 'num_3' | 'num_4'
  | 'num_5' | 'num_6' | 'num_7' | 'num_8' | 'num_9';

export interface TvDevice {
  id: string;
  name: string;
  host: string;
  brand: 'samsung' | 'lg' | 'androidtv' | 'roku' | 'mock';
}

export interface TvDriver {
  connect(device: TvDevice): Promise<void>;
  disconnect(): void;
  sendKey(key: Key): void;
  sendText(text: string): void;
  launchApp(appId: string): void;
  discover(onFound: (d: TvDevice) => void): () => void; // يرجع دالة إيقاف
}
