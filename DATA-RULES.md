# قوانين قاعدة البيانات (js/local-api.js)

كل شي يمر عبر `api(route, {method, body})`. إذا `API_BASE` فارغ يشتغل `local-api.js`، وإذا مليان يروح لنفس المسارات بالسيرفر. **أي سيرفر لازم يلتزم بنفس القوانين.**

## 1) أماكن الحفظ
- `localStorage['mhadatha_local_v1']` = `{ users[], msgs[], stories[], session }`
- `IndexedDB 'mhadatha_media'` = الصور والفيديوهات والملفات (Blob). الرسالة تحمل مرجع فقط.
- `localStorage[TOKEN_KEY]` = حتى يبقى المستخدم داخل بعد إغلاق التطبيق.

## 2) الكيانات
- **user**: `id, username, email, hash, first, last, photo, cover, phone, bio, muted[], profileDone`
- **message**: `id, a (المرسل), b (المستلم), text, t (وقت), att|null`
- **att**: `id, kind (image|video|file), name, size, mime`
- **story**: `id, uid, mediaId, caption, t`

## 3) المسارات
| المسار | الشرط | النتيجة |
|---|---|---|
| `GET username?u=` | بدون دخول | `{available, valid}` |
| `POST register` | بدون دخول | `{token, user}` |
| `POST login` | بدون دخول | `{token, user}` (خطأ 401 إذا غلط) |
| `POST google` | بدون دخول | ينشئ الحساب أو يدخله بالبريد |
| `GET/PATCH me` | دخول | `{user}` |
| `POST logout` | دخول | `{ok}` |
| `GET search?q=` | دخول | `{users[]}` أقصى 20 |
| `GET user?u=` | دخول | `{user, self, muted}` أو 404 |
| `GET chats` | دخول | `{chats[{peer,last,muted}]}` الأحدث أولاً |
| `GET messages?peer=` | دخول | `{peer, messages[]}` بالترتيب الزمني |
| `POST messages` | دخول | `{message}` |
| `POST mute` | دخول | `{muted}` |
| `GET/POST/DELETE stories` | دخول | `{mine, groups}` / `{ok}` |

أي مسار غير الأول والثاني والثالث والرابع بدون دخول يرجع **401**.

## 4) قوانين التحقق
- **username**: `^[a-z0-9_]{3,20}$` (حروف صغيرة)، فريد، ويقدر يتغير بعدين.
- **email**: صحيح وفريد، يتخزن حروف صغيرة. الدخول بالبريد فقط.
- **password**: 6 رموز أو أكثر. تتخزن `SHA-256` مملّحة بـ `id` (مو username). ما تنرجع للواجهة أبداً.
- **first / last**: نص حتى 40 حرف. **bio**: حتى 140. **phone**: `+` اختياري و7–15 رقم.
- **photo / cover**: صورة data-URL صالحة فقط أو نص فارغ للحذف.
- **message**: لازم نص أو مرفق. النص حتى 1000 حرف. المرسل دائماً المستخدم الحالي، ما يقدر يرسل باسم غيره.
- **المرفقات**: الحد 150 ميغا، نوعها `image|video|file` فقط.
- **story**: تنتهي بعد 24 ساعة وتنحذف عند أي قراءة. الوصف حتى 500. فقط صاحبها يحذفها. تنعرض آخر 10 أشخاص.

## 5) قوانين الخصوصية والبحث
- البحث يلقى فقط من أكمل ملفه (`profileDone`) وبالاسم أو اسم المستخدم أو اسم العائلة، وما يرجع المستخدم نفسه. الترتيب: اللي يبدأ اسمه بالكلمة أولاً.
- المستخدم ما يطلع بالبحث ولا ملفه إلا بعد `profileDone` (إلا ملفه هو).
- `email` و`hash` ما ينرجعون إلا لصاحب الحساب نفسه (`lself`). للغير فقط `lpub` + cover/phone/bio.
- المحادثة تنرجع فقط للطرفين، والمحادثات تظهر فقط إذا الطرف الثاني موجود.
- الكتم يخص صاحبه فقط ويظهر رمز بالقائمة.

## 6) تسجيل Google
- يحتاج `GOOGLE_CLIENT_ID` بـ `config.js`. فارغ = تنبيه، بدون محاكاة.
- النافذة الرسمية ترجع البريد والاسم، والبريد لازم يكون موثّق.
- أول مرة: ينشئ حساب (username من البريد وإذا مأخوذ يضيف رقم) ويروح لـ "أكمل ملفك". بعدها يدخل بنفس البريد.
- حساب Google ما عنده كلمة مرور، فالدخول بالبريد وكلمة المرور ما ينفتح له.
- **ملاحظة مهمة:** بدون سيرفر، التحقق من Google يصير على الجهاز. بالسيرفر الحقيقي لازم يتحقق من `access_token` عبر Google قبل ما يعطي الجلسة.

## 7) للسيرفر (Cloudflare Worker + D1 + R2) لاحقاً
جداول: `users, messages, stories, mutes`. الوسائط بـ R2 ومرجعها `att.id`/`mediaId`. نفس المسارات والقوانين أعلاه، والجلسة `Authorization: Bearer token`.

## 8) المكالمات والبصمة والخصوصية (Firebase)
- `calls/{id}`: `caller, callee, kind(audio|video), state(ringing|active|ended), offer, answer, endBy, endReason, ice/{caller|callee}, events`. فقط الطرفين يقرأون ويكتبون.
- `callInbox/{المستلم}/{id}`: إشعار للمستلم بوجود مكالمة. `privacy/{صاحبها}/{الشخص}=true`: وضع الخصوصية.
- `blobs/{chat}/{id}`: محتوى الصور والبصمات (data-URL) والملفات الصغيرة (حتى 1 ميغا). الرسالة تحمل `att.blob=true` فقط.
- `att.kind` صار يقبل `voice` ومعه `dur` بالثواني. **انشر `firebase-rules.json` من جديد** بعد التحديث.
