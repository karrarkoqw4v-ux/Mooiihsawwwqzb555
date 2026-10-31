/* ===== story-cam.js — شاشة إضافة قصة: صورة / مقطع مرئي / بث مباشر (بالاشتراك) ===== */
const SC_MAX_SEC = 30;
const SC_Q = { '720': [720, 1280], '1080': [1080, 1920], '4k': [2160, 3840] };
const scQ = () => localStorage.getItem('mhadatha_q') || '1080';
let sc = { stream: null, facing: 'user', mode: 'photo', rec: null, chunks: [], t0: 0, tick: 0, file: null, url: '', thumb: '', torch: false, busy: false };
const scEl = () => $('sc-overlay');

async function scStart() {
  scStop();
  $('sc-fallback').hidden = true;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { $('sc-fallback').hidden = false; return; }
  const [qw, qh] = SC_Q[scQ()]; const base = { video: { facingMode: sc.facing, width: { ideal: qw }, height: { ideal: qh }, frameRate: { ideal: 30, max: 30 } } };
  try {
    sc.stream = await navigator.mediaDevices.getUserMedia(sc.mode === 'video' ? { ...base, audio: true } : base);
  } catch (e) {
    try { sc.stream = await navigator.mediaDevices.getUserMedia(base); } // بدون مايك إذا انرفض
    catch (e2) { $('sc-fallback').hidden = false; return; }
  }
  const v = $('sc-video'); v.srcObject = sc.stream; v.classList.toggle('front', sc.facing === 'user'); v.play().catch(() => {});
  sc.torch = false; $('sc-flash').classList.remove('on');
  const st = sc.stream.getVideoTracks()[0] && sc.stream.getVideoTracks()[0].getSettings();
  sc.actual = st && st.width ? Math.min(st.width, st.height) + 'p (' + st.width + '×' + st.height + ')' : '';
}
function scStop() {
  if (sc.stream) sc.stream.getTracks().forEach((t) => t.stop());
  sc.stream = null; $('sc-video').srcObject = null;
}

function scSetMode(m) {
  if (sc.rec) return;
  const prev = sc.mode; sc.mode = m;
  scEl().dataset.mode = m;
  document.querySelectorAll('.sc-mode').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
  $('sc-mid').hidden = m === 'live'; $('sc-live').hidden = m !== 'live';
  $('sc-timer').hidden = m !== 'video'; $('sc-timer').textContent = '00:00';
  if ((m === 'video') !== (prev === 'video')) scStart(); // المقطع المرئي يحتاج مايك
}

function openStoryCam() {
  const u = me(); if (!u) return;
  const av = $('sc-av'); av.className = 'avatar'; av.innerHTML = AVATAR_SVG; setAvatar(av, u.photo);
  $('sc-name').textContent = nameOf(u);
  scEl().classList.remove('recording', 'closing');
  $('sc-video').hidden = false;
  scEl().hidden = false; sc.facing = 'user'; sc.mode = ''; scSetMode('photo'); scStart();
}
function closeStoryCam() {
  if (sc.rec) { try { sc.rec.onstop = null; sc.rec.stop(); } catch (e) {} sc.rec = null; clearInterval(sc.tick); }
  scStop(); closeOverlay('sc-overlay');
}
/* بعد الالتقاط أو الاختيار من المعرض → محرر القصة (رسم / نص / ملصقات) */
function scReview(file) {
  if (file.type.startsWith('image/')) { if (sc.thumb) URL.revokeObjectURL(sc.thumb); sc.thumb = URL.createObjectURL(file); $('sc-gallery').innerHTML = '<img src="' + sc.thumb + '" alt="">'; }
  scStop(); seOpen(file, { onBack: scRetake });
}
function scRetake() { if (!scEl().hidden && !sc.stream) scStart(); }

/* التقاط صورة */
async function scShot() {
  const v = $('sc-video'); if (!v.videoWidth) return toast('الكاميرا غير جاهزة');
  const track = sc.stream && sc.stream.getVideoTracks()[0];
  if (sc.facing === 'environment' && window.ImageCapture && track) { // الكاميرا الخلفية: أعلى دقة ممكنة
    try { const ic = new ImageCapture(track), b = await ic.takePhoto(); if (b && b.size) return scReview(new File([b], 'story.jpg', { type: b.type || 'image/jpeg' })); } catch (e) {}
  }
  const maxSide = SC_Q[scQ()][1];
  const scale = Math.min(1, maxSide / Math.max(v.videoWidth, v.videoHeight));
  const c = document.createElement('canvas'); c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
  if (sc.facing === 'user') { x.translate(c.width, 0); x.scale(-1, 1); }
  x.drawImage(v, 0, 0, c.width, c.height);
  c.toBlob((b) => { if (b) scReview(new File([b], 'story.jpg', { type: 'image/jpeg' })); else toast('تعذر التقاط الصورة'); }, 'image/jpeg', 0.98);
}

/* تسجيل مقطع */
function scRecStart() {
  if (!sc.stream || typeof MediaRecorder === 'undefined') return toast('التسجيل غير مدعوم، اختر من المعرض');
  const mt = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
  try { sc.rec = new MediaRecorder(sc.stream, { ...(mt ? { mimeType: mt } : {}), videoBitsPerSecond: SE_VIDEO_BPS(), audioBitsPerSecond: 128000 }); } catch (e) { return toast('تعذر بدء التسجيل'); }
  sc.chunks = [];
  sc.rec.ondataavailable = (e) => e.data && e.data.size && sc.chunks.push(e.data);
  sc.rec.onstop = () => {
    clearInterval(sc.tick); scEl().classList.remove('recording'); $('sc-timer').classList.remove('rec');
    const type = (sc.rec && sc.rec.mimeType) || mt || 'video/webm'; sc.rec = null;
    const b = new Blob(sc.chunks, { type: type.split(';')[0] });
    if (!b.size) return toast('المقطع فارغ');
    scReview(new File([b], 'story.' + (type.includes('mp4') ? 'mp4' : 'webm'), { type: b.type }));
  };
  sc.rec.start(250); sc.t0 = Date.now();
  scEl().classList.add('recording'); $('sc-timer').classList.add('rec');
  sc.tick = setInterval(() => {
    const s = Math.floor((Date.now() - sc.t0) / 1000);
    $('sc-timer').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    if (s >= SC_MAX_SEC) scRecStop();
  }, 200);
}
function scRecStop() { if (sc.rec && sc.rec.state !== 'inactive') sc.rec.stop(); }

/* الأزرار */
$('sc-shutter').onclick = () => { if (sc.mode === 'photo') scShot(); else if (sc.rec) scRecStop(); else scRecStart(); };
$('sc-back').onclick = closeStoryCam;
$('sc-gallery').onclick = () => $('file-story').click();
$('sc-gear').onclick = () => { scQUI(); $('scs-actual').textContent = sc.actual ? 'الدقة الحالية للكاميرا: ' + sc.actual : ''; $('scs-overlay').hidden = false; };
function scQUI() { document.querySelectorAll('#scs-q button').forEach((b) => b.classList.toggle('active', b.dataset.q === scQ())); }
document.querySelectorAll('#scs-q button').forEach((b) => (b.onclick = () => { localStorage.setItem('mhadatha_q', b.dataset.q); scQUI(); scStart().then(() => ($('scs-actual').textContent = sc.actual ? 'الدقة الحالية للكاميرا: ' + sc.actual : '')); }));
$('scs-overlay').addEventListener('click', (e) => { if (e.target.classList.contains('photo-top') || e.target === $('scs-overlay')) closeOverlay('scs-overlay'); });
$('scs-sub').onclick = () => { closeOverlay('scs-overlay'); showSub('اشتراك ليكو Praises', 'قم بتفعيل <b>اشتراك ليكو Praises</b> للحصول على مزايا إضافية'); };
const scFlip = () => { if (sc.rec) return; sc.facing = sc.facing === 'user' ? 'environment' : 'user'; scStart(); };
$('sc-flip').onclick = scFlip; $('sc-live-flip').onclick = scFlip;
$('sc-grid').onclick = () => { const g = $('sc-gridlines'); g.hidden = !g.hidden; $('sc-grid').classList.toggle('on', !g.hidden); };
$('sc-flash').onclick = async () => {
  const t = sc.stream && sc.stream.getVideoTracks()[0];
  if (!t || !t.getCapabilities || !(t.getCapabilities().torch)) return toast('الفلاش غير متاح بهذه الكاميرا');
  try { sc.torch = !sc.torch; await t.applyConstraints({ advanced: [{ torch: sc.torch }] }); $('sc-flash').classList.toggle('on', sc.torch); }
  catch (e) { sc.torch = false; toast('الفلاش غير متاح'); }
};
document.querySelectorAll('.sc-mode').forEach((b) => (b.onclick = () => scSetMode(b.dataset.mode)));
/* البث المباشر: يحتاج اشتراك Permni */
function showSub(title, html) { $('sub-title').textContent = title; $('sub-text').innerHTML = html; $('sub-overlay').hidden = false; }
$('sc-live-go').onclick = () => showSub('البث المباشر', 'قم بتفعيل الاشتراك <b>Permni</b> للحصول على الميزة - البث المباشر');
$('sub-later').onclick = () => closeOverlay('sub-overlay');
$('sub-go').onclick = () => { closeOverlay('sub-overlay'); toast('تفعيل الاشتراك غير متاح حالياً'); };

/* الاختيار من المعرض → نفس شاشة المعاينة */
$('file-story').onchange = (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (!/^(image|video)\//.test(f.type)) return toast('اختر صورة أو فيديو');
  if (f.size > MAX_FILE) return toast('الملف كبير');
  if (scEl().hidden) { scEl().classList.remove('recording'); scEl().hidden = false; sc.mode = ''; scSetMode('photo'); }
  scStop(); scReview(f);
};
