'use strict';
/* ============================================================
   محرر الهاتف — شاشة عمودية، لمس، شريط أدوات سفلي، أوراق سفلية
   (يعيد استخدام محرك المحرر نفسه؛ يُفعَّل عندما يقل العرض عن 800px)
   ============================================================ */
const MQ = matchMedia('(max-width:800px)');
function applyMobile() {
  const was = document.body.classList.contains('mobile'); document.body.classList.toggle('mobile', MQ.matches);
  if (MQ.matches && !was) { pps = Math.min(pps, 40); $('#zoom').value = pps; }
  if (MQ.matches !== was && $('#view-editor').classList.contains('on')) { buildMobileEditor(); renderTimeline(); renderMTools(); }
}
MQ.addEventListener('change', applyMobile); applyMobile();

/* ---------------- الأدوات ---------------- */
const openProps = title => { openSheet('right'); setTimeout(() => { const t = $$('#props h4').find(x => x.textContent.includes(title)); if (t) t.scrollIntoView({ block: 'start' }); }, 60); };
function openSheet(side, tab) {
  const other = side === 'left' ? 'right' : 'left'; $('#' + other).classList.toggle('sheet', false); const el = $('#' + side); el.classList.add('sheet');
  if (tab) openTab(tab); const t = el.querySelector('.sheet-t'); if (t) t.textContent = side === 'right' ? (selClip() ? clipLabel(selClip()).slice(0, 24) : 'الخصائص') : 'الأدوات';
}
const closeSheets = () => { $('#left').classList.toggle('sheet', false); $('#right').classList.toggle('sheet', false); };
async function addOverlayMedia() {
  const files = await pickFiles('image/*,video/*', true); for (const f of files) { const type = f.type.startsWith('video') ? 'video' : 'image'; const m = await addMediaFromBlob(f, f.name, type); if (m) addMediaClip(m.id, { lane: 'v2', start: time }); }
}
function formatSheet() {
  modal('نسبة العرض', b => { ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'].forEach(r => { const x = h('button', 'btn', r + (S.ratio.join(':') === r ? '  ✓' : '')); x.onclick = () => { $('#ratio').value = r; $('#ratio').onchange({ target: $('#ratio') }); $$('.modal').forEach(m => m.hidden = true); setTimeout(() => $$('.modal').forEach(m => m.parentNode.removeChild(m)), 0); }; b.append(x); }); }, [['إغلاق', m => { m.hidden = true; m.parentNode.removeChild(m); }]]);
}
const MT = {
  media: ['folder', 'وسائط', () => openSheet('left', 'media')], audio: ['mic', 'صوت', () => openSheet('left', 'audio')], text: ['text', 'نص', () => openSheet('left', 'text')],
  stickers: ['star', 'ملصقات', () => openSheet('left', 'stickers')], overlay: ['plus', 'تراكب', addOverlayMedia], fx: ['wand', 'تأثيرات', () => openSheet('left', 'fx')],
  filters: ['sparkle', 'فلاتر', () => openSheet('left', 'filters')], trans: ['tpl2', 'انتقالات', () => openSheet('left', 'trans')], ai: ['lab', 'ذكاء', () => openSheet('left', 'ai')], format: ['cover', 'نسبة', formatSheet],
  back: ['back', 'رجوع', () => { closeSheets(); selectClip(null); }], split: ['cut', 'تقسيم', () => splitClip()], dup: ['copy', 'تكرار', () => dupClip()], del: ['trash', 'حذف', () => delClip()],
  speed: ['play', 'سرعة', () => openProps('السرعة')], volume: ['mic', 'الصوت', () => openProps('الصوت')], extract: ['mic', 'فصل الصوت', () => extractAudio()],
  adjust: ['gear', 'ضبط', () => openProps('الألوان')], anim: ['wand', 'حركة', () => openSheet('left', 'fx')], transform: ['scan', 'تحويل', () => openProps('التحويل')],
  crop: ['cover', 'اقتصاص', () => openProps('الاقتصاص')], textedit: ['edit', 'تعديل النص', () => openProps('النص')], props: ['gear', 'الخصائص', () => openSheet('right')],
};
function toolsFor(c) {
  if (!c) return ['media', 'audio', 'text', 'stickers', 'overlay', 'fx', 'filters', 'trans', 'ai', 'format'];
  const base = ['back', 'split', 'dup', 'del'];
  return { video: [...base, 'speed', 'volume', 'extract', 'adjust', 'filters', 'anim', 'trans', 'transform', 'crop'], image: [...base, 'adjust', 'filters', 'anim', 'trans', 'transform', 'crop'], audio: [...base, 'volume'], text: ['back', 'textedit', 'split', 'dup', 'del', 'anim', 'transform'], sticker: ['back', 'split', 'dup', 'del', 'anim', 'transform'] }[c.type] || base;
}
function renderMTools() {
  const t = $('#mtools'); if (!t) return;
  t.innerHTML = toolsFor(selClip()).map(k => `<button data-k="${k}">${ic(MT[k][0], 22)}<span>${MT[k][1]}</span></button>`).join(''); t.scrollLeft = 0;
}

/* ---------------- بناء واجهة الهاتف (مرة واحدة) ---------------- */
function buildMobileEditor() {
  if ($('#mtools')) return;
  const ed = $('#view-editor'), tb = h('div'); tb.id = 'mtools'; ed.append(tb);
  tb.addEventListener('click', e => { const b = e.target.closest('button'); if (b) MT[b.dataset.k][2](); });
  const more = h('button', '', ic('more', 20)); more.id = 'mMore'; $('#bExport').before(more);
  more.onclick = () => popMenu(more, [{ label: 'حفظ كقالب', icon: 'tpl2', fn: () => $('#bTpl').click() }, { label: 'تصدير الإطار كصورة', icon: 'photo', fn: exportFrame }, { label: 'إعدادات المحرر', icon: 'gear', fn: () => $('#bSet').click() }, { label: 'الخصائص', icon: 'gear', fn: () => openSheet('right') }]);
  const ctl = h('div'); ctl.id = 'mctl'; const u = h('button', 'mu', ic('undo', 22)), r = h('button', 'mu', ic('redo', 22)); u.onclick = undo; r.onclick = redo; $('#bPlay').before(ctl); ctl.append(u, $('#bPlay'), r);
  const ml = h('div'); ml.id = 'mph'; $('#timeline').append(ml);
  for (const [id, title] of [['left', 'الأدوات'], ['right', 'الخصائص']]) {
    const hd = h('div', 'sheet-h'); hd.innerHTML = `<span class="grab"></span><b class="sheet-t">${title}</b>`; const x = h('button', '', '✕'); x.onclick = closeSheets; hd.append(x); $('#' + id).prepend(hd);
  }
  $('#bProj').innerHTML = ic('back', 18) + '<span class="lbl2"> الرئيسية</span>';
  renderMTools();
}
const _rp2 = renderProps; renderProps = function () { _rp2(); renderMTools(); const r = $('#right .sheet-t'); if (r && $('#right').classList.contains('sheet')) r.textContent = selClip() ? clipLabel(selClip()).slice(0, 24) : 'الخصائص'; };
for (const fn of ['addMediaClip', 'addOverlay']) { const o = window[fn]; window[fn] = function () { const r = o.apply(this, arguments); closeSheets(); return r; }; }
const _sce2 = setupEditorChrome; setupEditorChrome = function () { _sce2(); buildMobileEditor(); if (MOB()) { renderTimeline(); renderMTools(); } };
