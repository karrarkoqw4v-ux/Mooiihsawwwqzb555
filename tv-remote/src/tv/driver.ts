export type Key =
  | 'up' | 'down' | 'left' | 'right' | 'ok'
  | 'back' | 'home' | 'menu' | 'tv'
  | 'power' | 'mute'
  | 'vol_up' | 'vol_down' | 'ch_up' | 'ch_down'
  | 'num_0' | 'num_1' | 'num_2' | 'num_3' | 'num_4'
  | 'num_5' | 'num_6' | 'num_7' | 'num_8' | 'num_9';

export type Brand = 'roku' | 'samsung' | 'lg';

export interface TvDevice {
  id: string;        // = host
  name: string;
  host: string;
  brand: Brand;
  token?: string;    // مفتاح الاقتران (LG / Samsung)
}

export interface TvDriver {
  connect(device: TvDevice, onToken?: (t: string) => void): Promise<void>;
  disconnect(): void;
  sendKey(key: Key): void;
  sendText(text: string): void;
  launchApp(appId: string): void;
}

export const withTimeout = <T,>(p: Promise<T>, ms: number, msg = 'timeout') =>
  new Promise<T>((res, rej) => {
    const t = setTimeout(() => rej(new Error(msg)), ms);
    p.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); });
  });

export function openWS(url: string, ms = 4000): Promise<WebSocket> {
  return withTimeout(
    new Promise<WebSocket>((res, rej) => {
      const ws = new WebSocket(url);
      ws.onopen = () => res(ws);
      ws.onerror = () => rej(new Error('ws error'));
    }),
    ms,
  );
}
