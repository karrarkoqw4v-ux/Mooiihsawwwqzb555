import { Atv } from '../../modules/atv-remote';
import { Key, TvDevice, TvDriver } from './driver';

// رموز أزرار أندرويد (KeyEvent)
const KEYS: Record<Key, number> = {
  up: 19, down: 20, left: 21, right: 22, ok: 23, back: 4, home: 3, menu: 82, tv: 170,
  power: 26, mute: 164, del: 67, vol_up: 24, vol_down: 25, ch_up: 166, ch_down: 167,
  num_0: 7, num_1: 8, num_2: 9, num_3: 10, num_4: 11, num_5: 12, num_6: 13, num_7: 14, num_8: 15, num_9: 16,
};
// روابط فتح التطبيقات على Android TV
const APPS: Record<string, string> = {
  netflix: 'https://www.netflix.com/title', youtube: 'https://www.youtube.com', prime: 'https://app.primevideo.com',
  disney: 'https://www.disneyplus.com', hbomax: 'https://play.max.com', tiktok: 'https://www.tiktok.com',
  appletv: 'https://tv.apple.com', crunchyroll: 'https://www.crunchyroll.com', mbc: 'https://shahid.mbc.net',
  stc: 'https://tv.stc.com.sa', osn: 'https://osnplus.com', twitter: 'https://x.com',
};

export class NeedPairing extends Error { constructor() { super('NEED_PAIRING'); } }

// Android TV / Google TV: بروتوكول Android TV Remote v2 (اقتران برمز ثم تحكم مشفّر)
export class AndroidTvDriver implements TvDriver {
  private subs: { remove(): void }[] = [];
  onKeyboard?: (text: string) => void;
  onClosed?: () => void;

  async connect(d: TvDevice) {
    if (!Atv) throw new Error('هذه الميزة تعمل على أندرويد فقط');
    if (d.token !== 'paired') throw new NeedPairing();
    this.subs.forEach((s) => s.remove());
    this.subs = [
      Atv.addListener('keyboard', (e) => this.onKeyboard?.(e.text)),
      Atv.addListener('closed', () => this.onClosed?.()),
    ];
    try { await Atv.connect(d.host); }
    catch (e: any) { if (e?.code === 'NOT_PAIRED') throw new NeedPairing(); throw e; }
  }
  disconnect() { this.subs.forEach((s) => s.remove()); this.subs = []; Atv?.disconnect(); }
  sendKey(k: Key) { Atv?.key(KEYS[k]); }
  sendText(t: string) { Atv?.text(t); }
  launchApp(id: string) { if (APPS[id]) Atv?.launch(APPS[id]); }
}
