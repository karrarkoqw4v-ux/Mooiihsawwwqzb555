'use strict';
/* ============================================================
   نظام القوالب (نسخة الويب المستقلة)
   قالب = JSON: مواضع وسائط (slots) + نصوص قابلة للتعديل + مشاهد + طبقات نص.
   - القوالب المدمجة أدناه أصلية، وقوالب المستخدم تُحفظ في localStorage وتُستورد/تُصدَّر كملف .vtpl
   - لا مشاركة مجتمعية في هذه النسخة (تحتاج خادماً).
   ============================================================ */
const TPL_CATS = [['popular', 'الأكثر استخداماً'], ['new', 'جديدة'], ['slideshow', 'عروض شرائح'], ['intro', 'مقدمات'], ['social', 'تواصل اجتماعي'], ['business', 'أعمال'], ['occasion', 'مناسبات']];

function mkSlides(n, dur, o = {}) {
  const slots = [], scenes = [];
  for (let i = 0; i < n; i++) {
    slots.push({ id: 's' + (i + 1), label: (o.label || 'وسائط') + ' ' + (i + 1), kind: o.kind || 'any' });
    scenes.push({ slot: 's' + (i + 1), start: +(i * dur).toFixed(2), dur, anim: o.anim || 'zoomin', trans: i && o.trans ? o.trans : 'none', filter: o.filter || null });
  }
  return { slots, scenes, total: n * dur };
}
const BUILTIN_TEMPLATES = (() => {
  const L = [];
  let g = mkSlides(5, 2.6, { anim: 'zoomin', trans: 'fade', label: 'صورة' });
  L.push({ id: 'memories', name: 'ذكريات', cat: ['popular', 'slideshow', 'occasion'], ratio: [16, 9], tags: ['صور', 'عائلة', 'ذكرى'], desc: 'عرض شرائح بخمس صور مع عنوان وخاتمة وانتقالات ناعمة.', palette: ['#ff9a8b', '#ff6a88'], hot: 98, ...g,
    texts: [{ id: 't1', label: 'العنوان', def: 'ذكرياتنا' }, { id: 't2', label: 'الخاتمة', def: 'شكراً لكم' }],
    layers: [{ text: 't1', start: .3, dur: 2.3, y: .5, size: 110, anim: 'pop', fadeOut: .4 }, { text: 't2', start: g.total - 2.2, dur: 2.2, y: .82, size: 64, anim: 'inup', bgOn: true, bgColor: '#00000088' }] });
  L.push({ id: 'intro-title', name: 'مقدمة بعنوان', cat: ['intro', 'new', 'popular'], ratio: [16, 9], tags: ['عنوان', 'يوتيوب'], desc: 'خلفية بوسيط واحد مع عنوان رئيسي وعنوان فرعي متحرك.', palette: ['#4facfe', '#00f2fe'], hot: 90, isNew: true,
    slots: [{ id: 's1', label: 'الخلفية', kind: 'any' }], scenes: [{ slot: 's1', start: 0, dur: 5, anim: 'zoomin', trans: 'none', filter: { b: 90, c: 115, vig: 40 } }],
    texts: [{ id: 't1', label: 'العنوان', def: 'قناتي' }, { id: 't2', label: 'العنوان الفرعي', def: 'أهلاً بكم في الحلقة الجديدة' }],
    layers: [{ text: 't1', start: .4, dur: 4.4, y: .45, size: 130, anim: 'pop', strokeW: 3 }, { text: 't2', start: 1, dur: 3.8, y: .64, size: 52, anim: 'inleft', bold: false, bgOn: true, bgColor: '#e91e63cc' }] });
  g = mkSlides(3, 3, { anim: 'inright', trans: 'slideL', label: 'مقطع', kind: 'video' });
  L.push({ id: 'vlog-open', name: 'افتتاحية فلوق', cat: ['intro', 'social'], ratio: [16, 9], tags: ['فلوق', 'سفر'], desc: 'ثلاثة مقاطع فيديو بانتقالات انزلاق وعنوان رئيسي.', palette: ['#f6d365', '#fda085'], hot: 76, ...g,
    texts: [{ id: 't1', label: 'العنوان', def: 'يوم في حياتي' }], layers: [{ text: 't1', start: .2, dur: 2.8, y: .5, size: 120, anim: 'pop', strokeW: 4, color: '#ffe600' }] });
  g = mkSlides(4, 2.2, { anim: 'zoomout', trans: 'zoom', label: 'لقطة' });
  L.push({ id: 'story-vertical', name: 'قصة عمودية', cat: ['social', 'popular', 'new'], ratio: [9, 16], tags: ['ستوري', 'ريلز'], desc: 'أربع لقطات بنسبة 9:16 مع نص كبير ومؤثر تكبير.', palette: ['#a18cd1', '#fbc2eb'], hot: 95, isNew: true, ...g,
    texts: [{ id: 't1', label: 'النص الأول', def: 'لحظات لا تنسى' }, { id: 't2', label: 'النص الأخير', def: 'تابعوني' }],
    layers: [{ text: 't1', start: .3, dur: 2, y: .2, size: 96, anim: 'pop' }, { text: 't2', start: g.total - 2, dur: 2, y: .78, size: 80, anim: 'inup', bgOn: true, bgColor: '#000000aa' }] });
  g = mkSlides(3, 3, { anim: 'inup', trans: 'wipe', label: 'المنتج', filter: { c: 112, s: 115 } });
  L.push({ id: 'product-show', name: 'عرض منتج', cat: ['business', 'new'], ratio: [16, 9], tags: ['متجر', 'إعلان'], desc: 'ثلاث صور للمنتج بانتقال مسح، واسم وسعر بخلفية بارزة.', palette: ['#0f2027', '#2c5364'], hot: 70, isNew: true, ...g,
    texts: [{ id: 't1', label: 'اسم المنتج', def: 'منتج رائع' }, { id: 't2', label: 'السعر', def: '99 ر.س' }],
    layers: [{ text: 't1', start: .3, dur: g.total - .6, y: .82, size: 70, anim: 'inleft', bgOn: true, bgColor: '#000000aa' }, { text: 't2', start: 1, dur: g.total - 1.3, y: .12, x: .85, size: 80, anim: 'pop', bgOn: true, bgColor: '#e91e63' }] });
  L.push({ id: 'greeting', name: 'بطاقة تهنئة', cat: ['occasion', 'popular'], ratio: [1, 1], tags: ['تهنئة', 'عيد'], desc: 'صورة واحدة مع تهنئة كبيرة وملصق احتفال.', palette: ['#f093fb', '#f5576c'], hot: 84,
    slots: [{ id: 's1', label: 'الصورة', kind: 'image' }], scenes: [{ slot: 's1', start: 0, dur: 5, anim: 'zoomin', trans: 'none', filter: { b: 105, s: 120, vig: 30 } }],
    texts: [{ id: 't1', label: 'التهنئة', def: 'كل عام وأنتم بخير' }, { id: 't2', label: 'الاسم', def: 'من: أحمد' }],
    layers: [{ text: 't1', start: .3, dur: 4.5, y: .22, size: 96, anim: 'pop', strokeW: 3 }, { text: 't2', start: 1, dur: 3.8, y: .86, size: 56, anim: 'inup' }, { sticker: '🎉', start: .5, dur: 4, y: .55, x: .2, size: 160, anim: 'pulse' }, { sticker: '✨', start: .5, dur: 4, y: .55, x: .8, size: 160, anim: 'pulse' }] });
  g = mkSlides(3, 2.5, { anim: 'pop', trans: 'fade', label: 'المركز' });
  L.push({ id: 'top3', name: 'أفضل ثلاثة', cat: ['social', 'popular'], ratio: [9, 16], tags: ['قائمة', 'ترتيب'], desc: 'قائمة ترتيبية من ثلاث وسائط مع أرقام كبيرة وعنوان.', palette: ['#fa709a', '#fee140'], hot: 88, ...g,
    texts: [{ id: 't1', label: 'العنوان', def: 'أفضل 3' }, { id: 't2', label: 'الأول', def: 'المركز الثالث' }, { id: 't3', label: 'الثاني', def: 'المركز الثاني' }, { id: 't4', label: 'الثالث', def: 'المركز الأول' }],
    layers: [{ text: 't1', start: 0, dur: g.total, y: .1, size: 90, anim: 'none', bgOn: true, bgColor: '#00000099' }, { text: 't2', start: .2, dur: 2.3, y: .85, size: 70, anim: 'inup' }, { text: 't3', start: 2.7, dur: 2.3, y: .85, size: 70, anim: 'inup' }, { text: 't4', start: 5.2, dur: 2.3, y: .85, size: 70, anim: 'inup' }] });
  g = mkSlides(4, 2, { anim: 'zoomin', trans: 'spin', label: 'لقطة' });
  L.push({ id: 'behind', name: 'كواليس', cat: ['social', 'new'], ratio: [1, 1], tags: ['كواليس'], desc: 'مربع 1:1 بأربع لقطات وانتقال دوران.', palette: ['#30cfd0', '#330867'], hot: 66, isNew: true, ...g,
    texts: [{ id: 't1', label: 'العنوان', def: 'خلف الكاميرا' }], layers: [{ text: 't1', start: .2, dur: g.total - .4, y: .88, size: 70, anim: 'inleft', bgOn: true, bgColor: '#00000099' }] });
  g = mkSlides(6, 1.2, { anim: 'pulse', trans: 'blur', label: 'لقطة', filter: { c: 118, s: 125 } });
  L.push({ id: 'fast-ad', name: 'إعلان سريع', cat: ['business', 'social', 'popular'], ratio: [9, 16], tags: ['إعلان', 'عرض'], desc: 'ست لقطات سريعة بإيقاع قصير مع شعار نصي.', palette: ['#ff0844', '#ffb199'], hot: 80, ...g,
    texts: [{ id: 't1', label: 'العرض', def: 'خصم 50%' }, { id: 't2', label: 'الدعوة', def: 'اطلب الآن' }],
    layers: [{ text: 't1', start: .2, dur: 3.5, y: .2, size: 120, anim: 'pop', strokeW: 4, color: '#ffe600' }, { text: 't2', start: g.total - 2, dur: 2, y: .8, size: 80, anim: 'pop', bgOn: true, bgColor: '#e91e63' }] });
  L.push({ id: 'thanks', name: 'بطاقة شكر', cat: ['occasion', 'business', 'intro'], ratio: [16, 9], tags: ['شكر', 'ختام'], desc: 'مشهد ختامي بوسيط واحد ونص شكر.', palette: ['#c1dfc4', '#deecdd'], hot: 55,
    slots: [{ id: 's1', label: 'الخلفية', kind: 'any' }], scenes: [{ slot: 's1', start: 0, dur: 4, anim: 'zoomout', trans: 'none', filter: { b: 95, vig: 45 } }],
    texts: [{ id: 't1', label: 'النص', def: 'شكراً للمشاهدة' }], layers: [{ text: 't1', start: .4, dur: 3.4, y: .5, size: 110, anim: 'pop' }] });
  return L;
})();

/* ---------- قوالب المستخدم ---------- */
const userTemplates = {
  list() { try { return JSON.parse(localStorage.getItem('ve-user-templates') || '[]'); } catch (e) { return []; } },
  save(a) { localStorage.setItem('ve-user-templates', JSON.stringify(a)); },
  add(t) { const a = this.list(); a.unshift(t); this.save(a); },
  remove(id) { this.save(this.list().filter(t => t.id !== id)); },
};
const allTemplates = () => [...userTemplates.list(), ...BUILTIN_TEMPLATES];
const tplTotal = t => Math.max(1, ...t.scenes.map(s => s.start + s.dur), ...(t.layers || []).map(l => l.start + l.dur));

/* ---------- معاينة القالب (رسم مباشر على Canvas) ---------- */
function tplEase(v) { return 1 - Math.pow(1 - Math.max(0, Math.min(1, v)), 3); }
function drawTemplate(cvs, tpl, t, texts, mediaEls) {
  const g2 = cvs.getContext('2d'), W = cvs.width, H = cvs.height, k = Math.min(W, H) / 720;
  g2.setTransform(1, 0, 0, 1, 0, 0); g2.globalAlpha = 1; g2.fillStyle = '#000'; g2.fillRect(0, 0, W, H);
  tpl.scenes.forEach((sc, i) => {
    const tail = (tpl.scenes[i + 1] && tpl.scenes[i + 1].trans && tpl.scenes[i + 1].trans !== 'none') ? .4 : 0;
    if (t < sc.start || t >= sc.start + sc.dur + (tail || 0)) return;
    const p = t - sc.start, u = p / sc.dur; let x = W / 2, y = H / 2, s = 1, a = 1, rot = 0;
    switch (sc.anim) { case 'zoomin': s = 1 + .2 * u; break; case 'zoomout': s = 1.2 - .2 * u; break; case 'inright': x += (1 - tplEase(p / .6)) * W * .4; break; case 'inup': y += (1 - tplEase(p / .6)) * H * .4; break; case 'pop': s = tplEase(p / .4); break; case 'pulse': s = 1 + .05 * Math.sin(p * 6); break; }
    let wipe = 1; if (sc.trans && sc.trans !== 'none' && p < .6) { const e = tplEase(p / .6); switch (sc.trans) { case 'fade': a = e; break; case 'slideL': x -= (1 - e) * W; break; case 'slideR': x += (1 - e) * W; break; case 'zoom': s *= .4 + .6 * e; a = e; break; case 'spin': rot = (1 - e) * 2; s *= .3 + .7 * e; a = e; break; case 'wipe': wipe = e; break; case 'blur': a = .4 + .6 * e; break; } }
    g2.save(); g2.globalAlpha = a; if (wipe < 1) { g2.beginPath(); g2.rect(0, 0, W * wipe, H); g2.clip(); }
    g2.translate(x, y); g2.rotate(rot); g2.scale(s, s);
    const el = mediaEls && mediaEls[sc.slot];
    if (el && ((el.videoWidth || el.naturalWidth))) {
      const iw = el.videoWidth || el.naturalWidth, ih = el.videoHeight || el.naturalHeight, f = Math.max(W / iw, H / ih);
      if (sc.filter) g2.filter = `brightness(${sc.filter.b || 100}%) contrast(${sc.filter.c || 100}%) saturate(${sc.filter.s || 100}%)`;
      g2.drawImage(el, -iw * f / 2, -ih * f / 2, iw * f, ih * f); g2.filter = 'none';
    } else {
      const pal = tpl.palette, gr = g2.createLinearGradient(-W / 2, -H / 2, W / 2, H / 2); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]);
      g2.fillStyle = gr; g2.globalAlpha = a * (.75 + .25 * ((i % 2) ? 1 : .85)); g2.fillRect(-W / 2, -H / 2, W, H); g2.globalAlpha = a * .8;
      g2.fillStyle = '#fff'; g2.font = `bold ${44 * k}px Cairo,Tahoma,sans-serif`; g2.textAlign = 'center'; g2.textBaseline = 'middle';
      g2.fillText('＋', 0, -22 * k); g2.font = `${26 * k}px Cairo,Tahoma,sans-serif`; const sl = tpl.slots.find(q => q.id === sc.slot); g2.fillText(sl ? sl.label : '', 0, 28 * k);
    }
    g2.restore();
  });
  for (const l of tpl.layers || []) {
    if (t < l.start || t >= l.start + l.dur) continue;
    const p = t - l.start, txt = l.sticker || ((texts && texts[l.text]) != null ? texts[l.text] : (tpl.texts.find(q => q.id === l.text) || {}).def || '');
    let x = (l.x != null ? l.x : .5) * W, y = (l.y != null ? l.y : .5) * H, s = 1, a = 1;
    if (p < .4) a = p / .4; if (l.fadeOut && l.dur - p < l.fadeOut) a *= (l.dur - p) / l.fadeOut;
    switch (l.anim) { case 'pop': s = tplEase(p / .4); break; case 'inleft': x -= (1 - tplEase(p / .6)) * W * .4; break; case 'inup': y += (1 - tplEase(p / .6)) * H * .3; break; case 'pulse': s = 1 + .06 * Math.sin(p * 6); break; }
    g2.save(); g2.globalAlpha = Math.max(0, Math.min(1, a)); g2.translate(x, y); g2.scale(s, s); g2.textAlign = 'center'; g2.textBaseline = 'middle';
    const size = (l.size || 60) * k;
    if (l.sticker) { g2.font = `${size}px "Noto Color Emoji","Segoe UI Emoji",sans-serif`; g2.fillText(txt, 0, 0); }
    else {
      g2.font = `${l.bold === false ? '' : 'bold '}${size}px Cairo,Tahoma,sans-serif`; const w = g2.measureText(txt).width + size * .6;
      if (l.bgOn) { g2.fillStyle = l.bgColor || '#000a'; g2.fillRect(-w / 2, -size * .8, w, size * 1.6); }
      g2.shadowColor = 'rgba(0,0,0,.55)'; g2.shadowBlur = size * .15;
      if (l.strokeW) { g2.lineWidth = l.strokeW * k * 2; g2.strokeStyle = '#000'; g2.lineJoin = 'round'; g2.strokeText(txt, 0, 0); }
      g2.fillStyle = l.color || '#fff'; g2.fillText(txt, 0, 0);
    }
    g2.restore();
  }
}

/* ---------- بناء مشروع من قالب ---------- */
async function blobFromPlaceholder(tpl, idx, W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, W, H);
  gr.addColorStop(0, tpl.palette[0]); gr.addColorStop(1, tpl.palette[1]); x.fillStyle = gr; x.fillRect(0, 0, W, H);
  return new Promise(r => c.toBlob(r, 'image/png'));
}
/* يُرجع كائن مشروع جاهزاً للحفظ في IndexedDB: { id,name,ratio,clips,media } */
async function buildTemplateProject(tpl, files, texts, name) {
  const [W, H] = sizeFor(720), media = [], clips = [], base = newClip({}), mids = {};
  const mkMedia = async (slotId, idx) => {
    if (mids[slotId]) return mids[slotId];
    let f = files[slotId], type, blob, dur = 5;
    if (f) { blob = f; type = f.type.startsWith('video') ? 'video' : 'image'; if (type === 'video') dur = await new Promise(r => { const v = document.createElement('video'); v.preload = 'metadata'; v.src = URL.createObjectURL(f); v.onloadedmetadata = () => r(isFinite(v.duration) ? v.duration : 5); v.onerror = () => r(5); }); }
    else { blob = await blobFromPlaceholder(tpl, idx, W, H); type = 'image'; }
    const id = uid(); media.push({ id, name: f ? f.name : 'مكان ' + (idx + 1), type, duration: dur, blob, hasAudio: undefined }); return mids[slotId] = { id, type, dur };
  };
  for (let i = 0; i < tpl.scenes.length; i++) {
    const sc = tpl.scenes[i], m = await mkMedia(sc.slot, i), d = m.type === 'video' ? Math.min(sc.dur, m.dur) : sc.dur;
    clips.push(newClip({ type: m.type, lane: 'v1', mediaId: m.id, start: sc.start, dur: d, name: (tpl.slots.find(q => q.id === sc.slot) || {}).label, anim: sc.anim === 'none' ? 'none' : sc.anim, trans: { type: sc.trans || 'none', dur: .6 }, f: { ...base.f, ...(sc.filter ? { b: sc.filter.b || 100, c: sc.filter.c || 100, s: sc.filter.s || 100, vig: sc.filter.vig || 0 } : {}) } }));
  }
  for (const l of tpl.layers || []) {
    const txt = l.sticker || ((texts && texts[l.text]) != null ? texts[l.text] : (tpl.texts.find(q => q.id === l.text) || {}).def || '');
    clips.push(newClip({ type: l.sticker ? 'sticker' : 'text', lane: l.sticker ? 's' : 't', start: l.start, dur: l.dur, text: txt, size: l.size || 60, x: l.x != null ? l.x : .5, y: l.y != null ? l.y : .5, anim: l.anim || 'none', fadeIn: l.sticker ? 0 : .2, fadeOut: l.fadeOut || 0, bold: l.bold !== false, strokeW: l.strokeW || 0, color: l.color || '#ffffff', bgOn: !!l.bgOn, bgColor: l.bgColor || '#000000aa' }));
  }
  return { id: uid(), name: name || tpl.name, ratio: tpl.ratio.slice(), clips, media, lanes: {} };
}

/* ---------- حفظ المشروع الحالي كقالب ---------- */
function projectToTemplate(name) {
  const v1 = S.clips.filter(c => c.lane === 'v1' && (c.type === 'video' || c.type === 'image')).sort((a, b) => a.start - b.start);
  if (!v1.length) return null;
  const slots = [], scenes = [], texts = [], layers = [];
  v1.forEach((c, i) => { slots.push({ id: 's' + (i + 1), label: 'وسائط ' + (i + 1), kind: c.type }); scenes.push({ slot: 's' + (i + 1), start: +c.start.toFixed(2), dur: +c.dur.toFixed(2), anim: c.anim, trans: c.trans.type, filter: { b: c.f.b, c: c.f.c, s: c.f.s, vig: c.f.vig } }); });
  S.clips.filter(c => c.type === 'text' || c.type === 'sticker').forEach((c, i) => {
    const L = { start: +c.start.toFixed(2), dur: +c.dur.toFixed(2), x: +c.x.toFixed(3), y: +c.y.toFixed(3), size: c.size, anim: c.anim, bold: c.bold, strokeW: c.strokeW, color: c.color, bgOn: c.bgOn, bgColor: c.bgColor, fadeOut: c.fadeOut };
    if (c.type === 'sticker') L.sticker = c.text; else { const id = 't' + (texts.length + 1); texts.push({ id, label: 'نص ' + (texts.length + 1), def: c.text }); L.text = id; }
    layers.push(L);
  });
  const pal = [['#667eea', '#764ba2'], ['#11998e', '#38ef7d'], ['#ee0979', '#ff6a00'], ['#2193b0', '#6dd5ed']][Math.floor(Math.random() * 4)];
  return { id: 'u_' + uid(), name, cat: ['mine'], ratio: S.ratio.slice(), tags: ['قالبي'], desc: 'قالب أنشأته من مشروعك.', palette: pal, hot: 0, slots, scenes, texts, layers, mine: true };
}
