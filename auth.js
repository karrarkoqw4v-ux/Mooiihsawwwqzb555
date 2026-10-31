/* ===== auth.js — تسجيل الدخول (بريد + كلمة مرور) وإنشاء الحساب (اسم مستخدم + بريد + كلمة مرور) ===== */
let registerMode = false, availTimer, availSeq = 0;
const UNAME = /^[a-z0-9_]{3,20}$/;
function setAvail(cls, txt) { const a = $('avail'); a.className = 'avail ' + (cls || ''); a.textContent = txt || ''; a.hidden = !txt; }
function checkName() {
  clearTimeout(availTimer);
  const u = $('username').value.trim().toLowerCase();
  if (!registerMode || !u) return setAvail();
  if (!UNAME.test(u)) return setAvail('no', 'غير صالح: حروف إنجليزية وأرقام و _ فقط (3-20)');
  setAvail('wait', 'جاري التحقق...');
  const seq = ++availSeq;
  availTimer = setTimeout(async () => {
    try { const d = await api('username?u=' + encodeURIComponent(u)); if (seq === availSeq) setAvail(d.available ? 'ok' : 'no', d.available ? 'متاح' : 'غير متاح'); }
    catch (e) { if (seq === availSeq) setAvail('no', e.message); }
  }, 350);
}
function setMode(reg) {
  registerMode = reg;
  const t = $('login-title'); t.style.opacity = 0;
  setTimeout(() => {
    t.textContent = reg ? 'إنشاء حساب' : 'تسجيل الدخول'; t.style.opacity = 1;
    $('btn-login').textContent = reg ? 'إنشاء حساب' : 'تسجيل الدخول';
    $('switch-text').textContent = reg ? 'عندك حساب؟' : 'ما عندك حساب؟';
    $('switch-link').textContent = reg ? 'تسجيل الدخول' : 'إنشاء حساب';
  }, 140);
  $('username').hidden = !reg;
  $('password').autocomplete = reg ? 'new-password' : 'current-password';
  $('email').autocomplete = reg ? 'email' : 'username';
  showErr('login-error', ''); checkName();
}
const busy = (b, on) => b.classList.toggle('loading', on);
async function submitAuth() {
  const btn = $('btn-login'), username = $('username').value.trim().toLowerCase(),
    email = $('email').value.trim().toLowerCase(), password = $('password').value;
  if (registerMode && !UNAME.test(username)) return showErr('login-error', 'اسم المستخدم: حروف إنجليزية وأرقام و _ فقط (3-20)');
  if (!validEmail(email)) return showErr('login-error', 'اكتب بريد إلكتروني صحيح');
  if (password.length < 6) return showErr('login-error', 'كلمة المرور لازم 6 رموز على الأقل');
  busy(btn, true); showErr('login-error', '');
  try {
    const d = await api(registerMode ? 'register' : 'login', { method: 'POST', body: registerMode ? { username, email, password } : { email, password } });
    try { if (window.PasswordCredential) navigator.credentials.store(new PasswordCredential({ id: email, password, name: email })).catch(() => {}); } catch (x) {}
    localStorage.setItem(TOKEN_KEY, d.token); user = d.user; busy(btn, false); route();
  } catch (e) {
    busy(btn, false); showErr('login-error', e.message);
    if (e.field === 'username') setAvail('no', 'غير متاح');
  }
}
$('auth-form').onsubmit = (e) => { e.preventDefault(); submitAuth(); }; // نموذج حقيقي حتى المتصفح يعرض حفظ كلمة المرور
$('username').addEventListener('input', checkName);
$('switch-link').onclick = (e) => { e.preventDefault(); setMode(!registerMode); };
$('toggle-pw').onclick = () => { const p = $('password'); p.type = p.type === 'password' ? 'text' : 'password'; };
$('email').autocomplete = 'username';

/* استخدام عبر Google: يفتح نافذة Google الرسمية ويرجع البريد والاسم، وبعدها الدخول يمر عبر مسار google */
const loadGsi = () => new Promise((ok, no) => {
  if (window.google && google.accounts && google.accounts.oauth2) return ok();
  const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.onload = ok;
  s.onerror = () => no(new Error('ما قدرت أتصل بخدمة Google، تأكد من الإنترنت')); document.head.appendChild(s);
});
async function googleLogin() {
  const btn = $('btn-google'); showErr('login-error', '');
  if (USE_FIREBASE) {
    btn.classList.add('loading');
    try { const d = await api('google', { method: 'POST', body: {} }); localStorage.setItem(TOKEN_KEY, d.token); user = d.user; btn.classList.remove('loading'); route(); }
    catch (e) { btn.classList.remove('loading'); showErr('login-error', e.message); }
    return;
  }
  if (!GOOGLE_CLIENT_ID) return showErr('login-error', 'استخدام Google غير مفعّل: لازم Client ID من Google داخل js/config.js');
  btn.classList.add('loading');
  try {
    await loadGsi();
    const tok = await new Promise((ok, no) => google.accounts.oauth2.initTokenClient({ client_id: GOOGLE_CLIENT_ID, scope: 'openid email profile',
      callback: (r) => (r.access_token ? ok(r.access_token) : no(new Error('تم الإلغاء'))), error_callback: () => no(new Error('تم الإلغاء')) }).requestAccessToken());
    const info = await (await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + tok } })).json();
    if (!info.email || info.email_verified === false) throw new Error('حساب Google ما رجع بريد موثّق');
    const d = await api('google', { method: 'POST', body: { email: info.email, first: info.given_name || '', last: info.family_name || '' } });
    localStorage.setItem(TOKEN_KEY, d.token); user = d.user; btn.classList.remove('loading'); route();
  } catch (e) { btn.classList.remove('loading'); showErr('login-error', e.message); }
}
$('btn-google').onclick = googleLogin;

/* شاشة التحقق من البريد */
$('btn-verify').onclick = async () => {
  const b = $('btn-verify'); busy(b, true);
  try {
    user = (await api('me?refresh=1')).user; busy(b, false);
    if (user.needsVerify) showErr('verify-error', 'البريد لسه غير موثّق، افتح الرابط اللي وصلك وبعدها اضغط مرة ثانية');
    else { showErr('verify-error', ''); route(); }
  } catch (e) { busy(b, false); showErr('verify-error', e.message); }
};
$('btn-resend').onclick = async () => { try { await api('verify-send', { method: 'POST' }); showErr('verify-error', ''); toast('انرسل الرابط'); } catch (e) { showErr('verify-error', e.message); } };
$('btn-verify-out').onclick = (e) => { e.preventDefault(); api('logout', { method: 'POST' }).catch(() => {}); localStorage.removeItem(TOKEN_KEY); user = null; $('password').value = ''; setMode(false); go('login'); };
