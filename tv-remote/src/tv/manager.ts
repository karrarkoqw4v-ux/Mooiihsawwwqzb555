import { useStore } from '../store';
import { Key, TvDevice, TvDriver } from './driver';
import { RokuDriver } from './roku';
import { SamsungDriver } from './samsung';
import { LgDriver } from './lg';
import { AndroidTvDriver, NeedPairing } from './androidtv';

// المدير الوحيد الذي تتعامل معه الواجهة: يختار السائق حسب نوع التلفزيون
type KbListener = (text: string) => void;

class TvManager {
  private d: TvDriver | null = null;
  private kb = new Set<KbListener>();

  /** يُستدعى عندما يفتح التلفزيون حقل كتابة (بحث...) لنعرض لوحة المفاتيح على الجوال */
  onKeyboard(cb: KbListener) { this.kb.add(cb); return () => { this.kb.delete(cb); }; }

  async connect(dev: TvDevice) {
    const set = useStore.setState;
    this.d?.disconnect();
    set({ conn: 'connecting', activeId: dev.id, pairingFor: null });
    const drv: TvDriver =
      dev.brand === 'roku' ? new RokuDriver()
      : dev.brand === 'samsung' ? new SamsungDriver()
      : dev.brand === 'androidtv' ? new AndroidTvDriver()
      : new LgDriver();
    if (drv instanceof AndroidTvDriver) {
      drv.onKeyboard = (t) => this.kb.forEach((f) => f(t));
      drv.onClosed = () => { if (this.d === drv) { this.d = null; useStore.setState({ conn: 'idle' }); } };
    }
    try {
      await drv.connect(dev, (token) => useStore.getState().updateDevice(dev.id, { token }));
      this.d = drv;
      set({ conn: 'connected' });
    } catch (e) {
      this.d = null;
      if (e instanceof NeedPairing) set({ conn: 'idle', pairingFor: dev.id });   // الواجهة تفتح شاشة إدخال الرمز
      else set({ conn: 'error' });
    }
  }
  disconnect() { this.d?.disconnect(); this.d = null; useStore.setState({ conn: 'idle' }); }
  sendKey(k: Key) { this.d?.sendKey(k); }
  sendText(t: string) { this.d?.sendText(t); }
  launchApp(id: string) { this.d?.launchApp(id); }
}
export const tv = new TvManager();
