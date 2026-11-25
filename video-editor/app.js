'use strict';
/* ============================================================
   محرر الفيديو — تنفيذ مستقل (Canvas + WebAudio + MediaRecorder)
   ============================================================ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmt = t => { t = Math.max(0, t); const m = Math.floor(t / 60), s = t - m * 60; return String(m).padStart(2, '0') + ':' + s.toFixed(1).padStart(4, '0'); };
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

const LANES = [
  { id: 't',  label: 'نص',       accept: ['text'] },
  { id: 's',  label: 'ملصقات',   accept: ['sticker'] },
  { id: 'v3', label: 'طبقة 3',   accept: ['video', 'image', 'text', 'sticker'] },
  { id: 'v2', label: 'طبقة 2',   accept: ['video', 'image', 'text', 'sticker'] },
  { id: 'v1', label: 'الرئيسي',  accept: ['video', 'image'] },
  { id: 'a1', label: 'صوت 1',    accept: ['audio'] },
  { id: 'a2', label: 'صوت 2',    accept: ['audio'] },
  { id: 'a3', label: 'صوت 3',    accept: ['audio'] },
];
const LANE_H = 38;
const RANK = { v1: 0, v2: 1, v3: 2, s: 3, t: 4 };
const LS = {}; // حالة المسارات: lock / hide / mute
const selSet = new Set();
const KFP = ['x', 'y', 'scale', 'rot', 'opacity'];

/* ---------------- الحالة ---------------- */
const S = { id: uid(), name: 'مشروع جديد', ratio: [16, 9], clips: [], media: {} };
let sel = null, time = 0, playing = false, pps = 60;
let undoS = [], redoS = [], lastU = 0, exporting = null, bounds = {}, onEnd = null;
const els = new Map();
let cfg = { snap: true, wave: true, autosave: true };
try { cfg = { ...cfg, ...JSON.parse(localStorage.getItem('ve-cfg') || '{}') }; } catch (e) {}

const cv = $('#cv'), g = cv.getContext('2d');
const off = document.createElement('canvas'), og = off.getContext('2d', { willReadFrequently: true });

function sizeFor(short) {
  const [a, b] = S.ratio; let W, H;
  if (a >= b) { H = short; W = Math.round(short * a / b); } else { W = short; H = Math.round(short * b / a); }
  return [W + (W % 2), H + (H % 2)];
}
function applyRatio() { const [W, H] = sizeFor(720); cv.width = W; cv.height = H; render(); }

/* ---------------- مساعدات ---------------- */
function toast(msg, ms = 2200) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.k); toast.k = setTimeout(() => t.hidden = true, ms); }
const total = () => S.clips.reduce((m, c) => Math.max(m, c.start + c.dur), 0);
const byId = id => S.clips.find(c => c.id === id);
const selClip = () => byId(sel);
const setSel = id => { sel = id; selSet.clear(); if (id) selSet.add(id); };
const selClips = () => { const a = S.clips.filter(c => selSet.has(c.id)); return a.length ? a : (selClip() ? [selClip()] : []); };
const locked = c => !!(LS[c.lane] && LS[c.lane].lock);
const get = (o, k) => k.split('.').reduce((a, b) => a[b], o);
const set = (o, k, v) => { const p = k.split('.'); const l = p.pop(); p.reduce((a, b) => a[b], o)[l] = v; };

function newClip(p) {
  return Object.assign({
    id: uid(), type: 'video', lane: 'v1', mediaId: null, start: 0, dur: 5, srcIn: 0, speed: 1,
    x: .5, y: .5, scale: 100, rot: 0, opacity: 100, flipH: false, flipV: false, blend: 'source-over',
    volume: 100, fadeIn: 0, fadeOut: 0, denoise: false, bass: 0, treble: 0, anim: 'none',
    f: { b: 100, c: 100, s: 100, h: 0, sep: 0, g: 0, bl: 0, inv: 0, vig: 0, sharp: 0 },
    kf: {}, crop: { l: 0, t: 0, r: 0, b: 0 }, trans: { type: 'none', dur: .6 }, curve: null, aiBg: false,
    chroma: { on: false, color: '#00ff00', tol: 40 },
    text: '', size: 64, color: '#ffffff', font: 'Cairo, Tahoma, sans-serif', bold: true, italic: false,
    strokeW: 0, strokeColor: '#000000', bgOn: false, bgColor: '#000000aa', shadow: true,
  }, p);
}
const cssFilter = c => {
  const f = c.f;
  const a = [];
  if (f.b !== 100) a.push(`brightness(${f.b}%)`); if (f.c !== 100) a.push(`contrast(${f.c}%)`);
  if (f.s !== 100) a.push(`saturate(${f.s}%)`); if (f.h) a.push(`hue-rotate(${f.h}deg)`);
  if (f.sep) a.push(`sepia(${f.sep}%)`); if (f.g) a.push(`grayscale(${f.g}%)`);
  if (f.bl) a.push(`blur(${f.bl}px)`); if (f.inv) a.push(`invert(${f.inv}%)`);
  if (f.sharp) a.push(`url(#sh${f.sharp})`);
  return a.length ? a.join(' ') : 'none';
};

/* ---------------- التراجع / الإعادة ---------------- */
const snap = () => JSON.stringify(S.clips);
function pushUndo() { undoS.push(snap()); if (undoS.length > 100) undoS.shift(); redoS = []; lastU = performance.now(); dirty(); }
function touch() { if (performance.now() - lastU > 800) pushUndo(); lastU = performance.now(); dirty(); }
function restore(js) { S.clips = JSON.parse(js); if (!byId(sel)) setSel(null); afterStruct(); }
function undo() { if (!undoS.length) return; redoS.push(snap()); restore(undoS.pop()); }
function redo() { if (!redoS.length) return; undoS.push(snap()); restore(redoS.pop()); }
function afterStruct() { pruneEls(); renderTimeline(); renderProps(); sync(time, false); render(); dirty(); }
function pruneEls() { const ids = new Set(S.clips.map(c => c.id)); for (const [k, e] of els) if (!ids.has(k)) { try { e.pause && e.pause(); } catch (_) {} els.delete(k); } }

/* ---------------- إطارات مفتاحية / منحنى السرعة / نوافذ الظهور ---------------- */
function val(c, k, p) {
  const a = c.kf && c.kf[k]; if (!a || !a.length) return c[k];
  if (p <= a[0].t) return a[0].v;
  for (let i = 1; i < a.length; i++) if (p <= a[i].t) { const u = (p - a[i - 1].t) / (a[i].t - a[i - 1].t || 1), e = u * u * (3 - 2 * u); return a[i - 1].v + (a[i].v - a[i - 1].v) * e; }
  return a[a.length - 1].v;
}
function setProp(c, k, v, p) {
  const a = c.kf && c.kf[k];
  if (a && a.length) { const t = +clamp(p, 0, c.dur).toFixed(2), f = a.find(q => Math.abs(q.t - t) < .04); if (f) f.v = v; else { a.push({ t, v }); a.sort((x, y) => x.t - y.t); } }
  else c[k] = v;
}
const curveMemo = {};
function curveW(cv_, x) { const n = cv_.length - 1, p = clamp(x, 0, 1) * n, i = Math.min(n - 1, Math.floor(p)), f = p - i; return cv_[i] + (cv_[i + 1] - cv_[i]) * f; }
function curveTab(cv_) {
  const key = cv_.join(','); if (curveMemo[key]) return curveMemo[key];
  const N = 400, cum = new Float32Array(N + 1); for (let i = 1; i <= N; i++) cum[i] = cum[i - 1] + curveW(cv_, (i - .5) / N) / N;
  return curveMemo[key] = { cum, mean: cum[N] };
}
function srcTime(c, p) {
  if (!c.curve) return c.srcIn + p * c.speed;
  const t = curveTab(c.curve), u = clamp(p / c.dur, 0, 1) * 400, i = Math.min(399, Math.floor(u));
  return c.srcIn + c.speed * c.dur * (t.cum[i] + (t.cum[i + 1] - t.cum[i]) * (u - i)) / t.mean;
}
function instRate(c, p) { if (!c.curve) return c.speed; return c.speed * curveW(c.curve, p / c.dur) / curveTab(c.curve).mean; }
function tail(c) {
  let tl = 0; const end = c.start + c.dur;
  for (const n of S.clips) if (n !== c && n.lane === c.lane && n.trans && n.trans.type !== 'none' && Math.abs(n.start - end) < .03) tl = Math.max(tl, n.trans.dur);
  if (tl && (c.type === 'video' || c.type === 'audio')) { const m = S.media[c.mediaId]; if (!m || m.duration - (c.srcIn + c.dur * c.speed) < tl * c.speed) tl = 0; }
  return tl;
}
const inWin = (c, t) => t >= c.start && t < c.start + c.dur + tail(c);
const laneOff = c => !!(LS[c.lane] && LS[c.lane].hide);

/* ---------------- الصوت (WebAudio) ---------------- */
let AC = null, dest = null, monitor = null;
function audioCtx() {
  if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); dest = AC.createMediaStreamDestination(); monitor = AC.createGain(); monitor.connect(AC.destination); }
  return AC;
}
function hookAudio(e) {
  const ctx = audioCtx(); const s = ctx.createMediaElementSource(e);
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 10;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 22000;
  const ls = ctx.createBiquadFilter(); ls.type = 'lowshelf'; ls.frequency.value = 200;
  const hs = ctx.createBiquadFilter(); hs.type = 'highshelf'; hs.frequency.value = 4000;
  const gn = ctx.createGain();
  s.connect(hp); hp.connect(lp); lp.connect(ls); ls.connect(hs); hs.connect(gn);
  gn.connect(monitor); gn.connect(dest);
  e._n = { hp, lp, ls, hs, gn };
}
function getEl(c) {
  let e = els.get(c.id); if (e) return e;
  const m = S.media[c.mediaId]; if (!m) return null;
  if (c.type === 'image') { e = new Image(); e.src = m.url; }
  else {
    e = document.createElement(c.type === 'audio' ? 'audio' : 'video');
    e.src = m.url; e.preload = 'auto'; e.playsInline = true;
    e.onseeked = () => { if (!playing) render(); };
    hookAudio(e);
  }
  els.set(c.id, e); return e;
}

/* ---------------- المزامنة والتشغيل ---------------- */
function sync(t, play) {
  if (monitor) monitor.gain.value = exporting ? 0 : 1;
  for (const c of S.clips) {
    if (c.type !== 'video' && c.type !== 'audio') continue;
    const e = getEl(c); if (!e) continue;
    const act = inWin(c, t);
    if (!act) { if (!e.paused) e.pause(); continue; }
    const p = t - c.start, target = srcTime(c, p);
    e.playbackRate = clamp(instRate(c, p), .0625, 16);
    if (play) {
      if (e.paused) { e.currentTime = target; e.play().catch(() => {}); }
      else if (Math.abs(e.currentTime - target) > .35) e.currentTime = target;
    } else {
      if (!e.paused) e.pause();
      if (Math.abs(e.currentTime - target) > .04) e.currentTime = target;
    }
    if (e._n) {
      let a = c.volume / 100; if (c.fadeIn > 0 && p < c.fadeIn) a *= p / c.fadeIn;
      const r = c.dur - p; if (c.fadeOut > 0 && r < c.fadeOut) a *= r / c.fadeOut;
      if (LS[c.lane] && (LS[c.lane].hide || LS[c.lane].mute)) a = 0;
      const n = e._n; n.gn.gain.value = Math.max(0, a);
      n.hp.frequency.value = c.denoise ? 120 : 10; n.lp.frequency.value = c.denoise ? 9000 : 22000;
      n.ls.gain.value = c.bass; n.hs.gain.value = c.treble;
    }
  }
}
let t0 = 0, tS = 0;
function play() {
  if (playing || !total()) return;
  audioCtx(); AC.resume();
  if (time >= total() - .02) time = 0;
  playing = true; t0 = performance.now(); tS = time; $('#bPlay').textContent = '⏸'; requestAnimationFrame(tick);
}
function pause() {
  if (!playing) return; playing = false; $('#bPlay').textContent = '▶';
  for (const e of els.values()) if (e.pause) e.pause();
}
function tick() {
  if (!playing) return;
  time = tS + (performance.now() - t0) / 1000;
  const T = total(); let ended = false;
  if (time >= T) { time = T; ended = true; }
  sync(time, !ended); render(); movePlayhead();
  if (exporting) $('#prog').value = T ? time / T * 100 : 0;
  if (ended) { pause(); if (onEnd) { const f = onEnd; onEnd = null; f(); } return; }
  requestAnimationFrame(tick);
}
function seek(t) { time = clamp(t, 0, Math.max(total(), 0)); sync(time, false); render(); movePlayhead(); }
function updateTC() { $('#tc').textContent = fmt(time) + ' / ' + fmt(total()); }

/* ---------------- الرسم ---------------- */
function render() {
  const W = cv.width, H = cv.height;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  bounds = {};
  const act = S.clips.filter(c => c.type !== 'audio' && !laneOff(c) && inWin(c, time))
    .sort((a, b) => (RANK[a.lane] - RANK[b.lane]) || (a.start - b.start));
  for (const c of act) drawClip(c);
  if (sel && !exporting && bounds[sel]) {
    const b = bounds[sel]; g.save(); g.translate(b.cx, b.cy); g.rotate(b.rot * Math.PI / 180);
    g.strokeStyle = '#2ee6d0'; g.lineWidth = 2; g.strokeRect(-b.w * b.sc / 2, -b.h * b.sc / 2, b.w * b.sc, b.h * b.sc); g.restore();
  }
  if (window.detBoxes && performance.now() < window.detBoxes.until) {
    g.save(); g.lineWidth = 3; g.strokeStyle = '#ffd23f'; g.fillStyle = '#ffd23f'; g.font = `bold ${Math.round(H / 36)}px sans-serif`;
    for (const b of window.detBoxes.items) { g.strokeRect(b.x, b.y, b.w, b.h); g.fillText(b.label, b.x + 4, Math.max(g.measureText('M').width * 1.6, b.y - 6)); }
    g.restore();
  }
  refreshKf(); updateTC();
}
function drawClip(c) {
  const W = cv.width, H = cv.height, p = time - c.start, d = c.dur, k = Math.min(W, H) / 720;
  let a = val(c, 'opacity', p) / 100;
  if (c.fadeIn > 0 && p < c.fadeIn) a *= p / c.fadeIn;
  if (c.fadeOut > 0 && d - p < c.fadeOut) a *= (d - p) / c.fadeOut;
  let x = val(c, 'x', p), y = val(c, 'y', p), sc = val(c, 'scale', p) / 100, rot = val(c, 'rot', p);
  const ease = v => 1 - Math.pow(1 - clamp(v, 0, 1), 3), e6 = ease(p / .6);
  switch (c.anim) {
    case 'zoomin': sc *= 1 + .25 * p / d; break;
    case 'zoomout': sc *= 1.25 - .25 * p / d; break;
    case 'inleft': x -= (1 - e6) * .4; break;
    case 'inright': x += (1 - e6) * .4; break;
    case 'inup': y += (1 - e6) * .4; break;
    case 'pop': sc *= ease(p / .4) * (1 + .1 * Math.sin(Math.min(p / .4, 1) * Math.PI)); break;
    case 'pulse': sc *= 1 + .06 * Math.sin(p * 6); break;
  }
  let blurT = 0, wipe = 1; const tr = c.trans;
  if (tr && tr.type !== 'none' && p >= 0 && p < tr.dur) {
    const e = ease(p / tr.dur);
    switch (tr.type) {
      case 'fade': a *= e; break; case 'slideL': x -= 1 - e; break; case 'slideR': x += 1 - e; break; case 'slideUp': y += 1 - e; break;
      case 'zoom': sc *= .4 + .6 * e; a *= e; break; case 'spin': rot += (1 - e) * 120; sc *= .3 + .7 * e; a *= e; break;
      case 'wipe': wipe = e; break; case 'blur': blurT = (1 - e) * 24; a *= .4 + .6 * e; break;
    }
  }
  g.save(); g.globalAlpha = clamp(a, 0, 1); g.globalCompositeOperation = c.blend;
  if (wipe < 1) { g.beginPath(); g.rect(0, 0, W * wipe, H); g.clip(); }
  g.translate(x * W, y * H); g.rotate(rot * Math.PI / 180);
  let w = 0, hh = 0;
  if (c.type === 'video' || c.type === 'image') {
    const e = getEl(c); const iw = e && (e.videoWidth || e.naturalWidth), ih = e && (e.videoHeight || e.naturalHeight);
    if (iw && ih && (c.type === 'image' || e.readyState >= 2)) {
      const fit = Math.min(W / iw, H / ih); w = iw * fit; hh = ih * fit;
      g.scale(sc * (c.flipH ? -1 : 1), sc * (c.flipV ? -1 : 1));
      const fl = cssFilter(c); g.filter = blurT ? (fl === 'none' ? '' : fl + ' ') + `blur(${blurT}px)` : fl;
      const cr = c.crop || { l: 0, t: 0, r: 0, b: 0 }, fw = 1 - (cr.l + cr.r) / 100, fh = 1 - (cr.t + cr.b) / 100;
      const sx = iw * cr.l / 100, sy = ih * cr.t / 100, sw = iw * fw, sh = ih * fh, dx = -w / 2 + w * cr.l / 100, dy = -hh / 2 + hh * cr.t / 100, dw = w * fw, dh = hh * fh;
      if (c.chroma.on || (c.aiBg && window.aiMask)) {
        const mw = Math.max(2, Math.min(960, Math.round(sw))), mh = Math.max(2, Math.round(mw * sh / sw));
        if (off.width !== mw || off.height !== mh) { off.width = mw; off.height = mh; }
        og.globalCompositeOperation = 'source-over'; og.clearRect(0, 0, mw, mh); og.drawImage(e, sx, sy, sw, sh, 0, 0, mw, mh);
        if (c.chroma.on) chromaKey(og.getImageData(0, 0, mw, mh), c.chroma);
        if (c.aiBg && window.aiMask) window.aiMask(off, og, c);
        g.drawImage(off, dx, dy, dw, dh);
      } else g.drawImage(e, sx, sy, sw, sh, dx, dy, dw, dh);
      g.filter = 'none'; w = dw; hh = dh;
      if (c.f.vig > 0) {
        const gr = g.createRadialGradient(0, 0, Math.min(w, hh) * .25, 0, 0, Math.max(w, hh) * .7);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${c.f.vig / 100})`);
        g.fillStyle = gr; g.fillRect(-w / 2, -hh / 2, w, hh);
      }
    }
  } else if (c.type === 'text' || c.type === 'sticker') {
    g.scale(sc, sc);
    const size = c.size * k;
    if (c.type === 'sticker') {
      g.font = `${size}px "Segoe UI Emoji","Noto Color Emoji","Apple Color Emoji",sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(c.text, 0, 0); w = hh = size * 1.2;
    } else {
      g.font = `${c.italic ? 'italic ' : ''}${c.bold ? 'bold ' : ''}${size}px ${c.font}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const lines = (c.text || ' ').split('\n'), lh = size * 1.3, pad = size * .3;
      w = Math.max(...lines.map(l => g.measureText(l).width)) + pad * 2; hh = lines.length * lh + pad * 2;
      if (c.bgOn) { g.fillStyle = c.bgColor; g.beginPath(); g.roundRect ? g.roundRect(-w / 2, -hh / 2, w, hh, size * .2) : g.rect(-w / 2, -hh / 2, w, hh); g.fill(); }
      if (c.shadow) { g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = size * .15; g.shadowOffsetY = size * .05; }
      lines.forEach((l, i) => {
        const yy = (i - (lines.length - 1) / 2) * lh;
        if (c.strokeW > 0) { g.lineWidth = c.strokeW * k * 2; g.strokeStyle = c.strokeColor; g.lineJoin = 'round'; g.strokeText(l, 0, yy); }
        g.fillStyle = c.color; g.fillText(l, 0, yy);
      });
    }
  }
  g.restore();
  if (w) bounds[c.id] = { cx: x * W, cy: y * H, w, h: hh, sc, rot };
}
function chromaKey(img, ck) {
  const d = img.data, r0 = parseInt(ck.color.slice(1, 3), 16), g0 = parseInt(ck.color.slice(3, 5), 16), b0 = parseInt(ck.color.slice(5, 7), 16);
  const tol = ck.tol * 4.4, soft = tol * .5;
  for (let i = 0; i < d.length; i += 4) {
    const dr = d[i] - r0, dg = d[i + 1] - g0, db = d[i + 2] - b0, dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist < tol) d[i + 3] = 0; else if (dist < tol + soft) d[i + 3] = 255 * (dist - tol) / soft;
  }
  og.putImageData(img, 0, 0);
}

/* سحب العناصر على المعاينة */
let drag = null;
function cvPoint(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; }
cv.addEventListener('pointerdown', e => {
  const [px, py] = cvPoint(e); let hit = null;
  const act = S.clips.filter(c => bounds[c.id]).sort((a, b) => (RANK[b.lane] - RANK[a.lane]) || (b.start - a.start));
  for (const c of act) {
    const b = bounds[c.id], r = -b.rot * Math.PI / 180, dx = px - b.cx, dy = py - b.cy;
    const lx = (dx * Math.cos(r) - dy * Math.sin(r)) / b.sc, ly = (dx * Math.sin(r) + dy * Math.cos(r)) / b.sc;
    if (Math.abs(lx) <= b.w / 2 && Math.abs(ly) <= b.h / 2) { hit = c; break; }
  }
  if (hit) { selectClip(hit.id); pushUndo(); drag = { id: hit.id, px, py, x: val(hit, 'x', time - hit.start), y: val(hit, 'y', time - hit.start) }; cv.setPointerCapture(e.pointerId); }
  else selectClip(null);
});
cv.addEventListener('pointermove', e => {
  if (!drag) return; const [px, py] = cvPoint(e), c = byId(drag.id); if (!c) return;
  const lp = time - c.start; setProp(c, 'x', drag.x + (px - drag.px) / cv.width, lp); setProp(c, 'y', drag.y + (py - drag.py) / cv.height, lp); render(); dirty();
});
cv.addEventListener('pointerup', () => { if (drag) { drag = null; renderProps(); } });

/* ---------------- الوسائط ---------------- */
function addMediaFromBlob(blob, name, type, extra = {}) {
  return new Promise(res => {
    const m = { id: uid(), name, type, blob, url: URL.createObjectURL(blob), duration: 5, ...extra };
    const fin = () => { S.media[m.id] = m; renderLib(); if (type !== 'image') computePeaks(m); res(m); };
    if (type === 'image') { const i = new Image(); i.onload = fin; i.onerror = fin; i.src = m.url; }
    else {
      const e = document.createElement(type === 'audio' ? 'audio' : 'video'); e.preload = 'metadata'; e.src = m.url;
      e.onloadedmetadata = () => { m.duration = isFinite(e.duration) ? e.duration : 5; fin(); };
      e.onerror = () => { toast('تعذّر قراءة الملف: ' + name); res(null); };
    }
  });
}
async function importFiles(files) {
  for (const f of files) {
    const type = f.type.startsWith('video') ? 'video' : f.type.startsWith('image') ? 'image' : f.type.startsWith('audio') ? 'audio' : null;
    if (!type) { toast('نوع غير مدعوم: ' + f.name); continue; }
    await addMediaFromBlob(f, f.name, type);
  }
}
async function computePeaks(m) {
  if (m.blob.size > 250e6) return;
  try {
    const ab = await m.blob.arrayBuffer(); const buf = await audioCtx().decodeAudioData(ab);
    const ch = buf.getChannelData(0), N = Math.max(1, Math.ceil(buf.duration * 50)), st = Math.max(1, Math.floor(ch.length / N)), pk = new Float32Array(N);
    for (let i = 0; i < N; i++) { let mx = 0; for (let j = i * st, e = Math.min(ch.length, j + st), s = Math.max(1, (e - j) >> 4); j < e; j += s) { const v = Math.abs(ch[j]); if (v > mx) mx = v; } pk[i] = mx; }
    m.peaks = pk; m.hasAudio = true; renderTimeline();
  } catch (e) { m.hasAudio = false; }
}
function renderLib() {
  const lib = $('#lib'); lib.innerHTML = '';
  for (const m of Object.values(S.media)) {
    const it = h('div', 'it'); it.title = m.name;
    if (m.type === 'image') it.innerHTML = `<img src="${m.url}">`;
    else if (m.type === 'video') it.innerHTML = `<video src="${m.url}#t=0.1" preload="metadata" muted></video>`;
    else it.innerHTML = '🎵';
    it.append(h('b', '', m.name));
    const ac = h('div', 'acts'), b2 = h('span', '', '⧉ طبقة إضافية'); b2.onclick = ev => { ev.stopPropagation(); addMediaClip(m.id, { lane: m.type === 'audio' ? 'a2' : 'v2' }); }; ac.append(b2); it.append(ac);
    it.onclick = () => addMediaClip(m.id);
    lib.append(it);
  }
}
function addMediaClip(mid, opts = {}) {
  const m = S.media[mid]; if (!m) return;
  pushUndo();
  const lane = m.type === 'audio' ? (opts.lane || 'a1') : (opts.lane || 'v1');
  const end = S.clips.filter(c => c.lane === lane).reduce((a, c) => Math.max(a, c.start + c.dur), 0);
  const c = newClip({ type: m.type, lane, mediaId: mid, start: opts.start != null ? opts.start : (lane === 'v1' || lane === 'a1' ? end : time), dur: m.type === 'image' ? 5 : m.duration, name: m.name });
  S.clips.push(c); setSel(c.id); afterStruct(); toast('تمت الإضافة إلى الخط الزمني');
}
function addOverlay(type, props) {
  pushUndo();
  const c = newClip({ type, lane: type === 'sticker' ? 's' : 't', start: time, dur: 4, ...props });
  S.clips.push(c); setSel(c.id); afterStruct();
}

/* ---------------- الخط الزمني ---------------- */
const tlScroll = $('#tlScroll'), inner = $('#tlInner'), ruler = $('#ruler'), lanesEl = $('#lanes'), ph = $('#playhead');
function renderTimeline() {
  const tot = Math.max(total() + 10, tlScroll.clientWidth / pps);
  inner.style.width = (tot * pps + 64) + 'px';
  const steps = [.5, 1, 2, 5, 10, 30, 60, 120, 300]; const step = steps.find(s => s * pps >= 80) || 600;
  ruler.innerHTML = '';
  for (let t = 0; t < tot; t += step) { const k = h('div', 'tick', fmt(t).slice(0, step < 1 ? 5 : 5)); k.style.left = (64 + t * pps) + 'px'; ruler.append(k); }
  lanesEl.innerHTML = '';
  for (const L of LANES) {
    const lane = h('div', 'lane'); lane.dataset.lane = L.id;
    const st = LS[L.id] || (LS[L.id] = {}), lb = h('div', 'lbl'), ic = h('div', 'ic'); lb.append(h('span', '', L.label));
    [['lock', '🔒', 'قفل المسار'], ['hide', '👁', 'إخفاء المسار'], ['mute', '🔇', 'كتم المسار']].forEach(([k, em, tt]) => {
      if (k === 'mute' && L.id[0] !== 'a' && L.id[0] !== 'v') return;
      const i = h('i', '', em); i.title = tt; i.classList.toggle('on', !!st[k]);
      i.onclick = ev => { ev.stopPropagation(); st[k] = !st[k]; renderTimeline(); sync(time, false); render(); dirty(); }; ic.append(i);
    });
    lb.append(ic); lane.append(lb); lane.classList.toggle('hidden', !!st.hide); lane.classList.toggle('locked', !!st.lock);
    const tr = h('div', 'track'); lane.append(tr);
    for (const c of S.clips.filter(c => c.lane === L.id)) tr.append(clipEl(c));
    lanesEl.append(lane);
  }
  movePlayhead(); updateTC();
}
function clipLabel(c) { return c.type === 'text' ? '✎ ' + (c.text || '').split('\n')[0] : c.type === 'sticker' ? c.text : ({ video: '🎞 ', image: '🖼 ', audio: '🎵 ' }[c.type]) + (c.name || ''); }
function clipEl(c) {
  const d = h('div', 'clip ' + c.type + (c.id === sel ? ' sel' : selSet.has(c.id) ? ' multi' : ''));
  d.dataset.id = c.id; d.style.left = c.start * pps + 'px'; d.style.width = Math.max(6, c.dur * pps) + 'px';
  const m = S.media[c.mediaId];
  if (cfg.wave && m && m.peaks && (c.type === 'audio' || c.type === 'video')) {
    const w = Math.max(6, Math.round(c.dur * pps)); const cn = h('canvas'); cn.width = w; cn.height = LANE_H - 8; cn.style.cssText = 'position:absolute;inset:0;opacity:.55;pointer-events:none';
    const x = cn.getContext('2d'); x.fillStyle = '#fff'; const mid = cn.height / 2;
    for (let px = 0; px < w; px += 2) {
      const ti = c.srcIn + (px / pps) * c.speed, v = m.peaks[Math.floor(ti * 50)] || 0, hh = Math.max(1, v * (cn.height - 4));
      x.fillRect(px, mid - hh / 2, 1.4, hh);
    }
    d.append(cn);
  }
  const lb = h('span'); lb.textContent = clipLabel(c); lb.style.position = 'relative'; d.append(lb);
  if (c.trans && c.trans.type !== 'none') { const t = h('div', 'tr'); t.style.width = c.trans.dur * pps + 'px'; d.append(t); }
  const kt = new Set(); Object.values(c.kf || {}).forEach(a => a.forEach(q => kt.add(q.t)));
  kt.forEach(t => { const k = h('div', 'kf'); k.style.left = t * pps + 'px'; d.append(k); });
  d.append(h('div', 'h l'), h('div', 'h r'));
  d.addEventListener('pointerdown', e => clipDown(e, c, d));
  return d;
}
function movePlayhead() {
  ph.style.left = (64 + time * pps) + 'px';
  if (playing) { const x = time * pps, v = tlScroll.scrollLeft; if (x > v + tlScroll.clientWidth - 40 || x < v) tlScroll.scrollLeft = x - 80; }
}
function snapT(t, c, edgeW = 0) {
  if (!cfg.snap) return t; const th = 8 / pps; const pts = [0, time];
  for (const o of S.clips) if (o !== c) { pts.push(o.start, o.start + o.dur); }
  let best = t, bd = th;
  for (const p of pts) { if (Math.abs(p - t) < bd) { bd = Math.abs(p - t); best = p; } if (edgeW && Math.abs(p - (t + edgeW)) < bd) { bd = Math.abs(p - (t + edgeW)); best = p - edgeW; } }
  return best;
}
function laneAt(y) { const r = lanesEl.getBoundingClientRect(); const i = Math.floor((y - r.top) / LANE_H); return LANES[clamp(i, 0, LANES.length - 1)]; }
function clipDown(e, c, d) {
  e.stopPropagation(); e.preventDefault();
  const add = e.shiftKey || e.ctrlKey || e.metaKey;
  if (add || !selSet.has(c.id)) selectClip(c.id, true, add); else { sel = c.id; $$('.clip', lanesEl).forEach(x => x.classList.toggle('sel', x.dataset.id === sel)); renderProps(); render(); }
  if (add || locked(c)) { if (locked(c)) toast('المسار مقفل'); return; }
  const r = d.getBoundingClientRect(), ox = e.clientX - r.left;
  const mode = ox < 9 ? 'l' : ox > r.width - 9 ? 'r' : 'm';
  const o = { start: c.start, dur: c.dur, srcIn: c.srcIn, x: e.clientX }; const m = S.media[c.mediaId];
  const grp = (mode === 'm' && selSet.size > 1) ? S.clips.filter(q => selSet.has(q.id) && !locked(q)).map(q => [q, q.start]) : null;
  pushUndo();
  const mv = ev => {
    const dt = (ev.clientX - o.x) / pps;
    if (mode === 'm') {
      let ns = Math.max(0, snapT(o.start + dt, c, c.dur));
      if (grp) { const sh = Math.max(ns - o.start, -Math.min(...grp.map(q => q[1]))); grp.forEach(([q, s0]) => q.start = s0 + sh); }
      else { c.start = ns; const L = laneAt(ev.clientY); if (L.accept.includes(c.type)) c.lane = L.id; }
    } else if (mode === 'l') {
      let ns = snapT(o.start + dt, c), delta = ns - o.start;
      if (c.type === 'video' || c.type === 'audio') delta = Math.max(delta, -o.srcIn / c.speed);
      delta = clamp(delta, -o.start, o.dur - .1);
      c.start = o.start + delta; c.dur = o.dur - delta; if (c.type === 'video' || c.type === 'audio') c.srcIn = o.srcIn + delta * c.speed;
    } else {
      let nd = Math.max(.1, snapT(o.start + o.dur + dt, c) - o.start);
      if (m && (c.type === 'video' || c.type === 'audio')) nd = Math.min(nd, (m.duration - c.srcIn) / c.speed);
      c.dur = nd;
    }
    renderTimeline(); sync(time, false); render();
  };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); renderProps(); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}
function selectClip(id, keepTl, add) {
  if (add && id) { if (selSet.has(id)) { selSet.delete(id); if (sel === id) sel = [...selSet][0] || null; } else { selSet.add(id); sel = id; } }
  else setSel(id);
  if (!keepTl) renderTimeline(); else $$('.clip', lanesEl).forEach(x => { x.classList.toggle('sel', x.dataset.id === sel); x.classList.toggle('multi', selSet.has(x.dataset.id) && x.dataset.id !== sel); });
  renderProps(); render();
}
lanesEl.addEventListener('pointerdown', e => { if (e.target.closest('.clip') || e.target.closest('.lbl')) return; selectClip(null); const r = ruler.getBoundingClientRect(); seek((e.clientX - r.left - 64) / pps); });
function rulerSeek(e) { const r = ruler.getBoundingClientRect(); pause(); seek((e.clientX - r.left - 64) / pps); }
ruler.addEventListener('pointerdown', e => { ruler.setPointerCapture(e.pointerId); rulerSeek(e); ruler.onpointermove = rulerSeek; });
ruler.addEventListener('pointerup', () => ruler.onpointermove = null);
$('#zoom').oninput = e => { const cx = tlScroll.scrollLeft + tlScroll.clientWidth / 2, tc = cx / pps; pps = +e.target.value; renderTimeline(); tlScroll.scrollLeft = tc * pps - tlScroll.clientWidth / 2; };
tlScroll.addEventListener('wheel', e => { if (!e.ctrlKey) return; e.preventDefault(); const z = $('#zoom'); z.value = clamp(+z.value * (e.deltaY < 0 ? 1.15 : .87), 10, 300); z.oninput({ target: z }); }, { passive: false });
addEventListener('resize', renderTimeline);

/* ---------------- أدوات التحرير ---------------- */
function splitClip() {
  let targets = selClips().filter(c => time > c.start + .05 && time < c.start + c.dur - .05);
  if (!targets.length && !selClips().length) { const c = S.clips.filter(c => time > c.start + .05 && time < c.start + c.dur - .05 && !laneOff(c)).sort((a, b) => RANK[a.lane] - RANK[b.lane])[0]; if (c) targets = [c]; }
  targets = targets.filter(c => !locked(c));
  if (!targets.length) return toast('ضع المؤشر داخل مقطع غير مقفل لتقسيمه');
  pushUndo(); let last = null;
  for (const c of targets) {
    const p = time - c.start, n = JSON.parse(JSON.stringify(c)); n.id = uid(); n.start = time; n.dur = c.dur - p; n.fadeIn = 0; n.trans = { type: 'none', dur: .6 };
    if (c.type === 'video' || c.type === 'audio') n.srcIn = srcTime(c, p);
    for (const k of Object.keys(c.kf || {})) { // توزيع الإطارات المفتاحية على الجزأين
      const a = c.kf[k], v = val(c, k, p);
      n.kf[k] = [{ t: 0, v }, ...a.filter(q => q.t > p).map(q => ({ t: +(q.t - p).toFixed(2), v: q.v }))];
      c.kf[k] = [...a.filter(q => q.t < p), { t: +p.toFixed(2), v }];
    }
    c.curve = null; n.curve = null; c.dur = p; c.fadeOut = 0; S.clips.push(n); last = n;
  }
  setSel(last.id); afterStruct();
}
function delClip() { const t = selClips().filter(c => !locked(c)); if (!t.length) return toast('لا يوجد مقطع محدد قابل للحذف'); pushUndo(); const ids = new Set(t.map(c => c.id)); S.clips = S.clips.filter(c => !ids.has(c.id)); setSel(null); afterStruct(); }
function dupClip() { const t = selClips().filter(c => !locked(c)); if (!t.length) return toast('حدّد مقطعاً'); pushUndo(); let last; for (const c of t) { const n = JSON.parse(JSON.stringify(c)); n.id = uid(); n.start = c.start + c.dur; n.trans = { type: 'none', dur: .6 }; S.clips.push(n); last = n; } setSel(last.id); afterStruct(); }
function mergeClips() {
  const t = selClips().sort((a, b) => a.start - b.start); if (t.length < 2) return toast('حدّد مقطعين متجاورين أو أكثر (Shift + نقر)');
  pushUndo(); let merged = 0, base = t[0];
  for (const n of t.slice(1)) {
    const end = base.start + base.dur, av = base.type === 'video' || base.type === 'audio';
    const ok = n.lane === base.lane && n.type === base.type && n.mediaId === base.mediaId && Math.abs(n.start - end) < .06 && n.speed === base.speed && !base.curve && !n.curve &&
      (!av || Math.abs(n.srcIn - (base.srcIn + base.dur * base.speed)) < .08 * base.speed);
    if (!ok) { base = n; continue; }
    base.dur = n.start + n.dur - base.start; S.clips = S.clips.filter(c => c !== n); merged++;
  }
  if (!merged) { undoS.pop(); return toast('لا يمكن الدمج: يجب أن يكون المقطعان متصلين ومن المصدر نفسه'); }
  setSel(base.id); afterStruct(); toast('تم دمج ' + merged + ' مقطع');
}
function closeGaps() {
  const lane = (selClip() && selClip().lane) || 'v1', L = S.clips.filter(c => c.lane === lane).sort((a, b) => a.start - b.start); if (!L.length || locked(L[0])) return toast('لا شيء لإغلاقه');
  pushUndo(); let t = 0; for (const c of L) { c.start = t; t += c.dur; } afterStruct(); toast('تم إغلاق الفراغات في المسار');
}
function extractAudio() {
  const c = selClip(); if (!c || c.type !== 'video') return toast('حدّد مقطع فيديو أولاً');
  const m = S.media[c.mediaId]; if (m.hasAudio === false) return toast('هذا الفيديو لا يحتوي على صوت');
  pushUndo(); const n = JSON.parse(JSON.stringify(c)); n.id = uid(); n.type = 'audio'; n.lane = 'a1'; c.volume = 0; S.clips.push(n); setSel(n.id); afterStruct(); toast('تم استخراج الصوت إلى مسار مستقل وكتم الفيديو الأصلي');
}
function autoEnhance() {
  const c = selClip(); if (!c || (c.type !== 'video' && c.type !== 'image')) return toast('حدّد مقطع فيديو أو صورة');
  const e = getEl(c); if (!e) return; const iw = e.videoWidth || e.naturalWidth; if (!iw) return toast('لم يتم تحميل الإطار بعد');
  const t = document.createElement('canvas'); t.width = 96; t.height = 96; const x = t.getContext('2d'); x.drawImage(e, 0, 0, 96, 96);
  const d = x.getImageData(0, 0, 96, 96).data; let s = 0, s2 = 0, n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) { const l = .299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2]; s += l; s2 += l * l; }
  const mean = s / n, sd = Math.sqrt(s2 / n - mean * mean);
  pushUndo(); c.f.b = Math.round(clamp(100 * 118 / Math.max(mean, 25), 70, 160)); c.f.c = Math.round(clamp(100 * 58 / Math.max(sd, 18), 90, 145)); c.f.s = 112;
  afterStruct(); toast(`تحسين تلقائي: سطوع ${c.f.b}% • تباين ${c.f.c}% (المتوسط ${mean | 0}، الانحراف ${sd | 0})`);
}

/* ---------------- لوحة الخصائص ---------------- */
const FONT_N = ['Cairo', 'Tajawal', 'Amiri (نسخ)', 'Reem Kufi (كوفي)', 'Lalezar (عريض)', 'Almarai', 'El Messiri', 'Changa', 'Tahoma', 'Arial', 'Georgia', 'Impact'];
const FONTS = ['Cairo', 'Tajawal', 'Amiri', '"Reem Kufi"', 'Lalezar', 'Almarai', '"El Messiri"', 'Changa', 'Tahoma', 'Arial', 'Georgia', 'Impact'].map(f => f + ', Tahoma, sans-serif');
FONTS.forEach(f => { try { document.fonts.load('bold 24px ' + f); document.fonts.load('24px ' + f); } catch (e) {} });
if (document.fonts) document.fonts.addEventListener('loadingdone', () => render());
const kfUI = [];
function refreshKf() {
  const c = selClip(); if (!c) return; const p = time - c.start;
  for (const u of kfUI) if (u.c === c) {
    const v = val(c, u.key, p), a = c.kf[u.key];
    if (document.activeElement !== u.i) u.i.value = v; u.o.textContent = (+v).toFixed(u.key === 'x' || u.key === 'y' ? 2 : 0) + u.unit;
    u.kb.classList.toggle('on', !!(a && a.some(q => Math.abs(q.t - p) < .04)));
  }
}
function renderTimelineKf() { renderTimeline(); }
function afterEdit(tl) { sync(time, false); render(); if (tl) renderTimeline(); }
function renderProps() {
  const P = $('#props'); P.innerHTML = ''; kfUI.length = 0; const c = selClip();
  if (!c) {
    P.append(h('h4', '', 'المشروع'));
    const r = h('div', 'row'); r.append(h('label', '', 'الاسم')); const i = h('input'); i.type = 'text'; i.value = S.name; i.oninput = () => { S.name = i.value; dirty(); }; r.append(i); P.append(r);
    P.append(h('p', 'hint', 'حدّد مقطعاً من الخط الزمني أو المعاينة لتعديل خصائصه.<br>اختصارات: Space تشغيل • S تقسيم • Delete حذف • Ctrl+Z/Y تراجع/إعادة • Ctrl+D تكرار • ←/→ إطار'));
    return;
  }
  const sec = t => P.append(h('h4', '', t));
  const rng = (label, key, min, max, step, unit = '', cb) => {
    const r = h('div', 'row'), l = h('label', '', label), i = h('input'), o = h('output'), isK = KFP.includes(key); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = isK ? val(c, key, time - c.start) : get(c, key); o.textContent = i.value + unit;
    i.oninput = () => { touch(); if (isK) setProp(c, key, +i.value, time - c.start); else set(c, key, +i.value); o.textContent = i.value + unit; if (cb) cb(); afterEdit(key === 'fadeIn' || key === 'fadeOut'); if (isK) renderTimelineKf(); };
    if (isK) {
      const kb = h('button', 'kfb', '◆'); kb.title = 'إطار مفتاحي عند موضع المؤشر';
      kb.onclick = () => {
        pushUndo(); const p = +clamp(time - c.start, 0, c.dur).toFixed(2), a = c.kf[key];
        if (!a || !a.length) c.kf[key] = [{ t: p, v: c[key] }];
        else { const f = a.findIndex(q => Math.abs(q.t - p) < .04); if (f >= 0) { if (a.length === 1) c[key] = a[0].v; a.splice(f, 1); if (!a.length) delete c.kf[key]; } else { a.push({ t: p, v: val(c, key, p) }); a.sort((x, y) => x.t - y.t); } }
        render(); renderTimeline();
      };
      r.append(l, kb, i, o); kfUI.push({ c, key, i, o, kb, unit });
    } else r.append(l, i, o);
    P.append(r);
  };
  const chk = (label, key, cb) => { const r = h('div', 'row'), l = h('label', '', label), i = h('input'); i.type = 'checkbox'; i.checked = get(c, key); i.onchange = () => { pushUndo(); set(c, key, i.checked); if (cb) cb(); afterEdit(); }; r.append(l, i); P.append(r); };
  const col = (label, key) => { const r = h('div', 'row'), l = h('label', '', label), i = h('input'); i.type = 'color'; i.value = get(c, key).slice(0, 7); i.oninput = () => { touch(); set(c, key, i.value); afterEdit(); }; r.append(l, i); P.append(r); };
  const sel_ = (label, key, opts, cb) => { const r = h('div', 'row'), l = h('label', '', label), i = h('select'); opts.forEach(([v, n]) => { const o = h('option', '', n); o.value = v; i.append(o); }); i.value = get(c, key); i.onchange = () => { pushUndo(); set(c, key, i.value); if (cb) cb(); afterEdit(); }; r.append(l, i); P.append(r); };

  P.append(h('h4', '', clipLabel(c)));
  P.append(h('p', 'hint', `البداية ${fmt(c.start)} • المدة ${fmt(c.dur)}`));
  if (c.type === 'text') {
    sec('النص');
    const ta = h('textarea'); ta.rows = 3; ta.value = c.text; ta.oninput = () => { touch(); c.text = ta.value; afterEdit(true); }; P.append(ta);
    rng('الحجم', 'size', 16, 300, 1); col('اللون', 'color');
    sel_('الخط', 'font', FONTS.map((f, i) => [f, FONT_N[i]]));
    chk('عريض', 'bold'); chk('مائل', 'italic'); chk('ظل', 'shadow');
    rng('الحد', 'strokeW', 0, 12, 1); col('لون الحد', 'strokeColor');
    chk('خلفية', 'bgOn'); col('لون الخلفية', 'bgColor');
  }
  if (c.type === 'sticker') { sec('الملصق'); rng('الحجم', 'size', 24, 400, 1); }
  if (c.type !== 'audio') {
    sec('التحويل'); rng('الحجم %', 'scale', 5, 400, 1); rng('X', 'x', -.5, 1.5, .005); rng('Y', 'y', -.5, 1.5, .005); rng('التدوير °', 'rot', -180, 180, 1); rng('الشفافية', 'opacity', 0, 100, 1, '%');
    if (c.type === 'video' || c.type === 'image') { chk('قلب أفقي', 'flipH'); chk('قلب عمودي', 'flipV'); }
    sel_('الانتقال (عند البداية)', 'trans.type', TRANS.map(t => [t[0], t[1]]), () => { if (c.trans.type !== 'none') toast('تم تطبيق الانتقال'); renderTimeline(); });
    rng('مدة الانتقال', 'trans.dur', .2, 2, .1, 's', () => renderTimeline());
    sel_('الدمج', 'blend', [['source-over', 'عادي'], ['multiply', 'ضرب'], ['screen', 'شاشة'], ['overlay', 'تراكب'], ['lighten', 'تفتيح'], ['darken', 'تغميق'], ['difference', 'فرق']]);
    sel_('حركة الدخول', 'anim', ANIMS.map(a => [a[0], a[1]]));
    rng('ظهور تدريجي', 'fadeIn', 0, 3, .1, 's'); rng('اختفاء تدريجي', 'fadeOut', 0, 3, .1, 's');
  }
  if (c.type === 'video' || c.type === 'audio') {
    sec('السرعة');
    const sg = h('div', 'seg'); SPEEDCURVES.forEach(([n, cv_]) => { const b = h('button', '', n); b.onclick = () => { pushUndo(); c.curve = cv_ ? cv_.slice() : null; afterEdit(); toast(cv_ ? 'تم تطبيق منحنى السرعة: ' + n : 'سرعة عادية'); }; sg.append(b); }); P.append(h('p', 'hint', 'منحنى السرعة (يعيد توزيع السرعة دون تغيير المدة الكلية):')); P.append(sg);
    const r = h('div', 'row'), l = h('label', '', 'السرعة'), i = h('input'), o = h('output'); i.type = 'range'; i.min = .25; i.max = 4; i.step = .05; i.value = c.speed; o.textContent = c.speed + 'x';
    i.oninput = () => { touch(); const span = c.dur * c.speed, m = S.media[c.mediaId]; c.speed = +i.value; c.dur = span / c.speed; o.textContent = c.speed + 'x'; afterEdit(true); };
    r.append(l, i, o); P.append(r);
    sec('الصوت'); rng('مستوى الصوت', 'volume', 0, 200, 1, '%');
    if (c.type === 'audio') { rng('ظهور تدريجي', 'fadeIn', 0, 5, .1, 's'); rng('اختفاء تدريجي', 'fadeOut', 0, 5, .1, 's'); }
    rng('جهير', 'bass', -15, 15, 1, 'dB'); rng('حاد', 'treble', -15, 15, 1, 'dB'); chk('تقليل الضوضاء', 'denoise');
  }
  if (c.type === 'video' || c.type === 'image') {
    sec('الألوان والفلاتر');
    rng('السطوع', 'f.b', 20, 250, 1, '%'); rng('التباين', 'f.c', 20, 250, 1, '%'); rng('التشبع', 'f.s', 0, 300, 1, '%'); rng('تدرج اللون', 'f.h', -180, 180, 1, '°');
    rng('سيبيا', 'f.sep', 0, 100, 1, '%'); rng('رمادي', 'f.g', 0, 100, 1, '%'); rng('ضبابية', 'f.bl', 0, 20, .5, 'px'); rng('عكس', 'f.inv', 0, 100, 1, '%'); rng('تعتيم الأطراف', 'f.vig', 0, 100, 1, '%'); rng('الحدة (0-3)', 'f.sharp', 0, 3, 1);
    sec('الاقتصاص'); rng('من اليسار', 'crop.l', 0, 45, 1, '%'); rng('من اليمين', 'crop.r', 0, 45, 1, '%'); rng('من الأعلى', 'crop.t', 0, 45, 1, '%'); rng('من الأسفل', 'crop.b', 0, 45, 1, '%');
    sec('إزالة الخلفية الخضراء (Chroma Key)'); chk('تفعيل', 'chroma.on'); col('اللون', 'chroma.color'); rng('التسامح', 'chroma.tol', 5, 90, 1);
    const b = h('button', 'btn', '✨ تحسين تلقائي للألوان'); b.onclick = autoEnhance; P.append(b);
    const rs = h('button', 'btn', 'إعادة ضبط الفلاتر'); rs.onclick = () => { pushUndo(); c.f = newClip({}).f; renderProps(); afterEdit(); }; P.append(rs);
  }
}

/* ---------------- اللوحة اليسرى ---------------- */
const TRANS = [['none', 'بدون'], ['fade', 'تلاشي'], ['slideL', 'انزلاق يسار'], ['slideR', 'انزلاق يمين'], ['slideUp', 'صعود'], ['zoom', 'تكبير'], ['spin', 'دوران'], ['wipe', 'مسح'], ['blur', 'ضبابية']];
const SPEEDCURVES = [['عادي', null], ['مونتاج', [2, .4, 2, .4, 2]], ['بطل', [1, .25, .25, 1, 2]], ['رصاصة', [1, 1, .1, .1, 1, 1]], ['قفزة للداخل', [.3, .5, 1, 2, 3]], ['قفزة للخارج', [3, 2, 1, .5, .3]], ['وميض للداخل', [3, .5, .5, 1, 1]], ['وميض للخارج', [1, 1, .5, .5, 3]]];
const ANIMS = [['none', 'بدون'], ['zoomin', 'تكبير تدريجي'], ['zoomout', 'تصغير تدريجي'], ['inleft', 'انزلاق من اليسار'], ['inright', 'انزلاق من اليمين'], ['inup', 'صعود'], ['pop', 'ظهور منبثق'], ['pulse', 'نبض']];
const FILTERS = [
  ['أصلي', {}], ['حيوي', { b: 105, c: 115, s: 150 }], ['دافئ', { b: 105, c: 105, s: 110, sep: 30, h: -10 }], ['بارد', { b: 100, c: 105, s: 105, h: 25 }],
  ['سينمائي', { b: 95, c: 125, s: 85, sep: 15, vig: 45 }], ['أبيض وأسود', { g: 100, c: 115 }], ['قديم', { sep: 70, c: 90, b: 105, vig: 50 }], ['باهت', { c: 80, s: 70, b: 115 }],
  ['درامي', { c: 150, s: 120, b: 90, vig: 35 }], ['نيون', { s: 220, c: 120, h: 40 }], ['سلبي', { inv: 100 }], ['حالم', { bl: 1.5, b: 112, s: 120 }],
];
function aiTool(n, d, f) { const it = h('div', 'it', `${n}<small>${d}</small>`); it.onclick = f; $('#ai').append(it); return it; }
function buildLeft() {
  $$('#tabs button').forEach(b => b.onclick = () => { $$('#tabs button').forEach(x => x.classList.toggle('on', x === b)); $$('.tab').forEach(t => t.classList.toggle('on', t.id === 'tab-' + b.dataset.tab)); });
  const tp = $('#textPresets');
  [['عنوان كبير', { text: 'عنوان', size: 110, bold: true, strokeW: 0 }], ['عنوان فرعي', { text: 'عنوان فرعي', size: 64 }], ['نص عادي', { text: 'اكتب هنا', size: 44, bold: false }],
   ['نص بخلفية', { text: 'نص بخلفية', size: 52, bgOn: true, bgColor: '#e91e63' }], ['نص بحدود', { text: 'نص بحدود', size: 80, strokeW: 4, strokeColor: '#000000', color: '#ffe600' }],
   ['ترجمة سفلية', { text: 'ترجمة', size: 40, bold: false, bgOn: true, bgColor: '#000000aa', y: .88 }]].forEach(([n, p]) => {
    const it = h('div', 'it', n); it.onclick = () => addOverlay('text', p); tp.append(it);
  });
  const st = $('#stk');
  '😀 😂 😍 😎 🥳 😭 🔥 ❤️ 💯 ⭐ ✨ 🎉 👍 👏 🙏 💪 🎵 🎬 📌 ✅ ❌ ⚡ 🌈 ☀️ 🌙 🍀 🎁 👑 💎 🚀 🏆 💥 💬 📣 ➡️ ⬆️ 👀 🤝 🧠 🎯'.split(' ').forEach(e => {
    const it = h('div', 'it', e); it.onclick = () => addOverlay('sticker', { text: e, size: 140, dur: 3 }); st.append(it);
  });
  const fl = $('#flt');
  FILTERS.forEach(([n, f]) => {
    const it = h('div', 'it'); const probe = newClip({}); Object.assign(probe.f, f);
    it.innerHTML = `<div style="position:absolute;inset:0;background:linear-gradient(135deg,#f6c453,#d9487d 45%,#2b7bd6);filter:${cssFilter(probe)}"></div>`; it.append(h('b', '', n));
    it.onclick = () => { const c = selClip(); if (!c || (c.type !== 'video' && c.type !== 'image')) return toast('حدّد مقطع فيديو أو صورة أولاً'); pushUndo(); c.f = { ...newClip({}).f, ...f }; renderProps(); afterEdit(); };
    fl.append(it);
  });
  const fx = $('#fx');
  ANIMS.forEach(([k, n]) => { const it = h('div', 'it', n); it.onclick = () => { const c = selClip(); if (!c || c.type === 'audio') return toast('حدّد مقطعاً مرئياً أولاً'); pushUndo(); c.anim = k; renderProps(); afterEdit(); }; fx.append(it); });
  [['ظهور تدريجي (0.5ث)', 'fadeIn'], ['اختفاء تدريجي (0.5ث)', 'fadeOut']].forEach(([n, k]) => { const it = h('div', 'it', n); it.onclick = () => { const c = selClip(); if (!c) return toast('حدّد مقطعاً أولاً'); pushUndo(); c[k] = .5; renderProps(); afterEdit(true); }; fx.append(it); });
  const trn = $('#trn');
  TRANS.forEach(([k, n]) => { const it = h('div', 'it', n); it.onclick = () => { const c = selClip(); if (!c || c.type === 'audio') return toast('حدّد مقطعاً مرئياً أولاً'); pushUndo(); c.trans = { type: k, dur: c.trans.dur || .6 }; renderProps(); renderTimeline(); sync(time, false); seek(c.start); toast(k === 'none' ? 'تمت إزالة الانتقال' : 'تم تطبيق الانتقال: ' + n); }; trn.append(it); });
  const ai = $('#ai');
  const tool = (n, d, f) => aiTool(n, d, f);
  tool('✨ تحسين تلقائي للألوان', 'تحليل إطار المقطع وضبط السطوع والتباين', autoEnhance);
  tool('🟩 إزالة الخلفية الخضراء', 'Chroma Key فعلي على المقطع المحدد', () => { const c = selClip(); if (!c || (c.type !== 'video' && c.type !== 'image')) return toast('حدّد مقطع فيديو أو صورة'); pushUndo(); c.chroma.on = !c.chroma.on; renderProps(); afterEdit(); toast(c.chroma.on ? 'تم تفعيل إزالة الخلفية الخضراء' : 'تم إيقافها'); });
  tool('🔇 تقليل الضوضاء الصوتية', 'فلترة الترددات (ليس نموذج ذكاء اصطناعي)', () => { const c = selClip(); if (!c || (c.type !== 'video' && c.type !== 'audio')) return toast('حدّد مقطع صوت أو فيديو'); pushUndo(); c.denoise = !c.denoise; renderProps(); afterEdit(); toast(c.denoise ? 'تم تفعيل تقليل الضوضاء' : 'تم الإيقاف'); });
  tool('🔊 استخراج الصوت', 'فصل صوت الفيديو إلى مسار مستقل', extractAudio);
  // مؤثرات صوتية مولَّدة
  const sf = $('#sfx');
  Object.keys(SFX).forEach(k => { const it = h('div', 'it', SFX[k].n); it.onclick = async () => { const blob = await makeSfx(k); const m = await addMediaFromBlob(blob, SFX[k].n, 'audio', { duration: SFX[k].d, hasAudio: true }); addMediaClip(m.id, { lane: 'a2', start: time }); }; sf.append(it); });
}

/* ---------------- مؤثرات صوتية مولَّدة ---------------- */
const SFX = { whoosh: { n: '🌬 وووش', d: 1.2 }, ding: { n: '🔔 جرس', d: 1.5 }, pop: { n: '💥 فرقعة', d: .3 }, boom: { n: '🥁 انفجار', d: 1.4 }, click: { n: '🖱 نقرة', d: .15 }, laser: { n: '🔫 ليزر', d: .5 } };
async function makeSfx(k) {
  const sr = 44100, d = SFX[k].d, o = new OfflineAudioContext(1, Math.ceil(sr * d), sr);
  const noise = () => { const b = o.createBuffer(1, sr * d, sr), x = b.getChannelData(0); for (let i = 0; i < x.length; i++) x[i] = Math.random() * 2 - 1; const s = o.createBufferSource(); s.buffer = b; return s; };
  const env = (v0, t) => { const g = o.createGain(); g.gain.setValueAtTime(v0, 0); g.gain.exponentialRampToValueAtTime(.001, t); g.connect(o.destination); return g; };
  const osc = (type, f0, f1, t, gn) => { const s = o.createOscillator(); s.type = type; s.frequency.setValueAtTime(f0, 0); s.frequency.exponentialRampToValueAtTime(f1, t); s.connect(gn); s.start(); s.stop(t); };
  if (k === 'whoosh') { const n = noise(), f = o.createBiquadFilter(), g2 = o.createGain(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(300, 0); f.frequency.exponentialRampToValueAtTime(4000, d * .6); f.frequency.exponentialRampToValueAtTime(500, d); g2.gain.setValueAtTime(0, 0); g2.gain.linearRampToValueAtTime(.9, d * .5); g2.gain.linearRampToValueAtTime(0, d); n.connect(f); f.connect(g2); g2.connect(o.destination); n.start(); }
  if (k === 'ding') { osc('sine', 880, 878, d, env(.6, d)); osc('sine', 1760, 1758, d * .6, env(.25, d * .6)); osc('sine', 2640, 2638, d * .3, env(.12, d * .3)); }
  if (k === 'pop') osc('sine', 500, 60, d * .9, env(.9, d));
  if (k === 'boom') { osc('sine', 130, 35, d * .9, env(1, d)); const n = noise(), f = o.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 800; const gg = env(.7, d * .5); n.connect(f); f.connect(gg); n.start(); }
  if (k === 'click') { const n = noise(), f = o.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2000; const gg = env(.8, d); n.connect(f); f.connect(gg); n.start(); }
  if (k === 'laser') osc('sawtooth', 1800, 150, d * .95, env(.35, d));
  return wav(await o.startRendering());
}
function wav(buf) {
  const x = buf.getChannelData(0), n = x.length, ab = new ArrayBuffer(44 + n * 2), v = new DataView(ab);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, clamp(x[i], -1, 1) * 32767, true);
  return new Blob([ab], { type: 'audio/wav' });
}

/* ---------------- تسجيل التعليق الصوتي ---------------- */
let rec = null;
$('#bRec').onclick = async () => {
  if (rec) { rec.stop(); return; }
  try {
    const st = await navigator.mediaDevices.getUserMedia({ audio: true }); const chunks = []; rec = new MediaRecorder(st); const startT = time, t0r = performance.now();
    rec.ondataavailable = e => chunks.push(e.data);
    rec.onstop = async () => {
      st.getTracks().forEach(t => t.stop()); rec = null; pause(); $('#bRec').textContent = '🎙 تسجيل تعليق صوتي';
      const blob = new Blob(chunks, { type: 'audio/webm' }), dur = (performance.now() - t0r) / 1000;
      const m = await addMediaFromBlob(blob, 'تعليق صوتي', 'audio'); if (m) addMediaClip(m.id, { lane: 'a2', start: startT });
    };
    rec.start(); $('#bRec').textContent = '⏹ إيقاف التسجيل'; play();
  } catch (e) { toast('تعذّر الوصول إلى الميكروفون: ' + e.message); rec = null; }
};
$('#bExtract').onclick = extractAudio;

/* ---------------- حفظ المشاريع (IndexedDB) ---------------- */
const idb = new Promise((res, rej) => { const r = indexedDB.open('video-editor', 1); r.onupgradeneeded = () => r.result.createObjectStore('projects', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const tx = async (mode, fn) => { const d = await idb; return new Promise((res, rej) => { const t = d.transaction('projects', mode), r = fn(t.objectStore('projects')); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); };
let dirtyT = null;
function dirty() { if (!cfg.autosave) return; clearTimeout(dirtyT); dirtyT = setTimeout(() => saveProject(true), 1500); }
async function saveProject(silent) {
  try {
    await tx('readwrite', s => s.put({ id: S.id, name: S.name, ratio: S.ratio, clips: S.clips, lanes: LS, updated: Date.now(), media: Object.values(S.media).map(m => ({ id: m.id, name: m.name, type: m.type, duration: m.duration, blob: m.blob, hasAudio: m.hasAudio })) }));
    if (!silent) toast('تم حفظ المشروع');
  } catch (e) { toast('تعذّر الحفظ: ' + (e.message || e)); }
}
async function loadProject(p) {
  pause(); for (const m of Object.values(S.media)) URL.revokeObjectURL(m.url); els.clear();
  S.id = p.id; S.name = p.name; S.ratio = p.ratio; S.media = {};
  const base = newClip({}); S.clips = p.clips.map(c => ({ ...base, ...c, f: { ...base.f, ...c.f }, crop: { ...base.crop, ...(c.crop || {}) }, kf: c.kf || {}, trans: c.trans || base.trans }));
  Object.keys(LS).forEach(k => delete LS[k]); Object.assign(LS, p.lanes || {});
  for (const m of p.media) { S.media[m.id] = { ...m, url: URL.createObjectURL(m.blob) }; if (m.type !== 'image') computePeaks(S.media[m.id]); }
  setSel(null); time = 0; undoS = []; redoS = []; $('#ratio').value = S.ratio.join(':'); applyRatio(); renderLib(); afterStruct();
}
function newProject() { loadProject({ id: uid(), name: 'مشروع جديد', ratio: [16, 9], clips: [], media: [] }); }
function modal(title, build, btns) {
  const m = h('div', 'modal'), b = h('div', 'box'); b.append(h('h3', '', title)); const body = h('div'); b.append(body); build(body);
  const a = h('div', 'acts'); btns.forEach(([n, f, cls]) => { const x = h('button', cls || '', n); x.onclick = () => f(m); a.append(x); }); b.append(a); m.append(b); document.body.append(m);
  m.onpointerdown = e => { if (e.target === m) m.remove(); }; return m;
}
$('#bProj').onclick = async () => {
  const all = (await tx('readonly', s => s.getAll())) || [];
  modal('المشاريع', body => {
    if (!all.length) body.append(h('p', 'hint', 'لا توجد مشاريع محفوظة بعد.'));
    all.sort((a, b) => b.updated - a.updated).forEach(p => {
      const r = h('div', 'proj'); r.append(h('div', 'n', `${p.name}<small>${new Date(p.updated).toLocaleString('ar')} • ${p.clips.length} مقطع</small>`));
      const o = h('button', '', 'فتح'); o.onclick = () => { loadProject(p); document.querySelector('.modal').remove(); };
      const d = h('button', '', '🗑'); d.onclick = async () => { await tx('readwrite', s => s.delete(p.id)); r.remove(); };
      r.append(o, d); body.append(r); r.style.marginBottom = '6px';
    });
  }, [['مشروع جديد', m => { newProject(); m.remove(); }], ['حفظ الحالي', async m => { await saveProject(); m.remove(); }, 'primary'], ['إغلاق', m => m.remove()]]);
};
$('#bSet').onclick = () => modal('الإعدادات', body => {
  [['snap', 'الالتصاق بحواف المقاطع'], ['wave', 'عرض الموجات الصوتية'], ['autosave', 'الحفظ التلقائي']].forEach(([k, n]) => {
    const r = h('div', 'row'), l = h('label', '', n), i = h('input'); i.type = 'checkbox'; i.checked = cfg[k];
    i.onchange = () => { cfg[k] = i.checked; localStorage.setItem('ve-cfg', JSON.stringify(cfg)); renderTimeline(); }; r.append(l, i); body.append(r);
  });
  body.append(h('p', 'hint', 'يُحفظ المشروع وملفات الوسائط داخل متصفحك فقط (IndexedDB) ولا تُرسل إلى أي خادم.'));
}, [['إغلاق', m => m.remove(), 'primary']]);

/* ---------------- التصدير ---------------- */
$('#bExport').onclick = () => {
  if (!total()) return toast('لا يوجد محتوى للتصدير');
  const mp4 = window.MediaRecorder && ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4'].find(t => MediaRecorder.isTypeSupported(t));
  const o = { short: 1080, fps: 30, q: 1 };
  modal('تصدير الفيديو', body => {
    const row = (n, key, opts) => { const r = h('div', 'row'), l = h('label', '', n), s = h('select'); opts.forEach(([v, t]) => { const e = h('option', '', t); e.value = v; s.append(e); }); s.value = o[key]; s.onchange = () => o[key] = +s.value; r.append(l, s); body.append(r); };
    row('الدقة', 'short', [[480, '480p'], [720, '720p'], [1080, '1080p (Full HD)'], [1440, '2K'], [2160, '4K (يتطلب جهازاً قوياً)']]);
    row('معدل الإطارات', 'fps', [[24, '24 fps'], [25, '25 fps'], [30, '30 fps'], [60, '60 fps']]);
    row('الجودة', 'q', [[.5, 'منخفضة'], [1, 'متوسطة'], [1.8, 'عالية'], [3, 'أعلى جودة']]);
    body.append(h('p', 'hint', `الصيغة: ${mp4 ? 'MP4' : 'WebM'} • المدة: ${fmt(total())} • يجري التصدير في الزمن الحقيقي، أبقِ التبويب ظاهراً.`));
  }, [['إلغاء', m => m.remove()], ['ابدأ التصدير', m => { m.remove(); doExport(o, mp4 || null); }, 'primary']]);
};
async function doExport(o, mp4) {
  pause(); const pw = cv.width, ph_ = cv.height, [W, H] = sizeFor(o.short);
  const mime = mp4 || ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
  if (!mime) return toast('المتصفح لا يدعم التسجيل (MediaRecorder)');
  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm', chunks = []; let cancelled = false, failed = null;
  audioCtx(); await AC.resume();
  cv.width = W; cv.height = H; time = 0; exporting = {}; sync(0, false); render();
  await new Promise(r => setTimeout(r, 400)); render();
  const stream = cv.captureStream(o.fps); dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
  const bps = Math.round(W * H * o.fps * .07 * o.q);
  let mr; try { mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bps, audioBitsPerSecond: 192000 }); } catch (e) { exporting = null; cv.width = pw; cv.height = ph_; return toast('تعذّر بدء التصدير: ' + e.message); }
  mr.ondataavailable = e => e.data.size && chunks.push(e.data);
  mr.onerror = e => { failed = e.error || e; };
  const finish = () => {
    exporting = null; cv.width = pw; cv.height = ph_; $('#overlay').hidden = true; seek(0);
    if (cancelled) return toast('تم إلغاء التصدير'); if (failed) return toast('فشل التصدير: ' + (failed.message || failed));
    const blob = new Blob(chunks, { type: mime.split(';')[0] }), a = h('a'); a.href = URL.createObjectURL(blob); a.download = (S.name || 'video') + '.' + ext; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5e3);
    toast(`تم التصدير: ${(blob.size / 1048576).toFixed(1)} MB`, 4000);
  };
  mr.onstop = finish;
  $('#prog').value = 0; $('#ovTxt').textContent = `جاري التصدير ${W}×${H} @${o.fps}fps…`; $('#overlay').hidden = false;
  $('#ovCancel').onclick = () => { cancelled = true; onEnd = null; pause(); if (mr.state !== 'inactive') mr.stop(); };
  onEnd = () => setTimeout(() => { if (mr.state !== 'inactive') mr.stop(); }, 300);
  mr.start(1000); play();
}

/* ---------------- ربط الواجهة ---------------- */
$('#file').onchange = async e => { await importFiles(e.target.files); e.target.value = ''; };
$('#bPlay').onclick = () => playing ? pause() : play();
$('#bUndo').onclick = undo; $('#bRedo').onclick = redo; $('#bSplit').onclick = splitClip; $('#bMerge').onclick = mergeClips; $('#bGap').onclick = closeGaps; $('#bDel').onclick = delClip; $('#bDup').onclick = dupClip;
$('#ratio').onchange = e => { pushUndo(); S.ratio = e.target.value.split(':').map(Number); applyRatio(); };
addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && e.target.type !== 'range') return;
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); playing ? pause() : play(); }
  else if (k === 's' && !e.ctrlKey && !e.metaKey) splitClip();
  else if (k === 'delete' || k === 'backspace') { e.preventDefault(); delClip(); }
  else if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); }
  else if ((e.ctrlKey || e.metaKey) && k === 'd') { e.preventDefault(); dupClip(); }
  else if (k === 'arrowleft') { pause(); seek(time - 1 / 30); }
  else if (k === 'arrowright') { pause(); seek(time + 1 / 30); }
});
addEventListener('beforeunload', e => { if (cfg.autosave) saveProject(true); });

/* فواصل اللوحات القابلة للسحب */
(function () {
  const root = document.documentElement; let saved = {}; try { saved = JSON.parse(localStorage.getItem('ve-layout') || '{}'); } catch (e) {}
  for (const k in saved) root.style.setProperty(k, saved[k]);
  const cur = v => parseInt(getComputedStyle(root).getPropertyValue(v)) || 0;
  const mk = (el, v, calc, lo, hi) => el.addEventListener('pointerdown', e => {
    e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('on'); const s0 = cur(v), x0 = e.clientX, y0 = e.clientY;
    const mv = ev => { const val_ = clamp(calc(s0, ev.clientX - x0, ev.clientY - y0), lo, hi); root.style.setProperty(v, val_ + 'px'); saved[v] = val_ + 'px'; renderTimeline(); };
    const up = () => { el.classList.remove('on'); el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); try { localStorage.setItem('ve-layout', JSON.stringify(saved)); } catch (e) {} };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
  });
  mk($('#spA'), '--wlib', (s0, dx) => s0 - dx, 200, 560);   // المكتبة على اليمين (RTL)
  mk($('#spB'), '--wprops', (s0, dx) => s0 + dx, 220, 560); // الخصائص على اليسار
  mk($('#spT'), '--tl', (s0, dx, dy) => s0 - dy, 150, 600);
})();
buildLeft(); applyRatio(); renderTimeline(); renderProps();
window.__ve = { S, addMediaFromBlob, addMediaClip, addOverlay, splitClip, seek, play, pause, render, get time() { return time; } };
