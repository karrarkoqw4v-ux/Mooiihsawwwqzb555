/* ===== story-edit.js — محرر القصة: رسم (قلم/سهم/ماركر/نيون/ممحاة) + نص + ملصقات + تعديل الألوان ===== */
const SE_COLORS = ['#ffffff', '#000000', '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#32ade6', '#5856d6', '#af52de', '#ff2d92', '#a2845e', '#8e8e93'];
const SE_EMOJI = '😀 😂 🥹 😍 😎 🤩 😭 😡 🥳 😴 🤔 🙄 👍 👎 👏 🙏 💪 🔥 ❤️ 💔 💯 ✨ 🎉 🎁 🌹 🌙 ⭐ ☀️ ⚽ 🎮 🎵 📍 🚗 ✈️ 🍕 🍔 ☕ 🥤 🍰 🐱 🐶 🦁 🦅 🐎 🏆 👑 💎 📸 🎬 💬 ✅ ❌ ⚠️ 💙 💚 💛 🧡 💜 🖤 🤍 😉 😘 🤝 👀'.split(' ');
const SE_FAM = '"IBM Plex Sans Arabic","Noto Sans Arabic",Tahoma,sans-serif';
const SE_VIDEO_BPS = () => (REMOTE_MEDIA ? 2.2e6 : 8e6);
const STORY_REMOTE_VIDEO_MAX = 8 * 1024 * 1024;
let E = null, seBackCb = null;

const seMedia = () => $('se-media');
const seAdjStr = () => (E ? 'brightness(' + E.adj.b + '%) contrast(' + E.adj.c + '%) saturate(' + E.adj.s + '%)' : 'none');
const seAdjDefault = () => E.adj.b === 100 && E.adj.c === 100 && E.adj.s === 100;
const seHasEdits = () => E && (E.strokes.length || E.items.some((i) => i.t === 'emoji' || (i.text || '').trim()) || !seAdjDefault());
const seLum = (c) => { const n = parseInt(c.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
const seMaxSide = () => ({ '720': 1280, '1080': 1920, '4k': 3840 }[localStorage.getItem('mhadatha_q') || '1080']);

/* ---------- فتح / إغلاق ---------- */
function seOpen(file, opts = {}) {
  seClose(true);
  const isVid = file.type.startsWith('video/'), url = URL.createObjectURL(file);
  E = { file, isVid, url, W: 0, H: 0, strokes: [], items: [], adj: { b: 100, c: 100, s: 100 }, color: '#ff3b30', size: 10, brush: 'pen', mode: 'main', snap: null, sel: null, editing: null, cur: null };
  seBackCb = opts.onBack || null;
  $('se-layers').innerHTML = ''; $('se-cap').value = ''; ['se-adj-b', 'se-adj-c', 'se-adj-s'].forEach((id) => ($(id).value = 100));
  $('se-img').hidden = isVid; $('se-vid').hidden = !isVid; $('se-img').style.filter = $('se-vid').style.filter = 'none';
  $('se-busy').hidden = true; $('se-overlay').classList.remove('closing'); $('se-overlay').hidden = false;
  seMode('main'); seRenderPalette(); seBrushUI();
  const ready = () => { E.W = isVid ? $('se-vid').videoWidth : $('se-img').naturalWidth; E.H = isVid ? $('se-vid').videoHeight : $('se-img').naturalHeight;
    if (!E.W) { E.W = 1080; E.H = 1920; } const k = Math.min(1, 1920 / Math.max(E.W, E.H)); const cv = $('se-draw'); cv.width = Math.round(E.W * k); cv.height = Math.round(E.H * k); seFit(); seRedraw(); };
  if (isVid) { const v = $('se-vid'); v.onloadedmetadata = ready; v.src = url; v.play().catch(() => {}); } else { const im = $('se-img'); im.onload = ready; im.src = url; }
}
function seClose(silent) {
  if (!E) return;
  try { $('se-vid').pause(); $('se-vid').removeAttribute('src'); $('se-vid').load(); } catch (e) {}
  $('se-img').removeAttribute('src'); URL.revokeObjectURL(E.url); E = null;
  if (!silent) closeOverlay('se-overlay');
}
function seFit() {
  if (!E || !E.W) return;
  const st = $('se-stage'), aw = st.clientWidth - 16, ah = st.clientHeight, r = E.W / E.H;
  let w = aw, h = w / r; if (h > ah) { h = ah; w = h * r; }
  seMedia().style.width = w + 'px'; seMedia().style.height = h + 'px'; E.items.forEach(seStyle);
}
if (window.ResizeObserver) new ResizeObserver(seFit).observe($('se-stage'));
if (window.visualViewport) visualViewport.addEventListener('resize', () => { $('se-overlay').style.setProperty('--kb', Math.max(0, innerHeight - visualViewport.height - visualViewport.offsetTop) + 'px'); });

/* ---------- الأوضاع ---------- */
function seSnap() { return JSON.stringify({ s: E.strokes, i: E.items.map((i) => { const { el, ...r } = i; return r; }) }); }
function seRestore(js) {
  const d = JSON.parse(js); E.strokes = d.s; $('se-layers').innerHTML = ''; E.items = []; d.i.forEach((r) => seMk(r)); seRedraw();
}
function seMode(m) {
  if (!E) return;
  E.mode = m; $('se-overlay').dataset.mode = m;
  const edit = m === 'draw' || m === 'sticker';
  $('se-brushes').hidden = m !== 'draw'; $('se-stickers').hidden = m !== 'sticker'; $('se-textbar').hidden = m !== 'text';
  $('se-adjust').hidden = m !== 'adjust'; $('se-tabs').hidden = !edit; $('se-palette').hidden = true;
  document.querySelectorAll('.se-tab').forEach((b) => b.classList.toggle('active', b.dataset.m === m));
  document.querySelector('[data-go=adjust]').classList.toggle('on', m === 'adjust');
  if (m !== 'text') seStopEdit();
}
function seEnter(m) {
  if (m === 'adjust') return seMode(E.mode === 'adjust' ? 'main' : 'adjust');
  if (E.mode === 'main' || E.mode === 'adjust') E.snap = seSnap();
  if (m === 'text') return seNewText();
  seMode(m);
}
document.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => seEnter(b.dataset.go)));
document.querySelectorAll('.se-tab').forEach((b) => (b.onclick = () => seEnter(b.dataset.m)));
$('se-done').onclick = () => seMode('main');
$('se-cancel').onclick = () => { if (E.snap) seRestore(E.snap); seMode('main'); };
$('se-undo').onclick = () => {
  if (E.mode === 'draw' && E.strokes.length) { E.strokes.pop(); seRedraw(); }
  else if (E.items.length) { const it = E.items.pop(); it.el.remove(); }
  else if (E.strokes.length) { E.strokes.pop(); seRedraw(); }
};
$('se-clear').onclick = () => { E.strokes = []; E.items.forEach((i) => i.el.remove()); E.items = []; seRedraw(); };
$('se-back').onclick = () => { seClose(); if (seBackCb) seBackCb(); };

/* ---------- الرسم ---------- */
function seBrushUI() {
  document.querySelectorAll('.se-br[data-b]').forEach((b) => b.classList.toggle('active', b.dataset.b === E.brush));
  $('se-color').style.background = E.color;
}
document.querySelectorAll('.se-br[data-b]').forEach((b) => (b.onclick = () => { E.brush = b.dataset.b; seBrushUI(); }));
$('se-size').oninput = (e) => (E.size = +e.target.value);
function seDrawStroke(x, s, w, h) {
  const P = s.p.map((q) => [q[0] * w, q[1] * h]), lw = s.w * w;
  if (P.length === 1) P.push([P[0][0] + 0.01, P[0][1]]);
  const path = () => { x.beginPath(); x.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) x.lineTo(P[i][0], P[i][1]); };
  x.save(); x.lineCap = x.lineJoin = 'round'; x.strokeStyle = x.fillStyle = s.c; x.lineWidth = lw;
  if (s.b === 'eraser') { x.globalCompositeOperation = 'destination-out'; x.lineWidth = lw * 2.4; x.strokeStyle = '#000'; }
  else if (s.b === 'marker') { x.globalAlpha = 0.5; x.lineWidth = lw * 2.4; }
  else if (s.b === 'neon') { x.shadowColor = s.c; x.shadowBlur = lw * 2.4; x.lineWidth = lw * 1.4; }
  path(); x.stroke();
  if (s.b === 'neon') { x.shadowBlur = 0; x.strokeStyle = '#fff'; x.lineWidth = lw * 0.55; path(); x.stroke(); }
  if (s.b === 'arrow' && P.length > 1) {
    const tip = P[P.length - 1], hs = Math.max(lw * 4, w * 0.035); let k = P.length - 2;
    while (k > 0 && Math.hypot(P[k][0] - tip[0], P[k][1] - tip[1]) < hs * 0.6) k--;
    const a = Math.atan2(tip[1] - P[k][1], tip[0] - P[k][0]);
    x.beginPath(); x.moveTo(tip[0] - hs * Math.cos(a - 0.5), tip[1] - hs * Math.sin(a - 0.5)); x.lineTo(tip[0], tip[1]); x.lineTo(tip[0] - hs * Math.cos(a + 0.5), tip[1] - hs * Math.sin(a + 0.5)); x.stroke();
  }
  x.restore();
}
function seRedraw(cv, list) {
  cv = cv || $('se-draw'); const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height);
  (list || E.strokes).forEach((s) => seDrawStroke(x, s, cv.width, cv.height));
}
(() => {
  const cv = $('se-draw'); let on = false;
  const pt = (e) => { const r = cv.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; };
  cv.addEventListener('pointerdown', (e) => {
    if (!E || E.mode !== 'draw') return; on = true; cv.setPointerCapture(e.pointerId); $('se-palette').hidden = true;
    E.cur = { b: E.brush, c: E.color, w: E.size / 1000, p: [pt(e)] }; E.strokes.push(E.cur); seRedraw();
  });
  cv.addEventListener('pointermove', (e) => { if (!on || !E.cur) return; E.cur.p.push(pt(e)); seRedraw(); });
  const end = () => { on = false; if (E) E.cur = null; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
})();

/* ---------- الألوان ---------- */
function seRenderPalette() {
  $('se-palette').innerHTML = SE_COLORS.map((c) => '<button data-c="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>').join('') +
    '<label><input type="color" id="se-cc" value="#ff3b30"></label>';
  $('se-palette').querySelectorAll('button').forEach((b) => (b.onclick = () => sePick(b.dataset.c)));
  $('se-cc').oninput = (e) => sePick(e.target.value, true);
}
function sePick(c, keep) {
  if (E.mode === 'text' && E.editing) { E.editing.c = c; seStyle(E.editing); $('se-tcolor').style.background = c; }
  else { E.color = c; seBrushUI(); }
  if (!keep) $('se-palette').hidden = true;
}
const togglePal = () => { const p = $('se-palette'); p.hidden = !p.hidden; };
$('se-color').onclick = togglePal; $('se-more').onclick = togglePal; $('se-tcolor').onclick = togglePal;

/* ---------- النص والملصقات ---------- */
function seMk(o) {
  const it = Object.assign({ t: 'text', x: 0.5, y: 0.35, s: 0.07, r: 0, text: '', c: '#ffffff', a: 'center', st: 0, f: '' }, o);
  const el = document.createElement('div'); el.className = 'se-item'; el.dataset.ph = 'إضافة نص'; el.textContent = it.text;
  it.el = el; $('se-layers').appendChild(el); E.items.push(it); seStyle(it); seBind(it); return it;
}
function seStyle(it) {
  const el = it.el; if (!el) return;
  el.style.fontSize = (it.s * seMedia().clientWidth) + 'px'; el.style.left = it.x * 100 + '%'; el.style.top = it.y * 100 + '%';
  el.style.transform = 'translate(-50%,-50%) rotate(' + it.r + 'rad)'; el.style.textAlign = it.a; el.style.fontFamily = it.f || 'var(--font)';
  el.style.width = 'max-content'; el.style.maxWidth = '92%';
  if (it.t === 'emoji') { el.style.background = 'none'; el.style.color = '#fff'; el.style.textShadow = 'none'; return; }
  if (it.st === 0) { el.style.background = 'transparent'; el.style.color = it.c; el.style.textShadow = '0 1px 8px #0008'; }
  else if (it.st === 1) { el.style.background = it.c; el.style.color = seLum(it.c) > 0.6 ? '#000' : '#fff'; el.style.textShadow = 'none'; }
  else { el.style.background = 'rgba(0,0,0,.55)'; el.style.color = it.c; el.style.textShadow = 'none'; }
}
function seNewText() {
  const it = seMk({ t: 'text', y: 0.3, c: '#ffffff', s: 0.075 }); seEditText(it);
}
function seEditText(it) {
  if (E.editing && E.editing !== it) seStopEdit();
  E.editing = it; it._y = it.y; it._r = it.r; it.y = 0.3; it.r = 0; seStyle(it); seMode('text');
  const el = it.el; el.contentEditable = 'true'; el.classList.add('sel'); $('se-tcolor').style.background = it.c; $('se-font').value = it.f || '';
  el.focus(); const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}
function seStopEdit() {
  const it = E && E.editing; if (!it) return; E.editing = null;
  const el = it.el; el.contentEditable = 'false'; el.classList.remove('sel'); el.blur();
  it.text = el.innerText.replace(/\n+$/, '').trim(); el.textContent = it.text;
  if (!it.text) { el.remove(); E.items = E.items.filter((x) => x !== it); return; }
  if (it._y != null) { it.y = it._y; it.r = it._r || 0; } seStyle(it);
}
$('se-txt-ok').onclick = () => { seStopEdit(); seMode('main'); };
$('se-txt-del').onclick = () => { const it = E.editing; if (it) { E.editing = null; it.el.remove(); E.items = E.items.filter((x) => x !== it); } seMode('main'); };
$('se-talign').onclick = () => { const it = E.editing; if (!it) return; it.a = { center: 'left', left: 'right', right: 'center' }[it.a]; seStyle(it); };
$('se-tstyle').onclick = () => { const it = E.editing; if (!it) return; it.st = (it.st + 1) % 3; seStyle(it); };
$('se-font').onchange = (e) => { const it = E.editing; if (!it) return; it.f = e.target.value; seStyle(it); };
$('se-temoji').onclick = () => { seStopEdit(); seMode('sticker'); };
$('se-stickers').innerHTML = SE_EMOJI.map((e) => '<button type="button">' + e + '</button>').join('');
$('se-stickers').querySelectorAll('button').forEach((b) => (b.onclick = () => { const it = seMk({ t: 'emoji', text: b.textContent, s: 0.2, y: 0.45 }); selIt(it); }));
const selIt = (it) => { E.items.forEach((i) => i.el.classList.toggle('sel', i === it)); E.sel = it; };

/* سحب + تكبير وتدوير بإصبعين + سلة الحذف */
function seBind(it) {
  const el = it.el, P = new Map(); let g = null, moved = false, t0 = 0, hot = false;
  const snap = () => { const pts = [...P.values()]; g = { x: it.x, y: it.y, s: it.s, r: it.r, pts, d: pts.length > 1 ? Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) : 0, a: pts.length > 1 ? Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]) : 0 }; };
  el.addEventListener('pointerdown', (e) => {
    if (el.isContentEditable || !E || E.mode === 'draw') return;
    e.preventDefault(); el.setPointerCapture(e.pointerId); P.set(e.pointerId, [e.clientX, e.clientY]);
    if (P.size === 1) { moved = false; t0 = Date.now(); selIt(it); $('se-trash').classList.add('show'); } snap();
  });
  el.addEventListener('pointermove', (e) => {
    if (!P.has(e.pointerId)) return; P.set(e.pointerId, [e.clientX, e.clientY]);
    const m = seMedia(), w = m.clientWidth, h = m.clientHeight, pts = [...P.values()];
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    const gx = g.pts.reduce((a, p) => a + p[0], 0) / g.pts.length, gy = g.pts.reduce((a, p) => a + p[1], 0) / g.pts.length;
    if (Math.hypot(cx - gx, cy - gy) > 6) moved = true;
    it.x = g.x + (cx - gx) / w; it.y = g.y + (cy - gy) / h;
    if (pts.length > 1 && g.d) { moved = true; it.s = Math.min(0.6, Math.max(0.02, g.s * Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) / g.d)); it.r = g.r + Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]) - g.a; }
    seStyle(it);
    const tr = $('se-trash').getBoundingClientRect(); hot = e.clientX > tr.left - 30 && e.clientX < tr.right + 30 && e.clientY > tr.top - 30 && e.clientY < tr.bottom + 30;
    $('se-trash').classList.toggle('hot', hot);
  });
  const up = (e) => {
    if (!P.has(e.pointerId)) return; P.delete(e.pointerId);
    if (P.size) return snap();
    $('se-trash').classList.remove('show', 'hot');
    if (hot) { hot = false; el.remove(); E.items = E.items.filter((x) => x !== it); return; }
    if (!moved && Date.now() - t0 < 350 && it.t === 'text') seEditText(it);
  };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}

/* ---------- تعديل الألوان ---------- */
function seApplyAdj() { const f = seAdjStr(); $('se-img').style.filter = f; $('se-vid').style.filter = f; }
[['se-adj-b', 'b'], ['se-adj-c', 'c'], ['se-adj-s', 's']].forEach(([id, k]) => ($(id).oninput = (e) => { E.adj[k] = +e.target.value; seApplyAdj(); }));
$('se-adj-reset').onclick = () => { E.adj = { b: 100, c: 100, s: 100 }; ['se-adj-b', 'se-adj-c', 'se-adj-s'].forEach((id) => ($(id).value = 100)); seApplyAdj(); };

/* ---------- التصدير (يدمج الرسم والنص والفلتر داخل الصورة / الفيديو) ---------- */
function seDrawItem(x, it, w, h) {
  if (!(it.text || '').trim()) return;
  const fs = it.s * w, fam = it.f || SE_FAM; x.save(); x.translate(it.x * w, it.y * h); x.rotate(it.r); x.font = fs + 'px ' + fam; x.textBaseline = 'middle'; x.direction = 'inherit';
  const lines = it.text.split('\n'), lh = fs * 1.25, bw = Math.max(...lines.map((l) => x.measureText(l).width)), th = lines.length * lh, px = fs * 0.3, py = fs * 0.12;
  if (it.t === 'text' && it.st > 0) {
    x.fillStyle = it.st === 1 ? it.c : 'rgba(0,0,0,.55)'; const rx = -bw / 2 - px, ry = -th / 2 - py, rw = bw + 2 * px, rh = th + 2 * py, r = fs * 0.3;
    x.beginPath(); x.moveTo(rx + r, ry); x.arcTo(rx + rw, ry, rx + rw, ry + rh, r); x.arcTo(rx + rw, ry + rh, rx, ry + rh, r); x.arcTo(rx, ry + rh, rx, ry, r); x.arcTo(rx, ry, rx + rw, ry, r); x.fill();
  }
  x.fillStyle = it.t === 'emoji' ? '#fff' : it.st === 1 ? (seLum(it.c) > 0.6 ? '#000' : '#fff') : it.c;
  if (it.t === 'text' && it.st === 0) { x.shadowColor = '#0008'; x.shadowBlur = fs * 0.15; }
  x.textAlign = it.a === 'left' ? 'left' : it.a === 'right' ? 'right' : 'center';
  const tx = it.a === 'left' ? -bw / 2 : it.a === 'right' ? bw / 2 : 0;
  lines.forEach((l, i) => x.fillText(l, tx, -th / 2 + lh * (i + 0.5)));
  x.restore();
}
function seLayers(w, h) { // طبقة الرسم بدقة التصدير
  const t = document.createElement('canvas'); t.width = w; t.height = h; seRedraw(t); return t;
}
function seComposite(x, src, ov, w, h) {
  x.filter = seAdjStr(); x.drawImage(src, 0, 0, w, h); x.filter = 'none';
  if (ov) x.drawImage(ov, 0, 0, w, h); E.items.forEach((it) => seDrawItem(x, it, w, h));
}
const seBusy = (t) => { $('se-busy-t').textContent = t || ''; $('se-busy').hidden = !t; };
async function seRender() {
  if (!E) return null;
  if (!seHasEdits()) return E.file;
  const k = Math.min(1, seMaxSide() / Math.max(E.W, E.H)), w = Math.round(E.W * k / 2) * 2, h = Math.round(E.H * k / 2) * 2;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'), ov = seLayers(w, h);
  if (!E.isVid) {
    seComposite(x, $('se-img'), ov, w, h);
    const b = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.92)); return b ? new File([b], 'story.jpg', { type: 'image/jpeg' }) : E.file;
  }
  if (typeof MediaRecorder === 'undefined' || !cv.captureStream) { toast('المتصفح ما يدعم دمج التعديلات بالفيديو، رح ينشر الأصلي'); return E.file; }
  seBusy('جاري دمج التعديلات بالمقطع…');
  const v = document.createElement('video'); v.src = E.url; v.playsInline = true; v.preload = 'auto';
  await new Promise((r) => { v.onloadedmetadata = r; v.onerror = r; });
  const dur = Math.min(isFinite(v.duration) ? v.duration : 30, 60), stream = cv.captureStream(30); let ac = null;
  try { const AC = window.AudioContext || window.webkitAudioContext; ac = new AC(); const dst = ac.createMediaStreamDestination(); ac.createMediaElementSource(v).connect(dst); dst.stream.getAudioTracks().forEach((t) => stream.addTrack(t)); } catch (e) {}
  const mt = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
  const rec = new MediaRecorder(stream, { ...(mt ? { mimeType: mt } : {}), videoBitsPerSecond: SE_VIDEO_BPS(), audioBitsPerSecond: 128000 }), chunks = [];
  rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
  const out = await new Promise((res) => {
    rec.onstop = () => { const type = (rec.mimeType || mt || 'video/webm').split(';')[0]; res(new File([new Blob(chunks, { type })], 'story.' + (type.includes('mp4') ? 'mp4' : 'webm'), { type })); };
    const stop = () => { if (rec.state !== 'inactive') rec.stop(); v.pause(); };
    const tick = () => { seComposite(x, v, ov, w, h); $('se-busy-t').textContent = 'جاري دمج التعديلات بالمقطع… ' + Math.min(99, Math.round(v.currentTime / dur * 100)) + '%'; if (v.ended || v.currentTime >= dur) return stop(); requestAnimationFrame(tick); };
    rec.start(250); if (ac && ac.resume) ac.resume();
    v.play().then(() => requestAnimationFrame(tick)).catch(() => { stop(); });
  });
  if (ac) ac.close().catch(() => {}); seBusy(''); return out.size ? out : E.file;
}

/* ---------- حفظ على الجهاز + التالي (نشر) ---------- */
$('se-save').onclick = async () => {
  if (!E) return; seBusy('جاري التجهيز…');
  try { const f = await seRender(); const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = 'story-' + Date.now() + '.' + (f.name.split('.').pop() || 'jpg'); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('تم الحفظ على الجهاز'); }
  catch (e) { toast('تعذر الحفظ'); } seBusy('');
};
$('se-next').onclick = async () => {
  if (!E || !$('se-busy').hidden) return; seBusy('جاري التجهيز…');
  let f; try { f = await seRender(); } catch (e) { seBusy(''); return toast('تعذر تجهيز القصة'); }
  seBusy('جاري النشر…'); const ok = await postStory(f, $('se-cap').value.trim()); seBusy('');
  if (ok) { seClose(); if (typeof closeStoryCam === 'function') closeStoryCam(); }
};
