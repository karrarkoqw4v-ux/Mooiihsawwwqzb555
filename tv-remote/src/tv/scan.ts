import * as Network from 'expo-network';
import { Brand, TvDevice, withTimeout } from './driver';

// يمسح شبكة الواي فاي (/24) بالتوازي ويفحص منافذ Roku / Samsung / LG. يرجع النتائج فور ظهورها.
async function http(url: string, ms: number): Promise<string | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal }); return r.ok ? await r.text() : null; }
  catch { return null; } finally { clearTimeout(t); }
}
function wsOpen(url: string, ms: number): Promise<boolean> {
  return withTimeout(new Promise<boolean>((res) => {
    try {
      const ws = new WebSocket(url);
      ws.onopen = () => { res(true); try { ws.close(); } catch {} };
      ws.onerror = () => res(false);
    } catch { res(false); }
  }), ms).catch(() => false);
}

async function probe(host: string): Promise<TvDevice | null> {
  const [roku, samsung, lg] = await Promise.all([
    http(`http://${host}:8060/query/device-info`, 900),
    http(`http://${host}:8001/api/v2/`, 900),
    wsOpen(`ws://${host}:3000`, 900),
  ]);
  const mk = (brand: Brand, name: string): TvDevice => ({ id: host, host, brand, name });
  if (roku) {
    const m = /<(?:user-device-name|friendly-device-name)>([^<]+)</.exec(roku);
    return mk('roku', m?.[1] ?? 'Roku TV');
  }
  if (samsung) {
    try { return mk('samsung', JSON.parse(samsung)?.device?.name ?? 'Samsung TV'); } catch { return mk('samsung', 'Samsung TV'); }
  }
  if (lg) return mk('lg', 'LG TV');
  return null;
}

export async function scanNetwork(onFound: (d: TvDevice) => void, isCancelled: () => boolean) {
  const ip = await Network.getIpAddressAsync();
  const parts = ip.split('.');
  if (parts.length !== 4 || ip === '0.0.0.0') throw new Error('no wifi');
  const base = parts.slice(0, 3).join('.');
  const hosts = Array.from({ length: 254 }, (_, i) => `${base}.${i + 1}`).filter((h) => h !== ip);
  let i = 0;
  const worker = async () => {
    while (i < hosts.length && !isCancelled()) {
      const h = hosts[i++];
      const d = await probe(h);
      if (d && !isCancelled()) onFound(d);
    }
  };
  await Promise.all(Array.from({ length: 80 }, worker));
}
