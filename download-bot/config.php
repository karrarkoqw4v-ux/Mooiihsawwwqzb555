<?php
// الإعدادات: يفضّل وضعها كمتغيرات بيئة على الخادم
return [
    'token'    => getenv('BOT_TOKEN') ?: 'ضع_التوكن_هنا',
    // قنوات الاشتراك الإجباري (البوت يجب أن يكون مشرفاً فيها)
    'channels' => array_filter(array_map('trim', explode(',', getenv('FORCE_CHANNELS') ?: ''))),
    'ytdlp'    => getenv('YTDLP_PATH') ?: 'yt-dlp',
    'max_mb'   => 50,   // حد تيليجرام للبوتات (2000 مع Local Bot API Server)
    'timeout'  => 120,
    'secret'   => getenv('WEBHOOK_SECRET') ?: 'change-me-secret',
];
