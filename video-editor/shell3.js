'use strict';
/* ============================================================
   كليبو — تخطيط الهاتف (مستوحى من المرجعين: شاشة البداية + الرئيسية)
   الأدوات، مختبر الذكاء، صندوق الوارد، البحث، تحديد المشاريع، شريط التبويبات
   ============================================================ */
Object.assign(IC, {
  cut: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12',
  photo: 'M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 16l-5-5-8 9',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  cc: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM10 10.5a2 2 0 1 0 0 3M17 10.5a2 2 0 1 0 0 3',
  grid4: 'M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z', cover: 'M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM9 15l3-3 3 3M9 8h6',
  desktop: 'M3 4h18v12H3zM8 20h8M12 16v4', wand: 'M4 20L16 8M14 4v3M18 6h3M19 11v3M5 8h3', text: 'M4 7V4h16v3M9 20h6M12 4v16',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0', lab: 'M9 3h6M10 3v6L4 19a2 2 0 0 0 1.7 3h12.6A2 2 0 0 0 20 19l-6-10V3',
  manage: 'M3 6h14M3 12h10M3 18h7M15 20l6-6 1.5 1.5-6 6H15z', diamond: 'M6 3h12l4 6-10 12L2 9z', hex: 'M12 2.5l8 4.5v10l-8 4.5-8-4.5V7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  face: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01', scan: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 12h8',
  mic: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM19 11a7 7 0 0 1-14 0M12 18v3', video: 'M3 6h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3zM16 10l5-3v10l-5-3',
  tpl2: 'M8 4h12v16H8zM4 7v10M22 7v10',
});
const isMobile = () => matchMedia('(max-width:700px)').matches;
matchMedia('(max-width:700px)').addEventListener('change', () => { if ($('#v-main').classList.contains('on')) { frameBuilt = false; route(); } });

/* ---------------- صندوق الوارد ---------------- */
const Inbox = {
  key: () => 've-inbox-' + Auth.owner, list() { return STO.get(this.key(), []); },
  add(title, body, kind) { const a = this.list(); a.unshift({ id: uid(), t: Date.now(), title, body, kind: kind || 'info', read: false }); STO.set(this.key(), a.slice(0, 100)); updateBadge(); },
  unread() { return this.list().filter(x => !x.read).length; },
  markAll() { STO.set(this.key(), this.list().map(x => ({ ...x, read: true }))); updateBadge(); }, clear() { STO.set(this.key(), []); updateBadge(); },
};
function updateBadge() { const n = Inbox.unread(), b = $('#tabbar .badge'); if (b) { b.textContent = n > 9 ? '9+' : n; b.hidden = !n; } }
function welcomeOnce() { const k = 've-welcomed-' + Auth.owner; if (!STO.get(k, false)) { STO.set(k, true); Inbox.add(L('أهلاً بك في كليبو 👋', 'Welcome to Clipo 👋'), L('ابدأ بمشروع جديد أو جرّب قالباً جاهزاً. ستظهر هنا إشعارات التصدير والمشاريع.', 'Start a new project or try a template. Export and project notifications appear here.'), 'welcome'); } }

/* ---------------- مساعدات الوسائط والمشاريع ---------------- */
function pickFiles(accept, multiple) {
  return new Promise(res => { const i = h('input'); i.type = 'file'; i.accept = accept; i.multiple = !!multiple; i.style.display = 'none'; document.body.append(i); i.onchange = () => { const f = [...i.files]; i.remove(); res(f); }; i.addEventListener('cancel', () => { i.remove(); res([]); }); i.click(); });
}
async function probe(f) {
  const type = f.type.startsWith('video') ? 'video' : f.type.startsWith('image') ? 'image' : f.type.startsWith('audio') ? 'audio' : null; if (!type) return null;
  const url = URL.createObjectURL(f);
  try {
    if (type === 'image') { const w = await new Promise(r => { const i = new Image(); i.onload = () => r([i.naturalWidth, i.naturalHeight]); i.onerror = () => r([0, 0]); i.src = url; }); return { type, w: w[0], h: w[1], dur: 5 }; }
    const e = document.createElement(type === 'audio' ? 'audio' : 'video'); e.preload = 'metadata'; e.src = url; await new Promise(r => { e.onloadedmetadata = r; e.onerror = r; });
    return { type, w: e.videoWidth || 0, h: e.videoHeight || 0, dur: isFinite(e.duration) ? e.duration : 5 };
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1500); }
}
function pickRatio(w, hh) { if (!w || !hh) return [16, 9]; const a = Math.log(w / hh); return [[16, 9], [9, 16], [1, 1], [4, 3], [3, 4]].sort((x, y) => Math.abs(Math.log(x[0] / x[1]) - a) - Math.abs(Math.log(y[0] / y[1]) - a))[0]; }
async function makeProject(files, opt = {}) {
  const infos = []; for (const f of files) { const i = await probe(f); if (i) infos.push({ f, ...i }); }
  if (!infos.length) throw new Error(L('لا توجد ملفات مدعومة', 'No supported files'));
  const first = infos.find(i => i.type !== 'audio') || infos[0], ratio = opt.ratio || pickRatio(first.w, first.h), media = [], clips = [], cyc = ['fade', 'slideL', 'zoom', 'wipe', 'slideR', 'blur'];
  let t = 0, n = 0;
  for (const i of infos.filter(i => i.type !== 'audio')) {
    const id = uid(); media.push({ id, name: i.f.name, type: i.type, duration: i.dur, blob: i.f });
    const d = i.type === 'image' ? (opt.imgDur || 5) : (opt.auto ? Math.min(i.dur, 4) : i.dur), srcIn = i.type === 'video' && opt.auto && i.dur > 4 ? (i.dur - 4) / 2 : 0;
    clips.push(newClip({ type: i.type, lane: 'v1', mediaId: id, start: t, dur: d, srcIn, name: i.f.name, anim: opt.auto && i.type === 'image' ? 'zoomin' : 'none', trans: opt.auto && n ? { type: cyc[(n - 1) % cyc.length], dur: .5 } : { type: 'none', dur: .6 } })); t += d; n++;
  }
  for (const i of infos.filter(i => i.type === 'audio')) { const id = uid(); media.push({ id, name: i.f.name, type: 'audio', duration: i.dur, blob: i.f }); clips.push(newClip({ type: 'audio', lane: 'a1', mediaId: id, start: 0, dur: t ? Math.min(i.dur, t) : i.dur, name: i.f.name })); }
  (opt.extra || []).forEach(c => clips.push(newClip(c)));
  const p = { id: uid(), name: opt.name || first.f.name.replace(/\.[^.]+$/, ''), ratio, clips, media, lanes: {}, owner: Auth.owner, created: Date.now(), updated: Date.now(), dur: t, thumb: null };
  await Proj.put(p); return p;
}
function launch(p, then) { window.__after = then || null; go('editor/' + p.id); }
const _oe = openEditorById;
openEditorById = async function (id) { await _oe(id); if (window.__after) { const f = window.__after; window.__after = null; setTimeout(() => { try { f(); } catch (e) { console.error(e); } }, 800); } };
const openTab = k => { const b = $(`#tabs [data-tab=${k}]`); if (b) b.click(); };
const firstClip = () => S.clips.find(c => c.lane === 'v1') || S.clips[0];
async function viaFiles(accept, multiple, opt, then) {
  const files = await pickFiles(accept, multiple); if (!files.length) return;
  const bs = busy(L('تجهيز المشروع…', 'Preparing project…'));
  try { const p = await makeProject(files, opt); bs.done(); launch(p, then); } catch (e) { bs.done(); toast(e.message, 4000); }
}
async function blankThen(then, name) { const p = await Proj.create({ name: name || undefined, ratio: SET.defRatio.split(':').map(Number) }); launch(p, then); }

/* ---------------- تعريف الأدوات ---------------- */
const needClip = fn => () => { if (!firstClip()) return toast(L('لا يوجد مقطع', 'No clip')); selectClip(firstClip().id); fn(); };
const TOOLS = {
  newvideo: { ic: 'plus', ar: 'فيديو جديد', en: 'New video', run: () => viaFiles('video/*,image/*,audio/*', true, {}) },
  editphoto: { ic: 'photo', ar: 'تحرير صورة', en: 'Edit photo', run: () => viaFiles('image/*', false, { imgDur: 5 }, () => openTab('filters')) },
  products: { ic: 'tpl2', ar: 'قوالب المنتجات', en: 'Product templates', run: () => { tplCat = 'business'; go('templates'); } },
  textcard: { ic: 'text', ar: 'بطاقة نصية', en: 'Text card', run: () => textCardDialog() },
  autocut: { ic: 'cut', ar: 'قص تلقائي', en: 'AutoCut', run: () => viaFiles('video/*,image/*,audio/*', true, { auto: true, name: L('قص تلقائي', 'AutoCut') }), d: L('يجمع وسائطك تلقائياً: يقصّ المقاطع الطويلة إلى 4 ثوانٍ ويضيف انتقالات ويضع الموسيقى', 'Assembles your media automatically: trims long clips to 4s, adds transitions and puts music underneath') },
  retouch: { ic: 'wand', ar: 'تحسين', en: 'Enhance', run: () => viaFiles('image/*,video/*', false, {}, needClip(() => { autoEnhance(); const c = selClip(); if (c) { c.f.sharp = 1; afterEdit(); renderProps(); } })), d: L('تحليل الإطار وضبط السطوع والتباين والحدة تلقائياً', 'Analyses the frame and auto-adjusts brightness, contrast and sharpness') },
  aigen: { ic: 'sparkle', ar: 'مختبر الذكاء', en: 'AI Lab', run: () => go('ailab') },
  captions: { ic: 'cc', ar: 'ترجمة تلقائية', en: 'Auto captions', run: () => viaFiles('video/*,audio/*', false, {}, needClip(() => captionsDialog())), d: L('تفريغ الكلام إلى ترجمة (Whisper — يحتاج تنزيل النموذج مرة واحدة)', 'Speech to captions (Whisper — one-time model download)') },
  photoeditor: { ic: 'photo', ar: 'محرر الصور', en: 'Photo editor', run: () => viaFiles('image/*', false, { imgDur: 5 }, () => openTab('filters')) },
  cover: { ic: 'cover', ar: 'صانع الأغلفة', en: 'Cover maker', run: () => coverDialog() },
  desktop: { ic: 'desktop', ar: 'المحرر الكامل', en: 'Full editor', run: () => ACT.newProject() },
  all: { ic: 'grid4', ar: 'كل الأدوات', en: 'All tools', run: () => go('tools'), dot: true },
  bgremove: { ic: 'wand', ar: 'إزالة الخلفية', en: 'Remove background', d: L('فصل الشخص عن الخلفية — MediaPipe، محلي بالكامل', 'Separate a person from the background — MediaPipe, fully on-device'), run: () => viaFiles('image/*,video/*', false, {}, needClip(toggleAiBg)) },
  detect: { ic: 'scan', ar: 'التعرف على العناصر', en: 'Object detection', d: L('كشف الأشياء في الإطار — محلي', 'Detect objects in a frame — on-device'), run: () => viaFiles('image/*,video/*', false, {}, needClip(() => detect('object'))) },
  faces: { ic: 'face', ar: 'التعرف على الوجوه', en: 'Face detection', d: L('كشف الوجوه — محلي', 'Detect faces — on-device'), run: () => viaFiles('image/*,video/*', false, {}, needClip(() => detect('face'))) },
  silence: { ic: 'mic', ar: 'قص الصمت', en: 'Silence cutter', d: L('حذف فترات الصمت من تسجيل أو فيديو — محلي', 'Remove silent parts from a recording or video — on-device'), run: () => viaFiles('video/*,audio/*', false, {}, needClip(cutSilence)) },
  tts: { ic: 'mic', ar: 'نص إلى صوت', en: 'Text to speech', d: L('MMS-TTS (يحتاج تنزيل النموذج مرة واحدة)', 'MMS-TTS (one-time model download)'), run: () => blankThen(ttsDialog, L('تعليق صوتي', 'Voice-over')) },
  upscale: { ic: 'sparkle', ar: 'تكبير الصور ×2', en: 'Image upscale ×2', d: L('Swin2SR (يحتاج تنزيل النموذج مرة واحدة)', 'Swin2SR (one-time model download)'), run: () => viaFiles('image/*', false, {}, needClip(upscaleImage)) },
  script: { ic: 'video', ar: 'فيديو من نص', en: 'Script to video', d: L('يحوّل سيناريو إلى مشاهد بنصوص وتعليق اختياري', 'Turns a script into scenes with text and optional narration'), run: () => blankThen(scriptDialog, L('فيديو من نص', 'Script video')) },
};
const tl = k => L(TOOLS[k].ar, TOOLS[k].en);
ACT.tool = el => TOOLS[el.dataset.t].run();

function textCardDialog() {
  let ta, pal = 0; const pals = PALETTES;
  modal(L('بطاقة نصية', 'Text card'), b => {
    ta = h('textarea'); ta.value = L('اكتب نصك هنا', 'Write your text here'); b.append(ta);
    const r = h('div', 'row'); r.append(h('label', '', L('الألوان', 'Colours'))); const s = h('select'); pals.forEach((_, i) => { const o = h('option', '', L('نمط ', 'Style ') + (i + 1)); o.value = i; s.append(o); }); s.onchange = () => pal = +s.value; r.append(s); b.append(r);
  }, [[L('إلغاء', 'Cancel'), m => m.remove()], [L('إنشاء', 'Create'), async m => {
    const text = ta.value.trim(); if (!text) return; m.remove(); const [W, H] = sizeFor(720), c = document.createElement('canvas'); c.width = 1080; c.height = 1080; const x = c.getContext('2d'), g2 = x.createLinearGradient(0, 0, 1080, 1080); g2.addColorStop(0, pals[pal][0]); g2.addColorStop(1, pals[pal][1]); x.fillStyle = g2; x.fillRect(0, 0, 1080, 1080);
    const blob = await new Promise(r => c.toBlob(r, 'image/png')), f = new File([blob], 'card.png', { type: 'image/png' });
    const p = await makeProject([f], { ratio: [1, 1], name: L('بطاقة نصية', 'Text card'), extra: [{ type: 'text', lane: 't', start: 0, dur: 5, text: wrapLines(text, 18), size: 90, anim: 'pop' }] }); launch(p);
  }, 'primary']]);
}
function coverDialog() {
  let rs; modal(L('صانع الأغلفة', 'Cover maker'), b => {
    b.append(h('p', 'hint', L('اختر نسبة الغلاف ثم صورة الخلفية. أضف نصك في المحرر ثم اضغط «📷 صورة» لتصدير الغلاف PNG.', 'Pick the cover ratio then a background image. Add your text in the editor then press “📷 Image” to export the cover as PNG.')));
    rs = h('select'); [['16:9', 'YouTube 16:9'], ['9:16', 'Reels 9:16'], ['1:1', '1:1'], ['4:3', '4:3']].forEach(([v, n]) => { const o = h('option', '', n); o.value = v; rs.append(o); }); rs.style.cssText = 'width:100%;background:var(--p1);border:1px solid var(--bd);border-radius:8px;padding:9px;color:var(--tx)'; b.append(rs);
  }, [[L('إلغاء', 'Cancel'), m => m.remove()], [L('اختيار صورة', 'Choose image'), async m => {
    const ratio = rs.value.split(':').map(Number); m.remove(); const f = await pickFiles('image/*', false); if (!f.length) return;
    const p = await makeProject(f, { ratio, name: L('غلاف', 'Cover'), extra: [{ type: 'text', lane: 't', start: 0, dur: 5, text: L('عنوان الغلاف', 'Cover title'), size: 110, strokeW: 4, anim: 'none' }] }); launch(p);
  }, 'primary']]);
}

/* ---------------- صفحة الرئيسية للهاتف ---------------- */
const tile = k => `<button class="mt" data-act="tool" data-t="${k}"><span class="mti">${ic(TOOLS[k].ic, 26)}${TOOLS[k].dot ? '<i class="rd"></i>' : ''}</span><span>${esc(tl(k))}</span></button>`;
async function mobileHome() {
  const all = (await Proj.all()).filter(p => !p.deleted).sort((a, b) => b.updated - a.updated);
  $('#page').innerHTML = `<div class="m-home">
  <div class="m-top"><button class="plan" data-act="planInfo">${ic('diamond', 18)}<b>${L('قياسي', 'Standard')}</b></button><span class="sp"></span><button class="mi" data-act="goSearch" aria-label="search">${ic('search', 26)}</button><button class="mi" data-act="nav" data-p="settings" aria-label="settings">${ic('hex', 26)}</button></div>
  <div class="m-cards"><button class="mc big" data-act="tool" data-t="newvideo"><span class="mci">${ic('plus', 26)}</span><b>${esc(tl('newvideo'))}</b></button><button class="mc" data-act="tool" data-t="editphoto"><span class="mci">${ic('photo', 26)}</span><b>${esc(tl('editphoto'))}</b></button>
   <div class="mcol"><button class="ms" data-act="tool" data-t="products">${ic('tpl2', 26)}<span>${esc(tl('products'))}</span></button><button class="ms" data-act="tool" data-t="textcard">${ic('text', 26)}<span>${esc(tl('textcard'))}</span></button></div></div>
  <div class="m-grid">${['autocut', 'retouch', 'aigen', 'captions', 'photoeditor', 'cover', 'desktop', 'all'].map(tile).join('')}</div>
  <div class="m-ph"><h2>${L('المشاريع', 'Projects')}</h2><span class="sp"></span><button class="space" data-act="goSpace">${ic('cloud', 18)}<span>Space</span></button><button class="mi" data-act="manage" aria-label="manage">${ic('manage', 24)}</button></div>
  ${all.length ? `<div class="grid-c m-pg">${all.slice(0, 24).map(p => projCard(p)).join('')}</div>` : `<div class="m-empty"><svg width="130" height="100" viewBox="0 0 130 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="96" height="68" rx="10"/><path d="M48 28l22 12-22 12z" fill="var(--p3)" stroke="none"/><path d="M92 62l24 28M116 62L92 90"/><circle cx="90" cy="88" r="7"/><circle cx="118" cy="88" r="7"/></svg><p>${L('ستظهر مشاريعك هنا.<br>ابدأ الإنشاء الآن.', 'Your projects will appear here.<br>Start creating now.')}</p></div>`}
  </div>`;
}
ACT.planInfo = () => modal(L('خطتك', 'Your plan'), b => b.append(h('p', '', L('الخطة: قياسي — مجانية بالكامل. كل الأدوات والقوالب والتصدير بلا اشتراك ولا علامة مائية. (لا توجد ميزات مدفوعة في هذا التطبيق.)', 'Plan: Standard — completely free. All tools, templates and exports with no subscription and no watermark. (There are no paid features in this app.)'))), [[L('حسناً', 'OK'), m => m.remove(), 'primary']]);
ACT.goSearch = () => go('search'); ACT.goSpace = () => go('settings/storage');

/* ---------------- تحديد المشاريع (إدارة) ---------------- */
Nav.manage = false; Nav.picked = new Set();
function manageBar() {
  let b = $('#mbar'); if (!Nav.manage) { if (b) b.remove(); return; }
  if (!b) { b = h('div'); b.id = 'mbar'; document.body.append(b); }
  const n = Nav.picked.size;
  b.innerHTML = `<span>${n} ${L('محدد', 'selected')}</span><span class="sp"></span><button class="btn2 sm" data-act="mDup" ${n ? '' : 'disabled'}>${ic('copy', 16)} ${L('نسخ', 'Duplicate')}</button><button class="btn2 sm danger" data-act="mDel" ${n ? '' : 'disabled'}>${ic('trash', 16)} ${L('حذف', 'Delete')}</button><button class="btn2 sm ghost" data-act="manage">${L('تم', 'Done')}</button>`;
}
ACT.manage = () => { Nav.manage = !Nav.manage; Nav.picked.clear(); manageBar(); document.body.classList.toggle('managing', Nav.manage); renderPage(Nav.page, Nav.args || []); };
const _open = ACT.openProj;
ACT.openProj = (el, e) => { if (Nav.manage) { e.stopPropagation(); const id = el.dataset.id; Nav.picked.has(id) ? Nav.picked.delete(id) : Nav.picked.add(id); el.classList.toggle('picked', Nav.picked.has(id)); manageBar(); return; } _open(el, e); };
ACT.mDel = async () => { const n = Nav.picked.size; if (await confirmBox(L(`نقل ${n} مشروع إلى المحذوفات؟`, `Move ${n} project(s) to trash?`), L('نقل', 'Move'), true)) { for (const id of Nav.picked) await Proj.trash(id); toast(L('تم النقل إلى المحذوفات', 'Moved to trash')); Nav.picked.clear(); manageBar(); renderPage(Nav.page, Nav.args || []); } };
ACT.mDup = async () => { for (const id of Nav.picked) await Proj.duplicate(id); toast(L('تم النسخ', 'Duplicated')); Nav.picked.clear(); manageBar(); renderPage(Nav.page, Nav.args || []); };
const _route = route; route = async function () { if (Nav.manage) { Nav.manage = false; Nav.picked.clear(); manageBar(); document.body.classList.remove('managing'); } await _route(); if (Auth.ready) welcomeOnce(); updateTabbar(); updateBadge(); };

/* ---------------- مختبر الذكاء / كل الأدوات / الوارد / البحث ---------------- */
function toolCard(k) { return `<button class="lab" data-act="tool" data-t="${k}"><span class="mti">${ic(TOOLS[k].ic, 24)}</span><span class="li"><b>${esc(tl(k))}</b><small>${esc(TOOLS[k].d || '')}</small></span></button>`; }
function pageAilab() {
  $('#page').innerHTML = `<div class="pg-h"><h1>${L('مختبر الذكاء', 'AI Lab')}</h1></div><p class="hint">${L('أدوات تعمل داخل متصفحك. اختر أداة، ثم ملفاً، وسيفتح المحرر وينفّذها عليه. تنزيل نماذج Whisper/TTS/Swin2SR يتطلب إنترنت أول مرة فقط.', 'Tools run in your browser. Pick a tool, then a file; the editor opens and runs it. Whisper/TTS/Swin2SR model downloads need internet the first time only.')}</p>
  <div class="labs">${['bgremove', 'detect', 'faces', 'silence', 'captions', 'tts', 'script', 'upscale', 'retouch', 'autocut'].map(toolCard).join('')}</div>
  <div class="banner" style="margin-top:16px"><span>🎯</span><small style="color:var(--mut)">${L('تتبع الحركة: داخل المحرر حدّد ملصقاً أو نصاً ثم افتح تبويب «ذكاء» ← «تتبع الحركة».', 'Motion tracking: inside the editor select a sticker or text then open the “ذكاء” tab → “تتبع الحركة”.')}</small></div>`;
}
function pageTools() {
  const grp = (t, ks) => `<div class="sec-h"><h3>${t}</h3></div><div class="labs">${ks.map(toolCard).join('')}</div>`;
  $('#page').innerHTML = `<div class="pg-h"><h1>${L('كل الأدوات', 'All tools')}</h1></div>` + grp(L('إنشاء', 'Create'), ['newvideo', 'autocut', 'editphoto', 'photoeditor', 'cover', 'textcard', 'desktop']) + grp(L('ذكاء اصطناعي', 'AI'), ['bgremove', 'detect', 'faces', 'silence', 'captions', 'tts', 'script', 'upscale', 'retouch']) + grp(L('مكتبات', 'Libraries'), ['products']);
  $$('.labs .lab small').forEach(s => { if (!s.textContent) s.remove(); });
}
function pageInbox() {
  const a = Inbox.list();
  $('#page').innerHTML = `<div class="pg-h"><h1>${L('الوارد', 'Inbox')}</h1><div class="sp"></div>${a.length ? `<button class="btn2 sm ghost" data-act="inRead">${L('تعليم الكل كمقروء', 'Mark all read')}</button><button class="btn2 sm ghost" data-act="inClear">${L('مسح', 'Clear')}</button>` : ''}</div>
  ${a.length ? a.map(x => `<div class="msg ${x.read ? '' : 'new'}"><span class="mti">${ic(x.kind === 'export' ? 'download' : x.kind === 'tpl' ? 'tpl2' : 'bell', 20)}</span><div class="li"><b>${esc(x.title)}</b><small>${esc(x.body)}</small><small>${fmtDate(x.t)}</small></div></div>`).join('') : `<div class="empty"><big>🔔</big>${L('لا توجد إشعارات', 'No notifications')}</div>`}`;
  setTimeout(() => { Inbox.markAll(); }, 1500);
}
ACT.inRead = () => { Inbox.markAll(); pageInbox(); }; ACT.inClear = () => { Inbox.clear(); pageInbox(); };
async function pageSearch() {
  const all = (await Proj.all()).filter(p => !p.deleted);
  $('#page').innerHTML = `<div class="pg-h"><button class="btn2 ghost sm" data-act="nav" data-p="home">${ic('back', 16)}</button><div class="search" style="flex:1;position:relative"><input id="sq" class="sqi" placeholder="${L('ابحث في المشاريع والقوالب والأدوات…', 'Search projects, templates and tools…')}" value="${esc(Nav.sq || '')}"></div></div><div id="sres"></div>`;
  const draw = () => { const q = ($('#sq').value || '').trim().toLowerCase(); Nav.sq = q; const m = (s) => !q || s.toLowerCase().includes(q);
    const ps = all.filter(p => m(p.name)).slice(0, 12), ts = allTemplates().filter(t => m(t.name + ' ' + t.tags.join(' '))).slice(0, 12), ks = Object.keys(TOOLS).filter(k => m(tl(k) + ' ' + (TOOLS[k].d || ''))).slice(0, 12);
    $('#sres').innerHTML = (ps.length ? `<div class="sec-h"><h3>${L('المشاريع', 'Projects')}</h3></div><div class="grid-c">${ps.map(p => projCard(p)).join('')}</div>` : '') + (ts.length ? `<div class="sec-h"><h3>${L('القوالب', 'Templates')}</h3></div><div class="grid-c">${ts.map(tplCard).join('')}</div>` : '') + (ks.length ? `<div class="sec-h"><h3>${L('الأدوات', 'Tools')}</h3></div><div class="labs">${ks.map(toolCard).join('')}</div>` : '') || `<div class="empty"><big>🔍</big>${L('لا نتائج', 'No results')}</div>`;
    $$('#sres .lab small').forEach(s => { if (!s.textContent) s.remove(); }); drawThumbs(); };
  $('#sq').oninput = draw; draw(); setTimeout(() => $('#sq').focus(), 50);
}

/* ---------------- شريط التبويبات السفلي ---------------- */
const TABS = [['home', 'cut', L => L('تحرير', 'Edit')], ['templates', 'tpl2', L => L('القوالب', 'Templates')], ['ailab', 'lab', L => L('مختبر الذكاء', 'AI Lab')], ['inbox', 'bell', L => L('الوارد', 'Inbox')], ['profile', 'user', L => L('أنا', 'Me')]];
function ensureTabbar() {
  let t = $('#tabbar'); if (!t) { t = h('nav'); t.id = 'tabbar'; $('#v-main').append(t); }
  t.innerHTML = TABS.map(([id, i, f]) => `<button data-act="nav" data-p="${id}" data-tab="${id}">${ic(i, 24)}${id === 'inbox' ? '<i class="badge" hidden></i>' : ''}<span>${esc(f(L))}</span></button>`).join('');
}
function updateTabbar() { ensureTabbar(); $$('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === (Nav.page === 'template' ? 'templates' : Nav.page))); updateBadge(); }

/* ---------------- ربط الصفحات الجديدة والمحرر ---------------- */
const _renderPage = renderPage;
renderPage = function (pg, args) {
  if (['ailab', 'tools', 'inbox', 'search'].includes(pg)) { const P = $('#page'); P.classList.remove('fade-up'); void P.offsetWidth; P.classList.add('fade-up'); return Promise.resolve({ ailab: pageAilab, tools: pageTools, inbox: pageInbox, search: pageSearch }[pg](args)); }
  if (pg === 'home' && isMobile()) { const P = $('#page'); P.classList.remove('fade-up'); void P.offsetWidth; P.classList.add('fade-up'); return mobileHome(); }
  return _renderPage(pg, args);
};
/* الشريط الجانبي: صفحات إضافية */
NAVS.splice(3, 0, ['ailab', 'lab', L => L('مختبر الذكاء', 'AI Lab')], ['inbox', 'bell', L => L('الوارد', 'Inbox')]);
Object.assign(IC, { undo: 'M3 7v6h6M3 13a9 9 0 1 0 3-7', redo: 'M21 7v6h-6M21 13a9 9 0 1 1-3-7', merge: 'M8 6h8M8 18h8M12 6v12', gap: 'M3 12h6M15 12h6M9 8l-4 4 4 4M15 8l4 4-4 4' });
function buildEditorChrome() {
  if ($('#tlbar')) return;
  const bar = h('div'); bar.id = 'tlbar'; $('#timeline').prepend(bar);
  [['bUndo', 'undo', 'تراجع'], ['bRedo', 'redo', 'إعادة'], ['bSplit', 'cut', 'تقسيم'], ['bDup', 'copy', 'تكرار'], ['bMerge', 'merge', 'دمج'], ['bGap', 'gap', 'إغلاق الفراغات'], ['bDel', 'trash', 'حذف']].forEach(([id, i, t]) => { const b = $('#' + id); b.innerHTML = ic(i, 17) + `<span>${t}</span>`; b.title = t; bar.append(b); });
  bar.append(h('span', 'sp')); const zoom = $('#zoom'), z = zoom.closest('label'); z.innerHTML = ic('search', 16) + ' '; z.append(zoom); bar.append(z);
  $('#view-editor header .tools').style.display = 'none';
  const ratio = $('#ratio'); ratio.title = 'نسبة العرض'; $('#transport .sp').after(ratio);
  $('#view-editor header').prepend($('#bProj')); $('#bProj').innerHTML = ic('back', 16) + ' الرئيسية';
  const icons = { media: 'folder', audio: 'mic', text: 'text', stickers: 'star', filters: 'sparkle', fx: 'wand', trans: 'tpl2', ai: 'lab' };
  $$('#tabs button').forEach(b => { const t = b.textContent; b.innerHTML = ic(icons[b.dataset.tab] || 'star', 20) + `<span>${t}</span>`; });
  $('#bPlay').innerHTML = ic('play', 20);
}
const _sce = setupEditorChrome;
setupEditorChrome = function () {
  _sce(); buildEditorChrome();
  if (!$('#bFrame')) {
    const f = h('button', '', '📷 صورة'); f.id = 'bFrame'; f.title = 'تصدير الإطار الحالي كصورة PNG'; $('#bExport').before(f); f.onclick = exportFrame;
    const l = h('button', 'mob', '📚'), p = h('button', 'mob', '🎛'); l.id = 'bLib'; p.id = 'bPr'; l.title = 'المكتبة'; p.title = 'الخصائص'; $('.brand').after(l, p);
    l.onclick = () => { $('#left').classList.toggle('sheet'); $('#right').classList.remove('sheet'); }; p.onclick = () => { $('#right').classList.toggle('sheet'); $('#left').classList.remove('sheet'); };
  }
};
async function exportFrame() {
  if (!S.clips.length) return toast('لا يوجد محتوى');
  pause(); const pw = cv.width, ph = cv.height, ex = exporting, [W, H] = sizeFor(1080); cv.width = W; cv.height = H; exporting = {}; sync(time, false); await new Promise(r => setTimeout(r, 250)); render();
  const blob = await new Promise(r => cv.toBlob(r, 'image/png')); exporting = ex; cv.width = pw; cv.height = ph; render(); dl(blob, (S.name || 'frame') + '.png'); toast('تم تصدير الإطار كصورة (' + W + '×' + H + ')');
}
const _oex = onExported;
onExported = function (blob) { _oex(blob); Inbox.add(L('اكتمل التصدير', 'Export finished'), (S.name || '') + ' — ' + fmtSize(blob.size), 'export'); };
const _tu = ACT.tuCreate;
ACT.tuCreate = async function (el) { const nm = TV ? TV.tpl.name : ''; await _tu(el); Inbox.add(L('تم إنشاء مشروع من قالب', 'Project created from a template'), nm, 'tpl'); };
ensureTabbar(); applySettings();
