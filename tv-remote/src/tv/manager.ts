import { useStore } from '../store';
import { Key, TvDevice, TvDriver } from './driver';
import { RokuDriver } from './roku';
import { SamsungDriver } from './samsung';
import { LgDriver } from './lg';

// المدير الوحيد الذي تتعامل معه الواجهة: يختار السائق حسب نوع التلفزيون
class TvManager {
  private d: TvDriver | null = null;

  async connect(dev: TvDevice) {
    const set = useStore.setState;
    this.d?.disconnect();
    set({ conn: 'connecting', activeId: dev.id });
    const drv: TvDriver = dev.brand === 'roku' ? new RokuDriver() : dev.brand === 'samsung' ? new SamsungDriver() : new LgDriver();
    try {
      await drv.connect(dev, (token) => useStore.getState().updateDevice(dev.id, { token }));
      this.d = drv;
      set({ conn: 'connected' });
    } catch {
      this.d = null;
      set({ conn: 'error' });
    }
  }
  disconnect() { this.d?.disconnect(); this.d = null; useStore.setState({ conn: 'idle' }); }
  sendKey(k: Key) { this.d?.sendKey(k); }
  sendText(t: string) { this.d?.sendText(t); }
  launchApp(id: string) { this.d?.launchApp(id); }
}
export const tv = new TvManager();
