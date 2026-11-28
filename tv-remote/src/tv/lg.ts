import { Key, openWS, TvDevice, TvDriver, withTimeout } from './driver';

const BTN: Record<Key, string> = {
  up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', ok: 'ENTER', back: 'BACK', home: 'HOME', menu: 'MENU',
  tv: 'LIVETV', power: 'POWER', mute: 'MUTE', del: 'DELETE', vol_up: 'VOLUMEUP', vol_down: 'VOLUMEDOWN',
  ch_up: 'CHANNELUP', ch_down: 'CHANNELDOWN',
  num_0: '0', num_1: '1', num_2: '2', num_3: '3', num_4: '4', num_5: '5', num_6: '6', num_7: '7', num_8: '8', num_9: '9',
};
const APPS: Record<string, string> = {
  netflix: 'netflix', youtube: 'youtube.leanback.v4', prime: 'amazon', disney: 'com.disney.disneyplus-prod', appletv: 'com.apple.appletv',
};
const MANIFEST = {
  manifestVersion: 1,
  permissions: ['LAUNCH', 'LAUNCH_WEBAPP', 'CONTROL_AUDIO', 'CONTROL_INPUT_TEXT', 'CONTROL_MOUSE_AND_KEYBOARD', 'CONTROL_POWER', 'READ_INSTALLED_APPS', 'CONTROL_INPUT_MEDIA_PLAYBACK'],
};

export class LgDriver implements TvDriver {
  private ws: WebSocket | null = null;
  private pointer: WebSocket | null = null;
  private n = 0;
  private waiters = new Map<string, (p: any) => void>();

  async connect(d: TvDevice, onToken?: (t: string) => void) {
    const ws = await openWS(`ws://${d.host}:3000`, 3500);
    this.ws = ws;
    ws.onmessage = (e) => {
      try {
        const m = JSON.parse(String(e.data));
        this.waiters.get(m.id)?.(m);
      } catch {}
    };
    // اقتران: يظهر طلب موافقة على التلفزيون أول مرة فقط
    const reg = new Promise<any>((res) => this.waiters.set('reg', res));
    ws.send(JSON.stringify({
      type: 'register', id: 'reg',
      payload: { forcePairing: false, pairingType: 'PROMPT', 'client-key': d.token, manifest: MANIFEST },
    }));
    // أول رد "response" = بانتظار الموافقة، والثاني "registered"
    const first = await withTimeout(new Promise<any>((res) => {
      this.waiters.set('reg', (m) => { if (m.type === 'registered') res(m); });
    }), 30000, 'pairing');
    const key = first?.payload?.['client-key'];
    if (key) onToken?.(key);
    void reg;
    const r = await this.request('ssap://com.webos.service.networkinput/getPointerInputSocket');
    const path = r?.payload?.socketPath;
    if (path) this.pointer = await openWS(path, 3500);
  }
  disconnect() { try { this.ws?.close(); this.pointer?.close(); } catch {} this.ws = this.pointer = null; }

  private request(uri: string, payload: object = {}) {
    const id = 'r' + ++this.n;
    return withTimeout(new Promise<any>((res) => {
      this.waiters.set(id, res);
      this.ws?.send(JSON.stringify({ type: 'request', id, uri, payload }));
    }), 4000).finally(() => this.waiters.delete(id));
  }
  sendKey(k: Key) {
    if (k === 'power') { this.request('ssap://system/turnOff').catch(() => {}); return; }
    this.pointer?.send(`type:button\nname:${BTN[k]}\n\n`);
  }
  sendText(t: string) { this.request('ssap://com.webos.service.ime/insertText', { text: t, replace: 0 }).catch(() => {}); }
  launchApp(id: string) { if (APPS[id]) this.request('ssap://system.launcher/launch', { id: APPS[id] }).catch(() => {}); }
}
