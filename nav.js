/* ===== nav.js — الشاشة الرئيسية والشريط السفلي والبحث ===== */
const I = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z"/>',
  chat: '<path d="M4 5h16v11H9l-5 4Z"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19v-1.5A4.5 4.5 0 0 1 7.5 13h3A4.5 4.5 0 0 1 15 17.5V19M16 5.2a3.2 3.2 0 0 1 0 5.6M18 13.5a4.5 4.5 0 0 1 3 4V19"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>'
};
const TABS = [
  { id: 'chats', label: 'محادثات', icon: I.chat },
  { id: 'contacts', label: 'جهات', icon: I.people },
  { id: 'calls', label: 'مكالمات', icon: I.phone },
  { id: 'settings', label: 'إعدادات', icon: I.gear },
  { id: 'home', label: 'الرئيسية', icon: I.home }
];
let tab = 'chats';
const tabIndex = (id) => TABS.findIndex((x) => x.id === id);

/* شريط ثابت: 4 خانات متساوية، والكبسولة الزرقاء تنزلق بينها */
function renderNav() {
  const nav = $('bottom-nav');
  if (!nav.children.length) {
    nav.innerHTML = '<span class="nav-pill"></span>' + TABS.map((t) =>
      '<button class="nav-btn" data-tab="' + t.id + '" aria-label="' + t.label + '"><svg viewBox="0 0 24 24">' + t.icon + '</svg><span class="lbl">' + t.label + '</span></button>').join('');
    nav.querySelectorAll('.nav-btn').forEach((b) => (b.onclick = () => {
      if (b.dataset.tab === tab) return;
      $('tab-body').dataset.dir = tabIndex(b.dataset.tab) > tabIndex(tab) ? 1 : -1;
      tab = b.dataset.tab; renderMain();
    }));
  }
  nav.style.setProperty('--i', tabIndex(tab));
  nav.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
}

const empty = (icon, txt) => '<div class="empty"><svg viewBox="0 0 24 24">' + icon + '</svg>' + txt + '</div>';
const personCard = (u) => '<div class="item">' + avatarEl(u) + '<div><b>' + esc(nameOf(u)) + '</b><small>@' + esc(u.username) + '</small></div></div>';

function renderContacts(body) {
  body.innerHTML = '<input id="q" class="field" placeholder="ابحث باسم المستخدم" autocomplete="off" autocapitalize="none" spellcheck="false"><div id="results"></div>';
  const res = $('results'); let timer, seq = 0;
  const hint = () => (res.innerHTML = empty(I.people, 'اكتب اسم المستخدم حتى تلقى الأشخاص.'));
  hint();
  $('q').oninput = () => {
    clearTimeout(timer);
    const q = $('q').value.trim(); if (!q) { seq++; return hint(); }
    timer = setTimeout(async () => {
      const s = ++seq;
      try {
        const d = await api('search?q=' + encodeURIComponent(q));
        if (s !== seq) return;
        res.innerHTML = d.users.length ? d.users.map(personCard).join('') : '<div class="empty small">ما لقينا أحد بهذا الاسم</div>';
        res.querySelectorAll('.item').forEach((el, i) => { setAvatar(el.querySelector('.avatar'), d.users[i].photo); el.onclick = () => openProfile(d.users[i], 'main'); });
      } catch (e) { if (s === seq) res.innerHTML = '<div class="empty small">' + esc(e.message) + '</div>'; }
    }, 300);
  };
}

function renderSettings(body, u) {
  body.innerHTML = '<div class="settings-list">' +
    '<div class="item"><div class="avatar" id="set-av">' + AVATAR_SVG + '</div><div><b>' + esc((u.first + ' ' + u.last).trim()) + '</b><small>@' + esc(u.username) + '</small></div></div>' +
    '<div class="item" id="set-account"><span>إعدادات الحساب</span><svg class="chev" viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></svg></div>' +
    (u.email ? '<div class="item static">البريد: ' + esc(u.email) + '</div>' : '') +
    '<div class="item" id="set-chat"><svg class="si" viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4Z"/><path d="M8 9h8M8 12h5"/></svg><span class="grow">إعدادات المحادثة</span><small class="soon">قيد التطوير</small></div>' +
    '<div class="item" id="set-priv"><svg class="si" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg><span class="grow">الأمان والخصوصية</span><small class="soon">قيد التطوير</small></div>' +
    '<div class="item" id="set-notif"><svg class="si" viewBox="0 0 24 24"><path d="M6 17h12l-1.5-2V10a4.5 4.5 0 0 0-9 0v5Z"/><path d="M10 20h4"/></svg><span class="grow">الإشعارات والتنبيهات</span><small id="set-notif-st"></small></div>' +
    '<div class="item" id="set-safe"><svg class="si" viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6Z"/><path d="m9 12 2 2 4-4"/></svg><span class="grow">أداة وضع الأمان</span><small class="soon">قيد التطوير</small></div>' +
    '<div class="item" id="set-lang"><svg class="si" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg><span class="grow">اللغة</span><small class="soon">قيد التطوير</small></div>' +
    '<div class="item" id="set-dev"><svg class="si" viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/></svg><span class="grow">إدارة الأجهزة</span><small class="soon">قيد التطوير</small></div>' +
    '<div class="item" id="set-batt"><svg class="si" viewBox="0 0 24 24"><path d="M13 3 5 13h6l-1 8 8-10h-6Z"/></svg><span class="grow">توفير الطاقة</span><small class="soon">قيد التطوير</small></div>' +
    '<div class="item" id="set-sub"><svg class="si" viewBox="0 0 24 24"><path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.4l6-.8Z"/></svg><span class="grow">تفعيل الاشتراك</span><small class="soon">غير مفعّل</small></div>' +
    '<div class="item danger" id="set-out">تسجيل الخروج</div></div>';
  setAvatar($('set-av'), u.photo);
  $('set-account').onclick = () => go('account');
  $('set-sub').onclick = () => showSub('تفعيل الاشتراك', 'قم بتفعيل الاشتراك للحصول على المزايا الإضافية، مثل البث المباشر');
  $('set-notif').onclick = askNotif; renderNotifState();
  ['set-chat', 'set-priv', 'set-safe', 'set-lang', 'set-dev', 'set-batt'].forEach((id) => ($(id).onclick = () => toast('قيد التطوير')));
  $('set-out').onclick = () => {
    stopRealtime(); api('logout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem(TOKEN_KEY); user = null; tab = 'chats'; $('password').value = ''; setMode(false); go('login');
  };
}

function renderHome(body) {
  const key = 'mhadatha_feed_' + me().id;
  const posts = JSON.parse(localStorage.getItem(key) || '[]');
  body.innerHTML = `<div class="feed-head"><div><small>مساحة مجتمعك</small><h2 class="tab-title">الرئيسية</h2></div><button class="feed-compose" id="feed-new">＋ نشر</button></div>
    <div class="feed-actions"><button data-create="post">منشور</button><button data-create="story">قصة</button><button data-create="channel">قناة</button><button data-create="group">مجموعة</button></div>
    <section class="feed-tools"><b>اكتشف وتابع</b><p>تابع الأشخاص والقنوات والمجموعات التي تهمك.</p><div class="feed-empty">ماكو قنوات أو منشورات مقترحة حالياً. ابدأ بإنشاء أول منشور أو قناة.</div></section>
    <div id="feed-list">${posts.map(feedCard).join('')}</div>`;
  const create = (type) => {
    if (type === 'story' && typeof openStoryCam === 'function') return openStoryCam();
    const labels = {post:'منشور جديد',story:'قصة جديدة',channel:'إنشاء قناة',group:'إنشاء مجموعة'};
    const name = prompt(labels[type] + (type==='post' || type==='story' ? ' — اكتب النص' : ' — اكتب الاسم'));
    if (!name || !name.trim()) return;
    const arr = JSON.parse(localStorage.getItem(key) || '[]');
    arr.unshift({id:Date.now(),type,text:name.trim(),author:nameOf(me()),time:Date.now()});
    localStorage.setItem(key, JSON.stringify(arr.slice(0,50)));
    renderHome(body); toast(type==='post'?'تم نشر المنشور في هذا الجهاز':type==='story'?'تمت إضافة القصة':'تم إنشاء '+(type==='channel'?'القناة':'المجموعة')+' محلياً');
  };
  $('feed-new').onclick = () => create('post');
  body.querySelectorAll('[data-create]').forEach(b => b.onclick=()=>create(b.dataset.create));
}
function feedCard(p) {
  const label = ({post:'منشور',story:'قصة',channel:'قناة',group:'مجموعة'})[p.type] || 'منشور';
  return `<article class="feed-card"><div class="feed-card-top"><span class="feed-avatar">${esc((p.author||'م').slice(0,1))}</span><div><b>${esc(p.author||'مستخدم')}</b><small>${label} · ${new Date(p.time).toLocaleString('ar-IQ')}</small></div></div><p>${esc(p.text)}</p><div class="feed-card-foot"> <span>♡ إعجاب</span><span>تعليق</span><span>مشاركة</span></div></article>`;
}

function renderMain() {
  const u = me(); if (!u) return;
  refreshAvatars(); renderNav();
  const body = $('tab-body');
  if (tab === 'home' || tab === 'chats') renderChats(body);
  else if (tab === 'contacts') renderContacts(body);
  else if (tab === 'calls') renderCallsTab(body);
  else renderSettings(body, u);
  if (!['chats','home'].includes(tab)) body.insertAdjacentHTML('afterbegin', '<h2 class="tab-title">' + TABS[tabIndex(tab)].label + '</h2>');
}
