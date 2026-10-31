/* ===== local-api.js — وضع بدون سيرفر: الحسابات والرسائل تنحفظ على جهاز المستخدم =====
   يشتغل لما يكون API_BASE فارغ بملف config.js. نفس مسارات السيرفر بالضبط. */
const LDB = 'mhadatha_local_v1';
const ldb = {
  get() { try { return JSON.parse(localStorage.getItem(LDB)) || { users: [], session: null }; } catch (e) { return { users: [], session: null }; } },
  set(d) { localStorage.setItem(LDB, JSON.stringify(d)); }
};
const lfail = (m, s = 400, field) => Promise.reject(Object.assign(new Error(m), { status: s, field }));
async function lhash(u, p) {
  const s = 'mhadatha|' + u + '|' + p;
  if (!(window.crypto && crypto.subtle)) return btoa(unescape(encodeURIComponent(s)));
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
}
const lpub = (u) => ({ id: u.id, username: u.username, first: u.first, last: u.last, photo: u.photo });
const lself = (u) => ({ ...lpub(u), email: u.email, cover: u.cover || '', phone: u.phone || '', bio: u.bio || '', profileDone: u.profileDone });
const same = (x, y) => String(x) === String(y);

async function localApi(path, o = {}) {
  const d = ldb.get(), m = o.method || 'GET', b = o.body || {}, [route, qs] = path.split('?'), q = new URLSearchParams(qs || '');
  d.msgs = d.msgs || [];
  if (m === 'GET' && route === 'username') {
    const u = (q.get('u') || '').toLowerCase();
    if (!UNAME.test(u)) return { available: false, valid: false };
    const mine = d.users.find((x) => x.id === d.session);
    return { available: !d.users.some((x) => x.username === u && x !== mine), valid: true };
  }
  if (m === 'POST' && route === 'register') {
    const username = String(b.username || '').toLowerCase(), email = String(b.email || '').trim().toLowerCase(), pass = String(b.password || '');
    if (!UNAME.test(username)) return lfail('اسم المستخدم غير صالح');
    if (!validEmail(email)) return lfail('اكتب بريد إلكتروني صحيح');
    if (pass.length < 6) return lfail('كلمة المرور لازم 6 رموز على الأقل');
    if (d.users.some((x) => x.username === username)) return lfail('اسم المستخدم غير متاح', 409, 'username');
    if (d.users.some((x) => x.email === email)) return lfail('هذا البريد مستخدم بحساب ثاني', 409, 'email');
    const id = Date.now(), u = { id, username, email, hash: await lhash(id, pass), first: '', last: '', photo: '', profileDone: false };
    d.users.push(u); d.session = u.id; ldb.set(d);
    return { token: 'local', user: lself(u) };
  }
  if (m === 'POST' && route === 'login') {
    const email = String(b.email || '').trim().toLowerCase(), pass = String(b.password || '');
    if (!validEmail(email)) return lfail('اكتب بريد إلكتروني صحيح');
    const u = d.users.find((x) => x.email === email);
    if (!u || u.hash !== (await lhash(u.id, pass))) return lfail('البريد أو كلمة المرور غلط', 401);
    d.session = u.id; ldb.set(d);
    return { token: 'local', user: lself(u) };
  }
  if (m === 'POST' && route === 'google') {
    const email = String(b.email || '').trim().toLowerCase();
    if (!validEmail(email)) return lfail('\u062d\u0633\u0627\u0628 Google \u0645\u0627 \u0631\u062c\u0639 \u0628\u0631\u064a\u062f \u0635\u062d\u064a\u062d');
    let u = d.users.find((x) => x.email === email);
    if (!u) {
      let base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16); if (base.length < 3) base = 'user' + base;
      let name = base, n = 1; while (d.users.some((x) => x.username === name)) name = base + (n++);
      u = { id: Date.now(), username: name, email, hash: '', first: String(b.first || '').slice(0, 40), last: String(b.last || '').slice(0, 40), photo: '', profileDone: false };
      d.users.push(u);
    }
    d.session = u.id; ldb.set(d);
    return { token: 'local', user: lself(u) };
  }
  const cur = d.users.find((x) => x.id === d.session);
  if (!cur) return lfail('سجل الدخول أولاً', 401);
  if (m === 'GET' && route === 'me') return { user: lself(cur) };
  if (m === 'POST' && route === 'logout') { d.session = null; ldb.set(d); return { ok: true }; }
  if (m === 'PATCH' && route === 'me') {
    for (const k of ['first', 'last']) if (k in b) { if (typeof b[k] !== 'string' || b[k].length > 40) return lfail('نص طويل'); cur[k] = b[k].trim(); }
    if ('username' in b) {
      const n = String(b.username).trim().toLowerCase();
      if (!UNAME.test(n)) return lfail('اسم المستخدم غير صالح', 400, 'username');
      if (d.users.some((x) => x.username === n && x !== cur)) return lfail('اسم المستخدم غير متاح', 409, 'username');
      cur.username = n;
    }
    if ('photo' in b) { if (b.photo !== '' && !safePhoto(b.photo)) return lfail('الصورة غير صالحة'); cur.photo = b.photo; }
    if ('phone' in b) { const ph = String(b.phone).replace(/[\s-]/g, ''); if (ph !== '' && !/^\+?[0-9]{7,15}$/.test(ph)) return lfail('رقم الهاتف غير صالح'); cur.phone = ph; }
    if ('bio' in b) { if (typeof b.bio !== 'string' || b.bio.length > 140) return lfail('الوصف طويل (الحد 140 حرف)'); cur.bio = b.bio.trim(); }
    if ('cover' in b) { if (b.cover !== '' && !safePhoto(b.cover)) return lfail('الصورة غير صالحة'); cur.cover = b.cover; }
    if ('profileDone' in b) cur.profileDone = !!b.profileDone;
    ldb.set(d); return { user: lself(cur) };
  }
  const match = (u, s) => [u.username, u.first, u.last].some((v) => (v || '').toLowerCase().includes(s));
  if (m === 'GET' && route === 'search') {
    const s = (q.get('q') || '').trim().toLowerCase().replace(/^@/, '');
    if (!s) return { users: [] };
    const hit = d.users.filter((u) => u.id !== cur.id && u.profileDone && match(u, s));
    hit.sort((a, c) => (c.username.startsWith(s) - a.username.startsWith(s)) || a.username.localeCompare(c.username));
    return { users: hit.slice(0, 20).map(lpub) };
  }

  if (m === 'GET' && route === 'user') {
    const s = (q.get('u') || '').trim().toLowerCase().replace(/^@/, '');
    const p = d.users.find((x) => x.username === s && (x.profileDone || x === cur));
    if (!p) return lfail('لا يوجد مستخدم', 404);
    return { user: { ...lpub(p), cover: p.cover || '', phone: p.phone || '', bio: p.bio || '' }, self: p === cur, muted: (cur.muted || []).includes(String(p.id)) };
  }

  /* ----- الدردشة ----- */
  const findPeer = (id) => d.users.find((x) => same(x.id, id) && x.id !== cur.id);
  const convo = (id) => d.msgs.filter((x) => (same(x.a, cur.id) && same(x.b, id)) || (same(x.a, id) && same(x.b, cur.id)));
  const out = (x) => ({ id: x.id, mine: same(x.a, cur.id), text: x.text, t: x.t, att: x.att || null });
  const mk = (a, to, text, t, att) => ({ id: t + '-' + Math.random().toString(36).slice(2, 7), a, b: to, text, t, att: att || null });

  if (m === 'GET' && route === 'chats') {
    const last = new Map();
    for (const x of d.msgs) {
      const mine = same(x.a, cur.id);
      if (!mine && !same(x.b, cur.id)) continue;
      const pid = String(mine ? x.b : x.a), p = last.get(pid);
      if (!p || x.t >= p.t) last.set(pid, x);
    }
    const chats = [];
    for (const [pid, x] of last) { const p = findPeer(pid); if (p) chats.push({ peer: lpub(p), last: out(x), muted: (cur.muted || []).includes(String(pid)) }); }
    chats.sort((a, c) => c.last.t - a.last.t);
    return { chats };
  }
  if (m === 'GET' && route === 'messages') {
    const p = findPeer(q.get('peer'));
    if (!p) return lfail('المستخدم غير موجود', 404);
    return { peer: lpub(p), messages: convo(p.id).sort((a, c) => a.t - c.t).map(out) };
  }
  if (m === 'POST' && route === 'messages') {
    const p = findPeer(b.peer), text = String(b.text || '').trim();
    if (!p) return lfail('المستخدم غير موجود', 404);
    const a = b.att && typeof b.att === 'object' ? b.att : null;
    const att = a ? { id: String(a.id || '').slice(0, 60), kind: ['image', 'video', 'file'].includes(a.kind) ? a.kind : 'file', name: String(a.name || 'ملف').slice(0, 120), size: +a.size || 0, mime: String(a.mime || '').slice(0, 80) } : null;
    if (!text && !att) return lfail('اكتب رسالة');
    if (text.length > 1000) return lfail('الرسالة طويلة');
    const msg = mk(cur.id, p.id, text, Date.now(), att); d.msgs.push(msg);
    ldb.set(d);
    return { message: out(msg) };
  }
  if (m === 'POST' && route === 'mute') {
    const p = findPeer(b.peer); if (!p) return lfail('المستخدم غير موجود', 404);
    const set = new Set(cur.muted || []); b.muted ? set.add(String(p.id)) : set.delete(String(p.id));
    cur.muted = [...set]; ldb.set(d); return { muted: !!b.muted };
  }

  /* ----- القصص (تنتهي بعد 24 ساعة) ----- */
  if (route === 'stories') {
    const now = Date.now(); d.stories = (d.stories || []).filter((x) => now - x.t < 864e5);
    if (m === 'POST') {
      const mediaId = String(b.mediaId || '').slice(0, 60); if (!mediaId) return lfail('الصورة مطلوبة');
      d.stories.push({ id: 's' + now + Math.random().toString(36).slice(2, 6), uid: cur.id, mediaId, kind: b.kind === 'video' ? 'video' : 'image', caption: String(b.caption || '').slice(0, 500), t: now });
      ldb.set(d); return { ok: true };
    }
    if (m === 'DELETE') { const id = q.get('id'); d.stories = d.stories.filter((x) => !(x.id === id && same(x.uid, cur.id))); ldb.set(d); return { ok: true }; }
    if (m === 'GET') {
      const by = new Map();
      for (const x of d.stories) {
        const k = String(x.uid); if (!by.has(k)) by.set(k, []); by.get(k).push(x);
      }
      let mine = []; const groups = [];
      for (const [uid, items] of by) {
        items.sort((a, c) => a.t - c.t);
        if (same(uid, cur.id)) { mine = items; continue; }
        const p = findPeer(uid); if (p) groups.push({ user: lpub(p), items, t: items[items.length - 1].t });
      }
      groups.sort((a, c) => c.t - a.t);
      return { mine, groups: groups.slice(0, 10) };
    }
  }
  return lfail('غير موجود', 404);
}

