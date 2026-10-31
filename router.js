/* ===== router.js — التنقل بين الشاشات بحركة ===== */
function go(name) {
  const next = $('s-' + name);
  const cur = [...document.querySelectorAll('.screen')].find((s) => !s.hidden && s !== next);
  const show = () => {
    next.hidden = false;
    next.querySelectorAll('.sheet > *').forEach((el, i) => el.style.setProperty('--i', i));
    next.classList.add('enter');
    next.addEventListener('animationend', (e) => { if (e.target === next) next.classList.remove('enter'); });
    if (name === 'main') { renderMain(); startRealtime(); }
    if (name === 'profile') { refreshAvatars(); prefillProfile(); }
    if (name === 'verify') $('verify-text').textContent = 'أرسلنا رابط تحقق إلى ' + (me().email || 'بريدك') + '. افتح الرابط من بريدك (شوف الرسائل المزعجة إذا ما وصل) وبعدها ارجع واضغط "تم التحقق".';
    if (name === 'chat') renderChat();
    if (name === 'account') renderAccount();
    if (name === 'user') renderUser();
    if (name === 'admin') renderAdmin();
  };
  if (cur) { cur.classList.add('leave'); setTimeout(() => { cur.hidden = true; cur.classList.remove('leave'); show(); }, 200); }
  else show();
}
function route() {
  const u = me();
  if (!u) return go('login');
  if (u.needsVerify) return go('verify');
  if (!u.profileDone) return go('profile');
  go('main');
}
