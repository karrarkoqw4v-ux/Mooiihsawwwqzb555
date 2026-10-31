/* ===== config.js — عنوان السيرفر =====
   فارغ = بدون سيرفر: الحسابات تنحفظ على جهاز المستخدم فقط (js/local-api.js).
   وإذا عندك سيرفر حط رابطه هنا، مثل: 'https://mhadatha-api.اسمك.workers.dev' */
const API_BASE = '';

/* استخدام عبر Google: حط هنا Client ID من Google Cloud Console (OAuth Web client).
   وضيف رابط موقعك بـ Authorized JavaScript origins. فارغ = الزر يطلع تنبيه بدل ما يتظاهر. */
const GOOGLE_CLIENT_ID = '';

/* Firebase (الحسابات + قاعدة البيانات). إذا apiKey مليان يشتغل Firebase بدل التخزين المحلي.
   الـ apiKey هنا من ملف الأندرويد؛ إذا طلع خطأ "مفتاح Firebase" سجّل تطبيق ويب وحط مفتاحه. */
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCvSqby97FXSU8eUmiRNCHxy4NCZ-fUCw4',
  authDomain: 'hskl-7567e.firebaseapp.com',
  databaseURL: 'https://hskl-7567e-default-rtdb.firebaseio.com',
  projectId: 'hskl-7567e',
  storageBucket: 'hskl-7567e.firebasestorage.app'
};
const USE_FIREBASE = !!FIREBASE_CONFIG.apiKey;

/* المكالمات (WebRTC): سيرفرات STUN مجانية. بعض شبكات الجوال تمنع الاتصال المباشر، وقتها تحتاج سيرفر TURN
   (مثل Cloudflare Calls TURN أو Metered) وتضيفه هنا: { urls: 'turn:...', username: '...', credential: '...' } */
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

