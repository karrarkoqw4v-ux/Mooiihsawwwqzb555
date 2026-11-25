'use strict';
/* ============================================================
   أدوات الذكاء الاصطناعي — تعمل داخل المتصفح (لا خادم وسيط)
   - MediaPipe (مضمَّنة في vendor/): إزالة الخلفية، التعرف على العناصر والوجوه
   - تتبع الحركة: مطابقة قوالب (Template Matching) بلا نماذج
   - قص الصمت، فيديو من نص: خوارزميات محلية
   - Transformers.js (مضمَّنة) + نماذج Hugging Face تُنزَّل عند أول استخدام:
     الترجمة التلقائية (Whisper)، النص إلى صوت (MMS-TTS)، تكبير الصور (Swin2SR)
   ============================================================ */
const AI = {};
const BASE = new URL('.', document.baseURI).href;
let aiCancel = false;

function needHttp() {
  if (location.protocol === 'file:') { toast('أدوات الذكاء الاصطناعي تحتاج تشغيل المحرر عبر خادم: افتح الطرفية في هذا المجلد ثم  python3 -m http.server 8000', 7000); return false; }
  return true;
}
function busy(text) {
  aiCancel = false; const ov = $('#overlay'); ov.hidden = false; $('#ovTxt').textContent = text; $('#prog').removeAttribute('value');
  $('#ovCancel').onclick = () => { aiCancel = true; ov.hidden = true; };
  return { set: (t, p) => { $('#ovTxt').textContent = t; if (p == null) $('#prog').removeAttribute('value'); else $('#prog').value = p; }, done: () => { ov.hidden = true; } };
}
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ---------- MediaPipe ---------- */
async function mp() {
  if (AI.mp) return AI.mp;
  const v = await import(BASE + 'vendor/mediapipe/vision_bundle.mjs');
  const fs = await v.FilesetResolver.forVisionTasks(BASE + 'vendor/mediapipe/wasm');
  return AI.mp = { v, fs };
}
async function initSeg() {
  if (AI.seg) return; const { v, fs } = await mp();
  AI.seg = await v.ImageSegmenter.createFromOptions(fs, { baseOptions: { modelAssetPath: BASE + 'vendor/models/selfie_segmenter.tflite' }, runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false });
  AI.labels = AI.seg.getLabels ? AI.seg.getLabels() : [];
  const mc = document.createElement('canvas'), mg = mc.getContext('2d');
  window.aiMask = (canvas, ctx2) => {
    try {
      const r = AI.seg.segment(canvas), ms = r.confidenceMasks || []; if (!ms.length) return;
      let idx = 0; if (ms.length > 1) { const pi = AI.labels.findIndex(l => /person|foreground/i.test(l)); idx = pi >= 0 ? pi : ms.length - 1; }
      const m = ms[idx], w = m.width, hh = m.height, f = m.getAsFloat32Array();
      if (mc.width !== w || mc.height !== hh) { mc.width = w; mc.height = hh; }
      const id = mg.createImageData(w, hh), d = id.data;
      for (let i = 0; i < f.length; i++) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 255; d[i * 4 + 3] = clamp((f[i] - .25) / .5, 0, 1) * 255; }
      mg.putImageData(id, 0, 0);
      ctx2.globalCompositeOperation = 'destination-in'; ctx2.imageSmoothingQuality = 'high'; ctx2.drawImage(mc, 0, 0, canvas.width, canvas.height); ctx2.globalCompositeOperation = 'source-over';
      try { r.close(); } catch (e) {}
    } catch (e) { console.warn('aiMask', e); }
  };
}
async function toggleAiBg() {
  const c = selClip(); if (!c || (c.type !== 'video' && c.type !== 'image')) return toast('حدّد مقطع فيديو أو صورة');
  if (!needHttp()) return;
  if (!c.aiBg) { const b = busy('تحميل نموذج فصل الخلفية…'); try { await initSeg(); } catch (e) { b.done(); return toast('تعذّر تحميل النموذج: ' + e.message, 5000); } b.done(); }
  pushUndo(); c.aiBg = !c.aiBg; renderProps(); sync(time, false); render(); toast(c.aiBg ? 'تم تفعيل إزالة الخلفية بالذكاء الاصطناعي (تظهر الشفافية فوق الطبقات السفلية)' : 'تم إيقاف إزالة الخلفية');
}

const AR = { person: 'شخص', car: 'سيارة', dog: 'كلب', cat: 'قطة', bicycle: 'دراجة', bottle: 'زجاجة', chair: 'كرسي', cup: 'كوب', laptop: 'حاسوب', 'cell phone': 'هاتف', tv: 'تلفاز', book: 'كتاب', bird: 'طائر', bus: 'حافلة', truck: 'شاحنة', horse: 'حصان', bed: 'سرير', couch: 'أريكة', clock: 'ساعة', face: 'وجه' };
function frameBox(c, e, bx, by, bw, bh) {
  const b = bounds[c.id]; if (!b) return null;
  const iw = e.videoWidth || e.naturalWidth, ih = e.videoHeight || e.naturalHeight, k = b.w / iw * b.sc;
  return { x: b.cx + (bx - iw / 2) * k, y: b.cy + (by - ih / 2) * k, w: bw * k, h: bh * k };
}
async function detect(kind) {
  const c = selClip() || S.clips.find(c => (c.type === 'video' || c.type === 'image') && inWin(c, time) && !laneOff(c));
  if (!c || (c.type !== 'video' && c.type !== 'image')) return toast('حدّد مقطع فيديو أو صورة ثم ضع المؤشر داخله');
  if (!needHttp()) return;
  const e = getEl(c), bsy = busy('تحميل نموذج الكشف…');
  try {
    const { v, fs } = await mp();
    const key = 'det_' + kind;
    if (!AI[key]) AI[key] = kind === 'face'
      ? await v.FaceDetector.createFromOptions(fs, { baseOptions: { modelAssetPath: BASE + 'vendor/models/face_detector.tflite' }, runningMode: 'IMAGE' })
      : await v.ObjectDetector.createFromOptions(fs, { baseOptions: { modelAssetPath: BASE + 'vendor/models/efficientdet_lite0.tflite' }, runningMode: 'IMAGE', scoreThreshold: .35, maxResults: 12 });
    sync(time, false); await wait(250);
    const res = AI[key].detect(e), items = [];
    for (const d of res.detections) {
      const bb = d.boundingBox, cat = d.categories[0], name = kind === 'face' ? 'face' : cat.categoryName, f = frameBox(c, e, bb.originX, bb.originY, bb.width, bb.height);
      if (f) items.push({ ...f, label: (AR[name] || name) + ' ' + Math.round(cat.score * 100) + '%', name: AR[name] || name });
    }
    bsy.done(); window.detBoxes = { items, until: performance.now() + 6000 }; render(); setTimeout(render, 6100);
    toast(items.length ? 'تم العثور على: ' + items.map(i => i.name).join('، ') : 'لم يُعثر على عناصر في هذا الإطار', 5000);
  } catch (err) { bsy.done(); console.error(err); toast('فشل الكشف: ' + err.message, 5000); }
}

/* ---------- تتبع الحركة (Template Matching) ---------- */
async function trackMotion() {
  const o = selClip();
  if (!o || !['text', 'sticker', 'image'].includes(o.type) || o.lane === 'v1') return toast('حدّد ملصقاً أو نصاً (أو صورة على طبقة علوية) ليتبع الحركة');
  const v = S.clips.filter(c => c.type === 'video' && !laneOff(c) && inWin(c, time)).sort((a, b) => RANK[a.lane] - RANK[b.lane])[0];
  if (!v) return toast('ضع المؤشر داخل مقطع فيديو أسفل العنصر ليتم التتبع عليه');
  render(); const b = bounds[v.id]; if (!b) return toast('الفيديو غير جاهز، حاول مرة أخرى');
  const m = S.media[v.mediaId], iw = getEl(v).videoWidth, ih = getEl(v).videoHeight, W = cv.width, H = cv.height;
  const t0 = time, step = .1, end = Math.min(o.start + o.dur, v.start + v.dur), k = b.w / iw * b.sc;
  const SW = 320, SH = Math.round(SW * ih / iw), ks = SW / iw;
  const toV = (X, Y) => [iw / 2 + (X - b.cx) / k, ih / 2 + (Y - b.cy) / k], fromV = (px, py) => [b.cx + (px - iw / 2) * k, b.cy + (py - ih / 2) * k];
  const o0 = { x: val(o, 'x', t0 - o.start), y: val(o, 'y', t0 - o.start) };
  let [px, py] = toV(o0.x * W, o0.y * H); px *= ks; py *= ks;
  const tv = document.createElement('video'); tv.muted = true; tv.src = m.url; tv.preload = 'auto';
  await new Promise(r => { tv.onloadeddata = r; tv.onerror = r; });
  const sc = document.createElement('canvas'); sc.width = SW; sc.height = SH; const sg = sc.getContext('2d', { willReadFrequently: true });
  const grab = async t => { tv.currentTime = clamp(srcTime(v, t - v.start), 0, (tv.duration || 1e9) - .01); await new Promise(r => { const f = () => { tv.removeEventListener('seeked', f); r(); }; tv.addEventListener('seeked', f); }); sg.drawImage(tv, 0, 0, SW, SH); const d = sg.getImageData(0, 0, SW, SH).data, g = new Float32Array(SW * SH); for (let i = 0; i < g.length; i++) g[i] = .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2]; return g; };
  const R = 12, SR = 22, bs = busy('تتبع الحركة…'); const pts = [];
  try {
    let frame = await grab(t0), tpl = new Float32Array((2 * R + 1) ** 2);
    const cut = (fr, cx, cy, out) => { let j = 0; for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) out[j++] = fr[clamp(Math.round(cy + y), 0, SH - 1) * SW + clamp(Math.round(cx + x), 0, SW - 1)]; };
    cut(frame, px, py, tpl); pts.push({ t: t0 - o.start, x: o0.x, y: o0.y });
    for (let t = t0 + step; t <= end + 1e-6; t += step) {
      if (aiCancel) throw new Error('أُلغي التتبع');
      bs.set(`تتبع الحركة… ${Math.round((t - t0) / (end - t0 || 1) * 100)}%`, (t - t0) / (end - t0 || 1) * 100);
      frame = await grab(t); let best = 1e18, bx = px, by = py; const cx0 = Math.round(px), cy0 = Math.round(py);
      for (let dy = -SR; dy <= SR; dy++) for (let dx = -SR; dx <= SR; dx++) {
        const cx = cx0 + dx, cy = cy0 + dy; if (cx < R || cy < R || cx >= SW - R || cy >= SH - R) continue;
        let sad = 0, j = 0; for (let y = -R; y <= R && sad < best; y += 2) for (let x = -R; x <= R; x += 2) { sad += Math.abs(frame[(cy + y) * SW + cx + x] - tpl[(y + R) * (2 * R + 1) + x + R]); }
        if (sad < best) { best = sad; bx = cx; by = cy; }
      }
      px = bx; py = by; const nt = new Float32Array(tpl.length); cut(frame, px, py, nt); for (let i = 0; i < tpl.length; i++) tpl[i] = tpl[i] * .6 + nt[i] * .4; // تحديث بطيء للقالب
      const [X, Y] = fromV(px / ks, py / ks); pts.push({ t: +(t - o.start).toFixed(2), x: X / W, y: Y / H });
    }
    pushUndo(); o.kf.x = pts.map(q => ({ t: q.t, v: q.x })); o.kf.y = pts.map(q => ({ t: q.t, v: q.y }));
    bs.done(); renderProps(); renderTimeline(); render(); toast(`تم التتبع: أُنشئ ${pts.length} إطاراً مفتاحياً لحركة العنصر`);
  } catch (e) { bs.done(); toast(e.message || 'فشل التتبع', 4000); }
}

/* ---------- قص الصمت ---------- */
function cutSilence() {
  const c = selClip(); if (!c || (c.type !== 'audio' && c.type !== 'video')) return toast('حدّد مقطع صوت أو فيديو');
  const m = S.media[c.mediaId]; if (!m || !m.peaks) return toast('لم يُحلَّل صوت هذا المقطع بعد (أو لا يحتوي صوتاً)');
  const R = 50, a = Math.floor(c.srcIn * R), b = Math.min(m.peaks.length, Math.ceil((c.srcIn + c.dur * c.speed) * R));
  let mx = 0; for (let i = a; i < b; i++) mx = Math.max(mx, m.peaks[i]); const thr = Math.max(.015, mx * .08), minSil = Math.round(.45 * R), pad = Math.round(.1 * R);
  const keep = []; let i = a;
  while (i < b) {
    if (m.peaks[i] >= thr) { let j = i; while (j < b && m.peaks[j] >= thr) j++; keep.push([i, j]); i = j; } else i++;
  }
  const merged = []; for (const k of keep) { const l = merged[merged.length - 1]; if (l && k[0] - l[1] < minSil) l[1] = k[1]; else merged.push([k[0], k[1]]); }
  const segs = merged.map(([s, e]) => [Math.max(a, s - pad) / R, Math.min(b, e + pad) / R]).filter(([s, e]) => e - s > .15);
  if (!segs.length || segs.length === 1 && segs[0][1] - segs[0][0] > c.dur * c.speed - .3) return toast('لم يُعثر على فترات صمت كافية لحذفها');
  pushUndo(); let t = c.start; const out = [];
  for (const [s, e] of segs) { const n = JSON.parse(JSON.stringify(c)); n.id = uid(); n.srcIn = s; n.dur = (e - s) / c.speed; n.start = t; n.fadeIn = n.fadeOut = 0; n.kf = {}; n.curve = null; t += n.dur; out.push(n); }
  const removed = c.dur - (t - c.start); S.clips = S.clips.filter(x => x !== c).concat(out); setSel(out[0].id); afterStruct(); toast(`تم قص الصمت: ${segs.length} مقطع، وُفّر ${removed.toFixed(1)} ثانية`);
}

/* ---------- Transformers.js ---------- */
async function tf() {
  if (AI.tf) return AI.tf; const m = await import(BASE + 'vendor/transformers/transformers.min.js');
  m.env.allowLocalModels = false; m.env.backends.onnx.wasm.wasmPaths = BASE + 'vendor/transformers/'; m.env.backends.onnx.wasm.numThreads = 1; return AI.tf = m;
}
async function pipe(task, model, bs) {
  const m = await tf(); AI.pipes = AI.pipes || {}; const key = task + model; if (AI.pipes[key]) return AI.pipes[key];
  return AI.pipes[key] = await m.pipeline(task, model, { progress_callback: p => { if (p.status === 'progress') bs.set(`تنزيل النموذج ${p.file ? p.file.split('/').pop() : ''}… ${Math.round(p.progress || 0)}%`, p.progress); } });
}
async function audio16k(c) {
  const m = S.media[c.mediaId], buf = await audioCtx().decodeAudioData(await m.blob.arrayBuffer()), a = Math.floor(c.srcIn * buf.sampleRate), b = Math.min(buf.length, Math.ceil((c.srcIn + c.dur * c.speed) * buf.sampleRate));
  const len = Math.ceil((b - a) / buf.sampleRate * 16000), oc = new OfflineAudioContext(1, len, 16000), seg = oc.createBuffer(1, b - a, buf.sampleRate);
  seg.copyToChannel(buf.getChannelData(0).subarray(a, b), 0); const s = oc.createBufferSource(); s.buffer = seg; s.connect(oc.destination); s.start(); return (await oc.startRendering()).getChannelData(0);
}
function captionsDialog() {
  const c = selClip(); if (!c || (c.type !== 'audio' && c.type !== 'video')) return toast('حدّد مقطع فيديو أو صوت يحتوي كلاماً');
  if (!needHttp()) return;
  const o = { model: 'Xenova/whisper-base', lang: 'arabic' };
  modal('ترجمة تلقائية (Whisper)', body => {
    const row = (n, key, opts) => { const r = h('div', 'row'), l = h('label', '', n), s = h('select'); opts.forEach(([v, t]) => { const e = h('option', '', t); e.value = v; s.append(e); }); s.value = o[key]; s.onchange = () => o[key] = s.value; r.append(l, s); body.append(r); };
    row('النموذج', 'model', [['Xenova/whisper-tiny', 'tiny (≈40MB، أسرع)'], ['Xenova/whisper-base', 'base (≈75MB، أدق)'], ['Xenova/whisper-small', 'small (≈250MB، الأدق)']]);
    row('لغة الكلام', 'lang', [['arabic', 'العربية'], ['english', 'English'], ['french', 'Français'], ['spanish', 'Español'], ['turkish', 'Türkçe'], ['', 'كشف تلقائي']]);
    body.append(h('p', 'hint', 'يُنزَّل النموذج من Hugging Face عند أول استخدام ثم يُخزَّن في المتصفح، ويجري التفريغ على جهازك دون رفع الملف.'));
  }, [['إلغاء', m => m.remove()], ['ابدأ', m => { m.remove(); runCaptions(c, o); }, 'primary']]);
}
async function runCaptions(c, o) {
  const bs = busy('تجهيز الصوت…');
  try {
    const pcm = await audio16k(c); bs.set('تحميل النموذج…');
    const asr = await pipe('automatic-speech-recognition', o.model, bs); bs.set('جاري تفريغ الكلام…');
    const out = await asr(pcm, { return_timestamps: true, chunk_length_s: 30, stride_length_s: 5, ...(o.lang ? { language: o.lang, task: 'transcribe' } : {}) });
    const chunks = (out.chunks || []).filter(k => k.text && k.text.trim()); if (!chunks.length) { bs.done(); return toast('لم يتم التعرّف على كلام في المقطع'); }
    pushUndo();
    for (const k of chunks) {
      const s = k.timestamp[0] || 0, e = k.timestamp[1] != null ? k.timestamp[1] : s + 2;
      S.clips.push(newClip({ type: 'text', lane: 't', start: c.start + s / c.speed, dur: Math.max(.5, (e - s) / c.speed), text: k.text.trim(), size: 40, bold: false, bgOn: true, bgColor: '#000000aa', y: .88 }));
    }
    bs.done(); afterStruct(); toast(`تمت الترجمة: ${chunks.length} سطر ترجمة على مسار النصوص`, 4000);
  } catch (e) { bs.done(); console.error(e); toast('فشلت الترجمة: ' + (e.message || e) + ' — تحقق من الاتصال بالإنترنت لتنزيل النموذج', 6000); }
}
async function ttsSynth(text, model, bs) {
  const t = await pipe('text-to-speech', model, bs), r = await t(text), buf = audioCtx().createBuffer(1, r.audio.length, r.sampling_rate);
  buf.copyToChannel(r.audio, 0); return { blob: wav(buf), dur: r.audio.length / r.sampling_rate };
}
function ttsDialog() {
  if (!needHttp()) return; const o = { model: 'Xenova/mms-tts-ara' }; let ta;
  modal('تحويل النص إلى صوت', body => {
    ta = h('textarea'); ta.placeholder = 'اكتب النص الذي تريد تحويله إلى كلام…'; ta.value = selClip() && selClip().type === 'text' ? selClip().text : ''; body.append(ta);
    const r = h('div', 'row'), l = h('label', '', 'اللغة'), s = h('select'); [['Xenova/mms-tts-ara', 'العربية'], ['Xenova/mms-tts-eng', 'English']].forEach(([v, t]) => { const e = h('option', '', t); e.value = v; s.append(e); }); s.onchange = () => o.model = s.value; r.append(l, s); body.append(r);
    body.append(h('p', 'hint', 'يستخدم نموذج MMS-TTS محلياً داخل المتصفح (يُنزَّل مرة واحدة)، وينتج ملف صوت حقيقياً يدخل في التصدير.'));
  }, [['إلغاء', m => m.remove()], ['توليد الصوت', async m => {
    const text = ta.value.trim(); if (!text) return toast('اكتب نصاً أولاً'); m.remove(); const bs = busy('تحميل نموذج الصوت…');
    try { const { blob, dur } = await ttsSynth(text, o.model, bs); bs.done(); const me = await addMediaFromBlob(blob, 'تعليق: ' + text.slice(0, 18), 'audio', { duration: dur, hasAudio: true }); addMediaClip(me.id, { lane: 'a2', start: time }); }
    catch (e) { bs.done(); console.error(e); toast('فشل التوليد: ' + (e.message || e), 6000); }
  }, 'primary']]);
}
async function upscaleImage() {
  const c = selClip(); if (!c || c.type !== 'image') return toast('حدّد مقطع صورة'); if (!needHttp()) return;
  const bs = busy('تحميل نموذج التكبير (Swin2SR)…');
  try {
    const p = await pipe('image-to-image', 'Xenova/swin2SR-classical-sr-x2-64', bs); bs.set('جاري تحسين الصورة وتكبيرها ×2…');
    const out = await p(S.media[c.mediaId].url), blob = await out.toBlob('image/png'), me = await addMediaFromBlob(blob, 'محسّنة ' + (c.name || ''), 'image');
    pushUndo(); c.mediaId = me.id; els.delete(c.id); bs.done(); afterStruct(); toast('تم تكبير الصورة وتحسينها ×2');
  } catch (e) { bs.done(); console.error(e); toast('فشل التحسين: ' + (e.message || e), 6000); }
}

/* ---------- فيديو من نص (شرائح + تعليق اختياري) ---------- */
const PALETTES = [['#1d2671', '#c33764'], ['#0f2027', '#2c5364'], ['#42275a', '#734b6d'], ['#134e5e', '#71b280'], ['#2c3e50', '#fd746c'], ['#41295a', '#2f0743']];
function wrapLines(t, n) { const out = []; let cur = ''; for (const w of t.split(/\s+/)) { if ((cur + ' ' + w).trim().length > n && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); } if (cur) out.push(cur); return out.join('\n'); }
function scriptDialog() {
  const o = { voice: '' }; let ta;
  modal('إنشاء فيديو من نص', body => {
    ta = h('textarea'); ta.placeholder = 'اكتب السيناريو: كل فقرة (يفصل بينها سطر فارغ أو سطر جديد) تصبح مشهداً مستقلاً.'; body.append(ta);
    const r = h('div', 'row'), l = h('label', '', 'تعليق صوتي'), s = h('select'); [['', 'بدون'], ['Xenova/mms-tts-ara', 'عربي (يتطلب إنترنت لأول مرة)'], ['Xenova/mms-tts-eng', 'English']].forEach(([v, t]) => { const e = h('option', '', t); e.value = v; s.append(e); }); s.onchange = () => o.voice = s.value; r.append(l, s); body.append(r);
    body.append(h('p', 'hint', 'تُنشأ خلفية متدرجة لكل مشهد مع النص بحركة دخول، وتُضبط مدة المشهد على عدد الكلمات أو طول التعليق الصوتي.'));
  }, [['إلغاء', m => m.remove()], ['إنشاء', async m => { const t = ta.value.trim(); if (!t) return toast('اكتب السيناريو أولاً'); m.remove(); await buildFromScript(t, o.voice); }, 'primary']]);
}
async function buildFromScript(text, voice) {
  const paras = text.split(/\n+/).map(s => s.trim()).filter(Boolean), bs = busy('إنشاء المشاهد…'); pushUndo();
  const [W, H] = sizeFor(720); let t = S.clips.filter(c => c.lane === 'v1').reduce((a, c) => Math.max(a, c.start + c.dur), 0);
  try {
    for (let i = 0; i < paras.length; i++) {
      if (aiCancel) break; bs.set(`مشهد ${i + 1} من ${paras.length}…`, i / paras.length * 100);
      const p = paras[i], pal = PALETTES[i % PALETTES.length], cn = document.createElement('canvas'); cn.width = W; cn.height = H; const x = cn.getContext('2d');
      const gr = x.createLinearGradient(0, 0, W, H); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]); x.fillStyle = gr; x.fillRect(0, 0, W, H);
      const blob = await new Promise(r => cn.toBlob(r, 'image/png')), me = await addMediaFromBlob(blob, 'مشهد ' + (i + 1), 'image');
      let dur = Math.max(3, p.split(/\s+/).length * .45), narr = null;
      if (voice) { bs.set(`توليد التعليق الصوتي للمشهد ${i + 1}…`); const r = await ttsSynth(p, voice, bs); dur = Math.max(dur, r.dur + .4); narr = await addMediaFromBlob(r.blob, 'تعليق ' + (i + 1), 'audio', { duration: r.dur, hasAudio: true }); }
      const v = newClip({ type: 'image', lane: 'v1', mediaId: me.id, start: t, dur, name: 'مشهد ' + (i + 1), anim: 'zoomin' }); S.clips.push(v);
      S.clips.push(newClip({ type: 'text', lane: 't', start: t + .2, dur: dur - .2, text: wrapLines(p, W < H ? 18 : 30), size: W < H ? 60 : 56, fadeIn: .4, fadeOut: .3, anim: 'inup', shadow: true }));
      if (narr) S.clips.push(newClip({ type: 'audio', lane: 'a1', mediaId: narr.id, start: t + .2, dur: narr.duration, name: narr.name }));
      t += dur;
    }
    bs.done(); afterStruct(); seek(0); toast(`تم إنشاء ${paras.length} مشهد`);
  } catch (e) { bs.done(); console.error(e); afterStruct(); toast('توقف الإنشاء: ' + (e.message || e), 6000); }
}

/* ---------- تسجيل الأدوات في تبويب الذكاء ---------- */
(() => {
  const sep = t => $('#ai').append(h('h4', 'sub', t));
  sep('تحليل الفيديو (MediaPipe محلياً)');
  aiTool('✂ إزالة الخلفية بالذكاء الاصطناعي', 'فصل الشخص عن الخلفية (تشغيل/إيقاف للمقطع المحدد)', toggleAiBg);
  aiTool('🔍 التعرف على العناصر', 'كشف الأشياء في الإطار الحالي ورسم مربعاتها', () => detect('object'));
  aiTool('🙂 التعرف على الوجوه', 'كشف الوجوه في الإطار الحالي', () => detect('face'));
  aiTool('🎯 تتبع الحركة', 'يجعل الملصق/النص المحدد يتبع النقطة تحته في الفيديو', trackMotion);
  sep('الصوت والنص');
  aiTool('🔇 قص الصمت تلقائياً', 'يحذف فترات الصمت من المقطع المحدد (يعتمد على الموجة الصوتية)', cutSilence);
  aiTool('💬 الترجمة التلقائية', 'تفريغ الكلام إلى نصوص مؤقتة (Whisper)', captionsDialog);
  aiTool('🗣 تحويل النص إلى صوت', 'ينتج ملف صوت حقيقي (MMS-TTS)', ttsDialog);
  sep('الإنشاء والتحسين');
  aiTool('🎬 فيديو من نص', 'يحوّل السيناريو إلى مشاهد بنصوص وتعليق اختياري', scriptDialog);
  aiTool('🖼 تكبير الصورة وتحسينها ×2', 'نموذج Swin2SR للصور المحددة', upscaleImage);
})();
