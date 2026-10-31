/* ===== calls.js — مكالمات صوت وفيديو (WebRTC) + وضع الخصوصية =====
   الإشارة (الاتصال والرد وICE) تمر عبر Firebase Realtime Database:
   calls/{id}  |  callInbox/{المستلم}/{id}  |  privacy/{صاحب الخصوصية}/{الشخص} */
const CALL_RING_MS = 45000;
let CALL = null, uiTok = 0, lockTimer = 0, alertTimer = 0;
const callsOn = () => USE_FIREBASE && !API_BASE;
const fdb = () => fb().db;
const cUi = () => $('call-ui');

/* ---------- أصوات: نغمة الاتصال، رنين الانتظار، تنبيه الرسالة ---------- */
const Snd = (() => {
  let ctx = null, timer = 0;
  const get = () => { if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (A) { try { ctx = new A(); } catch (e) {} } } return ctx; };
  const unlock = () => { const c = get(); if (c && c.state === 'suspended') c.resume().catch(() => {}); };
  const tone = (f, at, d, v) => {
    const c = get(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(v, at + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, at + d);
    o.connect(g); g.connect(c.destination); o.start(at); o.stop(at + d + 0.05);
  };
  const P = {
    incoming: { every: 2600, vib: [500, 200, 500, 1400], play: (t) => [[784, 0], [988, .2], [784, .4], [988, .6], [1175, 1], [988, 1.2], [1175, 1.4], [1319, 1.6]].forEach(([f, o]) => tone(f, t + o, .18, .3)) },
    outgoing: { every: 3200, vib: null, play: (t) => { tone(425, t, 1.1, .12); tone(475, t, 1.1, .12); } }
  };
  const stop = () => { clearInterval(timer); timer = 0; if (navigator.vibrate) navigator.vibrate(0); };
  const start = (kind) => {
    stop(); const p = P[kind]; unlock();
    const run = () => { const c = get(); if (c && c.state === 'running') p.play(c.currentTime + .03); if (p.vib && navigator.vibrate) navigator.vibrate(p.vib); };
    run(); timer = setInterval(run, p.every);
  };
  const ping = () => { const c = get(); if (!c) return; unlock(); if (c.state === 'running') { tone(880, c.currentTime + .02, .12, .25); tone(1175, c.currentTime + .15, .18, .25); } };
  ['pointerdown', 'keydown', 'touchend'].forEach((ev) => addEventListener(ev, unlock, { passive: true }));
  return { start, stop, ping, unlock };
})();

/* ---------- حالة المكالمة ---------- */
const newCall = (id, peer_, kind, role) => ({ id, peer: peer_, kind, role, pc: null, stream: null, iceQ: [], remoteSet: false, connected: false, ended: false, accepting: false,
  t0: 0, timer: 0, ringTimer: 0, dc: 0, unsubs: [], priv: false, myPriv: false, lastEv: {}, face: 'user', screenStream: null, originalVideoTrack: null, flashlight: false });
const errTxt = (e) => (e && (e.code === 'PERMISSION_DENIED' || /permission_denied/i.test(e.message || '')) ? 'ما عندك صلاحية: انشر قواعد قاعدة البيانات الجديدة (firebase-rules.json)' : (e && e.message) || 'صار خطأ');
const callStatus = (t) => ($('call-status').textContent = t);
const fmtClock = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');

function callShow(mode) {
  uiTok++; const u = cUi(), C = CALL;
  u.hidden = false; u.dataset.mode = mode;
  u.classList.toggle('video', C.kind === 'video'); u.classList.toggle('ringing', mode !== 'active');
  u.classList.remove('has-remote-video', 'connected');
  $('call-name').textContent = nameOf(C.peer);
  const av = $('call-avatar'); av.className = 'avatar big'; av.innerHTML = AVATAR_SVG; setAvatar(av, C.peer.photo);
  $('call-bg').style.backgroundImage = safePhoto(C.peer.photo) ? 'url("' + C.peer.photo + '")' : '';
  $('call-ctrl').hidden = mode === 'incoming'; $('call-in-ctrl').hidden = mode !== 'incoming';
  $('c-cam').hidden = $('c-share').hidden = $('c-flash').hidden = false;
  $('c-cam').classList.toggle('off', C.kind !== 'video');
  $('c-share').classList.toggle('unavailable', C.kind !== 'video');
  $('c-flash').classList.toggle('unavailable', C.kind !== 'video');
  $('c-mic').classList.remove('off');
  $('call-lock').hidden = true; $('call-alert').hidden = true; $('call-priv').hidden = true;
  $('call-remote').style.visibility = '';
}
function localPreview() {
  const C = CALL; if (!C || !C.stream) return;
  const v = $('call-local'); v.srcObject = C.kind === 'video' ? new MediaStream(C.stream.getVideoTracks()) : null; v.style.transform = 'scaleX(-1)';
}
async function getMedia(kind) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('المتصفح ما يدعم المكالمات (يحتاج رابط https)');
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: kind === 'video' ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false });
  } catch (e) { throw new Error(kind === 'video' ? 'اسمح للموقع بالكاميرا والمايك' : 'اسمح للموقع بالمايك'); }
}

function setupPc() {
  const C = CALL, pc = (C.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS }));
  C.stream.getTracks().forEach((t) => pc.addTrack(t, C.stream));
  pc.ontrack = (e) => {
    const v = $('call-remote'), st = e.streams[0] || new MediaStream([e.track]);
    if (v.srcObject !== st) v.srcObject = st;
    v.play().catch(() => {});
    if (e.track.kind === 'video') cUi().classList.add('has-remote-video');
  };
  pc.onicecandidate = (e) => { if (e.candidate) fdb().ref('calls/' + C.id + '/ice/' + C.role).push(JSON.stringify(e.candidate)).catch(() => {}); };
  pc.onconnectionstatechange = () => {
    if (CALL !== C) return; const s = pc.connectionState;
    if (s === 'connected') { clearTimeout(C.dc); onConnected(); }
    else if (s === 'failed') hangUp('failed');
    else if (s === 'disconnected') { clearTimeout(C.dc); C.dc = setTimeout(() => { if (CALL === C && pc.connectionState !== 'connected') hangUp('failed'); }, 10000); }
  };
}
const flushIce = () => { const C = CALL; C.iceQ.splice(0).forEach((c) => C.pc.addIceCandidate(c).catch(() => {})); };

function watchCall() {
  const C = CALL, id = C.id, other = C.role === 'caller' ? 'callee' : 'caller';
  const r = fdb().ref('calls/' + id);
  const onVal = async (s) => {
    const v = s.val(); if (CALL !== C || C.ended) return;
    if (!v) { if (C.role === 'callee' || C.started) finishLocal('ended'); return; }
    C.started = true;
    if (v.state === 'ended') return finishLocal(v.endReason || 'ended', v.endBy);
    if (C.role === 'caller' && v.answer && !C.remoteSet) {
      C.remoteSet = true; Snd.stop(); callStatus('جاري الربط...');
      try { await C.pc.setRemoteDescription(v.answer); flushIce(); } catch (e) { hangUp('error'); }
    }
  };
  r.on('value', onVal); C.unsubs.push(() => r.off('value', onVal));
  const ic = r.child('ice/' + other);
  const onIce = (s) => { let c; try { c = JSON.parse(s.val()); } catch (e) { return; } if (C.remoteSet && C.pc) C.pc.addIceCandidate(c).catch(() => {}); else C.iceQ.push(c); };
  ic.on('child_added', onIce); C.unsubs.push(() => ic.off('child_added', onIce));
  const ev = r.child('events');
  const onEv = (s) => { const e = s.val(); if (e && e.by !== me().id) showCallAlert(e.type); };
  ev.on('child_added', onEv); C.unsubs.push(() => ev.off('child_added', onEv));
}

function onConnected() {
  const C = CALL; if (!C || C.connected) return;
  C.connected = true; C.t0 = Date.now(); clearTimeout(C.ringTimer); Snd.stop();
  const u = cUi(); u.dataset.mode = 'active'; u.classList.remove('ringing'); u.classList.add('connected');
  $('call-ctrl').hidden = false; $('call-in-ctrl').hidden = true;
  callStatus('00:00'); C.timer = setInterval(() => callStatus(fmtClock(Math.round((Date.now() - C.t0) / 1000))), 1000);
  if (C.priv) guardOn();
}

/* ---------- بدء مكالمة / استقبال ---------- */
async function startCall(p, kind) {
  if (!p) return;
  if (!callsOn()) return toast('المكالمات تحتاج Firebase');
  if (p.id === me().id) return;
  if (CALL) return toast('أنت بمكالمة حالياً');
  Snd.unlock();
  const C = (CALL = newCall(null, p, kind, 'caller'));
  try { C.stream = await getMedia(kind); } catch (e) { CALL = null; return toast(e.message); }
  const id = (C.id = fdb().ref('calls').push().key);
  callShow('outgoing'); callStatus('جاري الاتصال...'); localPreview();
  try {
    setupPc();
    const offer = await C.pc.createOffer();
    if (C.ended) return;
    await fdb().ref('calls/' + id).set({ caller: me().id, callee: p.id, kind, state: 'ringing', offer: { type: offer.type, sdp: offer.sdp }, t: fT() });
    C.created = true; const kill = () => { fdb().ref('calls/' + id).update({ state: 'ended', endBy: me().id, endReason: 'canceled' }).catch(() => {}); fdb().ref('callInbox/' + p.id + '/' + id).remove().catch(() => {}); };
    if (C.ended) return kill();
    await fdb().ref('callInbox/' + p.id + '/' + id).set({ from: me().id, t: fT() });
    if (C.ended) return kill();
    await C.pc.setLocalDescription(offer); // بعد ما انكتبت المكالمة، حتى تنقبل مرشحات ICE
  } catch (e) { toast(errTxt(e)); return finishLocal('error'); }
  if (C.ended) return;
  watchCall(); startPrivacyWatch(); Snd.start('outgoing'); callStatus('يرن...');
  C.ringTimer = setTimeout(() => { if (CALL === C && !C.connected) hangUp('noanswer'); }, CALL_RING_MS);
}

function incomingCall(id, p, kind) {
  const C = (CALL = newCall(id, p, kind, 'callee'));
  callShow('incoming'); callStatus(kind === 'video' ? 'مكالمة فيديو واردة' : 'مكالمة واردة');
  Snd.start('incoming'); watchCall(); startPrivacyWatch();
  notify('مكالمة واردة', nameOf(p) + (kind === 'video' ? ' يتصل بك (فيديو)' : ' يتصل بك'), 'call', { requireInteraction: true });
  C.ringTimer = setTimeout(() => { if (CALL === C && !C.accepting) finishLocal('missed'); }, CALL_RING_MS);
}

async function acceptCall() {
  const C = CALL; if (!C || C.role !== 'callee' || C.accepting || C.ended) return;
  C.accepting = true; Snd.stop(); clearTimeout(C.ringTimer); callStatus('جاري الربط...');
  $('call-in-ctrl').hidden = true; $('call-ctrl').hidden = false; cUi().dataset.mode = 'active';
  try { C.stream = await getMedia(C.kind); } catch (e) { toast(e.message); return hangUp('declined'); }
  if (CALL !== C || C.ended) { C.stream.getTracks().forEach((t) => t.stop()); return; }
  localPreview();
  try {
    setupPc();
    const v = (await fdb().ref('calls/' + C.id).once('value')).val();
    if (!v || v.state !== 'ringing') return finishLocal('missed');
    await C.pc.setRemoteDescription(v.offer); C.remoteSet = true; flushIce();
    const ans = await C.pc.createAnswer(); await C.pc.setLocalDescription(ans);
    await fdb().ref('calls/' + C.id).update({ answer: { type: ans.type, sdp: ans.sdp }, state: 'active' });
  } catch (e) { toast(errTxt(e)); hangUp('error'); }
}

/* ---------- إنهاء ---------- */
async function hangUp(reason) {
  const C = CALL; if (!C || C.ended) return;
  if (typeof reason !== 'string') reason = C.connected ? 'ended' : C.role === 'caller' ? 'canceled' : 'declined';
  try { if (C.id && (C.role === 'callee' || C.created)) await fdb().ref('calls/' + C.id).update({ state: 'ended', endBy: me().id, endReason: reason }); } catch (e) {}
  finishLocal(reason, me().id);
}
const END_TXT = { declined: 'تم رفض المكالمة', noanswer: 'ما رد', busy: 'الخط مشغول', failed: 'انقطع الاتصال', canceled: 'انتهت المكالمة', ended: 'انتهت المكالمة', missed: 'مكالمة فائتة', error: 'تعذر الاتصال' };
function finishLocal(reason, by) {
  const C = CALL; if (!C || C.ended) return;
  C.ended = true; Snd.stop(); [C.ringTimer, C.dc].forEach(clearTimeout); clearInterval(C.timer);
  C.unsubs.forEach((f) => { try { f(); } catch (e) {} }); guardOff();
  try { C.pc && C.pc.close(); } catch (e) {}
  if (C.screenStream) C.screenStream.getTracks().forEach((t) => t.stop());
  if (C.stream) C.stream.getTracks().forEach((t) => t.stop());
  $('call-remote').srcObject = null; $('call-local').srcObject = null;
  const dur = C.t0 ? Math.round((Date.now() - C.t0) / 1000) : 0, mineEnd = by === me().id;
  let status = dur ? 'answered' : reason;
  if (C.role === 'callee' && !dur && !mineEnd && ['canceled', 'noanswer', 'ended', 'missed'].includes(reason)) status = 'missed';
  if (C.role === 'callee' && !dur && !C.accepting && reason === 'declined') status = 'declined';
  if (status === 'missed') { reason = 'missed'; notify('مكالمة فائتة', nameOf(C.peer), 'missed'); }
  logCall(C, status, dur);
  if (C.id) { fdb().ref('callInbox/' + (C.role === 'callee' ? me().id : C.peer.id) + '/' + C.id).remove().catch(() => {}); if (C.role === 'caller') setTimeout(() => fdb().ref('calls/' + C.id).remove().catch(() => {}), 15000); }
  callStatus(dur ? 'انتهت المكالمة · ' + fmtClock(dur) : END_TXT[reason] || 'انتهت المكالمة');
  cUi().classList.remove('ringing'); $('call-ctrl').hidden = true; $('call-in-ctrl').hidden = true;
  const tok = uiTok; setTimeout(() => { if (tok === uiTok) cUi().hidden = true; }, 1400);
  CALL = null;
}

/* ---------- استقبال المكالمات الواردة ---------- */
let inboxRef = null, inboxFn = null;
function stopCallsListener() { if (inboxRef) inboxRef.off('child_added', inboxFn); inboxRef = inboxFn = null; }
function startCallsListener(uid) {
  stopCallsListener(); const db = fdb(); let off = 0;
  db.ref('.info/serverTimeOffset').once('value').then((s) => (off = s.val() || 0)).catch(() => {});
  inboxRef = db.ref('callInbox/' + uid);
  inboxFn = async (s) => {
    const id = s.key; let v;
    try { v = (await db.ref('calls/' + id).once('value')).val(); } catch (e) { return; }
    if (!v || v.state !== 'ringing' || v.callee !== uid || Date.now() + off - (v.t || 0) > CALL_RING_MS + 8000) { s.ref.remove().catch(() => {}); return; }
    if (CALL) { db.ref('calls/' + id).update({ state: 'ended', endBy: uid, endReason: 'busy' }).catch(() => {}); s.ref.remove().catch(() => {}); return; }
    let pu = {}; try { pu = (await db.ref('users/' + v.caller).once('value')).val() || {}; } catch (e) {}
    if (CALL) return;
    incomingCall(id, fpub(v.caller, pu), v.kind === 'video' ? 'video' : 'audio');
  };
  inboxRef.on('child_added', inboxFn);
}

/* ---------- أزرار الشاشة ---------- */
$('c-hang').onclick = () => hangUp();
$('c-decline').onclick = () => hangUp('declined');
$('c-accept').onclick = acceptCall;
$('c-mic').onclick = () => { const t = CALL && CALL.stream && CALL.stream.getAudioTracks(); if (!t || !t.length) return; const on = !t[0].enabled; t.forEach((x) => (x.enabled = on)); $('c-mic').classList.toggle('off', !on); };
$('c-cam').onclick = () => { const t = CALL && CALL.stream && CALL.stream.getVideoTracks(); if (!t || !t.length) return toast('تشغيل الكاميرا يحتاج مكالمة فيديو'); const on = !t[0].enabled; t.forEach((x) => (x.enabled = on)); $('c-cam').classList.toggle('off', !on); };
$('c-share').onclick = async () => {
  const C = CALL; if (!C || !C.pc || C.kind !== 'video') return toast('مشاركة الشاشة متاحة بمكالمة الفيديو');
  if (C.screenStream) {
    const old = C.originalVideoTrack;
    const sender = C.pc.getSenders().find(x => x.track && x.track.kind === 'video');
    if (sender && old) await sender.replaceTrack(old).catch(()=>{});
    C.screenStream.getTracks().forEach(t=>t.stop()); C.screenStream=null; C.originalVideoTrack=null;
    $('call-local').srcObject = new MediaStream(C.stream.getVideoTracks()); $('c-share').classList.remove('off'); toast('توقفت مشاركة الشاشة'); return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) return toast('مشاركة الشاشة غير مدعومة بهذا المتصفح');
  try {
    const ss = await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
    const track = ss.getVideoTracks()[0], sender = C.pc.getSenders().find(x => x.track && x.track.kind === 'video');
    if (!sender) { ss.getTracks().forEach(t=>t.stop()); return toast('تعذر تجهيز مسار مشاركة الشاشة'); }
    C.originalVideoTrack = C.stream.getVideoTracks()[0]; C.screenStream = ss;
    await sender.replaceTrack(track); $('call-local').srcObject = ss; $('call-local').style.transform='none'; $('c-share').classList.add('off');
    track.onended = () => { if (CALL === C && C.screenStream) $('c-share').click(); };
    toast('بدأت مشاركة الشاشة');
  } catch(e) { if (e.name !== 'NotAllowedError') toast('تعذرت مشاركة الشاشة'); }
};
$('c-flash').onclick = async () => {
  const C = CALL, track = C && C.stream && C.stream.getVideoTracks()[0];
  if (!track) return toast('الإضاءة تحتاج مكالمة فيديو وكاميرا تدعم الفلاش');
  try {
    const caps = track.getCapabilities ? track.getCapabilities() : {};
    if (!caps.torch) return toast('الإضاءة غير مدعومة بكاميرا هذا الجهاز');
    C.flashlight = !C.flashlight; await track.applyConstraints({advanced:[{torch:C.flashlight}]}); $('c-flash').classList.toggle('off', C.flashlight);
  } catch(e) { toast('تعذر تشغيل الإضاءة'); }
};

addEventListener('pagehide', () => { const C = CALL; if (C && !C.ended && C.id && (C.role === 'callee' || C.created)) fdb().ref('calls/' + C.id).update({ state: 'ended', endBy: me().id, endReason: C.connected ? 'ended' : 'canceled' }); });

/* ---------- سجل المكالمات (تبويب مكالمات) ---------- */
function logCall(C, status, dur) {
  try {
    const k = 'mhadatha_calls_' + me().id, a = JSON.parse(localStorage.getItem(k) || '[]');
    a.unshift({ peer: { id: C.peer.id, username: C.peer.username, first: C.peer.first, last: C.peer.last }, dir: C.role === 'caller' ? 'out' : 'in', kind: C.kind, status, dur, t: Date.now() });
    localStorage.setItem(k, JSON.stringify(a.slice(0, 60)));
  } catch (e) {}
  if (typeof tab !== 'undefined' && tab === 'calls' && !$('s-main').hidden) renderMain();
}
function renderCallsTab(body) {
  let a = []; try { a = JSON.parse(localStorage.getItem('mhadatha_calls_' + me().id) || '[]'); } catch (e) {}
  if (!a.length) { body.innerHTML = empty(I.phone, 'ما عندك مكالمات بعد.'); return; }
  const ST = { answered: '', missed: 'فائتة', declined: 'مرفوضة', noanswer: 'ما رد', busy: 'مشغول', canceled: 'ملغاة', failed: 'انقطعت', error: 'فشلت', ended: '' };
  const PH = '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z"/>', VID = '<rect x="3" y="6" width="12" height="12" rx="3"/><path d="m15 10 6-3v10l-6-3"/>';
  body.innerHTML = a.map((c) => '<div class="item call-item">' + avatarEl(c.peer) + '<div class="grow"><b class="' + (c.status === 'missed' ? 'miss' : '') + '">' + esc(nameOf(c.peer)) + '</b><small>' +
    (c.dir === 'out' ? 'صادرة' : 'واردة') + ' · ' + (c.kind === 'video' ? 'فيديو' : 'صوت') + (c.dur ? ' · ' + fmtClock(c.dur) : '') + (ST[c.status] ? ' · ' + ST[c.status] : '') +
    '</small></div><time>' + fmtStamp(c.t) + '</time><button class="call-again" type="button" aria-label="اتصال"><svg viewBox="0 0 24 24">' + (c.kind === 'video' ? VID : PH) + '</svg></button></div>').join('');
  body.querySelectorAll('.call-item').forEach((el, i) => { el.querySelector('.call-again').onclick = () => startCall(a[i].peer, a[i].kind); });
}

/* ---------- وضع الخصوصية ----------
   privacy/{A}/{B}=true يعني: A فعّل الخصوصية ضد B. أثناء المكالمة جهاز B يراقب محاولات التصوير:
   يقفل شاشته ويرسل حدث للمكالمة، وجهاز A يعرض له إشعار. (حدود الويب مكتوبة بالملاحظات) */
function startPrivacyWatch() {
  const C = CALL, db = fdb();
  const against = db.ref('privacy/' + C.peer.id + '/' + me().id), mine = db.ref('privacy/' + me().id + '/' + C.peer.id);
  const h1 = (s) => { C.priv = !!s.val(); if (C.priv && C.connected) guardOn(); if (!C.priv) guardOff(); };
  const h2 = (s) => { C.myPriv = !!s.val(); $('call-priv').hidden = !C.myPriv; };
  against.on('value', h1, () => {}); mine.on('value', h2, () => {});
  C.unsubs.push(() => { against.off('value', h1); mine.off('value', h2); });
}
let guarding = false;
function guardOn() { guarding = true; $('call-priv').hidden = false; $('call-priv').lastChild.textContent = ' وضع الخصوصية مفعّل من الطرف الثاني'; }
function guardOff() { guarding = false; $('call-lock').hidden = true; $('call-remote').style.visibility = ''; if (CALL && CALL.myPriv) { $('call-priv').lastChild.textContent = ' وضع الخصوصية مفعّل'; } else $('call-priv').hidden = true; }
function guardTrigger(type) {
  const C = CALL; if (!guarding || !C || !C.connected || !C.priv) return;
  lockScreen(type);
  const now = Date.now(); if (now - (C.lastEv[type] || 0) < 10000) return; C.lastEv[type] = now;
  fdb().ref('calls/' + C.id + '/events').push({ type, by: me().id, t: fT() }).catch(() => {});
}
function lockScreen(type) {
  $('call-lock').hidden = false; $('call-remote').style.visibility = 'hidden';
  $('call-lock-t').textContent = type === 'screenshot' ? 'تم رصد محاولة لقطة شاشة' : 'الشاشة مقفلة';
  const b = $('call-unlock'); b.disabled = true; clearTimeout(lockTimer); lockTimer = setTimeout(() => (b.disabled = false), 2000);
}
$('call-unlock').onclick = () => { if (document.hidden) return; $('call-lock').hidden = true; $('call-remote').style.visibility = ''; };
function showCallAlert(type) {
  const T = { screenshot: 'حاول يلتقط صورة للشاشة', away: 'طلع من شاشة المكالمة أو فتح لوحة الإشعارات (ممكن يسجل الشاشة)', record: 'يسجل الشاشة', share: 'يشارك الشاشة' };
  const a = $('call-alert'); a.textContent = '⚠️ ' + (CALL ? nameOf(CALL.peer) : '') + ': ' + (T[type] || 'محاولة تصوير'); a.hidden = false;
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  clearTimeout(alertTimer); alertTimer = setTimeout(() => (a.hidden = true), 7000);
  if (document.hidden) notify('وضع الخصوصية', a.textContent, 'priv');
}
const isShotKey = (e) => e.key === 'PrintScreen' || (e.shiftKey && (e.metaKey || e.ctrlKey && e.altKey) && ['3', '4', '5', 's', 'S'].includes(e.key));
addEventListener('keydown', (e) => { if (isShotKey(e)) guardTrigger('screenshot'); });
addEventListener('keyup', (e) => { if (e.key === 'PrintScreen') guardTrigger('screenshot'); });
document.addEventListener('visibilitychange', () => { if (document.hidden) guardTrigger('away'); });
addEventListener('blur', () => guardTrigger('away'));
cUi().addEventListener('contextmenu', (e) => e.preventDefault());

/* ورقة وضع الخصوصية من ثلاث نقاط ملف الشخص */
let privNow = false;
function renderPrivSheet() { $('priv-state').textContent = privNow ? 'مفعّل' : 'غير مفعّل'; $('priv-toggle-t').textContent = privNow ? 'رفع وضع الخصوصية عن هذا الشخص' : 'تفعيل وضع الخصوصية لهذا الشخص'; $('priv-toggle').classList.toggle('danger', privNow); }
$('user-more').onclick = async () => {
  if (!viewUser) return;
  try { privNow = (await api('privacy?peer=' + encodeURIComponent(viewUser.id))).on; } catch (e) { return toast(e.message); }
  renderPrivSheet(); $('priv-overlay').hidden = false;
};
$('priv-toggle').onclick = async () => {
  try { await api('privacy', { method: 'POST', body: { peer: viewUser.id, on: !privNow } }); privNow = !privNow; closeOverlay('priv-overlay'); toast(privNow ? 'تم تفعيل وضع الخصوصية لهذا الشخص' : 'تم رفع وضع الخصوصية'); }
  catch (e) { toast(e.message); }
};
$('priv-overlay').addEventListener('click', (e) => { if (e.target === $('priv-overlay') || e.target.classList.contains('photo-top')) closeOverlay('priv-overlay'); });
