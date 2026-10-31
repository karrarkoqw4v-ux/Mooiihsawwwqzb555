/* ===== chat.js — قائمة المحادثات وشاشة الدردشة ===== */
let peer = null, typing = 0;
/* مع Firebase: الصور والبصمات (والملفات الصغيرة) تنرفع لقاعدة البيانات حتى توصل للطرف الثاني */
const REMOTE_MEDIA = USE_FIREBASE && !API_BASE;
const REMOTE_MAX = 1024 * 1024;
const blobCache = new Map();
const blobToDataUrl = (b) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(r.error); r.readAsDataURL(b); });
const getBlobData = (pid, id) => {
  if (!blobCache.has(id)) blobCache.set(id, api('blob?peer=' + encodeURIComponent(pid) + '&id=' + encodeURIComponent(id)).then((r) => r.data).catch((e) => { blobCache.delete(id); throw e; }));
  return blobCache.get(id);
};
async function attUrl(a, pid) {
  if (a.blob && REMOTE_MEDIA) { const d = await getBlobData(pid, a.id); return d ? URL.createObjectURL(await (await fetch(d)).blob()) : ''; }
  return mediaUrl(a.id);
}
const fmtTime = (t) => new Date(t).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
const fmtStamp = (t) => (new Date(t).toDateString() === new Date().toDateString() ? fmtTime(t) : new Date(t).toLocaleDateString('ar-IQ', { day: 'numeric', month: 'short' }));
const nameOf = (u) => ((u.first || '') + ' ' + (u.last || '')).trim() || u.username;
const avatarEl = (u) => '<div class="avatar">' + AVATAR_SVG + '</div>';
const preview = (m) => (m.att ? ({ image: 'صورة', video: 'فيديو', file: 'ملف', voice: 'بصمة' }[m.att.kind] || 'ملف') + (m.text ? ': ' + m.text : '') : m.text);

function renderChats(body) {
  body.innerHTML = '<div class="home-head"><h2 class="tab-title">المحادثات</h2><button class="menu-btn" id="menu-btn" aria-label="القائمة"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button></div><div class="stories" id="stories"></div><div id="chat-list"></div>'; $('menu-btn').onclick = openMenu; renderStories(); renderChatList();
}
async function renderChatList() {
  const list = $('chat-list'); if (!list || tab !== 'chats') return;
  try {
    const d = await api('chats');
    if (tab !== 'chats' || $('chat-list') !== list) return;
    list.innerHTML = d.chats.length ? d.chats.map((c) =>
      '<div class="item chat-item">' + avatarEl(c.peer) + '<div class="grow"><b>' + esc(nameOf(c.peer)) + (c.muted ? ' <svg class="mi" viewBox="0 0 24 24"><path d="M5 5l14 14M9 17h6M8 13V9a4 4 0 0 1 6-3.4M16 12V9"/></svg>' : '') + '</b><small>' +
      (c.last.mine ? 'أنت: ' : '') + esc(preview(c.last)) + '</small></div><time>' + fmtStamp(c.last.t) + '</time></div>').join('')
      : empty(I.chat, 'ما عندك محادثات بعد.<br>ابحث عن شخص من "جهات".');
    list.querySelectorAll('.chat-item').forEach((el, i) => {
      setAvatar(el.querySelector('.avatar'), d.chats[i].peer.photo);
      el.onclick = () => openChat(d.chats[i].peer);
    });
  } catch (e) { if (tab === 'chats') list.innerHTML = empty(I.chat, esc(e.message)); }
}

let viewUser = null, userFrom = 'main';
function openChat(p) { peer = p; go('chat'); }
function openProfile(u, from) { viewUser = u; userFrom = from; go('user'); }

/* روابط ومنشن داخل الرسائل */
const RX = /(https?:\/\/[^\s<>"']+|(?<![A-Za-z0-9_])@[a-z0-9_]{3,20}(?![A-Za-z0-9_]))/gi;
function linkify(t) {
  let out = '', last = 0;
  for (const m of t.matchAll(RX)) {
    out += esc(t.slice(last, m.index)); const s = m[0];
    if (s[0] === '@') out += '<a class="mention" data-u="' + esc(s.slice(1).toLowerCase()) + '">' + esc(s) + '</a>';
    else { const u = s.replace(/[.,;:!?)\]،]+$/, ''); out += '<a class="url" data-url="' + esc(u) + '">' + esc(u) + '</a>' + esc(s.slice(u.length)); }
    last = m.index + s.length;
  }
  return out + esc(t.slice(last));
}
async function openMention(a) {
  try {
    const d = await api('user?u=' + encodeURIComponent(a.dataset.u));
    if (d.self) return go('account');
    openProfile(d.user, 'chat');
  } catch (e) {
    if (e.status !== 404) return toast(e.message);
    a.classList.remove('shake'); void a.offsetWidth; a.classList.add('shake'); toast('لا يوجد مستخدم');
  }
}
let linkTarget = '';
function askLink(u) { linkTarget = u; $('link-url').textContent = u; $('link-overlay').hidden = false; }
$('link-open').onclick = () => { window.open(linkTarget, '_blank', 'noopener,noreferrer'); closeOverlay('link-overlay'); };
$('link-copy').onclick = async () => {
  try { await navigator.clipboard.writeText(linkTarget); toast('تم نسخ الرابط'); } catch (e) { toast('تعذر النسخ'); }
  closeOverlay('link-overlay');
};

const toBottom = (smooth) => { const b = $('msgs'); b.scrollTo({ top: b.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); };
const FILE_ICON = '<svg viewBox="0 0 24 24"><path d="M7 3h7l5 5v13H7Z"/><path d="M14 3v5h5"/></svg>';
function attHtml(a, pid) {
  if (!a) return '';
  if (a.kind === 'image') return '<div class="att image"><img alt="صورة"></div>';
  if (a.kind === 'video') return '<video class="att" controls playsinline preload="metadata"></video>';
  if (a.kind === 'voice') return '<div class="att voice" data-id="' + esc(a.id) + '" data-peer="' + esc(pid || '') + '" data-blob="' + (a.blob ? 1 : 0) + '" data-dur="' + (+a.dur || 0) + '">' +
    '<button class="vp" type="button" aria-label="تشغيل"><svg class="i-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7Z"/></svg><svg class="i-pause" viewBox="0 0 24 24"><path d="M9 5v14M15 5v14"/></svg></button>' +
    '<div class="vw">' + voiceBars(a.id) + '</div><small class="vd">' + fmtDur(a.dur) + '</small></div>';
  return '<div class="att file">' + FILE_ICON + '<div><b>' + esc(a.name) + '</b><small>' + fmtSize(a.size) + '</small></div></div>';
}
async function fillAtt(el, a, pid) {
  if (a.kind === 'voice') return;
  let url = ''; try { url = await attUrl(a, pid); } catch (e) {}
  const box = el.querySelector('.att'); if (!box) return;
  if (!url) { box.outerHTML = '<div class="att gone">' + (a.blob ? 'تعذر تحميل الملف' : 'الملف غير موجود على هذا الجهاز') + '</div>'; return; }
  if (a.kind === 'image') box.querySelector('img').src = url;
  else if (a.kind === 'video') box.src = url;
  box.dataset.url = url; box.dataset.name = a.name;
}
function addMsg(m) {
  const box = $('msgs');
  if (m.id && box.querySelector('[data-id="' + m.id + '"]')) return; // ما نكرر الرسالة
  const e = box.querySelector('.chat-hint'); if (e) e.remove();
  const a = m.att, pid = peer && peer.id, el = document.createElement('div');
  if (m.id) el.dataset.id = m.id;
  el.className = 'msg ' + (m.mine ? 'mine' : 'theirs') + (a ? ' has-att' : '') + (a && a.kind === 'voice' ? ' voice' : '') + (a && a.kind === 'image' && !m.text ? ' img-only' : '');
  const loc = !a && m.text && /^📍 موقعي: https:\/\//.test(m.text) ? m.text.match(/(https:\/\/\S+)/) : null;
  const body = loc ? '<a class="location-card" href="' + esc(loc[1]) + '" target="_blank" rel="noopener"><span class="location-pin">📍</span><span><b>موقع جغرافي</b><small>اضغط لفتح الموقع على الخريطة</small></span><span class="location-arrow">↗</span></a>' : (m.text ? '<span class="txt">' + linkify(m.text) + '</span>' : '');
  el.innerHTML = attHtml(a, pid) + body + '<time>' + fmtTime(m.t) + '</time>';
  box.appendChild(el);
  if (a) fillAtt(el, a, pid).then(() => { if (a.kind === 'image' && el.querySelector('img')) el.querySelector('img').onload = () => toBottom(); });
}
function setTyping(on) {
  typing = Math.max(0, typing + (on ? 1 : -1));
  const box = $('msgs'); let t = box.querySelector('.typing');
  if (typing && !t) { t = document.createElement('div'); t.className = 'msg theirs typing'; t.innerHTML = '<i></i><i></i><i></i>'; box.appendChild(t); toBottom(true); }
  else if (!typing && t) t.remove();
}
async function renderChat() {
  const p = peer; typing = 0;
  $('chat-name').innerHTML = esc(nameOf(p));
  $('chat-sub').textContent = '@' + p.username;
  const av = $('chat-avatar'); av.className = 'avatar'; av.innerHTML = AVATAR_SVG; setAvatar(av, p.photo);
  const box = $('msgs'); box.innerHTML = ''; $('msg-input').value = ''; syncComposer();
  try {
    const d = await api('messages?peer=' + encodeURIComponent(p.id));
    if (peer !== p) return;
    if (d.messages.length) d.messages.forEach(addMsg); else box.innerHTML = '<div class="chat-hint">ابدأ المحادثة مع ' + esc(nameOf(p)) + '</div>';
    toBottom();
  } catch (e) { toast(e.message); }
}
/* تحديث لحظي: يجيب الرسائل الجديدة فقط */
async function syncChat() {
  const p = peer; if (!p || $('s-chat').hidden) return;
  try {
    const d = await api('messages?peer=' + encodeURIComponent(p.id));
    if (peer !== p) return;
    d.messages.forEach(addMsg); toBottom(true);
  } catch (e) {}
}
async function post(p, body) {
  try {
    const d = await api('messages', { method: 'POST', body: { peer: p.id, ...body } });
    if (peer !== p) return true;
    addMsg(d.message); toBottom(true);
    if (d.reply) {
      setTyping(true); await wait(900 + Math.random() * 700); setTyping(false);
      if (peer === p) { addMsg(d.reply); toBottom(true); }
    }
    return true;
  } catch (e) { toast(e.message); return false; }
}
async function sendMsg() {
  if (typeof REC !== 'undefined' && (REC.st === 'locked' || REC.st === 'paused')) return recStop(true);
  const inp = $('msg-input'), text = inp.value.trim();
  if (!text || !peer) return;
  inp.value = ''; syncComposer();
  if (!(await post(peer, { text }))) { inp.value = text; syncComposer(); }
}
async function sendAtt(file, caption) {
  const p = peer; if (!p || !file) return;
  if (file.size > MAX_FILE) return toast('الملف كبير، الحد الأقصى 150 ميغا');
  const kind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';
  const id = 'm' + Date.now() + Math.random().toString(36).slice(2, 7);
  let mime = file.type;
  if (REMOTE_MEDIA) {
    try {
      let data;
      if (kind === 'image') { const u = URL.createObjectURL(file); try { data = await fImg(u, { max: 1280 }, 0.8); } finally { URL.revokeObjectURL(u); } mime = 'image/jpeg'; }
      else {
        if (file.size > REMOTE_MAX) return toast('الفيديو والملفات حالياً حدها 1 ميغا حتى توصل للطرف الثاني. الصور والبصمات بدون مشكلة');
        data = await blobToDataUrl(file);
      }
      await api('blob', { method: 'POST', body: { peer: p.id, id, data } }); blobCache.set(id, Promise.resolve(data));
    } catch (e) { return toast(e.message || 'تعذر رفع الملف'); }
  } else {
    try { await mediaPut(id, file); } catch (e) { return toast('تعذر حفظ الملف على الجهاز'); }
  }
  await post(p, { text: caption || '', att: { id, kind, name: file.name || 'ملف', size: file.size, mime, ...(REMOTE_MEDIA ? { blob: true } : {}) } });
}

/* الإرفاق */
$('msg-attach').onclick = () => ($('attach-overlay').hidden = false);
$('att-image').onclick = () => { closeOverlay('attach-overlay'); $('file-img').click(); };
$('att-video').onclick = () => { closeOverlay('attach-overlay'); $('file-video').click(); };
$('att-file').onclick = () => { closeOverlay('attach-overlay'); $('file-any').click(); };
$('att-location').onclick = () => { closeOverlay('attach-overlay'); shareCurrentLocation(); };
async function shareCurrentLocation() {
  const p = peer; if (!p) return;
  if (!navigator.geolocation) return toast('المتصفح لا يدعم تحديد الموقع');
  toast('بانتظار إذن الموقع…');
  navigator.geolocation.getCurrentPosition(async pos => {
    const lat = pos.coords.latitude.toFixed(6), lon = pos.coords.longitude.toFixed(6);
    const url = `https://www.google.com/maps?q=${lat},${lon}`;
    const ok = await post(p, { text: '📍 موقعي: ' + url });
    if (ok) toast('تم إرسال رابط موقعك');
  }, err => toast(err.code === 1 ? 'لم تسمح بالوصول للموقع' : 'تعذر تحديد الموقع، تأكد من تفعيل GPS'), { enableHighAccuracy:true, timeout:15000, maximumAge:0 });
}
let pendingImg = null, imgMode = 'chat';
$('file-img').onchange = (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (!f.type.startsWith('image/')) return toast('اختر صورة فقط');
  if (f.size > MAX_FILE) return toast('الملف كبير، الحد الأقصى 150 ميغا');
  imgMode = 'chat'; $('img-title').textContent = 'إرسال صورة'; $('img-send').textContent = 'إرسال';
  pendingImg = f; $('img-prev').src = URL.createObjectURL(f); $('img-cap').value = ''; $('img-overlay').hidden = false;
};
$('img-cancel').onclick = () => { pendingImg = null; closeOverlay('img-overlay'); };
$('img-send').onclick = () => { const f = pendingImg, c = $('img-cap').value.trim(); pendingImg = null; closeOverlay('img-overlay'); imgMode === 'story' ? postStory(f, c) : sendAtt(f, c); };
$('img-cap').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('img-send').click(); });
['file-video', 'file-any'].forEach((id) => ($(id).onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) sendAtt(f, ''); }));

/* ضغطات داخل الرسائل: منشن، رابط، صورة، ملف */
$('msgs').addEventListener('click', (e) => {
  const t = e.target;
  const vb = t.closest('.att.voice'); if (vb) return voiceClick(vb, e);
  const m = t.closest('.mention'); if (m) return openMention(m);
  const l = t.closest('.url'); if (l) return askLink(l.dataset.url);
  const im = t.closest('.att.image'); if (im && im.dataset.url) { $('view-img').src = im.dataset.url; $('view-overlay').hidden = false; return; }
  const f = t.closest('.att.file'); if (f && f.dataset.url) { const a = document.createElement('a'); a.href = f.dataset.url; a.download = f.dataset.name || 'ملف'; a.click(); }
});
['attach-overlay', 'link-overlay'].forEach((id) => $(id).addEventListener('click', (e) => { if (e.target === $(id) || e.target.classList.contains('photo-top')) closeOverlay(id); }));
$('view-overlay').onclick = () => closeOverlay('view-overlay');

$('msg-send').onclick = sendMsg;
$('msg-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMsg(); });
$('chat-back').onclick = () => { if (typeof recStop === 'function') recStop(false); if (typeof stopVoice === 'function') stopVoice(); peer = null; go('main'); };
$('chat-who').onclick = () => peer && openProfile(peer, 'chat');
$('chat-call').onclick = () => startCall(peer, 'audio');
$('chat-video').onclick = () => startCall(peer, 'video');
