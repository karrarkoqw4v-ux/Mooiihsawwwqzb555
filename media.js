/* ===== media.js — تخزين الصور والفيديوهات والملفات على الجهاز (IndexedDB) ===== */
const MAX_FILE = 150 * 1024 * 1024; // 150 ميغا
const mediaDB = () => (mediaDB.p = mediaDB.p || new Promise((res, rej) => {
  const r = indexedDB.open('mhadatha_media', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('m');
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
}));
async function mediaPut(id, blob) {
  const db = await mediaDB();
  return new Promise((res, rej) => { const tx = db.transaction('m', 'readwrite'); tx.objectStore('m').put(blob, id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
}
async function mediaUrl(id) {
  const db = await mediaDB();
  const blob = await new Promise((res, rej) => { const r = db.transaction('m').objectStore('m').get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  return blob ? URL.createObjectURL(blob) : '';
}
async function mediaHas(id) {
  const db = await mediaDB();
  return new Promise((res) => { const r = db.transaction('m').objectStore('m').count(id); r.onsuccess = () => res(r.result > 0); r.onerror = () => res(false); });
}
const fmtSize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' ميغا' : Math.max(1, Math.round(n / 1024)) + ' كيلو');
