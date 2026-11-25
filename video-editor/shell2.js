'use strict';
/* ============================================================
   كليبو — الإطار الرئيسي، الصفحات، القوالب، الإعدادات، الملف الشخصي، ربط المحرر
   ============================================================ */
let frameBuilt = false;
const go = p => { if (location.hash === '#/' + p) route(); else location.hash = '#/' + p; };
const NAVS = [['home', 'home', L => L('الرئيسية', 'Home')], ['templates', 'template', L => L('القوالب', 'Templates')], ['projects', 'folder', L => L('مشاريعي', 'My projects')], ['settings', 'gear', L => L('الإعدادات', 'Settings')]];

function buildFrame() {
  const u = Auth.user;
  $('#side').innerHTML = `<div class="brand2"><div class="logo-mark sm"></div>${L('كليبو', 'Clipo')}</div>` +
    NAVS.map(([id, i, f]) => `<button class="nav" data-act="nav" data-p="${id}" data-nav="${id}">${ic(i)}<span>${esc(f(L))}</span></button>`).join('') +
    `<div class="grow"></div><button class="nav" data-act="nav" data-p="profile" data-nav="profile">${ic('user')}<span>${u ? esc(u.name) : L('ضيف', 'Guest')}</span></button>`;
  $('#topbar').innerHTML = `<div class="search">${ic('search', 18)}<input id="gq" placeholder="${L('ابحث في المشاريع والقوالب…', 'Search projects and templates…')}" value="${esc(Nav.q)}"></div><div class="sp"></div>
   <button class="btn2 pri" data-act="newProject">${ic('plus', 18)}<span>${L('مشروع جديد', 'New project')}</span></button>
   <div class="avatar" data-act="userMenu" title="${L('الحساب', 'Account')}">${avatarInner(u)}</div>`;
  let tm; $('#gq').oninput = e => { Nav.q = e.target.value; clearTimeout(tm); tm = setTimeout(() => { if (['home', 'templates', 'projects'].includes(Nav.page)) renderPage(Nav.page, Nav.args || []); }, 180); };
  frameBuilt = true;
}
const avatarInner = u => u && u.avatar ? `<img src="${esc(u.avatar)}" alt="">` : esc((u ? u.name : L('ض', 'G')).trim().charAt(0).toUpperCase() || '?');
ACT.nav = el => go(el.dataset.p);
ACT.userMenu = el => {
  const u = Auth.user;
  popMenu(el, [{ head: u ? u.name + ' — ' + u.email : L('ضيف (بدون حساب)', 'Guest (no account)') },
    ...(u ? [{ label: L('الملف الشخصي', 'Profile'), icon: 'user', fn: () => go('profile') }] : [{ label: L('تسجيل الدخول / إنشاء حساب', 'Log in / Sign up'), icon: 'user', fn: () => { Auth.logout(); authChoose(); } }]),
    { label: L('الإعدادات', 'Settings'), icon: 'gear', fn: () => go('settings') }, '-',
    { label: u ? L('تبديل الحساب', 'Switch account') : L('الخروج من وضع الضيف', 'Exit guest mode'), icon: 'restore', fn: () => { Auth.logout(); frameBuilt = false; authChoose(); } },
    ...(u ? [{ label: L('تسجيل الخروج', 'Log out'), icon: 'logout', danger: true, fn: doLogout }] : [])]);
};
async function doLogout() { if (await confirmBox(L('هل تريد تسجيل الخروج؟ مشاريعك تبقى محفوظة على هذا الجهاز.', 'Log out? Your projects stay saved on this device.'), L('تسجيل الخروج', 'Log out'))) { Auth.logout(); frameBuilt = false; toast(L('تم تسجيل الخروج', 'Logged out')); authChoose(); } }

/* ---------------- التوجيه ---------------- */
async function route() {
  if (!Auth.ready) { authChoose(); return; }
  Nav.cleanups.forEach(f => { try { f(); } catch (e) {} }); Nav.cleanups = [];
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean), pg = parts[0] || 'home';
  if ($('#view-editor').classList.contains('on') && pg !== 'editor') { pause(); await saveProject(true); }
  if (pg === 'editor') return openEditorById(parts[1]);
  if (!frameBuilt) buildFrame();
  showView('v-main'); Nav.page = pg; Nav.args = parts.slice(1);
  $$('#side .nav').forEach(n => n.classList.toggle('on', n.dataset.nav === (pg === 'template' ? 'templates' : pg)));
  $('#page').scrollTop = 0; renderPage(pg, parts.slice(1));
}
function renderPage(pg, args) {
  const P = $('#page'); P.classList.remove('fade-up'); void P.offsetWidth; P.classList.add('fade-up');
  const f = { home: pageHome, templates: pageTemplates, template: pageTemplate, projects: pageProjects, settings: pageSettings, profile: pageProfile }[pg] || pageHome;
  Promise.resolve(f(args)).catch(e => { console.error(e); P.innerHTML = `<div class="empty"><big>⚠</big>${esc(e.message || e)}</div>`; });
}
addEventListener('hashchange', () => { if (!$('#v-splash').classList.contains('on')) route(); });

/* ---------------- مشاريع: بطاقات وقوائم ---------------- */
function projCard(p, trashed) {
  return `<div class="pcard" data-act="openProj" data-id="${p.id}"><div class="th" style="${p.thumb ? `background-image:url(${p.thumb})` : ''}">${p.thumb ? '' : '🎬'}${p.dur ? `<span class="bd">${fmt(p.dur).slice(0, 5)}</span>` : ''}</div>
  <div class="pi"><b>${esc(p.name)}</b><small>${fmtDate(p.updated)} • ${p.ratio.join(':')} • ${(p.clips || []).length} ${L('مقطع', 'clips')}</small></div><button class="kb" data-act="pmenu" data-id="${p.id}" data-t="${trashed ? 1 : 0}">${ic('more', 16)}</button></div>`;
}
ACT.openProj = (el, e) => { if (e.target.closest('.kb')) return; go('editor/' + el.dataset.id); };
ACT.pmenu = async (el, e) => {
  e.stopPropagation(); const id = el.dataset.id, p = await Proj.get(id), refresh = () => renderPage(Nav.page, Nav.args || []);
  if (el.dataset.t === '1') return popMenu(el, [{ label: L('استعادة', 'Restore'), icon: 'restore', fn: async () => { await Proj.restore(id); toast(L('تمت الاستعادة', 'Restored')); refresh(); } }, { label: L('حذف نهائي', 'Delete forever'), icon: 'trash', danger: true, fn: async () => { if (await confirmBox(L('حذف نهائي لا يمكن التراجع عنه. متأكد؟', 'Permanent deletion cannot be undone. Sure?'), L('حذف', 'Delete'), true)) { await Proj.del(id); refresh(); } } }]);
  popMenu(el, [{ label: L('فتح', 'Open'), icon: 'play', fn: () => go('editor/' + id) },
    { label: L('إعادة تسمية', 'Rename'), icon: 'edit', fn: async () => { const n = await promptBox(L('اسم المشروع', 'Project name'), p.name); if (n) { await Proj.rename(id, n); refresh(); } } },
    { label: L('نسخ المشروع', 'Duplicate'), icon: 'copy', fn: async () => { await Proj.duplicate(id); toast(L('تم إنشاء نسخة', 'Duplicate created')); refresh(); } },
    { label: L('ملفات الوسائط', 'Media files'), icon: 'folder', fn: () => mediaManager(id) },
    { label: L('تصدير كملف مشروع (.vproj)', 'Export project file (.vproj)'), icon: 'download', fn: async () => { await Proj.exportFile(id); toast(L('تم تنزيل ملف المشروع', 'Project file downloaded')); } }, '-',
    { label: L('نقل إلى المحذوفات', 'Move to trash'), icon: 'trash', danger: true, fn: async () => { await Proj.trash(id); toast(L('نُقل إلى المحذوفات — يمكن استعادته من «مشاريعي»', 'Moved to trash — restore it from My projects')); refresh(); } }]);
};
async function mediaManager(id) {
  const p = await Proj.get(id); if (!p) return;
  const used = new Set((p.clips || []).map(c => c.mediaId)), rows = (p.media || []);
  modal(L('ملفات الوسائط — ', 'Media files — ') + p.name, b => {
    if (!rows.length) b.append(h('p', 'hint', L('لا توجد وسائط في هذا المشروع.', 'No media in this project.')));
    rows.forEach(m => { const r = h('div', 'proj'); r.style.marginBottom = '6px'; r.innerHTML = `<div class="n">${esc(m.name)}<small>${m.type} • ${fmtSize(m.blob ? m.blob.size : 0)} • ${used.has(m.id) ? L('مستخدم', 'in use') : L('غير مستخدم', 'unused')}</small></div>`; const d = h('button', '', ic('trash', 16)); d.disabled = used.has(m.id); d.title = used.has(m.id) ? L('مستخدم في الخط الزمني', 'Used on the timeline') : L('حذف الملف', 'Delete file'); d.onclick = async () => { p.media = p.media.filter(x => x.id !== m.id); p.updated = Date.now(); await Proj.put(p); r.remove(); toast(L('تم حذف الملف', 'File deleted')); }; r.append(d); b.append(r); });
    b.append(h('p', 'hint', L('الإجمالي: ', 'Total: ') + fmtSize(Proj.size(p))));
  }, [[L('إغلاق', 'Close'), m => { m.remove(); renderPage(Nav.page, Nav.args || []); }, 'primary']]);
}
ACT.newProject = () => {
  let name, ratio; modal(L('مشروع جديد', 'New project'), b => {
    b.innerHTML = `<div class="fld"><label>${L('اسم المشروع', 'Project name')}</label><input id="npn" value="${L('مشروع', 'Project')} ${new Date().toLocaleDateString('en-GB')}"></div><div class="fld"><label>${L('نسبة العرض', 'Aspect ratio')}</label><select id="npr">${['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'].map(r => `<option ${r === SET.defRatio ? 'selected' : ''}>${r}</option>`).join('')}</select></div>`;
    name = $('#npn', b); ratio = $('#npr', b); setTimeout(() => { name.focus(); name.select(); }, 40);
  }, [[L('إلغاء', 'Cancel'), m => m.remove()], [L('إنشاء', 'Create'), async m => { const p = await Proj.create({ name: name.value.trim() || undefined, ratio: ratio.value.split(':').map(Number) }); m.remove(); go('editor/' + p.id); }, 'primary']]);
};
ACT.newRatio = async el => { const p = await Proj.create({ ratio: el.dataset.r.split(':').map(Number) }); go('editor/' + p.id); };
ACT.importProj = () => { const i = h('input'); i.type = 'file'; i.accept = '.vproj,application/json'; i.onchange = async () => { try { const p = await Proj.importFile(i.files[0]); toast(L('تم استيراد المشروع: ', 'Imported: ') + p.name); renderPage(Nav.page, Nav.args || []); } catch (e) { toast(e.message, 4000); } }; i.click(); };
const filterQ = (a, f) => { const q = Nav.q.trim().toLowerCase(); return q ? a.filter(x => f(x).toLowerCase().includes(q)) : a; };

/* ---------------- الصفحة الرئيسية ---------------- */
async function pageHome() {
  const all = (await Proj.all()).filter(p => !p.deleted).sort((a, b) => b.updated - a.updated), recent = filterQ(all, p => p.name).slice(0, 12);
  const tp = filterQ(allTemplates(), t => t.name + ' ' + t.tags.join(' ')).sort((a, b) => (b.hot || 0) - (a.hot || 0)).slice(0, 8);
  $('#page').innerHTML = `${Auth.guest ? `<div class="banner"><span style="font-size:22px">👤</span><div><b>${L('أنت تستخدم التطبيق كضيف', 'You are using the app as a guest')}</b><br><small style="color:var(--mut)">${L('أنشئ حساباً لتخصيص ملفك الشخصي وفصل مشاريعك عن الآخرين على هذا الجهاز.', 'Create an account to get a profile and keep your projects separate from others on this device.')}</small></div><div class="sp"></div><button class="btn2 pri sm" data-act="toAuth">${L('تسجيل الدخول', 'Log in')}</button></div>` : ''}
  <div class="hero"><button class="big" data-act="newProject"><span class="plus">+</span><div><b>${L('ابدأ مشروعاً جديداً', 'Start a new project')}</b><br><span>${L('استورد فيديو وصوراً وابدأ المونتاج', 'Import video and photos and start editing')}</span></div></button>
   <div class="mini">${[['16:9', 32, 18], ['9:16', 18, 32], ['1:1', 26, 26], ['4:3', 30, 22]].map(([r, w, hh]) => `<button class="rt" data-act="newRatio" data-r="${r}"><i style="width:${w}px;height:${hh}px"></i><b>${r}</b></button>`).join('')}</div></div>
  <div class="sec-h"><h3>${L('المشاريع الأخيرة', 'Recent projects')}</h3><div class="sp"></div><button class="btn2 ghost sm" data-act="nav" data-p="projects">${L('عرض الكل', 'View all')}</button><button class="btn2 ghost sm" style="margin-inline-start:8px" data-act="importProj">${ic('upload', 16)} ${L('استيراد', 'Import')}</button></div>
  ${recent.length ? `<div class="row-c">${recent.map(p => projCard(p)).join('')}</div>` : `<div class="empty"><big>🎞</big>${Nav.q ? L('لا نتائج مطابقة', 'No matching projects') : L('لا توجد مشاريع بعد — ابدأ مشروعك الأول!', 'No projects yet — start your first one!')}</div>`}
  <div class="sec-h"><h3>${L('قوالب رائجة', 'Trending templates')}</h3><div class="sp"></div><button class="btn2 ghost sm" data-act="nav" data-p="templates">${L('كل القوالب', 'All templates')}</button></div>
  <div class="row-c">${tp.map(tplCard).join('')}</div>
  <div class="sec-h"><h3>${L('السحابة', 'Cloud')}</h3></div><div class="banner"><span style="font-size:22px">☁</span><div><b>${L('المشاريع السحابية غير متاحة', 'Cloud projects are unavailable')}</b><br><small style="color:var(--mut)">${L('هذا التطبيق مستقل بلا خادم: مشاريعك تُحفظ على جهازك فقط. للنقل بين الأجهزة استخدم «تصدير ملف المشروع» ثم «استيراد».', 'This standalone app has no server: projects are stored on your device only. To move between devices use “Export project file” then “Import”.')}</small></div></div>`;
  drawThumbs();
}
ACT.toAuth = () => { Auth.logout(); frameBuilt = false; authChoose(); };

/* ---------------- صفحة المشاريع ---------------- */
let projTab = 'all', projSort = 'updated', projView = STO.get('ve-pview', 'grid');
async function pageProjects() {
  const all = await Proj.all(), now = Date.now(), live = all.filter(p => !p.deleted), trash = all.filter(p => p.deleted);
  let list = projTab === 'trash' ? trash : projTab === 'recent' ? live.filter(p => now - p.updated < 7 * 864e5) : live;
  list = filterQ(list, p => p.name).sort((a, b) => projSort === 'name' ? a.name.localeCompare(b.name) : projSort === 'created' ? (b.created || 0) - (a.created || 0) : b.updated - a.updated);
  const total = all.reduce((a, p) => a + Proj.size(p), 0);
  $('#page').innerHTML = `<div class="pg-h"><h1>${L('مشاريعي', 'My projects')}</h1><div class="sp"></div><button class="btn2 ghost" data-act="importProj">${ic('upload', 16)} ${L('استيراد مشروع', 'Import project')}</button><button class="btn2 pri" data-act="newProject">${ic('plus', 16)} ${L('مشروع جديد', 'New project')}</button></div>
  <div class="pg-h"><div class="tabs2">${[['all', L('الكل', 'All'), live.length], ['recent', L('الأخيرة', 'Recent'), null], ['trash', L('المحذوفة', 'Trash'), trash.length]].map(([k, n, c]) => `<button class="${projTab === k ? 'on' : ''}" data-act="ptab" data-k="${k}">${n}${c != null ? ' (' + c + ')' : ''}</button>`).join('')}</div><div class="sp"></div>
   <select data-act="psort" style="background:var(--p1);border:1px solid var(--bd);border-radius:8px;padding:6px 10px;color:var(--tx)"><option value="updated" ${projSort === 'updated' ? 'selected' : ''}>${L('الأحدث تعديلاً', 'Last modified')}</option><option value="created" ${projSort === 'created' ? 'selected' : ''}>${L('الأحدث إنشاءً', 'Newest')}</option><option value="name" ${projSort === 'name' ? 'selected' : ''}>${L('الاسم', 'Name')}</option></select>
   <button class="btn2 ghost sm" data-act="pview">${projView === 'grid' ? L('قائمة', 'List') : L('شبكة', 'Grid')}</button>
   ${projTab === 'trash' && trash.length ? `<button class="btn2 danger sm" data-act="emptyTrash">${L('إفراغ المحذوفات', 'Empty trash')}</button>` : ''}</div>
  <p class="hint">${L('التخزين المحلي المستخدم: ', 'Local storage used: ')}${fmtSize(total)} • ${L('الحفظ التلقائي', 'Autosave')}: ${SET.autosave ? L('مفعّل', 'on') : L('متوقف', 'off')}</p>
  ${list.length ? `<div class="${projView === 'grid' ? 'grid-c' : 'plist'}" ${projView === 'list' ? 'style="display:flex;flex-direction:column;gap:10px"' : ''}>${list.map(p => projCard(p, projTab === 'trash')).join('')}</div>` : `<div class="empty"><big>${projTab === 'trash' ? '🗑' : '📁'}</big>${projTab === 'trash' ? L('سلة المحذوفات فارغة', 'Trash is empty') : L('لا توجد مشاريع هنا', 'No projects here')}</div>`}`;
}
ACT.ptab = el => { projTab = el.dataset.k; pageProjects(); };
document.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.act === 'psort') { projSort = e.target.value; pageProjects(); } });
ACT.pview = () => { projView = projView === 'grid' ? 'list' : 'grid'; STO.set('ve-pview', projView); pageProjects(); };
ACT.emptyTrash = async () => { if (await confirmBox(L('حذف كل المشاريع المحذوفة نهائياً؟', 'Permanently delete all trashed projects?'), L('إفراغ', 'Empty'), true)) { for (const p of (await Proj.all()).filter(p => p.deleted)) await Proj.del(p.id); pageProjects(); } };

/* ---------------- القوالب ---------------- */
let tplCat = 'all', tplRatio = 'all', tplSort = 'hot';
function tplCard(t) {
  const ar = t.ratio[0] / t.ratio[1], cw = ar >= 1 ? 420 : 270;
  return `<div class="pcard tcard" data-act="openTpl" data-id="${t.id}"><div class="th"><canvas data-tpl="${t.id}" width="${cw}" height="${Math.round(cw / ar)}" style="aspect-ratio:${t.ratio[0]}/${t.ratio[1]}"></canvas>${t.isNew ? `<span class="bd2">${L('جديد', 'NEW')}</span>` : ''}${t.mine ? `<span class="bd2">${L('قالبي', 'MINE')}</span>` : ''}<span class="bd">${t.ratio.join(':')}</span></div><div class="pi"><b>${esc(t.name)}</b><small>${tplTotal(t).toFixed(0)}s • ${t.slots.length} ${L('وسائط', 'media')}</small></div></div>`;
}
function drawThumbs() { $$('canvas[data-tpl]').forEach(c => { const t = allTemplates().find(x => x.id === c.dataset.tpl); if (t) drawTemplate(c, t, Math.min(tplTotal(t) - .1, (t.scenes[0].start) + 1.1), null, null); }); }
ACT.openTpl = el => go('template/' + el.dataset.id);
function pageTemplates() {
  const cats = [['all', L('الكل', 'All')], ...TPL_CATS.map(([k, n]) => [k, L(n, { popular: 'Popular', new: 'New', slideshow: 'Slideshows', intro: 'Intros', social: 'Social', business: 'Business', occasion: 'Occasions' }[k])]), ['mine', L('قوالبي', 'Mine')]];
  let list = allTemplates().filter(t => tplCat === 'all' || (t.cat || []).includes(tplCat) || (tplCat === 'new' && t.isNew));
  if (tplRatio !== 'all') list = list.filter(t => t.ratio.join(':') === tplRatio);
  list = filterQ(list, t => t.name + ' ' + t.tags.join(' ') + ' ' + t.desc).sort((a, b) => tplSort === 'hot' ? (b.hot || 0) - (a.hot || 0) : tplSort === 'dur' ? tplTotal(a) - tplTotal(b) : a.name.localeCompare(b.name));
  $('#page').innerHTML = `<div class="pg-h"><h1>${L('القوالب', 'Templates')}</h1><div class="sp"></div><button class="btn2 ghost" data-act="importTpl">${ic('upload', 16)} ${L('استيراد قالب', 'Import template')}</button></div>
  <div class="pg-h"><div class="tabs2">${cats.map(([k, n]) => `<button class="${tplCat === k ? 'on' : ''}" data-act="tcat" data-k="${k}">${esc(n)}</button>`).join('')}</div></div>
  <div class="pg-h"><label style="color:var(--mut);font-size:12px">${L('النسبة', 'Ratio')}</label><select data-act="tfilter" data-f="ratio" style="background:var(--p1);border:1px solid var(--bd);border-radius:8px;padding:6px 10px;color:var(--tx)">${['all', '16:9', '9:16', '1:1'].map(r => `<option value="${r}" ${tplRatio === r ? 'selected' : ''}>${r === 'all' ? L('الكل', 'All') : r}</option>`).join('')}</select>
  <label style="color:var(--mut);font-size:12px">${L('الفرز', 'Sort')}</label><select data-act="tfilter" data-f="sort" style="background:var(--p1);border:1px solid var(--bd);border-radius:8px;padding:6px 10px;color:var(--tx)"><option value="hot" ${tplSort === 'hot' ? 'selected' : ''}>${L('الأكثر استخداماً', 'Most popular')}</option><option value="dur" ${tplSort === 'dur' ? 'selected' : ''}>${L('الأقصر', 'Shortest')}</option><option value="name" ${tplSort === 'name' ? 'selected' : ''}>${L('الاسم', 'Name')}</option></select><span class="hint">${list.length} ${L('قالب', 'templates')}</span></div>
  ${list.length ? `<div class="grid-c">${list.map(tplCard).join('')}</div>` : `<div class="empty"><big>🧩</big>${tplCat === 'mine' ? L('لا توجد قوالب خاصة بك بعد. افتح مشروعاً واضغط «حفظ كقالب» في المحرر.', 'You have no templates yet. Open a project and press “Save as template” in the editor.') : L('لا قوالب مطابقة', 'No matching templates')}</div>`}`;
  drawThumbs();
}
ACT.tcat = el => { tplCat = el.dataset.k; pageTemplates(); };
document.addEventListener('change', e => { const d = e.target.dataset; if (d && d.act === 'tfilter') { if (d.f === 'ratio') tplRatio = e.target.value; else tplSort = e.target.value; pageTemplates(); } });
ACT.importTpl = () => { const i = h('input'); i.type = 'file'; i.accept = '.vtpl,application/json'; i.onchange = async () => { try { const t = JSON.parse(await i.files[0].text()); if (!t.vtpl || !t.scenes || !t.slots) throw new Error(L('ملف قالب غير صالح', 'Invalid template file')); delete t.vtpl; t.id = 'u_' + uid(); t.mine = true; t.cat = ['mine']; userTemplates.add(t); toast(L('تم استيراد القالب', 'Template imported')); tplCat = 'mine'; pageTemplates(); } catch (e) { toast(e.message, 4000); } }; i.click(); };

let TV = null; // حالة صفحة القالب
function pageTemplate(args) {
  const t = allTemplates().find(x => x.id === args[0]); if (!t) { $('#page').innerHTML = `<div class="empty"><big>🧩</big>${L('القالب غير موجود', 'Template not found')}<br><br><button class="btn2 pri" data-act="nav" data-p="templates">${L('كل القوالب', 'All templates')}</button></div>`; return; }
  if (args[1] === 'use') return pageTemplateUse(t);
  $('#page').innerHTML = `<div class="pg-h"><button class="btn2 ghost sm" data-act="nav" data-p="templates">${ic('back', 16)} ${L('القوالب', 'Templates')}</button></div>
  <div class="tpl-layout"><div class="tpl-prev"><canvas id="tpc"></canvas><div class="ctl"><button class="btn2 sm" id="tpp">${ic('pause', 14)}</button><input type="range" id="tps" min="0" max="${tplTotal(t)}" step="0.01" value="0"><span id="tpt" style="font-size:12px;direction:ltr">0.0s</span></div></div>
   <div><h1 style="margin:0 0 6px">${esc(t.name)}</h1><p style="color:var(--mut);margin:0 0 14px">${esc(t.desc)}</p>
   <div>${(t.tags || []).map(x => `<span class="chip">#${esc(x)}</span>`).join('')}<span class="chip">${t.ratio.join(':')}</span><span class="chip">${tplTotal(t).toFixed(0)}s</span><span class="chip">${t.slots.length} ${L('أماكن وسائط', 'media slots')}</span><span class="chip">${t.texts.length} ${L('نصوص قابلة للتعديل', 'editable texts')}</span></div>
   <div class="banner" style="margin-top:16px"><span>ℹ</span><small style="color:var(--mut)">${L('نسخة الويب: تستخدم القوالب الموجودة في الجهاز. تخصيص كامل (استبدال الوسائط وتعديل النصوص) ثم تحرير في المحرر وتصدير. لا مشاركة مجتمعية (تحتاج خادماً).', 'Web version: uses templates stored on this device. Full customisation (replace media, edit text), then edit in the editor and export. No community sharing (needs a server).')}</small></div>
   <div class="row2" style="justify-content:flex-start;margin-top:18px"><button class="btn2 pri" data-act="useTpl" data-id="${t.id}">${ic('check', 18)} ${L('استخدام القالب', 'Use template')}</button>
   <button class="btn2 ghost" data-act="expTpl" data-id="${t.id}">${ic('download', 16)} ${L('تصدير القالب', 'Export template')}</button>${t.mine ? `<button class="btn2 danger" data-act="delTpl" data-id="${t.id}">${ic('trash', 16)} ${L('حذف', 'Delete')}</button>` : ''}</div></div></div>`;
  startPreview(t, {}, null);
}
function startPreview(t, texts, els) {
  const c = $('#tpc'); if (!c) return; const ar = t.ratio[0] / t.ratio[1]; c.width = ar >= 1 ? 640 : 405; c.height = Math.round(c.width / ar);
  const total = tplTotal(t); let playing = true, T = 0, last = performance.now(), raf = 0; const sl = $('#tps'), tt = $('#tpt'), pb = $('#tpp');
  const loop = now => { raf = requestAnimationFrame(loop); const dt = (now - last) / 1000; last = now; if (playing) { T += dt; if (T >= total) T = 0; sl.value = T; } drawTemplate(c, t, T, TV && TV.texts || texts, TV && TV.els || els); tt.textContent = T.toFixed(1) + 's'; };
  pb.onclick = () => { playing = !playing; pb.innerHTML = ic(playing ? 'pause' : 'play', 14); if (TV && TV.els) Object.values(TV.els).forEach(v => v.play && (playing ? v.play() : v.pause())); };
  sl.oninput = () => { T = +sl.value; };
  raf = requestAnimationFrame(loop); Nav.cleanups.push(() => cancelAnimationFrame(raf));
}
ACT.useTpl = el => go('template/' + el.dataset.id + '/use');
ACT.expTpl = el => { const t = allTemplates().find(x => x.id === el.dataset.id); dl(new Blob([JSON.stringify({ vtpl: 1, ...t, mine: undefined })], { type: 'application/json' }), t.name + '.vtpl'); toast(L('تم تنزيل ملف القالب', 'Template file downloaded')); };
ACT.delTpl = async el => { if (await confirmBox(L('حذف هذا القالب؟', 'Delete this template?'), L('حذف', 'Delete'), true)) { userTemplates.remove(el.dataset.id); go('templates'); } };
function pageTemplateUse(t) {
  TV = { tpl: t, files: {}, texts: {}, els: {}, urls: [] }; t.texts.forEach(x => TV.texts[x.id] = x.def);
  Nav.cleanups.push(() => { TV && TV.urls.forEach(u => URL.revokeObjectURL(u)); TV = null; });
  $('#page').innerHTML = `<div class="pg-h"><button class="btn2 ghost sm" data-act="back" data-id="${t.id}">${ic('back', 16)} ${esc(t.name)}</button><h1 style="font-size:20px">${L('تخصيص القالب', 'Customise template')}</h1></div>
  <div class="tpl-layout"><div class="tpl-prev"><canvas id="tpc"></canvas><div class="ctl"><button class="btn2 sm" id="tpp">${ic('pause', 14)}</button><input type="range" id="tps" min="0" max="${tplTotal(t)}" step="0.01" value="0"><span id="tpt" style="font-size:12px;direction:ltr">0.0s</span></div></div>
   <div><div class="sec-h" style="margin-top:0"><h3>${L('الوسائط', 'Media')}</h3><div class="sp"></div><button class="btn2 sm" data-act="batchFill">${ic('upload', 14)} ${L('استبدال دفعة واحدة', 'Batch replace')}</button></div><div id="slots"></div>
   ${t.texts.length ? `<div class="sec-h"><h3>${L('النصوص', 'Texts')}</h3></div>${t.texts.map(x => `<div class="fld"><label>${esc(x.label)}</label><input data-text="${x.id}" value="${esc(x.def)}"></div>`).join('')}` : ''}
   <div class="sec-h"><h3>${L('المشروع', 'Project')}</h3></div><div class="fld"><label>${L('اسم المشروع', 'Project name')}</label><input id="tuName" value="${esc(t.name)}"></div>
   <div class="row2" style="justify-content:flex-start"><button class="btn2 pri" id="tuGo" data-act="tuCreate">${ic('check', 18)} ${L('إنشاء المشروع والتحرير', 'Create project and edit')}</button></div>
   <p class="hint">${L('الأماكن الفارغة تُملأ بخلفية متدرجة ويمكنك استبدالها لاحقاً في المحرر.', 'Empty slots get a gradient placeholder; you can replace them later in the editor.')}</p></div></div>`;
  drawSlots(); startPreview(t, TV.texts, TV.els);
  $$('[data-text]').forEach(i => i.oninput = () => { TV.texts[i.dataset.text] = i.value; });
}
ACT.back = el => go('template/' + el.dataset.id);
function drawSlots() {
  const t = TV.tpl; $('#slots').innerHTML = t.slots.map((s, i) => { const f = TV.files[s.id]; return `<div class="slot"><div class="sth" style="${f && f.type.startsWith('image') ? `background-image:url(${TV.urls[TV.idx && TV.idx[s.id]] || ''})` : ''}">${f ? (f.type.startsWith('video') ? '🎞' : '') : (i + 1)}</div><div class="si"><b>${esc(s.label)}</b><small>${f ? esc(f.name) + ' • ' + fmtSize(f.size) : L('بدون ملف (خلفية افتراضية)', 'No file (default background)')}${s.kind !== 'any' ? ' • ' + (s.kind === 'video' ? L('فيديو', 'video') : L('صورة', 'image')) : ''}</small></div><button class="btn2 sm" data-act="slotPick" data-s="${s.id}">${f ? L('استبدال', 'Replace') : L('اختيار', 'Choose')}</button>${f ? `<button class="btn2 sm ghost" data-act="slotClear" data-s="${s.id}">✕</button>` : ''}</div>`; }).join('');
}
function setSlotFile(slot, f) {
  const sl = TV.tpl.slots.find(x => x.id === slot); if (!sl) return; const isV = f.type.startsWith('video'), isI = f.type.startsWith('image');
  if (!isV && !isI) return toast(L('نوع الملف غير مدعوم', 'Unsupported file type'));
  if (sl.kind === 'video' && !isV) return toast(L('هذا المكان يقبل فيديو فقط', 'This slot accepts video only')); if (sl.kind === 'image' && !isI) return toast(L('هذا المكان يقبل صوراً فقط', 'This slot accepts images only'));
  const url = URL.createObjectURL(f); TV.urls.push(url); TV.idx = TV.idx || {}; TV.idx[slot] = TV.urls.length - 1; TV.files[slot] = f;
  if (TV.els[slot] && TV.els[slot].pause) TV.els[slot].pause();
  let el; if (isV) { el = document.createElement('video'); el.muted = true; el.loop = true; el.playsInline = true; el.src = url; el.play().catch(() => {}); } else { el = new Image(); el.src = url; }
  TV.els[slot] = el;
}
ACT.slotPick = el => { const i = h('input'); i.type = 'file'; i.accept = 'image/*,video/*'; i.onchange = () => { if (i.files[0]) { setSlotFile(el.dataset.s, i.files[0]); drawSlots(); } }; i.click(); };
ACT.slotClear = el => { delete TV.files[el.dataset.s]; delete TV.els[el.dataset.s]; drawSlots(); };
ACT.batchFill = () => { const i = h('input'); i.type = 'file'; i.multiple = true; i.accept = 'image/*,video/*'; i.onchange = () => { const files = [...i.files]; let k = 0; for (const s of TV.tpl.slots) { const f = files.find((q, j) => j >= k && (s.kind === 'any' || q.type.startsWith(s.kind))); if (f) { k = files.indexOf(f) + 1; setSlotFile(s.id, f); } } drawSlots(); toast(L('تم توزيع الملفات على الأماكن بالترتيب', 'Files assigned to slots in order')); }; i.click(); };
ACT.tuCreate = async el => {
  el.disabled = true; const bs = busy(L('إنشاء المشروع من القالب…', 'Building project from template…'));
  try { const p = await buildTemplateProject(TV.tpl, TV.files, TV.texts, ($('#tuName').value || '').trim()); Object.assign(p, { owner: Auth.owner, created: Date.now(), updated: Date.now(), dur: tplTotal(TV.tpl), thumb: null }); await Proj.put(p); bs.done(); toast(L('تم إنشاء المشروع — عدّل ثم صدّر', 'Project created — edit and export')); go('editor/' + p.id); }
  catch (e) { bs.done(); el.disabled = false; toast(L('فشل الإنشاء: ', 'Failed: ') + e.message, 5000); }
};

/* ---------------- الإعدادات ---------------- */
let setSec = 'account';
const SECS = [['account', 'user', 'الحساب', 'Account'], ['language', 'template', 'اللغة', 'Language'], ['appearance', 'eye', 'المظهر', 'Appearance'], ['notifs', 'star', 'الإشعارات', 'Notifications'], ['privacy', 'cloud', 'الخصوصية', 'Privacy'], ['security', 'gear', 'الأمان', 'Security'], ['storage', 'folder', 'التخزين', 'Storage'], ['project', 'edit', 'إعدادات المشاريع', 'Project settings'], ['export', 'download', 'إعدادات التصدير', 'Export settings'], ['help', 'search', 'المساعدة والدعم', 'Help & support'], ['about', 'home', 'معلومات التطبيق', 'About'], ['logout', 'logout', 'تسجيل الخروج', 'Log out']];
const sw = (key, checked) => `<label class="sw"><input type="checkbox" data-set="${key}" ${checked ? 'checked' : ''}><i></i></label>`;
function srow(title, sub, ctl) { return `<div class="srow"><div class="si"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div>${ctl || ''}</div>`; }
const selc = (key, opts, val, num) => `<select data-set="${key}" ${num ? 'data-num="1"' : ''}>${opts.map(([v, n]) => `<option value="${v}" ${String(v) === String(val) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
async function pageSettings(args) {
  if (args && args[0]) setSec = args[0];
  const u = Auth.user;
  $('#page').innerHTML = `<div class="pg-h"><h1>${L('الإعدادات', 'Settings')}</h1></div><div class="set-layout"><div class="set-nav">${SECS.map(([k, i, a, e]) => `<button class="nav ${setSec === k ? 'on' : ''}" data-act="setSec" data-k="${k}">${ic(i, 18)}<span>${L(a, e)}</span></button>`).join('')}</div><div class="set-panel" id="setp"></div></div>`;
  const P = $('#setp'), T = x => x;
  const ex = SET.exp;
  switch (setSec) {
    case 'account': P.innerHTML = `<h2>${L('إعدادات الحساب', 'Account settings')}</h2>${u ? srow(esc(u.name), esc(u.email) + ' • ' + L('طريقة التسجيل: ', 'Sign-up: ') + u.provider, `<button class="btn2 sm" data-act="nav" data-p="profile">${L('الملف الشخصي', 'Profile')}</button>`) : srow(L('ضيف', 'Guest'), L('لا حساب — مشاريعك محلية', 'No account — projects are local'), `<button class="btn2 pri sm" data-act="toAuth">${L('تسجيل الدخول', 'Log in')}</button>`)}
      <h3 style="margin:20px 0 4px">${L('تسجيل الدخول الخارجي (OAuth)', 'Social login (OAuth)')}</h3><p class="hint">${L('معرّفات التطبيقات الرسمية من لوحات مطوري Google وFacebook. لا تُخزَّن كلمات مرور تلك الخدمات.', 'Official app IDs from the Google/Facebook developer consoles. No passwords of those services are stored.')}</p>
      ${srow('Google Client ID', '', `<input type="text" data-set="gClient" value="${esc(SET.gClient)}" dir="ltr" placeholder="xxxx.apps.googleusercontent.com">`)}${srow('Facebook App ID', '', `<input type="text" data-set="fbApp" value="${esc(SET.fbApp)}" dir="ltr" placeholder="1234567890">`)}`; break;
    case 'language': P.innerHTML = `<h2>${L('اللغة', 'Language')}</h2>${srow(L('لغة الواجهة', 'Interface language'), L('تؤثر على الشاشات والقوائم الرئيسية. واجهة المحرر عربية في هذه النسخة.', 'Applies to screens and main menus. The editor panel is Arabic in this version.'), selc('lang', [['ar', 'العربية'], ['en', 'English']], SET.lang))}`; break;
    case 'appearance': P.innerHTML = `<h2>${L('المظهر', 'Appearance')}</h2>${srow(L('السمة', 'Theme'), '', selc('theme', [['dark', L('داكنة', 'Dark')], ['light', L('فاتحة', 'Light')], ['auto', L('حسب النظام', 'System')]], SET.theme))}${srow(L('اللون الرئيسي', 'Accent colour'), '', `<div class="swatch">${['#2ee6d0', '#ff3d71', '#6c5ce7', '#f5a524', '#3b82f6', '#22c55e'].map(c => `<button data-act="accent" data-c="${c}" class="${SET.accent === c ? 'on' : ''}" style="background:${c}"></button>`).join('')}</div>`)}`; break;
    case 'notifs': P.innerHTML = `<h2>${L('الإشعارات', 'Notifications')}</h2>${srow(L('رسائل التنبيه داخل التطبيق', 'In-app messages'), L('إظهار رسائل النجاح والأخطاء المنبثقة', 'Show pop-up success and error messages'), sw('notif', SET.notif))}${srow(L('إشعار النظام عند اكتمال التصدير', 'System notification when export finishes'), (typeof Notification === 'undefined' ? L('غير مدعوم في هذا المتصفح', 'Not supported in this browser') : L('الحالة: ', 'Status: ') + Notification.permission), sw('osNotif', SET.osNotif))}`; break;
    case 'privacy': P.innerHTML = `<h2>${L('الخصوصية', 'Privacy')}</h2><p class="hint">${L('ملفاتك ومشاريعك لا تغادر جهازك. الاستثناءات: تحميل الخطوط العربية من Google Fonts، ونماذج الذكاء الاصطناعي (Whisper/TTS/Swin2SR) من Hugging Face عند أول استخدام لها، وتسجيل الدخول الخارجي إن فعّلته.', 'Your files and projects never leave your device. Exceptions: Arabic fonts from Google Fonts, AI models (Whisper/TTS/Swin2SR) from Hugging Face on first use, and social login if you enable it.')}</p>
      ${srow(L('تنزيل بياناتي', 'Download my data'), L('الحساب (بدون كلمات المرور) والإعدادات وقائمة المشاريع والقوالب بصيغة JSON', 'Account (no passwords), settings, project list and templates as JSON'), `<button class="btn2 sm" data-act="dlData">${ic('download', 14)}</button>`)}
      ${srow(L('حذف قوالبي', 'Delete my templates'), '', `<button class="btn2 sm danger" data-act="clrTpl">${ic('trash', 14)}</button>`)}${srow(L('حذف كل مشاريعي', 'Delete all my projects'), L('لا يمكن التراجع', 'Cannot be undone'), `<button class="btn2 sm danger" data-act="clrProj">${ic('trash', 14)}</button>`)}`; break;
    case 'security': P.innerHTML = `<h2>${L('الأمان', 'Security')}</h2>${u ? `${u.hash ? srow(L('تغيير كلمة المرور', 'Change password'), '', `<button class="btn2 sm" data-act="chPw">${ic('edit', 14)}</button>`) : ''}${u.hash ? srow(L('رمز الاستعادة', 'Recovery code'), L('إنشاء رمز جديد يُبطل القديم', 'Generating a new one invalidates the old'), `<button class="btn2 sm" data-act="newRec">${L('إنشاء رمز جديد', 'Generate new')}</button>`) : ''}${srow(L('تشفير كلمات المرور', 'Password hashing'), 'PBKDF2-SHA256 • 150,000 ' + L('تكرار مع ملح عشوائي', 'iterations, random salt'), '')}${srow(L('حماية من التخمين', 'Brute-force protection'), L('قفل 30 ثانية بعد 5 محاولات خاطئة', '30-second lock after 5 wrong attempts'), '')}${srow(L('حذف الحساب', 'Delete account'), L('يحذف الحساب ومشاريعه نهائياً', 'Permanently deletes the account and its projects'), `<button class="btn2 sm danger" data-act="delAcct">${ic('trash', 14)}</button>`)}` : `<p class="hint">${L('سجّل الدخول لإدارة الأمان.', 'Log in to manage security.')}</p>`}<p class="hint">${L('ملاحظة: الحسابات محلية على هذا المتصفح؛ لا يوجد خادم، فلا مزامنة بين الأجهزة.', 'Note: accounts are local to this browser; there is no server and so no cross-device sync.')}</p>`; break;
    case 'storage': { P.innerHTML = `<h2>${L('التخزين', 'Storage')}</h2><div id="stg">${L('جارٍ الحساب…', 'Calculating…')}</div>`; storageInfo(); break; }
    case 'project': P.innerHTML = `<h2>${L('إعدادات المشاريع', 'Project settings')}</h2>${srow(L('نسبة العرض الافتراضية', 'Default aspect ratio'), L('للمشاريع الجديدة', 'For new projects'), selc('defRatio', ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'].map(r => [r, r]), SET.defRatio))}${srow(L('الحفظ التلقائي', 'Autosave'), L('حفظ المشروع بعد كل تعديل', 'Save after every edit'), sw('autosave', SET.autosave))}${srow(L('الالتصاق بحواف المقاطع', 'Snap to clip edges'), '', sw('snap', SET.snap))}${srow(L('عرض الموجات الصوتية', 'Show audio waveforms'), '', sw('wave', SET.wave))}`; break;
    case 'export': P.innerHTML = `<h2>${L('إعدادات التصدير', 'Export settings')}</h2><p class="hint">${L('تُستخدم كقيم افتراضية في نافذة التصدير داخل المحرر.', 'Used as defaults in the editor’s export dialog.')}</p>${srow(L('الدقة', 'Resolution'), '', selc('exp.short', [[480, '480p'], [720, '720p'], [1080, '1080p'], [1440, '2K'], [2160, '4K']], ex.short, true))}${srow(L('معدل الإطارات', 'Frame rate'), '', selc('exp.fps', [[24, '24'], [25, '25'], [30, '30'], [60, '60']], ex.fps, true))}${srow(L('الجودة', 'Quality'), '', selc('exp.q', [[.5, L('منخفضة', 'Low')], [1, L('متوسطة', 'Medium')], [1.8, L('عالية', 'High')], [3, L('أعلى', 'Best')]], ex.q, true))}`; break;
    case 'help': P.innerHTML = `<h2>${L('المساعدة والدعم', 'Help & support')}</h2><h3>${L('اختصارات المحرر', 'Editor shortcuts')}</h3><table class="kbd">${[['Space', L('تشغيل / إيقاف', 'Play / pause')], ['S', L('تقسيم عند المؤشر', 'Split at playhead')], ['Delete', L('حذف المحدد', 'Delete selected')], ['Ctrl+Z / Ctrl+Y', L('تراجع / إعادة', 'Undo / redo')], ['Ctrl+D', L('تكرار', 'Duplicate')], ['← / →', L('إطار واحد', 'One frame')], ['Shift + ' + L('نقر', 'click'), L('تحديد متعدد', 'Multi-select')], ['Ctrl + ' + L('عجلة', 'wheel'), L('تكبير الخط الزمني', 'Zoom timeline')]].map(([k, d]) => `<tr><td><kbd>${k}</kbd></td><td>${d}</td></tr>`).join('')}</table>
      <h3 style="margin-top:20px">${L('أسئلة شائعة', 'FAQ')}</h3>
      <details class="faq"><summary>${L('أين تُحفظ مشاريعي؟', 'Where are my projects saved?')}</summary><p>${L('داخل متصفحك (IndexedDB) على هذا الجهاز. لنقلها: تصدير ملف المشروع ثم استيراده.', 'In your browser (IndexedDB) on this device. To move them: export the project file then import it.')}</p></details>
      <details class="faq"><summary>${L('نسيت كلمة المرور', 'I forgot my password')}</summary><p>${L('استخدم «نسيت كلمة المرور» مع رمز الاستعادة الذي حصلت عليه عند إنشاء الحساب. بدونه لا يمكن الاستعادة لأنه لا يوجد خادم.', 'Use “Forgot password” with the recovery code you got at sign-up. Without it recovery is impossible because there is no server.')}</p></details>
      <details class="faq"><summary>${L('لماذا لا تعمل أدوات الذكاء الاصطناعي؟', 'Why do AI tools not work?')}</summary><p>${L('شغّل التطبيق عبر خادم (python3 -m http.server) لا بفتح الملف مباشرة، وتأكد من الاتصال بالإنترنت عند أول استخدام للترجمة/النص إلى صوت.', 'Run the app through a server (python3 -m http.server), not by opening the file directly, and be online the first time you use captions/text-to-speech.')}</p></details>
      <details class="faq"><summary>${L('كيف أستخدم قالباً؟', 'How do I use a template?')}</summary><p>${L('القوالب ← اختر قالباً ← استخدام القالب ← استبدل الوسائط وعدّل النصوص ← إنشاء المشروع ← صدّر.', 'Templates → pick one → Use template → replace media, edit text → Create project → export.')}</p></details>
      <div class="row2" style="justify-content:flex-start;margin-top:16px"><button class="btn2" data-act="resetOb">${L('إعادة عرض الترحيب', 'Replay welcome')}</button><button class="btn2 danger" data-act="resetSet">${L('استعادة الإعدادات الافتراضية', 'Reset settings')}</button></div>`; break;
    case 'about': P.innerHTML = `<h2>${L('معلومات التطبيق', 'About')}</h2>${srow('كليبو / Clipo', L('الإصدار 1.0 — تطبيق مستقل لمونتاج الفيديو يعمل في المتصفح', 'Version 1.0 — standalone in-browser video editor'), '')}<p class="hint">${L('هذا مشروع مستقل مستوحى وظيفياً من تطبيقات المونتاج الشائعة، وليس منتجاً لأي شركة منها ولا مرتبطاً بها، ولا يستخدم شيفرتها أو علامتها أو أصولها.', 'An independent project functionally inspired by popular editing apps; not affiliated with any of them and using none of their code, brand or assets.')}</p>
      <h3>${L('المكتبات والتراخيص', 'Libraries & licences')}</h3><table class="kbd">${[['MediaPipe Tasks Vision', 'Apache-2.0'], ['Transformers.js / ONNX Runtime Web', 'Apache-2.0 / MIT'], ['نماذج MediaPipe (tflite)', 'Apache-2.0'], ['Cairo, Tajawal, Amiri, …', 'SIL OFL']].map(([a, b]) => `<tr><td>${a}</td><td dir="ltr">${b}</td></tr>`).join('')}</table>`; break;
    case 'logout': P.innerHTML = `<h2>${L('تسجيل الخروج', 'Log out')}</h2><p class="hint">${L('تبقى مشاريعك محفوظة على هذا الجهاز.', 'Your projects stay saved on this device.')}</p><button class="btn2 danger" data-act="doLogoutBtn">${ic('logout', 16)} ${L('تسجيل الخروج', 'Log out')}</button>`; break;
  }
}
ACT.setSec = el => { setSec = el.dataset.k; pageSettings(); };
ACT.doLogoutBtn = doLogout;
ACT.accent = el => { SET.accent = el.dataset.c; saveSet(); applySettings(); pageSettings(); };
document.addEventListener('change', async e => {
  const el = e.target.closest && e.target.closest('[data-set]'); if (!el) return;
  const key = el.dataset.set, v = el.type === 'checkbox' ? el.checked : (el.dataset.num ? +el.value : el.value.trim ? el.value : el.value);
  const path = key.split('.'); let o = SET; while (path.length > 1) o = o[path.shift()]; o[path[0]] = typeof v === 'string' && ['gClient', 'fbApp'].includes(key) ? v.trim() : v;
  if (key === 'osNotif' && v) { if (typeof Notification === 'undefined') { SET.osNotif = false; toast(L('غير مدعوم', 'Not supported')); } else { const r = await Notification.requestPermission(); if (r !== 'granted') { SET.osNotif = false; toast(L('لم يُمنح الإذن', 'Permission denied')); } } }
  saveSet(); applySettings();
  if (key === 'lang') { frameBuilt = false; buildFrame(); route(); } else if (['osNotif', 'theme'].includes(key)) pageSettings();
  if (key === 'snap' || key === 'wave') renderTimeline(); toast(L('تم حفظ الإعداد', 'Setting saved'), 1200);
});
async function storageInfo() {
  const all = await Proj.all(), tot = all.reduce((a, p) => a + Proj.size(p), 0); let est = null; try { est = await navigator.storage.estimate(); } catch (e) {}
  const pct = est && est.quota ? Math.min(100, (est.usage || 0) / est.quota * 100) : 0;
  $('#stg').innerHTML = `${est ? `<b>${fmtSize(est.usage || 0)}</b> ${L('من', 'of')} ${fmtSize(est.quota || 0)} (${pct.toFixed(1)}%)<div class="bar"><i style="width:${Math.max(1, pct)}%"></i></div>` : ''}${srow(L('مشاريعي (وسائط)', 'My projects (media)'), all.length + ' ' + L('مشروع', 'projects'), `<b>${fmtSize(tot)}</b>`)}
  ${all.sort((a, b) => Proj.size(b) - Proj.size(a)).slice(0, 8).map(p => srow(esc(p.name) + (p.deleted ? ' 🗑' : ''), '', fmtSize(Proj.size(p)))).join('')}
  <div class="row2" style="justify-content:flex-start;margin-top:14px"><button class="btn2 danger sm" data-act="emptyTrash2">${L('إفراغ المحذوفات', 'Empty trash')}</button></div>`;
}
ACT.emptyTrash2 = async () => { const t = (await Proj.all()).filter(p => p.deleted); for (const p of t) await Proj.del(p.id); toast(L('تم حذف ', 'Deleted ') + t.length); storageInfo(); };
ACT.dlData = async () => { const u = Auth.user, all = await Proj.all(); const d = { exported: new Date().toISOString(), account: u ? { name: u.name, email: u.email, provider: u.provider, created: u.created } : null, settings: SET, projects: all.map(p => ({ id: p.id, name: p.name, ratio: p.ratio, created: p.created, updated: p.updated, clips: (p.clips || []).length, mediaBytes: Proj.size(p), deleted: !!p.deleted })), templates: userTemplates.list() }; dl(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }), 'my-data.json'); };
ACT.clrTpl = async () => { if (await confirmBox(L('حذف كل قوالبك؟', 'Delete all your templates?'), L('حذف', 'Delete'), true)) { userTemplates.save([]); toast(L('تم الحذف', 'Deleted')); } };
ACT.clrProj = async () => { if (await confirmBox(L('حذف كل مشاريعك نهائياً؟', 'Delete ALL your projects permanently?'), L('حذف الكل', 'Delete all'), true)) { for (const p of await Proj.all()) await Proj.del(p.id); toast(L('تم الحذف', 'Deleted')); } };
ACT.resetOb = () => { STO.set('ve-onboarded', false); onboard(0); };
ACT.resetSet = async () => { if (await confirmBox(L('استعادة كل الإعدادات الافتراضية؟', 'Reset all settings?'), L('استعادة', 'Reset'))) { SET = { ...SETDEF, exp: { ...SETDEF.exp } }; saveSet(); applySettings(); frameBuilt = false; buildFrame(); pageSettings(); } };
ACT.chPw = () => { let a, b; modal(L('تغيير كلمة المرور', 'Change password'), body => { body.innerHTML = `<div class="fld"><label>${L('الحالية', 'Current')}</label><input type="password" id="cp1"></div><div class="fld"><label>${L('الجديدة', 'New')}</label><input type="password" id="cp2"></div><div class="err" id="cpe"></div>`; a = $('#cp1', body); b = $('#cp2', body); }, [[L('إلغاء', 'Cancel'), m => m.remove()], [L('تغيير', 'Change'), async m => { try { await Auth.changePassword(a.value, b.value); m.remove(); toast(L('تم تغيير كلمة المرور', 'Password changed')); } catch (e) { $('#cpe', m).textContent = e.msg || e.message; } }, 'primary']]); };
ACT.newRec = async () => { if (await confirmBox(L('إنشاء رمز جديد سيُبطل القديم.', 'A new code invalidates the old one.'), L('متابعة', 'Continue'))) showRecovery(await Auth.newRecovery(), false); };
ACT.delAcct = async () => { if (await confirmBox(L('حذف الحساب وكل مشاريعه نهائياً؟', 'Delete the account and all its projects permanently?'), L('حذف الحساب', 'Delete account'), true)) { for (const p of await Proj.all()) await Proj.del(p.id); const all = Users.all(); delete all[Auth.user.id]; Users.save(all); Auth.logout(); frameBuilt = false; toast(L('تم حذف الحساب', 'Account deleted')); authChoose(); } };

/* ---------------- الملف الشخصي ---------------- */
async function pageProfile() {
  const u = Auth.user;
  if (!u) { $('#page').innerHTML = `<div class="empty"><big>👤</big><b>${L('لا ملف شخصي في وضع الضيف', 'No profile in guest mode')}</b><br>${L('سجّل الدخول أو أنشئ حساباً لإدارة ملفك الشخصي.', 'Log in or create an account to manage your profile.')}<br><br><button class="btn2 pri" data-act="toAuth">${L('تسجيل الدخول', 'Log in')}</button></div>`; return; }
  const all = await Proj.all(), st = STO.get('ve-stats', { exports: 0 });
  $('#page').innerHTML = `<div class="pg-h"><h1>${L('الملف الشخصي', 'Profile')}</h1></div>
  <div class="prof"><div class="avatar lg">${avatarInner(u)}</div><div style="flex:1;min-width:240px"><h2 style="margin:0">${esc(u.name)}</h2><div style="color:var(--mut)">${esc(u.email)}</div><div style="color:var(--mut);font-size:12px;margin-top:4px">${L('عضو منذ ', 'Member since ')}${fmtDate(u.created)} • ${L('طريقة التسجيل: ', 'Sign-up: ')}${u.provider}</div>
   <div class="row2" style="justify-content:flex-start;margin-top:14px"><button class="btn2 sm" data-act="editProfile">${ic('edit', 14)} ${L('تعديل الملف', 'Edit profile')}</button><button class="btn2 sm ghost" data-act="pickAvatar">${ic('upload', 14)} ${L('تغيير الصورة', 'Change photo')}</button>${u.avatar ? `<button class="btn2 sm ghost" data-act="rmAvatar">${L('إزالة الصورة', 'Remove photo')}</button>` : ''}</div></div></div>
  <div class="stats"><div class="stat"><b>${all.filter(p => !p.deleted).length}</b><small>${L('المشاريع', 'Projects')}</small></div><div class="stat"><b>${st.exports || 0}</b><small>${L('عمليات التصدير', 'Exports')}</small></div><div class="stat"><b>${userTemplates.list().length}</b><small>${L('قوالبي', 'My templates')}</small></div><div class="stat"><b>${fmtSize(all.reduce((a, p) => a + Proj.size(p), 0))}</b><small>${L('الوسائط المخزنة', 'Stored media')}</small></div></div>
  <div class="sec-h" style="margin-top:0"><h3>${L('المحتوى', 'Content')}</h3><div class="sp"></div><button class="btn2 ghost sm" data-act="nav" data-p="projects">${L('كل المشاريع', 'All projects')}</button></div>
  <div class="row-c">${all.filter(p => !p.deleted).sort((a, b) => b.updated - a.updated).slice(0, 6).map(p => projCard(p)).join('') || `<div class="empty" style="flex:1">${L('لا مشاريع بعد', 'No projects yet')}</div>`}</div>
  <div class="sec-h"><h3>${L('الاشتراكات والمزامنة', 'Subscriptions & sync')}</h3></div>
  <div class="banner"><span style="font-size:22px">☁</span><div><b>${L('بلا اشتراكات ولا مزامنة سحابية', 'No subscriptions or cloud sync')}</b><br><small style="color:var(--mut)">${L('كل الميزات مجانية، والبيانات على هذا الجهاز فقط. انقل مشاريعك بين الأجهزة بتصدير/استيراد ملف المشروع.', 'All features are free and data stays on this device. Move projects between devices by exporting/importing the project file.')}</small></div><div class="sp"></div><button class="btn2 sm" data-act="nav" data-p="settings">${L('إعدادات الحساب', 'Account settings')}</button></div>`;
}
ACT.editProfile = async () => { const n = await promptBox(L('الاسم', 'Name'), Auth.user.name); if (n) { Auth.update({ name: n }); frameBuilt = false; buildFrame(); route(); toast(L('تم تحديث الملف', 'Profile updated')); } };
ACT.pickAvatar = () => { const i = h('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => { const f = i.files[0]; if (!f) return; const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 192; const x = c.getContext('2d'), s = Math.min(im.width, im.height); x.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 192, 192); Auth.update({ avatar: c.toDataURL('image/jpeg', .85) }); frameBuilt = false; buildFrame(); route(); toast(L('تم تغيير الصورة', 'Photo updated')); }; im.onerror = () => toast(L('ملف صورة غير صالح', 'Invalid image')); im.src = URL.createObjectURL(f); }; i.click(); };
ACT.rmAvatar = () => { Auth.update({ avatar: '' }); frameBuilt = false; buildFrame(); route(); };

/* ---------------- ربط المحرر ---------------- */
async function openEditorById(id) {
  const p = id && await Proj.get(id);
  if (!p || (p.owner || 'guest') !== Auth.owner || p.deleted) { toast(L('المشروع غير موجود', 'Project not found')); history.replaceState(null, '', '#/projects'); return route(); }
  showView('view-editor'); await loadProject(p); setupEditorChrome(); renderTimeline(); applyRatio(); sync(0, false); render();
}
function setupEditorChrome() {
  const b = $('.brand');
  if (!$('#pname')) {
    b.innerHTML = '<input id="pname" class="pname" spellcheck="false">';
    const t = h('button', '', '⌘ حفظ كقالب'); t.id = 'bTpl'; t.title = 'حفظ المشروع الحالي كقالب قابل لإعادة الاستخدام'; $('#bExport').before(t);
    t.onclick = async () => { const n = await promptBox('اسم القالب', S.name); if (!n) return; const tp = projectToTemplate(n); if (!tp) return toast('أضف مقاطع فيديو أو صوراً إلى المسار الرئيسي أولاً'); userTemplates.add(tp); toast('تم حفظ القالب — تجده في القوالب ← قوالبي'); };
    $('#pname').oninput = e => { S.name = e.target.value; dirty(); };
    $('#pname').onkeydown = e => { if (e.key === 'Enter') e.target.blur(); };
  }
  $('#pname').value = S.name;
}
$('#bProj').onclick = async () => { if (exporting) return toast('انتظر انتهاء التصدير'); pause(); seek(Math.min(total() * .12, 1.5)); await new Promise(r => setTimeout(r, 400)); await saveProject(true); go('home'); };
function onExported(blob) {
  const st = STO.get('ve-stats', { exports: 0 }); st.exports = (st.exports || 0) + 1; STO.set('ve-stats', st);
  if (SET.osNotif && typeof Notification !== 'undefined' && Notification.permission === 'granted') { try { new Notification(L('اكتمل التصدير', 'Export finished'), { body: (S.name || '') + ' — ' + fmtSize(blob.size) }); } catch (e) {} }
}

/* ---------------- الإقلاع ---------------- */
applySettings(); runSplash();
