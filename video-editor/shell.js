'use strict';
/* ============================================================
   كليبو — إطار التطبيق: الإعدادات، اللغة، الحسابات، المشاريع، شاشات الدخول
   (الجزء الثاني في shell2.js: القوالب، الرئيسية، الإعدادات، الملف الشخصي، التشغيل)
   ============================================================ */
const STO = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { localStorage.setItem(k, JSON.stringify(v)); } };
const SETDEF = { lang: 'ar', theme: 'auto', accent: '#2ee6d0', notif: true, osNotif: false, snap: true, wave: true, autosave: true, defRatio: '16:9', exp: { short: 1080, fps: 30, q: 1 }, gClient: '', fbApp: '' };
let SET = { ...SETDEF, ...STO.get('ve-settings', {}) }; SET.exp = { ...SETDEF.exp, ...(SET.exp || {}) };
const saveSet = () => STO.set('ve-settings', SET);
const L = (ar, en) => SET.lang === 'en' ? en : ar;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function applySettings() {
  const r = document.documentElement;
  r.dataset.theme = SET.theme === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : SET.theme;
  r.style.setProperty('--ac', SET.accent); r.lang = SET.lang; r.dir = SET.lang === 'en' ? 'ltr' : 'rtl';
  cfg.snap = SET.snap; cfg.wave = SET.wave; cfg.autosave = SET.autosave;
}
/* احترام إعداد التنبيهات */
const _toast = window.toast; window.toast = (m, ms) => { if (SET.notif) _toast(m, ms); };

const IC = {
  home: 'M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z', template: 'M3 3h8v8H3zM13 3h8v5h-8zM13 11h8v10h-8zM3 13h8v8H3z',
  folder: 'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12h2m12 0h2M12 4v2m0 12v2M6.3 6.3l1.4 1.4m8.6 8.6l1.4 1.4M6.3 17.7l1.4-1.4m8.6-8.6l1.4-1.4',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  plus: 'M12 5v14M5 12h14', trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14', copy: 'M9 9h11v11H9zM5 15V5h10', edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  download: 'M12 3v12m0 0l-4-4m4 4l4-4M4 21h16', upload: 'M12 15V3m0 0L8 7m4-4l4 4M4 21h16', logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  more: 'M12 5h.01M12 12h.01M12 19h.01', back: 'M15 18l-6-6 6-6', check: 'M20 6L9 17l-5-5', play: 'M6 4l14 8-14 8z', pause: 'M6 4h4v16H6zM14 4h4v16h-4z', cloud: 'M18 10h-1.3A8 8 0 1 0 9 18h9a4 4 0 0 0 0-8z',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', restore: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5', star: 'M12 2l3 7 7 .6-5.3 4.7L18.2 22 12 18l-6.2 4 1.5-7.7L2 9.6 9 9z',
};
const ic = (n, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${IC[n]}"/></svg>`;
const fmtDate = ts => new Date(ts).toLocaleString(SET.lang === 'en' ? 'en-GB' : 'ar', { dateStyle: 'medium', timeStyle: 'short' });
const fmtSize = b => b > 1073741824 ? (b / 1073741824).toFixed(2) + ' GB' : b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const dl = (blob, name) => { const a = h('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); };
function confirmBox(msg, okLabel, danger) { return new Promise(res => { let done = false; const m = modal(L('تأكيد', 'Confirm'), b => b.append(h('p', '', esc(msg))), [[L('إلغاء', 'Cancel'), m => { done = true; m.remove(); res(false); }], [okLabel || L('موافق', 'OK'), m => { done = true; m.remove(); res(true); }, danger ? 'primary' : 'primary']]); m.addEventListener('remove', () => {}); }); }
function promptBox(title, value, ph) { return new Promise(res => { let inp; modal(title, b => { inp = h('input'); inp.type = 'text'; inp.value = value || ''; inp.placeholder = ph || ''; inp.style.cssText = 'width:100%;background:var(--p1);border:1px solid var(--bd);border-radius:8px;padding:9px;color:var(--tx)'; b.append(inp); setTimeout(() => { inp.focus(); inp.select(); }, 30); inp.onkeydown = e => { if (e.key === 'Enter') { const v = inp.value.trim(); inp.closest('.modal').remove(); res(v || null); } }; }, [[L('إلغاء', 'Cancel'), m => { m.remove(); res(null); }], [L('حفظ', 'Save'), m => { const v = inp.value.trim(); m.remove(); res(v || null); }, 'primary']]); }); }
function popMenu(anchor, items) {
  $$('.pop').forEach(x => x.remove()); const m = h('div', 'pop'); const r = anchor.getBoundingClientRect();
  for (const it of items) { if (it === '-') { m.append(h('hr')); continue; } if (it.head) { m.append(h('div', 'hd', esc(it.head))); continue; } const b = h('button', it.danger ? 'dg' : '', (it.icon ? ic(it.icon, 16) : '') + `<span>${esc(it.label)}</span>`); b.onclick = e => { e.stopPropagation(); m.remove(); it.fn(); }; m.append(b); }
  document.body.append(m); const w = m.offsetWidth, hh = m.offsetHeight;
  let x = SET.lang === 'en' ? r.left : r.right - w; x = clamp(x, 8, innerWidth - w - 8); let y = r.bottom + 6; if (y + hh > innerHeight - 8) y = Math.max(8, r.top - hh - 6);
  m.style.left = x + 'px'; m.style.top = y + 'px'; setTimeout(() => addEventListener('click', function f() { m.remove(); removeEventListener('click', f); }, { once: true }), 0);
}

/* ---------------- التشفير والحسابات ---------------- */
const b64e = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function pbkdf2(pw, saltB64) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  return b64e(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: b64d(saltB64), iterations: 150000, hash: 'SHA-256' }, key, 256));
}
const newSalt = () => b64e(crypto.getRandomValues(new Uint8Array(16)));
function genRecovery() { const al = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint8Array(16)); let s = ''; r.forEach((b, i) => { s += al[b % al.length]; if (i % 4 === 3 && i < 15) s += '-'; }); return s; }
const normRec = c => String(c || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const Users = { all: () => STO.get('ve-users', {}), save: u => STO.set('ve-users', u) };
const Auth = {
  get sess() { return STO.get('ve-session', null); },
  get user() { const s = this.sess; return s && s.uid ? Users.all()[s.uid] || null : null; },
  get guest() { const s = this.sess; return !!(s && s.guest); },
  get owner() { return this.user ? this.user.id : 'guest'; },
  get ready() { return !!(this.user || this.guest); },
  findByEmail(e) { e = String(e).trim().toLowerCase(); return Object.values(Users.all()).find(u => u.email === e) || null; },
  async signup(name, email, pw) {
    email = String(email).trim().toLowerCase();
    if (!name.trim()) throw { code: 'name', msg: L('أدخل الاسم', 'Enter your name') };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw { code: 'email', msg: L('البريد الإلكتروني غير صالح', 'Invalid email address') };
    if (this.findByEmail(email)) throw { code: 'dup', msg: L('هذا البريد مسجّل مسبقاً، سجّل الدخول بدلاً من ذلك', 'This email is already registered — log in instead') };
    if (pwScore(pw) < 2) throw { code: 'pw', msg: L('كلمة المرور ضعيفة: استخدم 8 أحرف على الأقل مع أرقام أو رموز', 'Weak password: use at least 8 characters with numbers or symbols') };
    const salt = newSalt(), rsalt = newSalt(), code = genRecovery(), u = { id: 'u_' + uid() + uid(), name: name.trim(), email, salt, hash: await pbkdf2(pw, salt), rsalt, rhash: await pbkdf2(normRec(code), rsalt), avatar: '', created: Date.now(), provider: 'email' };
    const all = Users.all(); all[u.id] = u; Users.save(all); STO.set('ve-session', { uid: u.id }); return { user: u, code };
  },
  lockInfo(email) { const l = STO.get('ve-lock', {})[email]; return l && l.until > Date.now() ? Math.ceil((l.until - Date.now()) / 1000) : 0; },
  async login(email, pw) {
    email = String(email).trim().toLowerCase(); const u = this.findByEmail(email), lk = this.lockInfo(email);
    if (lk) throw { code: 'locked', msg: L(`محاولات كثيرة. انتظر ${lk} ثانية`, `Too many attempts. Wait ${lk}s`) };
    if (!u) throw { code: 'nouser', msg: L('لا يوجد حساب بهذا البريد', 'No account with this email') };
    if (!u.hash) throw { code: 'social', msg: L('هذا الحساب أُنشئ عبر ' + u.provider + ' — استخدم تلك الطريقة للدخول', 'This account was created with ' + u.provider + ' — use that method to log in') };
    if (await pbkdf2(pw, u.salt) !== u.hash) {
      const all = STO.get('ve-lock', {}), l = all[email] || { n: 0, until: 0 }; l.n++; if (l.n >= 5) { l.until = Date.now() + 30000; l.n = 0; } all[email] = l; STO.set('ve-lock', all);
      throw { code: 'badpw', msg: L('كلمة المرور غير صحيحة', 'Incorrect password') };
    }
    const all = STO.get('ve-lock', {}); delete all[email]; STO.set('ve-lock', all); STO.set('ve-session', { uid: u.id }); return u;
  },
  async recover(email, code, npw) {
    const u = this.findByEmail(email); if (!u || !u.rhash || await pbkdf2(normRec(code), u.rsalt) !== u.rhash) throw { code: 'rec', msg: L('البريد أو رمز الاستعادة غير صحيح', 'Email or recovery code is incorrect') };
    if (pwScore(npw) < 2) throw { code: 'pw', msg: L('كلمة المرور الجديدة ضعيفة', 'New password is too weak') };
    const all = Users.all(), salt = newSalt(), rc = genRecovery(), rsalt = newSalt();
    Object.assign(all[u.id], { salt, hash: await pbkdf2(npw, salt), rsalt, rhash: await pbkdf2(normRec(rc), rsalt) }); Users.save(all); STO.set('ve-session', { uid: u.id }); return rc;
  },
  async changePassword(cur, npw) {
    const u = this.user; if (!u || !u.hash || await pbkdf2(cur, u.salt) !== u.hash) throw { msg: L('كلمة المرور الحالية غير صحيحة', 'Current password is incorrect') };
    if (pwScore(npw) < 2) throw { msg: L('كلمة المرور الجديدة ضعيفة', 'New password is too weak') };
    const all = Users.all(), salt = newSalt(); all[u.id].salt = salt; all[u.id].hash = await pbkdf2(npw, salt); Users.save(all);
  },
  async newRecovery() { const u = this.user, c = genRecovery(), all = Users.all(); all[u.id].rsalt = newSalt(); all[u.id].rhash = await pbkdf2(normRec(c), all[u.id].rsalt); Users.save(all); return c; },
  update(patch) { const u = this.user; if (!u) return; const all = Users.all(); Object.assign(all[u.id], patch); Users.save(all); },
  socialLogin(provider, email, name, pic) {
    email = String(email || '').toLowerCase(); let u = email && this.findByEmail(email);
    const all = Users.all(); if (!u) { u = { id: 'u_' + uid() + uid(), name: name || email.split('@')[0] || provider, email, avatar: pic || '', created: Date.now(), provider }; all[u.id] = u; Users.save(all); }
    STO.set('ve-session', { uid: u.id }); return u;
  },
  logout() { STO.set('ve-session', null); },
  asGuest() { STO.set('ve-session', { guest: true }); },
};
function pwScore(p) { let s = 0; if (p.length >= 8) s++; if (/[A-Za-z]/.test(p) && /\d/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p) || p.length >= 12) s++; if (p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p)) s++; return Math.min(s, 4); }

/* ---------------- المشاريع (IndexedDB، مفصولة حسب المالك) ---------------- */
Object.defineProperty(window, '__owner', { get: () => Auth.owner });
const Proj = {
  async all() { return ((await tx('readonly', s => s.getAll())) || []).filter(p => (p.owner || 'guest') === Auth.owner); },
  get: id => tx('readonly', s => s.get(id)),
  put: p => tx('readwrite', s => s.put(p)),
  del: id => tx('readwrite', s => s.delete(id)),
  size: p => (p.media || []).reduce((a, m) => a + (m.blob ? m.blob.size : 0), 0),
  async create({ name, ratio, base }) {
    const p = { id: uid(), name: name || L('مشروع جديد', 'New project'), ratio: ratio || [16, 9], clips: [], media: [], lanes: {}, owner: Auth.owner, created: Date.now(), updated: Date.now(), thumb: null, dur: 0, ...base };
    await this.put(p); return p;
  },
  async duplicate(id) { const p = await this.get(id); if (!p) return; const n = { ...p, id: uid(), name: p.name + L(' (نسخة)', ' (copy)'), created: Date.now(), updated: Date.now() }; await this.put(n); return n; },
  async rename(id, name) { const p = await this.get(id); if (!p) return; p.name = name; p.updated = Date.now(); await this.put(p); },
  async trash(id) { const p = await this.get(id); if (!p) return; p.deleted = Date.now(); await this.put(p); },
  async restore(id) { const p = await this.get(id); if (!p) return; delete p.deleted; await this.put(p); },
  async exportFile(id) {
    const p = await this.get(id); if (!p) return; const rd = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
    const out = { vproj: 1, ...p, thumb: p.thumb, media: await Promise.all((p.media || []).map(async m => ({ ...m, blob: await rd(m.blob) }))) };
    dl(new Blob([JSON.stringify(out)], { type: 'application/json' }), (p.name || 'project') + '.vproj');
  },
  async importFile(file) {
    const j = JSON.parse(await file.text()); if (!j.vproj) throw new Error(L('ملف مشروع غير صالح', 'Invalid project file'));
    j.media = await Promise.all((j.media || []).map(async m => ({ ...m, blob: await (await fetch(m.blob)).blob() })));
    const p = { ...j, id: uid(), owner: Auth.owner, updated: Date.now(), deleted: 0 }; delete p.vproj; await this.put(p); return p;
  },
};
/* لقطة مصغّرة للمشروع من لوحة المعاينة (تُستدعى من saveProject) */
function thumbData() {
  try { if (!S.clips.length) return null; const t = document.createElement('canvas'); t.width = 320; t.height = Math.round(320 * cv.height / cv.width); t.getContext('2d').drawImage(cv, 0, 0, t.width, t.height); return t.toDataURL('image/jpeg', .6); } catch (e) { return null; }
}

/* ---------------- التنقل ---------------- */
const Nav = { q: '', cleanups: [], page: 'home' };
function showView(id) { $$('#shell > .view, #view-editor').forEach(v => v.classList.toggle('on', v.id === id)); }
const ACT = {};
document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (el && ACT[el.dataset.act]) ACT[el.dataset.act](el, e); });

/* ---------------- شاشة البداية والترحيب ---------------- */
function runSplash() {
  showView('v-splash'); const fast = /[?&]fast/.test(location.search);
  setTimeout(() => { if (!STO.get('ve-onboarded', false)) onboard(0); else if (!Auth.ready) authChoose(); else route(); }, fast ? 50 : 1700);
}
function onboard(i) {
  const slides = [
    ['🎬', L('محرر فيديو كامل في متصفحك', 'A full video editor in your browser'), L('خط زمني متعدد المسارات، انتقالات، فلاتر وإطارات مفتاحية — دون رفع ملفاتك إلى أي خادم.', 'Multi-track timeline, transitions, filters and keyframes — without uploading your files anywhere.'), '#1d2b64', '#6c5ce7'],
    ['✨', L('قوالب جاهزة بلمسة واحدة', 'Ready-made templates'), L('اختر قالباً، استبدل الوسائط، عدّل النصوص، ثم صدّر.', 'Pick a template, replace the media, edit the text, then export.'), '#f093fb', '#f5576c'],
    ['🤖', L('أدوات ذكاء اصطناعي محلية', 'On-device AI tools'), L('إزالة الخلفية، التعرف على العناصر، تتبع الحركة، قص الصمت والمزيد.', 'Background removal, object detection, motion tracking, silence cutting and more.'), '#134e5e', '#71b280'],
  ], s = slides[i], v = $('#v-onboard');
  showView('v-onboard');
  v.innerHTML = `<div class="ob fade-up" style="--c1:${s[3]};--c2:${s[4]}"><div class="art">${s[0]}</div><h2>${esc(s[1])}</h2><p>${esc(s[2])}</p><div class="dots">${slides.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div><div class="row2">${i < 2 ? `<button class="btn2 ghost" data-act="obSkip">${L('تخطي', 'Skip')}</button><button class="btn2 pri" data-act="obNext" data-i="${i + 1}">${L('التالي', 'Next')}</button>` : `<button class="btn2 pri" data-act="obSkip">${L('ابدأ الآن', 'Get started')}</button>`}</div></div>`;
}
ACT.obNext = el => onboard(+el.dataset.i);
ACT.obSkip = () => { STO.set('ve-onboarded', true); if (!Auth.ready) authChoose(); else route(); };

/* ---------------- تسجيل الدخول وإنشاء الحساب ---------------- */
function authFrame(inner) { showView('v-auth'); $('#v-auth').innerHTML = `<div class="card fade-up"><div class="lg"><div class="logo-mark sm"></div><b style="font-size:20px">${L('كليبو', 'Clipo')}</b></div>${inner}</div>`; }
function authChoose() {
  authFrame(`<h2>${L('تسجيل الدخول', 'Log in')}</h2><p class="sub2">${L('اختر طريقة الدخول. حسابك وملفاتك تبقى على هذا الجهاز.', 'Choose how to log in. Your account and files stay on this device.')}</p>
  <button class="mbtn" data-act="sGoogle"><span class="gl" style="background:#fff;color:#ea4335">G</span><span>Google<small>${SET.gClient ? L('مفعّل', 'Enabled') : L('يتطلب إعداد Client ID', 'Requires a Client ID')}</small></span></button>
  <button class="mbtn" data-act="sTikTok"><span class="gl" style="background:#000;color:#fff">♪</span><span>TikTok<small>${L('يتطلب خادماً — غير متاح', 'Requires a server — unavailable')}</small></span></button>
  <button class="mbtn" data-act="sFacebook"><span class="gl" style="background:#1877f2;color:#fff">f</span><span>Facebook<small>${SET.fbApp ? L('مفعّل', 'Enabled') : L('يتطلب إعداد App ID', 'Requires an App ID')}</small></span></button>
  <button class="mbtn" data-act="sQR"><span class="gl">▦</span><span>${L('رمز QR', 'QR code')}<small>${L('يتطلب خادماً — غير متاح', 'Requires a server — unavailable')}</small></span></button>
  <button class="mbtn" data-act="aEmail"><span class="gl">@</span><span>${L('البريد الإلكتروني', 'Email')}<small>${L('حساب محلي آمن (PBKDF2)', 'Secure local account (PBKDF2)')}</small></span></button>
  <div class="sep">${L('أو', 'or')}</div>
  <div class="row2"><button class="btn2 ghost" data-act="aSignup">${L('إنشاء حساب', 'Create account')}</button><button class="btn2 ghost" data-act="aGuest">${L('المتابعة كضيف', 'Continue as guest')}</button></div>`);
}
ACT.aGuest = () => { Auth.asGuest(); toast(L('تم الدخول كضيف: مشاريعك محلية ولا ملف شخصي', 'Guest mode: projects are local, no profile')); route(); };
ACT.aEmail = () => authEmail('login'); ACT.aSignup = () => authEmail('signup'); ACT.aBack = () => authChoose(); ACT.aForgot = () => authEmail('recover');
ACT.sTikTok = () => modal('TikTok', b => b.append(h('p', '', L('تسجيل الدخول عبر TikTok يتطلب تبادل رمز OAuth على خادم يحمل Client Secret، ولا يوجد خادم في هذا التطبيق المستقل، لذلك لا يمكن تنفيذه بأمان داخل المتصفح فقط. استخدم البريد الإلكتروني أو Google أو Facebook.', 'TikTok login needs an OAuth code exchange on a server holding the Client Secret. This standalone app has no server, so it cannot be done safely from the browser alone. Use email, Google or Facebook.'))), [[L('حسناً', 'OK'), m => m.remove(), 'primary']]);
ACT.sQR = () => modal(L('رمز QR', 'QR code'), b => b.append(h('p', '', L('الدخول برمز QR يتطلب خادماً يربط الهاتف بالمتصفح (كما في الإصدارات الرسمية على الويب وسطح المكتب). هذه الميزة غير متاحة هنا لأنه لا يوجد خادم.', 'QR login needs a server pairing the phone with the browser (as in the official web/desktop apps). Unavailable here because there is no server.'))), [[L('حسناً', 'OK'), m => m.remove(), 'primary']]);
function needId(kind) {
  const key = kind === 'google' ? 'gClient' : 'fbApp', nm = kind === 'google' ? 'Google Client ID' : 'Facebook App ID';
  let inp; modal(nm, b => {
    b.append(h('p', 'hint', L(`لتفعيل الدخول عبر ${kind === 'google' ? 'Google' : 'Facebook'} أنشئ تطبيق OAuth في لوحة المطوّر الرسمية، أضف عنوان هذا الموقع كـ Origin مسموح، ثم الصق المعرّف هنا. لا تُرسل كلمات مرور خدماتك إلينا إطلاقاً.`, `To enable ${kind === 'google' ? 'Google' : 'Facebook'} login create an OAuth app in the official developer console, add this site's origin as allowed, then paste the ID here. Your other services' passwords never reach us.`)));
    inp = h('input'); inp.type = 'text'; inp.value = SET[key]; inp.placeholder = nm; inp.style.cssText = 'width:100%;background:var(--p1);border:1px solid var(--bd);border-radius:8px;padding:9px;color:var(--tx)'; b.append(inp);
  }, [[L('إلغاء', 'Cancel'), m => m.remove()], [L('حفظ', 'Save'), m => { SET[key] = inp.value.trim(); saveSet(); m.remove(); authChoose(); toast(L('تم الحفظ', 'Saved')); }, 'primary']]);
}
const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = () => rej(new Error(L('تعذّر تحميل مكتبة الدخول (تحقق من الإنترنت)', 'Could not load the login library (check your connection)'))); document.head.append(s); });
ACT.sGoogle = async () => {
  if (!SET.gClient) return needId('google');
  try {
    await loadScript('https://accounts.google.com/gsi/client'); const host = h('div'); host.style.cssText = 'display:flex;justify-content:center;padding:10px';
    modal('Google', b => b.append(h('p', 'hint', L('اختر حساب Google:', 'Choose a Google account:')), host), [[L('إلغاء', 'Cancel'), m => m.remove()]]);
    google.accounts.id.initialize({ client_id: SET.gClient, callback: r => {
      try { const p = JSON.parse(decodeURIComponent(escape(atob(r.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))))); $$('.modal').forEach(x => x.remove()); Auth.socialLogin('google', p.email, p.name, p.picture); toast(L('تم تسجيل الدخول بنجاح', 'Logged in successfully')); route(); } catch (e) { toast(L('فشل قراءة بيانات Google', 'Failed to read Google data')); }
    } });
    google.accounts.id.renderButton(host, { theme: 'filled_black', size: 'large' });
  } catch (e) { toast(e.message, 4000); }
};
ACT.sFacebook = async () => {
  if (!SET.fbApp) return needId('facebook');
  try {
    await loadScript('https://connect.facebook.net/en_US/sdk.js'); FB.init({ appId: SET.fbApp, version: 'v19.0', cookie: false });
    FB.login(r => { if (r.authResponse) FB.api('/me', { fields: 'name,email,picture' }, u => { Auth.socialLogin('facebook', u.email || (u.id + '@facebook.local'), u.name, u.picture && u.picture.data && u.picture.data.url); toast(L('تم تسجيل الدخول بنجاح', 'Logged in successfully')); route(); }); else toast(L('أُلغي تسجيل الدخول', 'Login cancelled')); }, { scope: 'public_profile,email' });
  } catch (e) { toast(e.message, 4000); }
};
function authEmail(mode) {
  const si = mode === 'signup', rc = mode === 'recover';
  authFrame(`<button class="lnk" data-act="aBack">‹ ${L('رجوع', 'Back')}</button>
  <h2 style="margin-top:10px">${si ? L('إنشاء حساب', 'Create account') : rc ? L('استعادة الحساب', 'Recover account') : L('الدخول بالبريد', 'Log in with email')}</h2>
  <p class="sub2">${si ? L('أنشئ حساباً محلياً على هذا الجهاز.', 'Create a local account on this device.') : rc ? L('أدخل بريدك ورمز الاستعادة الذي حصلت عليه عند إنشاء الحساب.', 'Enter your email and the recovery code you received at sign-up.') : L('أدخل بيانات حسابك.', 'Enter your account details.')}</p>
  <form id="af" novalidate>
   ${si ? `<div class="fld"><label>${L('الاسم', 'Name')}</label><input name="name" autocomplete="name"></div>` : ''}
   <div class="fld"><label>${L('البريد الإلكتروني', 'Email')}</label><input name="email" type="email" autocomplete="email" dir="ltr"></div>
   ${rc ? `<div class="fld"><label>${L('رمز الاستعادة', 'Recovery code')}</label><input name="code" dir="ltr" placeholder="XXXX-XXXX-XXXX-XXXX"></div>` : ''}
   <div class="fld"><label>${rc ? L('كلمة المرور الجديدة', 'New password') : L('كلمة المرور', 'Password')}</label><div class="pw"><input name="pw" type="password" autocomplete="${si || rc ? 'new-password' : 'current-password'}" dir="ltr"><button type="button" data-act="togglePw">${ic('eye', 18)}</button></div>${si || rc ? '<div class="meter"><i id="pwm"></i></div>' : ''}</div>
   ${si ? `<div class="fld"><label>${L('تأكيد كلمة المرور', 'Confirm password')}</label><input name="pw2" type="password" autocomplete="new-password" dir="ltr"></div>` : ''}
   <div class="err" id="aerr"></div>
   <button class="btn2 pri" style="width:100%" id="asub">${si ? L('إنشاء الحساب', 'Create account') : rc ? L('إعادة تعيين كلمة المرور', 'Reset password') : L('تسجيل الدخول', 'Log in')}</button>
  </form>
  <div class="sep"></div><div class="row2" style="font-size:13px">${mode === 'login' ? `<button class="lnk" data-act="aForgot">${L('نسيت كلمة المرور؟', 'Forgot password?')}</button><span>•</span><button class="lnk" data-act="aSignup">${L('حساب جديد', 'New account')}</button>` : `<button class="lnk" data-act="aEmail">${L('لدي حساب بالفعل', 'I already have an account')}</button>`}</div>`);
  const f = $('#af'), err = $('#aerr'), btn = $('#asub'), pw = f.pw;
  if (f.pw && $('#pwm')) pw.oninput = () => { const s = pwScore(pw.value); $('#pwm').style.width = s * 25 + '%'; $('#pwm').style.background = ['#e5484d', '#e5484d', '#f5a524', '#2ee6d0', '#2ee6d0'][s]; };
  setTimeout(() => f.email.focus(), 50);
  f.onsubmit = async e => {
    e.preventDefault(); err.textContent = ''; err.classList.remove('ok'); btn.disabled = true; const old = btn.textContent; btn.textContent = L('جارٍ التحقق…', 'Verifying…');
    try {
      if (si) {
        if (f.pw.value !== f.pw2.value) throw { msg: L('كلمتا المرور غير متطابقتين', 'Passwords do not match') };
        const r = await Auth.signup(f.name.value, f.email.value, f.pw.value); showRecovery(r.code, true);
      } else if (rc) { const code = await Auth.recover(f.email.value, f.code.value, f.pw.value); toast(L('تمت إعادة تعيين كلمة المرور', 'Password reset')); showRecovery(code, true); }
      else { const u = await Auth.login(f.email.value, f.pw.value); toast(L('أهلاً بعودتك ', 'Welcome back ') + u.name); route(); }
    } catch (x) { err.textContent = x.msg || x.message || String(x); btn.disabled = false; btn.textContent = old; f.classList.remove('shake'); }
  };
}
ACT.togglePw = el => { const i = el.parentElement.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; };
function showRecovery(code, thenRoute) {
  modal(L('رمز استعادة الحساب', 'Account recovery code'), b => { b.append(h('p', '', L('احفظ هذا الرمز في مكان آمن. هو الطريقة الوحيدة لاستعادة حسابك إذا نسيت كلمة المرور (لا يوجد خادم لإرسال بريد). لن يظهر مرة أخرى.', 'Save this code somewhere safe. It is the only way to recover your account if you forget your password (there is no server to send email). It will not be shown again.')), h('div', 'recov', code)); },
    [[L('نسخ', 'Copy'), () => { navigator.clipboard && navigator.clipboard.writeText(code); toast(L('تم النسخ', 'Copied')); }], [L('حفظت الرمز', 'I saved it'), m => { m.remove(); if (thenRoute) route(); }, 'primary']]).onpointerdown = null;
}
