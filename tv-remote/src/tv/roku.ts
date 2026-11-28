import { Key, TvDevice, TvDriver } from './driver';

const KEYS: Record<Key, string> = {
  up: 'Up', down: 'Down', left: 'Left', right: 'Right', ok: 'Select', back: 'Back', home: 'Home',
  menu: 'Info', tv: 'InputTuner', power: 'Power', mute: 'VolumeMute', vol_up: 'VolumeUp', vol_down: 'VolumeDown',
  ch_up: 'ChannelUp', ch_down: 'ChannelDown',
  num_0: 'Lit_0', num_1: 'Lit_1', num_2: 'Lit_2', num_3: 'Lit_3', num_4: 'Lit_4',
  num_5: 'Lit_5', num_6: 'Lit_6', num_7: 'Lit_7', num_8: 'Lit_8', num_9: 'Lit_9',
};
const APPS: Record<string, string> = {
  netflix: '12', youtube: '837', prime: '13', disney: '291097', hbomax: '61322', appletv: '551012',
};

// Roku: HTTP بسيط على المنفذ 8060 بدون اقتران
export class RokuDriver implements TvDriver {
  private base = '';
  async connect(d: TvDevice) {
    this.base = `http://${d.host}:8060`;
    const r = await fetch(`${this.base}/query/device-info`);
    if (!r.ok) throw new Error('roku');
  }
  disconnect() {}
  private post(path: string) { fetch(this.base + path, { method: 'POST' }).catch(() => {}); }
  sendKey(k: Key) { this.post('/keypress/' + KEYS[k]); }
  sendText(t: string) { for (const ch of t) this.post('/keypress/Lit_' + encodeURIComponent(ch)); }
  launchApp(id: string) { if (APPS[id]) this.post('/launch/' + APPS[id]); }
}
