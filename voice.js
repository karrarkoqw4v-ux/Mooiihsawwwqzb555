/* ===== voice.js — البصمة (رسالة صوتية): اضغط مطولاً للتسجيل، اسحب لفوق للقفل، اسحب جانباً للإلغاء ===== */
const REC = { st: 'idle', rec: null, stream: null, chunks: [], mime: '', t0: 0, acc: 0, tick: 0, sx: 0, sy: 0, holding: false };
const mic = $('msg-mic');
const fmtDur = (s) => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

/* زر الميكروفون يظهر إذا الحقل فارغ، وزر الإرسال إذا فيه نص */
function syncComposer() {
  if (REC.st !== 'idle') return;
  const has = $('msg-input').value.trim().length > 0;
  $('msg-send').hidden = !has; mic.hidden = has;
}
$('msg-input').addEventListener('input', syncComposer);

const elapsed = () => REC.acc + (REC.st === 'paused' ? 0 : Date.now() - REC.t0);
const pickMime = () => ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';

function showRecUi() {
  $('rec-bar').hidden = false; $('rec-bar').classList.remove('paused'); $('rec-lock').hidden = false; mic.classList.add('rec');
  $('rec-del').hidden = true; $('rec-pause').hidden = true; $('rec-pause').classList.remove('paused'); $('rec-hint').hidden = false; $('rec-hint').style.transform = ''; $('rec-time').textContent = '0:00';
}
function hideRecUi() {
  $('rec-bar').hidden = true; $('rec-lock').hidden = true; mic.classList.remove('rec'); mic.hidden = false; $('msg-send').hidden = true; syncComposer();
}
async function recStart(e) {
  if (REC.st !== 'idle' || !peer) return;
  if (!window.MediaRecorder || !navigator.mediaDevices) return toast('المتصفح ما يدعم تسجيل الصوت');
  REC.st = 'starting'; REC.holding = true; REC.sx = e.clientX; REC.sy = e.clientY;
  try { REC.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch (err) { REC.st = 'idle'; return toast('اسمح للموقع بالمايك'); }
  if (!REC.holding) { REC.stream.getTracks().forEach((t) => t.stop()); REC.stream = null; REC.st = 'idle'; return toast('اضغط مطولاً لتسجيل بصمة'); }
  REC.mime = pickMime(); REC.chunks = []; const chunks = REC.chunks;
  REC.rec = new MediaRecorder(REC.stream, { ...(REC.mime ? { mimeType: REC.mime } : {}), audioBitsPerSecond: 24000 });
  REC.rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
  REC.rec.start(250); REC.st = 'holding'; REC.t0 = Date.now(); REC.acc = 0;
  showRecUi(); REC.tick = setInterval(() => { $('rec-time').textContent = fmtDur(elapsed() / 1000); if (elapsed() >= 180000) recStop(true); }, 200);
  if (navigator.vibrate) navigator.vibrate(20);
}
function recLock() {
  if (REC.st !== 'holding') return;
  REC.st = 'locked'; $('rec-lock').hidden = true; $('rec-hint').hidden = true; mic.classList.remove('rec'); mic.hidden = true; $('msg-send').hidden = false;
  $('rec-del').hidden = false; $('rec-pause').hidden = false;
  if (navigator.vibrate) navigator.vibrate(15);
}
function recStop(send, msg) {
  if (!['starting', 'holding', 'locked', 'paused'].includes(REC.st)) return;
  const r = REC.rec, stream = REC.stream, dur = elapsed() / 1000, chunks = REC.chunks, mime = REC.mime;
  clearInterval(REC.tick); REC.st = 'idle'; REC.holding = false; REC.rec = null; REC.stream = null;
  hideRecUi();
  const done = () => stream && stream.getTracks().forEach((t) => t.stop());
  if (!r) { done(); return; }
  r.onstop = () => { done(); if (send) sendVoice(new Blob(chunks, { type: mime || 'audio/webm' }), Math.max(1, Math.round(dur))); };
  try { if (r.state !== 'inactive') r.stop(); else r.onstop(); } catch (e) { done(); }
  if (msg) toast(msg);
}
async function sendVoice(blob, dur) {
  const p = peer; if (!p) return;
  const id = 'v' + Date.now() + Math.random().toString(36).slice(2, 7);
  if (REMOTE_MEDIA) {
    if (blob.size > 1000 * 1024) return toast('البصمة طويلة، قصّرها شوي');
    try { const data = await blobToDataUrl(blob); await api('blob', { method: 'POST', body: { peer: p.id, id, data } }); blobCache.set(id, Promise.resolve(data)); }
    catch (e) { return toast(e.message || 'تعذر إرسال البصمة'); }
  } else { try { await mediaPut(id, blob); } catch (e) { return toast('تعذر حفظ البصمة'); } }
  await post(p, { text: '', att: { id, kind: 'voice', name: 'بصمة', size: blob.size, mime: blob.type, dur, ...(REMOTE_MEDIA ? { blob: true } : {}) } });
}

/* ضغط مطول على الميكروفون */
mic.addEventListener('contextmenu', (e) => e.preventDefault());
mic.addEventListener('pointerdown', (e) => { e.preventDefault(); try { mic.setPointerCapture(e.pointerId); } catch (x) {} recStart(e); });
mic.addEventListener('pointermove', (e) => {
  if (REC.st !== 'holding') return;
  const dx = e.clientX - REC.sx, dy = REC.sy - e.clientY, h = $('rec-hint');
  h.style.transform = 'translateX(' + Math.max(-80, Math.min(80, dx * 0.5)) + 'px)'; h.style.opacity = String(Math.max(0.2, 1 - Math.abs(dx) / 110));
  if (dy > 70) recLock(); else if (Math.abs(dx) > 90) recStop(false, 'تم إلغاء البصمة');
});
const micUp = () => {
  REC.holding = false;
  if (REC.st === 'holding') { if (elapsed() < 700) recStop(false, 'اضغط مطولاً لتسجيل بصمة'); else recStop(true); }
};
mic.addEventListener('pointerup', micUp); mic.addEventListener('pointercancel', micUp);
$('rec-del').onclick = () => recStop(false, 'تم حذف البصمة');
$('rec-pause').onclick = () => {
  if (REC.st === 'locked') { REC.rec.pause(); REC.acc += Date.now() - REC.t0; REC.st = 'paused'; $('rec-pause').classList.add('paused'); $('rec-bar').classList.add('paused'); }
  else if (REC.st === 'paused') { REC.rec.resume(); REC.t0 = Date.now(); REC.st = 'locked'; $('rec-pause').classList.remove('paused'); $('rec-bar').classList.remove('paused'); }
};

/* ---------- تشغيل البصمات ---------- */
const VP = { audio: new Audio(), box: null, urls: {} };
function voiceBars(id) {
  let h = 2166136261; for (const c of String(id)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  let out = ''; for (let i = 0; i < 30; i++) { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; out += '<i style="height:' + (6 + Math.round(((h >>> 0) % 100) / 100 * 20)) + 'px"></i>'; }
  return out;
}
async function voiceUrl(box) {
  const id = box.dataset.id; if (VP.urls[id]) return VP.urls[id];
  let url = '';
  if (box.dataset.blob === '1' && REMOTE_MEDIA) { const d = await getBlobData(box.dataset.peer, id); if (d) url = URL.createObjectURL(await (await fetch(d)).blob()); }
  else url = await mediaUrl(id);
  if (url) VP.urls[id] = url; return url;
}
function vReset(b) { if (!b) return; b.classList.remove('playing', 'loading'); b.querySelectorAll('.vw i').forEach((x) => x.classList.remove('on')); b.querySelector('.vd').textContent = fmtDur(+b.dataset.dur); }
function stopVoice() { VP.audio.pause(); vReset(VP.box); VP.box = null; }
async function voiceClick(box, e) {
  const a = VP.audio;
  if (VP.box === box) {
    const vw = e.target.closest('.vw'), total = +box.dataset.dur || a.duration;
    if (vw && total) { const r = vw.getBoundingClientRect(); try { a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * total; } catch (x) {} return; }
    return a.paused ? a.play().catch(() => {}) : a.pause();
  }
  stopVoice(); VP.box = box; box.classList.add('loading');
  let url = ''; try { url = await voiceUrl(box); } catch (x) {}
  if (VP.box !== box) return;
  if (!url) { vReset(box); VP.box = null; return toast('تعذر تشغيل البصمة'); }
  a.src = url; a.play().catch(() => { toast('تعذر تشغيل البصمة'); vReset(box); VP.box = null; });
}
VP.audio.onplay = () => VP.box && (VP.box.classList.remove('loading'), VP.box.classList.add('playing'));
VP.audio.onpause = () => VP.box && VP.box.classList.remove('playing');
VP.audio.ontimeupdate = () => {
  const b = VP.box; if (!b) return;
  const total = +b.dataset.dur || VP.audio.duration || 1, bars = b.querySelectorAll('.vw i'), n = Math.round(Math.min(1, VP.audio.currentTime / total) * bars.length);
  bars.forEach((x, i) => x.classList.toggle('on', i < n)); b.querySelector('.vd').textContent = fmtDur(VP.audio.currentTime);
};
VP.audio.onended = () => { vReset(VP.box); VP.box = null; };
