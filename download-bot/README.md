# بوت تحميل (PHP + yt-dlp)

بوت تيليجرام: اشتراك إجباري ← رسالة ترحيب ← أرسل الرابط ← "لحظه من فضلك" ← فيديو مع كامل معلوماته.
المنصات: يوتيوب، انستكرام، تيك توك، فيسبوك، تويتر/X، سناب شات، ساوند كلاود.

## التشغيل على الخادم (Ubuntu + Nginx/Apache + HTTPS)
```bash
sudo apt install php-cli php-fpm php-curl ffmpeg python3-pip
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && sudo chmod a+rx /usr/local/bin/yt-dlp
composer install --no-dev
export BOT_TOKEN=... FORCE_CHANNELS=@chan1,@chan2 WEBHOOK_SECRET=كلمة_سرية   # أو عدّل config.php
php set_webhook.php https://دومينك/download-bot/bot.php
```
- أضف البوت **مشرفاً** في قنوات الاشتراك الإجباري.
- يجب أن يعمل الخادم بـ HTTPS (تيليجرام يشترطه). حدّث yt-dlp دورياً: `yt-dlp -U`.
- لتجاوز حد 50MB: شغّل Local Bot API Server (حتى 2GB).
