/* ===== profile.js — أكمل ملفك + ورقة الصورة ===== */
const AVATAR_SVG = '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.6"/><path d="M5 20v-3a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v3"/></svg>';
function setAvatar(el, photo) {
  const p = safePhoto(photo);
  el.style.backgroundImage = p ? 'url("' + p + '")' : '';
  el.classList.remove('pop'); if (p) { void el.offsetWidth; el.classList.add('pop'); }
  const svg = el.querySelector('svg'); if (svg) svg.style.display = p ? 'none' : '';
}
function refreshAvatars() {
  const u = me(); if (!u) return;
  setAvatar($('avatar-preview'), u.photo);
  const t = $('photo-top-avatar'); t.innerHTML = AVATAR_SVG; setAvatar(t, u.photo);
  setAvatar($('acc-avatar'), u.photo);
}
function prefillProfile() { const u = me(); if (!u) return; $('first-name').value = u.first || ''; $('last-name').value = u.last || ''; }
const finishProfile = async () => {
  const f = $('first-name').value.trim(), l = $('last-name').value.trim();
  if (!f) return showErr('profile-error', 'اكتب اسمك');
  try { await saveMe({ first: f, last: l, profileDone: true }); showErr('profile-error', ''); await savedFx($('btn-next')); route(); }
  catch (e) { showErr('profile-error', e.message); }
};
$('btn-next').onclick = finishProfile;
$('btn-profile-skip').onclick = (e) => { e.preventDefault(); finishProfile(); };

/* ورقة الصورة */
$('avatar-btn').onclick = () => { refreshAvatars(); $('photo-overlay').hidden = false; };
$('photo-overlay').addEventListener('click', (e) => { if (e.target === $('photo-overlay') || e.target.classList.contains('photo-top')) closeOverlay('photo-overlay'); });
$('act-camera').onclick = () => $('file-camera').click();
$('act-gallery').onclick = () => $('file-gallery').click();
$('act-delete').onclick = async () => { try { await saveMe({ photo: '' }); refreshAvatars(); closeOverlay('photo-overlay'); toast('تم حذف الصورة'); } catch (e) { toast(e.message); } };
['file-camera', 'file-gallery'].forEach((id) => ($(id).onchange = (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (!f.type.startsWith('image/')) return toast('اختر صورة فقط');
  const img = new Image(), url = URL.createObjectURL(f);
  img.onload = () => { openCrop(img); };
  img.onerror = () => toast('تعذر فتح الصورة');
  img.src = url;
}));

