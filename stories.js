/* ===== stories.js — القصص: شريط الأعلى وعارض القصص ===== */
const SEEN = 'mhadatha_seen';
const seenSet = () => { try { return new Set(JSON.parse(localStorage.getItem(SEEN)) || []); } catch (e) { return new Set(); } };
const markSeen = (id) => { const s = seenSet(); s.add(id); try { localStorage.setItem(SEEN, JSON.stringify([...s].slice(-300))); } catch (e) {} };
const ago = (t) => { const m = Math.max(1, Math.round((Date.now() - t) / 6e4)); return m < 60 ? 'منذ ' + m + ' دقيقة' : 'منذ ' + Math.round(m / 60) + ' ساعة'; };
let sv = null, svTimer;

async function renderStories() {
  let d; try { d = await api('stories'); } catch (e) { return; }
  const box = $('stories'); if (!box || tab !== 'chats') return;
  const u = me(), seen = seenSet(), has = d.mine.length, fresh = (items) => items.some((x) => !seen.has(x.id));
  const groups = (has ? [{ user: u, items: d.mine }] : []).concat(d.groups);
  const ring = (cls, user) => '<div class="rw"><div class="ring ' + cls + '">' + avatarEl(user) + '</div>';
  box.innerHTML =
    '<button class="st own" data-g="' + (has ? 0 : -1) + '">' + ring(has ? (fresh(d.mine) ? 'new' : 'seen') : 'none', u) + '<span class="plus">+</span></div><small>قصتك</small></button>' +
    d.groups.map((g, i) => '<button class="st" data-g="' + (i + (has ? 1 : 0)) + '">' + ring(fresh(g.items) ? 'new' : 'seen', g.user) + '</div><small>' + esc(nameOf(g.user)) + '</small></button>').join('');
  const users = [u].concat(d.groups.map((g) => g.user));
  box.querySelectorAll('.st').forEach((el, i) => {
    setAvatar(el.querySelector('.avatar'), users[i].photo);
    el.onclick = (e) => {
      if (el.classList.contains('own') && (e.target.closest('.plus') || !has)) return openStoryCam();
      openStories(groups, +el.dataset.g);
    };
  });
}
async function postStory(f, c) {
  if (!f) return false;
  const kind = f.type.startsWith('video/') ? 'video' : 'image';
  if (kind === 'video' && REMOTE_MEDIA && f.size > STORY_REMOTE_VIDEO_MAX) { toast('المقطع كبير (' + fmtSize(f.size) + '). الحد 8 ميغا حتى يوصل للطرف الثاني، قصّره أو قلل الدقة'); return false; }
  const id = 'm' + Date.now() + Math.random().toString(36).slice(2, 7);
  try { await mediaPut(id, f); } catch (e) { toast('تعذر حفظ الملف على الجهاز'); return false; }
  try { await api('stories', { method: 'POST', body: { mediaId: id, caption: c, kind } }); toast('تم نشر القصة'); renderStories(); return true; } catch (e) { toast(e.message); return false; }
}

/* العارض */
function openStories(groups, gi) { sv = { groups, gi, ii: 0, tok: 0 }; $('story-overlay').hidden = false; showStory(); }
async function showStory() {
  clearTimeout(svTimer);
  const g = sv.groups[sv.gi], it = g.items[sv.ii], tok = ++sv.tok, mine = String(g.user.id) === String(me().id);
  $('story-bars').innerHTML = g.items.map((_, i) => '<i><b style="width:' + (i < sv.ii ? '100%' : '0') + '"></b></i>').join('');
  const av = $('story-av'); av.className = 'avatar'; av.innerHTML = AVATAR_SVG; setAvatar(av, g.user.photo);
  $('story-name').textContent = mine ? 'قصتك' : nameOf(g.user); $('story-time').textContent = ago(it.t);
  $('story-cap').textContent = it.caption || ''; $('story-cap').hidden = !it.caption; $('story-del').hidden = !mine;
  let url = ''; try { url = await mediaUrl(it.mediaId); } catch (e) {}
  if (sv.tok !== tok) return;
  const vid = $('story-vid'), isVid = it.kind === 'video';
  vid.pause(); $('story-stage').classList.toggle('vid', isVid); markSeen(it.id);
  const run = (ms) => { const b = $('story-bars').children[sv.ii].firstChild; void b.offsetWidth; b.style.transition = 'width ' + ms + 'ms linear'; b.style.width = '100%'; svTimer = setTimeout(nextStory, ms); };
  if (isVid) {
    vid.src = url; vid.onended = null;
    let started = false;
    const go = () => { if (started || sv.tok !== tok) return; started = true; const d = isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 10; run(Math.min(d, 30) * 1000 + 300); vid.play().catch(() => { vid.muted = true; vid.play().catch(() => {}); }); };
    vid.onloadedmetadata = go; vid.onerror = () => { if (sv.tok === tok) run(3000); }; setTimeout(go, 1500);
  } else { $('story-img').src = url; run(5000); }
}
function nextStory() {
  const g = sv.groups[sv.gi];
  if (sv.ii < g.items.length - 1) sv.ii++; else if (sv.gi < sv.groups.length - 1) { sv.gi++; sv.ii = 0; } else return closeStories();
  showStory();
}
function prevStory() { if (sv.ii > 0) sv.ii--; else if (sv.gi > 0) { sv.gi--; sv.ii = 0; } showStory(); }
function closeStories() { clearTimeout(svTimer); $('story-vid').pause(); if (sv) sv.tok++; closeOverlay('story-overlay'); renderStories(); }
$('story-stage').onclick = (e) => { const r = $('story-stage').getBoundingClientRect(); (e.clientX - r.left < r.width / 2) ? nextStory() : prevStory(); }; // اتجاه عربي: اليسار = التالي
$('story-close').onclick = closeStories;
$('story-del').onclick = async () => {
  const it = sv.groups[sv.gi].items[sv.ii];
  try { await api('stories?id=' + encodeURIComponent(it.id), { method: 'DELETE' }); toast('تم حذف القصة'); closeStories(); } catch (e) { toast(e.message); }
};
