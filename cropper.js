/* ===== cropper.js — ضبط الصورة (قص دائري) ===== */
/* ---------- ضبط الصورة (قص دائري + تكبير + سحب) ---------- */
const cv = $('crop-canvas'), cx = cv.getContext('2d');
let img = null, scale = 1, minScale = 1, ox = 0, oy = 0;
const S = 600, R = S * 0.44; // نصف قطر الدائرة المرئية (inset 6%)
function openCrop(image) {
  img = image;
  minScale = (2 * R) / Math.min(img.width, img.height);
  scale = minScale; ox = oy = 0; $('zoom').value = 1;
  closeOverlay('photo-overlay'); $('crop-overlay').hidden = false; draw();
}
function clamp() {
  const w = img.width * scale, h = img.height * scale;
  const mx = Math.max(0, (w - 2 * R) / 2), my = Math.max(0, (h - 2 * R) / 2);
  ox = Math.min(mx, Math.max(-mx, ox)); oy = Math.min(my, Math.max(-my, oy));
}
function draw() {
  clamp(); cx.fillStyle = '#0c1116'; cx.fillRect(0, 0, S, S);
  const w = img.width * scale, h = img.height * scale;
  cx.drawImage(img, S / 2 - w / 2 + ox, S / 2 - h / 2 + oy, w, h);
}
$('zoom').oninput = (e) => { scale = minScale * parseFloat(e.target.value); draw(); };
let drag = null;
const stage = $('crop-stage');
stage.onpointerdown = (e) => { drag = { x: e.clientX, y: e.clientY, ox, oy }; stage.setPointerCapture(e.pointerId); };
stage.onpointermove = (e) => { if (!drag) return; const k = S / stage.clientWidth; ox = drag.ox + (e.clientX - drag.x) * k; oy = drag.oy + (e.clientY - drag.y) * k; draw(); };
stage.onpointerup = stage.onpointercancel = () => (drag = null);
async function saveCrop() {
  const out = document.createElement('canvas'); out.width = out.height = 320;
  const o = out.getContext('2d'), k = 320 / (2 * R);
  const w = img.width * scale, h = img.height * scale;
  o.drawImage(img, (S / 2 - w / 2 + ox - (S / 2 - R)) * k, (S / 2 - h / 2 + oy - (S / 2 - R)) * k, w * k, h * k);
  try { await saveMe({ photo: out.toDataURL('image/jpeg', 0.82) }); } catch (e) { return toast(e.message); }
  refreshAvatars(); await savedFx($('crop-save')); closeOverlay('crop-overlay'); toast('تم حفظ الصورة');
}
$('crop-save').onclick = $('crop-save-top').onclick = saveCrop;
$('crop-cancel').onclick = () => closeOverlay('crop-overlay');

