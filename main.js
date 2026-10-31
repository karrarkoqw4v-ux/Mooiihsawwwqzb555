/* ===== main.js — نقطة البداية ===== */
$('avatar-preview').innerHTML = AVATAR_SVG;
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); // حتى ما يمسح المتصفح بيانات الدخول
(async () => {
  if (USE_FIREBASE || localStorage.getItem(TOKEN_KEY)) {
    try { user = (await api('me')).user; }
    catch (e) { if (e.status === 401) localStorage.removeItem(TOKEN_KEY); }
  }
  route();
})();
