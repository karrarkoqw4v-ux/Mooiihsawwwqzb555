<?php
require __DIR__ . '/vendor/autoload.php';

use GuzzleHttp\Client;

$cfg = require __DIR__ . '/config.php';

// التحقق من أن الطلب قادم من تيليجرام
if (($_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? '') !== $cfg['secret']) { http_response_code(403); exit; }

$update = json_decode(file_get_contents('php://input'), true);
if (!$update) exit;

// إنهاء الاستجابة فوراً حتى لا يعيد تيليجرام إرسال التحديث أثناء التحميل
http_response_code(200);
header('Connection: close');
if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
ignore_user_abort(true);
set_time_limit(300);

// منع المعالجة المكررة
$lock = sys_get_temp_dir() . '/upd_' . ($update['update_id'] ?? 0);
if (file_exists($lock)) exit;
touch($lock);

$http = new Client(['base_uri' => "https://api.telegram.org/bot{$cfg['token']}/", 'timeout' => 300, 'http_errors' => false]);

function api(string $method, array $p = [], array $files = []) {
    global $http;
    $multipart = [];
    foreach ($p as $k => $v) $multipart[] = ['name' => $k, 'contents' => is_array($v) ? json_encode($v, JSON_UNESCAPED_UNICODE) : (string)$v];
    foreach ($files as $k => $path) $multipart[] = ['name' => $k, 'contents' => fopen($path, 'r'), 'filename' => basename($path)];
    $r = $http->post($method, ['multipart' => $multipart]);
    return json_decode((string)$r->getBody(), true);
}

function h($s) { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_HTML5, 'UTF-8'); }

function notSubscribed(int $uid): array {
    global $cfg;
    $missing = [];
    foreach ($cfg['channels'] as $ch) {
        $r = api('getChatMember', ['chat_id' => $ch, 'user_id' => $uid]);
        $st = $r['result']['status'] ?? 'left';
        if (!in_array($st, ['member', 'administrator', 'creator'], true)) $missing[] = $ch;
    }
    return $missing;
}

function forceMessage(int $chat, array $missing): void {
    $kb = [];
    foreach ($missing as $ch) $kb[] = [['text' => '📢 اشترك في ' . $ch, 'url' => 'https://t.me/' . ltrim($ch, '@')]];
    $kb[] = [['text' => '✅ تحققت من الاشتراك', 'callback_data' => 'check']];
    api('sendMessage', [
        'chat_id' => $chat,
        'text' => "⌁︙عذراً عزيزي، يجب عليك الاشتراك في القنوات التالية أولاً لاستخدام البوت 👇\n\nبعد الاشتراك اضغط ( تحققت من الاشتراك )",
        'reply_markup' => ['inline_keyboard' => $kb],
    ]);
}

function welcome(int $chat): void {
    api('sendMessage', [
        'chat_id' => $chat,
        'text' => "⌁︙آهلا بكَِ اغاتي في بوت التيك توك 💘\n⌁︙يمكنك ايضاً التحميل من ( اليوتيوب ، انستكرام ، تيكتوك ، فيسبوك ، تويتر ، سناب شات ، ساوند كلاود )",
    ]);
}

function platformOf(string $url): ?string {
    $map = [
        'tiktok.com' => 'تيك توك', 'youtube.com' => 'يوتيوب', 'youtu.be' => 'يوتيوب',
        'instagram.com' => 'انستكرام', 'facebook.com' => 'فيسبوك', 'fb.watch' => 'فيسبوك',
        'twitter.com' => 'تويتر', 'x.com' => 'تويتر', 'snapchat.com' => 'سناب شات',
        'soundcloud.com' => 'ساوند كلاود',
    ];
    $host = strtolower(parse_url($url, PHP_URL_HOST) ?: '');
    foreach ($map as $d => $name) if ($host === $d || str_ends_with($host, '.' . $d)) return $name;
    return null;
}

function fmtDur($s): string { $s = (int)$s; return $s >= 3600 ? gmdate('H:i:s', $s) : gmdate('i:s', $s); }
function fmtNum($n): string { return $n === null ? '—' : number_format((int)$n); }

function download(string $url, string $platform): array {
    global $cfg;
    $dir = sys_get_temp_dir() . '/dl_' . uniqid();
    mkdir($dir, 0700, true);
    $mb = $cfg['max_mb'];
    $audio = $platform === 'ساوند كلاود';
    // صيغ مفردة جاهزة (بدون دمج) للحصول على أعلى سرعة
    $fmt = $audio ? 'ba[ext=mp3]/ba[ext=m4a]/ba' : "b[ext=mp4][filesize<{$mb}M]/b[filesize<{$mb}M]/b[filesize_approx<{$mb}M]/b[ext=mp4]/b";
    $cmd = sprintf(
        'timeout %d %s -J --no-simulate --no-playlist --no-warnings --concurrent-fragments 8 --no-part -f %s -o %s %s 2>/dev/null',
        $cfg['timeout'], escapeshellarg($cfg['ytdlp']), escapeshellarg($fmt),
        escapeshellarg($dir . '/%(id)s.%(ext)s'), escapeshellarg($url)
    );
    $info = json_decode((string)shell_exec($cmd), true);
    $files = glob($dir . '/*') ?: [];
    return [$info, $files[0] ?? null, $dir, $audio];
}

function cleanup(string $dir): void { foreach (glob($dir . '/*') ?: [] as $f) @unlink($f); @rmdir($dir); }

function handleLink(int $chat, string $url): void {
    global $cfg;
    $platform = platformOf($url);
    if (!$platform) { api('sendMessage', ['chat_id' => $chat, 'text' => '⌁︙الرابط غير مدعوم، أرسل رابطاً من المنصات المذكورة.']); return; }

    $wait = api('sendMessage', ['chat_id' => $chat, 'text' => 'لحظه من فضلك . . .']);
    $waitId = $wait['result']['message_id'] ?? null;
    api('sendChatAction', ['chat_id' => $chat, 'action' => 'upload_video']);

    [$info, $file, $dir, $audio] = download($url, $platform);

    if (!$info || !$file) {
        if ($waitId) api('editMessageText', ['chat_id' => $chat, 'message_id' => $waitId, 'text' => '⌁︙تعذّر التحميل، تأكد من الرابط وأن المحتوى عام.']);
        cleanup($dir); return;
    }
    if (filesize($file) > $cfg['max_mb'] * 1048576) {
        if ($waitId) api('editMessageText', ['chat_id' => $chat, 'message_id' => $waitId, 'text' => "⌁︙الملف أكبر من {$cfg['max_mb']} ميجابايت."]);
        cleanup($dir); return;
    }

    $caption = "🎬 <b>" . h(mb_substr($info['title'] ?? 'بدون عنوان', 0, 200)) . "</b>\n\n"
        . "👤 الناشر: " . h($info['uploader'] ?? $info['channel'] ?? '—') . "\n"
        . "🌐 المنصة: {$platform}\n"
        . (isset($info['duration']) ? "⏱ المدة: " . fmtDur($info['duration']) . "\n" : '')
        . "👁 المشاهدات: " . fmtNum($info['view_count'] ?? null) . "\n"
        . "❤️ الإعجابات: " . fmtNum($info['like_count'] ?? null) . "\n"
        . "💬 التعليقات: " . fmtNum($info['comment_count'] ?? null) . "\n"
        . (!empty($info['upload_date']) ? "📅 التاريخ: " . substr($info['upload_date'], 0, 4) . '-' . substr($info['upload_date'], 4, 2) . '-' . substr($info['upload_date'], 6, 2) . "\n" : '')
        . "💾 الحجم: " . round(filesize($file) / 1048576, 2) . " MB\n"
        . "🔗 <a href=\"" . h($url) . "\">الرابط الأصلي</a>";
    $caption = mb_substr($caption, 0, 1024);

    $p = ['chat_id' => $chat, 'caption' => $caption, 'parse_mode' => 'HTML'];
    if ($audio) {
        api('sendAudio', $p + ['title' => $info['title'] ?? '', 'performer' => $info['uploader'] ?? ''], ['audio' => $file]);
    } else {
        $p += ['supports_streaming' => 'true'];
        if (!empty($info['width'])) $p += ['width' => $info['width'], 'height' => $info['height'] ?? 0];
        if (!empty($info['duration'])) $p += ['duration' => (int)$info['duration']];
        api('sendVideo', $p, ['video' => $file]);
    }
    if ($waitId) api('deleteMessage', ['chat_id' => $chat, 'message_id' => $waitId]);
    cleanup($dir);
}

// ---- التوجيه ----
if (isset($update['callback_query'])) {
    $cq = $update['callback_query'];
    $uid = $cq['from']['id']; $chat = $cq['message']['chat']['id'];
    $missing = notSubscribed($uid);
    if ($missing) { api('answerCallbackQuery', ['callback_query_id' => $cq['id'], 'text' => 'لم تشترك بعد ❌', 'show_alert' => 'true']); exit; }
    api('answerCallbackQuery', ['callback_query_id' => $cq['id'], 'text' => 'تم التحقق ✅']);
    api('deleteMessage', ['chat_id' => $chat, 'message_id' => $cq['message']['message_id']]);
    welcome($chat);
    exit;
}

$msg = $update['message'] ?? null;
if (!$msg || !isset($msg['text'])) exit;
$chat = $msg['chat']['id']; $uid = $msg['from']['id']; $text = trim($msg['text']);

if ($missing = notSubscribed($uid)) { forceMessage($chat, $missing); exit; }

if (str_starts_with($text, '/start')) { welcome($chat); exit; }

if (preg_match('~https?://\S+~i', $text, $m)) handleLink($chat, $m[0]);
else api('sendMessage', ['chat_id' => $chat, 'text' => '⌁︙أرسل رابط الفيديو للتحميل.']);
