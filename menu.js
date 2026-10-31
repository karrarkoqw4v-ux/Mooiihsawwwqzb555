/* ===== menu.js — القائمة الجانبية (ثلاث شخطات) وصفحات الأقسام ===== */
const FEATS = {
  wallet: { t: 'محفظتك', d: 'رصيدك ومعاملاتك بمكان واحد.' },
  shop: { t: 'التسوق / المنتجات', d: 'تصفح المنتجات واشترِ مباشرة من داخل التطبيق.' },
  dev: { t: 'قسم المطورين', d: 'أدوات وواجهات برمجية (API) للمطورين.' },
  bots: { t: 'بوتات', d: 'أضف بوتات لمحادثاتك أو أنشئ بوتك الخاص.' },
  cloud: { t: 'استضافة سحابية', d: 'استضف مواقعك وتطبيقاتك على السحابة.' }
};
function openMenu() {
  const u = me(); if (!u) return;
  const av = $('drawer-av'); av.className = 'avatar'; av.innerHTML = AVATAR_SVG; setAvatar(av, u.photo);
  $('drawer-name').textContent = nameOf(u); $('drawer-user').textContent = '@' + u.username;
  $('menu-overlay').classList.remove('closing'); $('menu-overlay').hidden = false;
}
const closeMenu = () => closeOverlay('menu-overlay');
$('menu-overlay').addEventListener('click', (e) => { if (e.target === $('menu-overlay')) closeMenu(); });
document.querySelectorAll('.drawer-item').forEach((b) => (b.onclick = () => { closeMenu(); openFeat(b.dataset.feat); }));

function openFeat(k) {
  const f = FEATS[k]; if (!f) return;
  $('feat-title').textContent = f.t;
  $('feat-body').innerHTML = k === 'wallet'
    ? '<div class="wallet-card"><small>الرصيد الحالي</small><b>0.00</b><span>د.ع</span></div>' +
      '<button class="row" id="w-topup"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg><span>شحن الرصيد</span></button>' +
      '<button class="row" id="w-send"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg><span>تحويل</span></button>' +
      '<button class="row" id="w-hist"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg><span>سجل المعاملات</span></button>'
    : '<div class="empty"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg><b>' + esc(f.t) + '</b><br>' + esc(f.d) + '<br><small class="soon">قيد التطوير</small></div>';
  if (k === 'wallet') ['w-topup', 'w-send', 'w-hist'].forEach((id) => ($(id).onclick = () => toast('قيد التطوير')));
  $('feat-overlay').classList.remove('closing'); $('feat-overlay').hidden = false;
}
$('feat-back').onclick = () => closeOverlay('feat-overlay');
