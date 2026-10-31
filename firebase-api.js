/* ===== firebase-api.js — Firebase Auth + Realtime Database (نفس مسارات local-api.js) ===== */
const ferr = (m, s = 400, field) => Object.assign(new Error(m), { status: s, field });
const FBKEY = 'مفتاح Firebase ما يشتغل بالموقع: سجّل تطبيق ويب (</>) بإعدادات المشروع وحط الـ apiKey الجديد بـ js/config.js';
const FB_MSG = {
  'auth/email-already-in-use': 'هذا البريد مستخدم بحساب ثاني', 'auth/invalid-email': 'اكتب بريد إلكتروني صحيح',
  'auth/weak-password': 'كلمة المرور لازم 6 رموز على الأقل', 'auth/too-many-requests': 'محاولات كثيرة، انتظر شوي وجرب',
  'auth/network-request-failed': 'تعذر الاتصال بالإنترنت', 'auth/popup-closed-by-user': 'تم الإلغاء', 'auth/cancelled-popup-request': 'تم الإلغاء',
  'auth/popup-blocked': 'المتصفح منع نافذة Google، اسمح بالنوافذ المنبثقة', 'auth/operation-not-allowed': 'هذي الطريقة غير مفعّلة بقسم Authentication بـ Firebase',
  'auth/unauthorized-domain': 'أضف رابط موقعك بـ Authentication ثم Settings ثم Authorized domains'
};
function ferror(e) {
  if (e.status) return e;
  const c = e.code || '', msg = e.message || '';
  if (c.includes('api-key') || c.includes('referer')) return ferr(FBKEY);
  if (['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'].includes(c)) return ferr('البريد أو كلمة المرور غلط', 401);
  if (c === 'PERMISSION_DENIED' || /permission_denied/i.test(msg)) return ferr('ما عندك صلاحية: تأكد من نشر قواعد قاعدة البيانات', 403);
  return ferr(FB_MSG[c] || msg || 'صار خطأ');
}
let _fb;
function fb() {
  if (_fb) return _fb;
  if (!window.firebase) throw ferr('تعذر تحميل Firebase، تأكد من الإنترنت');
  firebase.initializeApp(FIREBASE_CONFIG);
  const auth = firebase.auth(); auth.languageCode = 'ar';
  return (_fb = { auth, db: firebase.database(), ready: new Promise((r) => { const off = auth.onAuthStateChanged((u) => { off(); r(u); }); }) });
}
const fT = () => firebase.database.ServerValue.TIMESTAMP;
const fpub = (id, v = {}) => ({ id, username: v.username || '', first: v.first || '', last: v.last || '', photo: v.photo || '' });
const fself = (a, v = {}) => ({ ...fpub(a.uid, v), email: a.email || '', cover: v.cover || '', phone: v.phone || '', bio: v.bio || '', profileDone: !!v.profileDone,
  needsVerify: !a.emailVerified && a.providerData.some((p) => p.providerId === 'password') });
const fChat = (a, b) => [a, b].sort().join('_');
const fImg = (src, size, q) => new Promise((ok, no) => {
  const im = new Image(); im.crossOrigin = 'anonymous';
  im.onload = () => {
    try {
      const r = size.square ? 1 : Math.min(1, size.max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = size.square || Math.round(im.width * r); c.height = size.square || Math.round(im.height * r);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', q));
    } catch (e) { no(e); }
  };
  im.onerror = () => no(ferr('تعذر قراءة الصورة')); im.src = src;
});
const fBlobData = async (blob) => { const u = URL.createObjectURL(blob); try { return await fImg(u, { max: 900 }, 0.75); } finally { URL.revokeObjectURL(u); } };

async function fbApi(path, o = {}) { try { return await fbRoute(path, o); } catch (e) { throw ferror(e); } }
async function fbRoute(path, o) {
  const { auth, db, ready } = fb(), m = o.method || 'GET', b = o.body || {}, [route, qs] = path.split('?'), q = new URLSearchParams(qs || '');
  const val = async (p) => (await db.ref(p).once('value')).val();
  const fcur = async () => { await ready; const a = auth.currentUser; if (!a) throw ferr('سجل الدخول أولاً', 401); return a; };

  if (m === 'GET' && route === 'username') {
    const u = (q.get('u') || '').toLowerCase(); if (!UNAME.test(u)) return { available: false, valid: false };
    const owner = await val('usernames/' + u); await ready;
    return { available: !owner || (!!auth.currentUser && owner === auth.currentUser.uid), valid: true };
  }
  if (m === 'POST' && route === 'register') {
    const username = String(b.username || '').toLowerCase(), email = String(b.email || '').trim(), pass = String(b.password || '');
    if (!UNAME.test(username)) throw ferr('اسم المستخدم غير صالح');
    if (!validEmail(email)) throw ferr('اكتب بريد إلكتروني صحيح');
    if (pass.length < 6) throw ferr('كلمة المرور لازم 6 رموز على الأقل');
    if (await val('usernames/' + username)) throw ferr('اسم المستخدم غير متاح', 400, 'username');
    const a = (await auth.createUserWithEmailAndPassword(email, pass)).user;
    try {
      await db.ref('usernames/' + username).set(a.uid);
      await db.ref('users/' + a.uid).set({ username, first: '', last: '', photo: '', profileDone: false });
    } catch (e) { await db.ref('usernames/' + username).remove().catch(() => {}); await a.delete().catch(() => {}); throw e; }
    a.sendEmailVerification().catch(() => {});
    return { token: 'fb', user: fself(a, { username }) };
  }
  if (m === 'POST' && route === 'login') {
    const email = String(b.email || '').trim(); if (!validEmail(email)) throw ferr('اكتب بريد إلكتروني صحيح');
    const a = (await auth.signInWithEmailAndPassword(email, String(b.password || ''))).user;
    return { token: 'fb', user: fself(a, (await val('users/' + a.uid)) || {}) };
  }
  if (m === 'POST' && route === 'google') {
    const a = (await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())).user;
    let v = await val('users/' + a.uid);
    if (!v) {
      const b0 = (a.email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16), base = b0.length < 3 ? 'user' + b0 : b0;
      let name = base, n = 1; while (await val('usernames/' + name)) name = base + n++;
      const parts = (a.displayName || '').trim().split(/\s+/).filter(Boolean);
      const photo = a.photoURL ? await fImg(a.photoURL.replace(/=s\d+-c$/, '=s256-c'), { square: 256 }, 0.85).catch(() => '') : '';
      v = { username: name, first: (parts.shift() || '').slice(0, 40), last: parts.join(' ').slice(0, 40), photo, profileDone: false };
      await db.ref('usernames/' + name).set(a.uid); await db.ref('users/' + a.uid).set(v);
    }
    return { token: 'fb', user: fself(a, v) };
  }
  if (m === 'POST' && route === 'logout') { await auth.signOut(); return { ok: true }; }

  const a = await fcur(), uid = a.uid;
  if (m === 'POST' && route === 'verify-send') { await a.sendEmailVerification(); return { ok: true }; }
  if (m === 'GET' && route === 'me') { if (q.get('refresh')) await a.reload(); return { user: fself(a, (await val('users/' + uid)) || {}) }; }
  if (m === 'PATCH' && route === 'me') {
    const cur = (await val('users/' + uid)) || {}, up = {};
    for (const k of ['first', 'last']) if (k in b) { if (typeof b[k] !== 'string' || b[k].length > 40) throw ferr('نص طويل'); up[k] = b[k].trim(); }
    for (const k of ['photo', 'cover']) if (k in b) { if (b[k] !== '' && !safePhoto(b[k])) throw ferr('الصورة غير صالحة'); up[k] = b[k]; }
    if ('phone' in b) { const ph = String(b.phone).replace(/[\s-]/g, ''); if (ph !== '' && !/^\+?[0-9]{7,15}$/.test(ph)) throw ferr('رقم الهاتف غير صالح'); up.phone = ph; }
    if ('bio' in b) { if (typeof b.bio !== 'string' || b.bio.length > 140) throw ferr('الوصف طويل (الحد 140 حرف)'); up.bio = b.bio; }
    if ('profileDone' in b) up.profileDone = !!b.profileDone;
    if ('username' in b) {
      const n = String(b.username).trim().toLowerCase(); if (!UNAME.test(n)) throw ferr('اسم المستخدم غير صالح', 400, 'username');
      if (n !== cur.username) {
        const owner = await val('usernames/' + n); if (owner && owner !== uid) throw ferr('اسم المستخدم غير متاح', 400, 'username');
        await db.ref('usernames/' + n).set(uid); up.username = n;
      }
    }
    await db.ref('users/' + uid).update(up);
    if (up.username && cur.username) db.ref('usernames/' + cur.username).remove().catch(() => {});
    return { user: fself(a, { ...cur, ...up }) };
  }
  if (m === 'GET' && route === 'search') {
    const s = (q.get('q') || '').trim().toLowerCase().replace(/^@/, ''); if (!s) return { users: [] };
    const cap = s[0].toUpperCase() + s.slice(1), by = (k, v) => db.ref('users').orderByChild(k).startAt(v).endAt(v + '\uf8ff').limitToFirst(20).once('value').then((x) => x.val() || {});
    const qs2 = [by('username', s), by('first', s), by('last', s)]; if (cap !== s) qs2.push(by('first', cap), by('last', cap));
    const raw = (await Promise.all(qs2)).reduce((r, x) => Object.assign(r, x), {});
    const users = Object.entries(raw).filter(([id, v]) => id !== uid && v.profileDone)
      .sort(([, x], [, y]) => (y.username.startsWith(s) - x.username.startsWith(s)) || x.username.localeCompare(y.username)).slice(0, 20).map(([id, v]) => fpub(id, v));
    return { users };
  }
  if (m === 'GET' && route === 'user') {
    const s = (q.get('u') || '').trim().toLowerCase().replace(/^@/, '');
    const id = UNAME.test(s) && (await val('usernames/' + s)), v = id && (await val('users/' + id));
    if (!v || !(v.profileDone || id === uid)) throw ferr('لا يوجد مستخدم', 404);
    return { user: { ...fpub(id, v), cover: v.cover || '', phone: v.phone || '', bio: v.bio || '' }, self: id === uid, muted: !!(await val('muted/' + uid + '/' + id)) };
  }
  if (m === 'GET' && route === 'chats') {
    const [uc, mu] = await Promise.all([val('userChats/' + uid), val('muted/' + uid)]), ids = Object.keys(uc || {});
    const us = await Promise.all(ids.map((id) => val('users/' + id)));
    const chats = ids.map((id, i) => us[i] && { peer: fpub(id, us[i]), last: { mine: uc[id].from === uid, text: uc[id].last || '', t: uc[id].t || 0, att: uc[id].att ? { kind: uc[id].att } : null }, muted: !!(mu && mu[id]) }).filter(Boolean);
    return { chats: chats.sort((x, y) => y.last.t - x.last.t) };
  }
  const okId = (v) => /^[A-Za-z0-9_-]{1,64}$/.test(v || '');
  if (route === 'privacy') { /* وضع الخصوصية: privacy/{أنا}/{الشخص} = true */
    const pid = m === 'GET' ? q.get('peer') : b.peer;
    if (!okId(pid) || !(await val('users/' + pid))) throw ferr('المستخدم غير موجود', 404);
    const r = db.ref('privacy/' + uid + '/' + pid);
    if (m === 'GET') return { on: !!(await r.once('value')).val() };
    await (b.on ? r.set(true) : r.remove()); return { on: !!b.on };
  }
  if (route === 'blob') { /* محتوى الصور والبصمات: blobs/{chat}/{id} */
    const pid = m === 'GET' ? q.get('peer') : b.peer, id = m === 'GET' ? q.get('id') : b.id;
    if (!okId(pid) || !okId(id) || !(await val('users/' + pid))) throw ferr('غير موجود', 404);
    const ref = db.ref('blobs/' + fChat(uid, pid) + '/' + id);
    if (m === 'GET') return { data: (await ref.once('value')).val() || '' };
    const data = String(b.data || '');
    if (!/^data:[a-z]+\/[\w.+-]+(;[^;,]+)*;base64,/.test(data.slice(0, 150))) throw ferr('ملف غير صالح');
    if (data.length > 1450000) throw ferr('الملف كبير');
    await ref.set(data); return { ok: true };
  }
  if (route === 'messages') {
    const pid = m === 'GET' ? q.get('peer') : b.peer, pv = pid && (await val('users/' + pid));
    if (!pv) throw ferr('المستخدم غير موجود', 404);
    const cid = fChat(uid, pid);
    if (m === 'GET') {
      const snap = await db.ref('messages/' + cid).orderByChild('t').limitToLast(200).once('value'), out = [];
      snap.forEach((x) => { const v = x.val(); out.push({ id: x.key, mine: v.from === uid, text: v.text || '', t: v.t, att: v.att || null }); });
      return { peer: fpub(pid, pv), messages: out };
    }
    const text = String(b.text || '').trim(), x = b.att && typeof b.att === 'object' ? b.att : null;
    const att = x ? { id: String(x.id || '').slice(0, 60), kind: ['image', 'video', 'file', 'voice'].includes(x.kind) ? x.kind : 'file', name: String(x.name || 'ملف').slice(0, 120), size: +x.size || 0, mime: String(x.mime || '').slice(0, 100), ...(x.blob ? { blob: true } : {}), ...(+x.dur > 0 ? { dur: Math.min(600, Math.round(+x.dur)) } : {}) } : null;
    if (!text && !att) throw ferr('اكتب رسالة'); if (text.length > 1000) throw ferr('الرسالة طويلة');
    const ref = db.ref('messages/' + cid).push(), data = { from: uid, t: fT() }; if (text) data.text = text; if (att) data.att = att;
    await ref.set(data);
    const t = (await ref.once('value')).val().t, last = { last: text, from: uid, t: fT(), ...(att ? { att: att.kind } : {}) };
    await db.ref().update({ ['userChats/' + uid + '/' + pid]: last, ['userChats/' + pid + '/' + uid]: last });
    return { message: { id: ref.key, mine: true, text, t, att } };
  }
  if (m === 'POST' && route === 'mute') {
    const pid = b.peer; if (!pid || !(await val('users/' + pid))) throw ferr('المستخدم غير موجود', 404);
    const r = db.ref('muted/' + uid + '/' + pid); await (b.muted ? r.set(true) : r.remove()); return { muted: !!b.muted };
  }
  if (route === 'stories') {
    const now = Date.now(), ref = db.ref('stories/' + uid);
    if (m === 'POST') {
      const mediaId = String(b.mediaId || '').slice(0, 60), url = mediaId && (await mediaUrl(mediaId)); if (!url) throw ferr('الصورة مطلوبة');
      const kind = b.kind === 'video' ? 'video' : 'image', blob = await (await fetch(url)).blob(); URL.revokeObjectURL(url);
      const data = kind === 'video' ? await blobToDataUrl(blob) : await (async () => { const u2 = URL.createObjectURL(blob); try { return await fImg(u2, { max: 1280 }, 0.85); } finally { URL.revokeObjectURL(u2); } })();
      await ref.push().set({ mediaId, kind, caption: String(b.caption || '').slice(0, 500), t: fT(), data }); return { ok: true };
    }
    if (m === 'DELETE') { await ref.child(q.get('id')).remove(); return { ok: true }; }
    const all = (await val('stories')) || {}, groups = []; let mine = [];
    for (const [id, items] of Object.entries(all)) {
      const list = [];
      for (const [sid, s] of Object.entries(items)) {
        if (now - s.t > 864e5) { if (id === uid) ref.child(sid).remove().catch(() => {}); continue; }
        if (id !== uid && !(await mediaHas(s.mediaId))) { try { await mediaPut(s.mediaId, await (await fetch(s.data)).blob()); } catch (e) { continue; } }
        list.push({ id: sid, uid: id, mediaId: s.mediaId, kind: s.kind || 'image', caption: s.caption || '', t: s.t });
      }
      if (!list.length) continue; list.sort((x, y) => x.t - y.t);
      if (id === uid) mine = list; else { const v = await val('users/' + id); if (v) groups.push({ user: fpub(id, v), items: list, t: list[list.length - 1].t }); }
    }
    return { mine, groups: groups.sort((x, y) => y.t - x.t).slice(0, 10) };
  }
  throw ferr('غير موجود', 404);
}
