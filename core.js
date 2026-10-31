/* ===== core.js — أدوات مشتركة + الاتصال بالسيرفر ===== */
const $ = (id) => document.getElementById(id);
const TOKEN_KEY = 'mhadatha_token';
let user = null;
const me = () => user;
const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const safePhoto = (p) => (/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p || '') ? p : '');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function toast(msg) {
  if (/قواعد/.test(String(msg)) && typeof showRulesHelp === 'function') return showRulesHelp();
  const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2200); }
function showErr(id, msg) {
  const e = $(id); e.textContent = msg; e.hidden = !msg;
  const c = e.closest('.card');
  if (msg && c) { c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); }
}
async function api(path, opts = {}) {
  if (!API_BASE) return USE_FIREBASE ? fbApi(path, opts) : localApi(path, opts);
  const t = localStorage.getItem(TOKEN_KEY);
  let r;
  try {
    r = await fetch(API_BASE + '/api/' + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
  } catch (e) { throw Object.assign(new Error('تعذر الاتصال بالسيرفر'), { status: 0 }); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'صار خطأ'), { status: r.status });
  return d;
}
async function saveMe(patch) { user = (await api('me', { method: 'PATCH', body: patch })).user; return user; }
function closeOverlay(id) {
  const o = $(id); if (o.hidden) return;
  o.classList.add('closing');
  setTimeout(() => { o.hidden = true; o.classList.remove('closing'); }, 220);
}
async function savedFx(btn) {
  const old = btn.innerHTML;
  btn.classList.add('saved');
  btn.innerHTML = '<svg class="tick" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  await wait(650);
  btn.classList.remove('saved'); btn.innerHTML = old;
}
