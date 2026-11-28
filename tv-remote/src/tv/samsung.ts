import { Key, openWS, TvDevice, TvDriver } from './driver';

const KEYS: Record<Key, string> = {
  up: 'KEY_UP', down: 'KEY_DOWN', left: 'KEY_LEFT', right: 'KEY_RIGHT', ok: 'KEY_ENTER', back: 'KEY_RETURN',
  home: 'KEY_HOME', menu: 'KEY_MENU', tv: 'KEY_TV', power: 'KEY_POWER', mute: 'KEY_MUTE', del: 'KEY_BACKSPACE',
  vol_up: 'KEY_VOLUP', vol_down: 'KEY_VOLDOWN', ch_up: 'KEY_CHUP', ch_down: 'KEY_CHDOWN',
  num_0: 'KEY_0', num_1: 'KEY_1', num_2: 'KEY_2', num_3: 'KEY_3', num_4: 'KEY_4',
  num_5: 'KEY_5', num_6: 'KEY_6', num_7: 'KEY_7', num_8: 'KEY_8', num_9: 'KEY_9',
};
const APPS: Record<string, string> = {
  netflix: '11101200001', youtube: '111299001912', prime: '3201512006785', disney: '3201901017640', appletv: '3201807016597',
};
const b64 = (s: string) => (globalThis as any).btoa(unescape(encodeURIComponent(s)));

export class SamsungDriver implements TvDriver {
  private ws: WebSocket | null = null;
  async connect(d: TvDevice, onToken?: (t: string) => void) {
    const name = b64('TV Raymond');
    const tok = d.token ? `&token=${d.token}` : '';
    // أحدث الموديلات تستخدم 8002 (مشفّر)، والأقدم 8001
    let ws: WebSocket;
    try { ws = await openWS(`wss://${d.host}:8002/api/v2/channels/samsung.remote.control?name=${name}${tok}`, 3500); }
    catch { ws = await openWS(`ws://${d.host}:8001/api/v2/channels/samsung.remote.control?name=${name}${tok}`, 3500); }
    ws.onmessage = (e) => {
      try {
        const m = JSON.parse(String(e.data));
        if (m?.data?.token) onToken?.(String(m.data.token));
      } catch {}
    };
    this.ws = ws;
  }
  disconnect() { try { this.ws?.close(); } catch {} this.ws = null; }
  private send(o: object) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(o)); }
  sendKey(k: Key) {
    this.send({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: KEYS[k], Option: 'false', TypeOfRemote: 'SendRemoteKey' } });
  }
  sendText(t: string) {
    this.send({ method: 'ms.remote.control', params: { Cmd: b64(t), DataOfCmd: 'base64', TypeOfRemote: 'SendInputString' } });
  }
  launchApp(id: string) {
    if (!APPS[id]) return;
    this.send({ method: 'ms.channel.emit', params: { event: 'ed.apps.launch', to: 'host', data: { action_type: 'DEEP_LINK', appId: APPS[id] } } });
  }
}
