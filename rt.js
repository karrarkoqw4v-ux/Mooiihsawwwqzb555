/* ===== rt.js — تحديث لحظي للرسائل + إشعارات النظام + طلب الصلاحية ===== */
const RT = { uid: null, offs: [], muted: {}, seen: {}, names: {} };
const rtOn = () => USE_FIREBASE && !API_BASE;
let swReg = null;
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').then((r) => (swReg = r)).catch(() => {});

async function notify(title, body, tag, extra) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const o = { body, tag, dir: 'rtl', lang: 'ar', renotify: true, vibrate: [200, 100, 200], ...(extra || {}) };
  try { const reg = swReg || (navigator.serviceWorker && (await navigator.serviceWorker.getRegistration())); if (reg) return await reg.showNotification(title, o); } catch (e) {}
  try { new Notification(title, o); } catch (e) {}
}
function refreshChatList() { if (typeof tab !== 'undefined' && tab === 'chats' && !$('s-main').hidden && $('chat-list')) renderChatList(); }
async function peerName(db, pid) {
  if (!RT.names[pid]) { try { RT.names[pid] = nameOf(fpub(pid, (await db.ref('users/' + pid).once('value')).val() || {})); } catch (e) { RT.names[pid] = 'رسالة جديدة'; } }
  return RT.names[pid];
}
async function onChatChanged(db, pid, v) {
  if (v.from === RT.uid) return refreshChatList();
  const open = peer && peer.id === pid && !$('s-chat').hidden;
  if (open) syncChat(); else refreshChatList();
  if (RT.muted[pid]) return;
  const text = preview({ text: v.last || '', att: v.att ? { kind: v.att } : null }), name = await peerName(db, pid);
  if (document.hidden) { Snd.ping(); notify(name, text, 'msg-' + pid); }
  else if (!open) { Snd.ping(); toast(name + ': ' + text); }
}
function startRealtime() {
  if (!rtOn() || !me() || RT.uid === me().id) return;
  stopRealtime(); const uid = (RT.uid = me().id), { db, ready } = fb();
  ready.then(() => {
    if (RT.uid !== uid) return;
    const mu = db.ref('muted/' + uid), hm = (s) => (RT.muted = s.val() || {}); mu.on('value', hm, () => {}); RT.offs.push(() => mu.off('value', hm));
    const uc = db.ref('userChats/' + uid); let first = true; RT.seen = {};
    const h = (s) => {
      const all = s.val() || {};
      for (const [pid, v] of Object.entries(all)) { const prev = RT.seen[pid]; RT.seen[pid] = v.t; if (!first && prev !== v.t) onChatChanged(db, pid, v); }
      first = false;
    };
    uc.on('value', h, () => {}); RT.offs.push(() => uc.off('value', h));
    startCallsListener(uid);
    setTimeout(maybeAskNotif, 1500);
  });
}
function stopRealtime() { RT.offs.splice(0).forEach((f) => { try { f(); } catch (e) {} }); if (typeof stopCallsListener === 'function') stopCallsListener(); RT.uid = null; RT.seen = {}; }

/* صلاحية الإشعارات */
function renderNotifState() {
  const el = $('set-notif-st'); if (!el) return;
  el.textContent = !('Notification' in window) ? 'غير مدعومة' : { granted: 'مفعّلة', denied: 'محظورة', default: 'اضغط للتفعيل' }[Notification.permission];
}
function maybeAskNotif() { if ('Notification' in window && Notification.permission === 'default' && !localStorage.getItem('mh_notif_asked')) $('notif-overlay').hidden = false; }
function askNotif() {
  if (!('Notification' in window)) return toast('المتصفح ما يدعم الإشعارات');
  if (Notification.permission === 'granted') return toast('الإشعارات مفعّلة');
  if (Notification.permission === 'denied') return toast('الإشعارات محظورة، فعّلها من إعدادات الموقع بالمتصفح');
  $('notif-overlay').hidden = false;
}
$('notif-yes').onclick = async () => {
  localStorage.setItem('mh_notif_asked', '1'); closeOverlay('notif-overlay');
  let p = 'denied'; try { p = await Notification.requestPermission(); } catch (e) {}
  toast(p === 'granted' ? 'تم تفعيل الإشعارات' : 'الإشعارات مو مفعّلة'); renderNotifState();
};
$('notif-no').onclick = () => { localStorage.setItem('mh_notif_asked', '1'); closeOverlay('notif-overlay'); };
$('notif-overlay').addEventListener('click', (e) => { if (e.target === $('notif-overlay') || e.target.classList.contains('photo-top')) closeOverlay('notif-overlay'); });

/* مساعد القواعد: يطلع تلقائياً إذا Firebase رفض الصلاحية */
function showRulesHelp() { $('rules-overlay').hidden = false; }
$('rules-copy').onclick = async () => {
  try { const t = await (await fetch('firebase-rules.json', { cache: 'no-store' })).text(); await navigator.clipboard.writeText(t); toast('تم نسخ القواعد، الصقها بـ Firebase'); }
  catch (e) { toast('تعذر النسخ، افتح ملف firebase-rules.json وانسخه يدوياً'); }
};
$('rules-open').onclick = () => window.open('https://console.firebase.google.com/project/' + FIREBASE_CONFIG.projectId + '/database/' + FIREBASE_CONFIG.projectId + '-default-rtdb/rules', '_blank', 'noopener');
$('rules-overlay').addEventListener('click', (e) => { if (e.target === $('rules-overlay') || e.target.classList.contains('photo-top')) closeOverlay('rules-overlay'); });
