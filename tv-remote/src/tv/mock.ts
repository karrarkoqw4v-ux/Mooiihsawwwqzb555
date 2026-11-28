import { TvDevice, TvDriver, Key } from './driver';

// سائق تجريبي: يطبع الأوامر فقط. نستبدله بسائق حقيقي في المرحلة 3.
export const mockDriver: TvDriver = {
  async connect(d: TvDevice) { console.log('[mock] connect', d.name); },
  disconnect() { console.log('[mock] disconnect'); },
  sendKey(k: Key) { console.log('[mock] key', k); },
  sendText(t: string) { console.log('[mock] text', t); },
  launchApp(id: string) { console.log('[mock] app', id); },
  discover(onFound) {
    const t = setTimeout(
      () => onFound({ id: 'mock-1', name: 'hh', host: '192.168.1.20', brand: 'mock' }),
      2500,
    );
    return () => clearTimeout(t);
  },
};
