/* ===== account.js — إعدادات الحساب + خلفية الملف + ملف شخص ثاني ===== */
let accTimer, accSeq = 0, accOk = true;
function setAccAvail(cls, txt) { const a = $('acc-avail'); a.className = 'avail ' + (cls || ''); a.textContent = txt || ''; a.hidden = !txt; }
const setCover = (el, c) => { el.style.backgroundImage = safePhoto(c) ? 'url("' + c + '")' : ''; el.classList.toggle('has', !!safePhoto(c)); };
function renderAccount() {
  const u = me();
  $('acc-first').value = u.first || ''; $('acc-last').value = u.last || ''; $('acc-user').value = u.username;
  $('acc-phone').value = u.phone || ''; $('acc-bio').value = u.bio || '';
  $('acc-avatar').innerHTML = AVATAR_SVG; setAvatar($('acc-avatar'), u.photo);
  setCover($('acc-cover'), u.cover); $('cover-add').textContent = u.cover ? 'تغيير الخلفية' : 'إضافة خلفية'; $('cover-del').hidden = !u.cover;
  accOk = true; accSeq++; setAccAvail();
}
$('acc-user').addEventListener('input', () => {
  clearTimeout(accTimer);
  const v = $('acc-user').value.trim().toLowerCase(), seq = ++accSeq;
  if (v === me().username) { accOk = true; return setAccAvail('ok', 'هذا اسمك الحالي'); }
  accOk = false;
  if (!v) return setAccAvail();
  if (!UNAME.test(v)) return setAccAvail('no', 'غير صالح: حروف إنجليزية وأرقام و _ فقط (3-20)');
  setAccAvail('wait', 'جاري التحقق...');
  accTimer = setTimeout(async () => {
    try { const d = await api('username?u=' + encodeURIComponent(v)); if (seq !== accSeq) return; accOk = d.available; setAccAvail(d.available ? 'ok' : 'no', d.available ? 'متاح' : 'غير متاح'); }
    catch (e) { if (seq === accSeq) setAccAvail('no', e.message); }
  }, 350);
});
$('acc-save').onclick = async () => {
  const u = me(), first = $('acc-first').value.trim(), last = $('acc-last').value.trim(), username = $('acc-user').value.trim().toLowerCase(),
    phone = $('acc-phone').value.replace(/[\s-]/g, ''), bio = $('acc-bio').value.trim();
  if (!first) return toast('اكتب اسمك');
  if (!accOk) return toast('اسم المستخدم غير صالح أو غير متاح');
  const patch = {};
  if (first !== u.first) patch.first = first;
  if (last !== u.last) patch.last = last;
  if (username !== u.username) patch.username = username;
  if (phone !== (u.phone || '')) patch.phone = phone;
  if (bio !== (u.bio || '')) patch.bio = bio;
  if (!Object.keys(patch).length) return toast('ما تغير شي');
  try { await saveMe(patch); await savedFx($('acc-save')); renderAccount(); }
  catch (e) { toast(e.message); if (e.field === 'username') { accOk = false; setAccAvail('no', 'غير متاح'); } }
};
$('acc-avatar-btn').onclick = () => { refreshAvatars(); $('photo-overlay').hidden = false; };
$('acc-back').onclick = () => go('main');

/* خلفية الملف: تسحب وتكبّر وتحدد الجزء بنفسك */
const cvc = $('cover-canvas'), cctx = cvc.getContext('2d'), CW = 1080, CH = 600, cstage = $('cover-stage');
let cimg = null, cs = 1, cmin = 1, cox = 0, coy = 0, cdrag = null;
function cdraw() {
  const w = cimg.width * cs, h = cimg.height * cs, mx = Math.max(0, (w - CW) / 2), my = Math.max(0, (h - CH) / 2);
  cox = Math.min(mx, Math.max(-mx, cox)); coy = Math.min(my, Math.max(-my, coy));
  cctx.fillStyle = '#0c1116'; cctx.fillRect(0, 0, CW, CH);
  cctx.drawImage(cimg, CW / 2 - w / 2 + cox, CH / 2 - h / 2 + coy, w, h);
}
$('cover-add').onclick = () => $('file-cover').click();
$('file-cover').onchange = (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (!f.type.startsWith('image/')) return toast('اختر صورة فقط');
  const im = new Image(), url = URL.createObjectURL(f);
  im.onload = () => {
    cimg = im; cmin = Math.max(CW / im.width, CH / im.height); cs = cmin; cox = coy = 0; $('cover-zoom').value = 1;
    $('cover-overlay').hidden = false; cdraw();
  };
  im.onerror = () => toast('تعذر فتح الصورة'); im.src = url;
};
$('cover-zoom').oninput = (e) => { cs = cmin * parseFloat(e.target.value); cdraw(); };
cstage.onpointerdown = (e) => { cdrag = { x: e.clientX, y: e.clientY, ox: cox, oy: coy }; cstage.setPointerCapture(e.pointerId); };
cstage.onpointermove = (e) => { if (!cdrag) return; const k = CW / cstage.clientWidth; cox = cdrag.ox + (e.clientX - cdrag.x) * k; coy = cdrag.oy + (e.clientY - cdrag.y) * k; cdraw(); };
cstage.onpointerup = cstage.onpointercancel = () => (cdrag = null);
$('cover-cancel').onclick = () => closeOverlay('cover-overlay');
$('cover-save').onclick = async () => {
  try { await saveMe({ cover: cvc.toDataURL('image/jpeg', 0.82) }); } catch (x) { return toast(x.message); }
  await savedFx($('cover-save')); closeOverlay('cover-overlay'); renderAccount(); toast('تم تحديد الخلفية');
};
$('cover-del').onclick = async () => { try { await saveMe({ cover: '' }); renderAccount(); toast('تم حذف الخلفية'); } catch (x) { toast(x.message); } };

/* ملف شخص ثاني */
const INFO_IC = {
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z"/>',
  user: '<circle cx="12" cy="12" r="4"/><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1"/>',
  bio: '<path d="M5 6h14M5 12h14M5 18h9"/>'
};
function setMuteBtn(on) { $('u-mute').classList.toggle('on', on); $('u-mute').querySelector('small').textContent = on ? 'إلغاء الكتم' : 'كتم'; }
function renderUser() {
  const u = viewUser, av = $('user-avatar');
  av.className = 'avatar big'; av.innerHTML = AVATAR_SVG; setAvatar(av, u.photo);
  $('user-name').innerHTML = esc(nameOf(u));
  setCover($('user-cover'), u.cover); setMuteBtn(false); $('user-info').innerHTML = '';
  api('user?u=' + encodeURIComponent(u.username)).then((d) => {
    if (viewUser !== u) return;
    const p = d.user; setCover($('user-cover'), p.cover); setMuteBtn(d.muted);
    const rows = [];
    if (p.phone) rows.push(['phone', 'رقم الهاتف', '<span class="ltr">' + esc(p.phone) + '</span>']);
    rows.push(['user', 'اسم المستخدم', '<span class="ltr">@' + esc(p.username) + '</span>']);
    if (p.bio) rows.push(['bio', 'الوصف', esc(p.bio)]);
    $('user-info').innerHTML = rows.map((r) => '<div class="info-row"><svg viewBox="0 0 24 24">' + INFO_IC[r[0]] + '</svg><div><small>' + r[1] + '</small><p>' + r[2] + '</p></div></div>').join('');
  }).catch(() => {});
}
$('user-msg').onclick = () => openChat(viewUser);
$('user-back').onclick = () => go(userFrom);
$('u-call').onclick = () => startCall(viewUser, 'audio');
$('u-video').onclick = () => startCall(viewUser, 'video');
$('u-mute').onclick = async () => {
  const on = !$('u-mute').classList.contains('on');
  try { await api('mute', { method: 'POST', body: { peer: viewUser.id, muted: on } }); setMuteBtn(on); toast(on ? 'تم كتم المحادثة' : 'تم إلغاء الكتم'); } catch (e) { toast(e.message); }
};
