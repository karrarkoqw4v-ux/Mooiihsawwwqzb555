<?php
// تشغيل بدون دومين/HTTPS: php poll.php   (يعمل على أي خادم أو جهاز)
$cfg = require __DIR__ . '/config.php';
$api = "https://api.telegram.org/bot{$cfg['token']}/";
file_get_contents($api . 'deleteWebhook');
$offset = 0;
echo "Bot started. Waiting for messages...\n";
while (true) {
    $r = json_decode(@file_get_contents($api . 'getUpdates?' . http_build_query(['offset' => $offset, 'timeout' => 30])), true);
    foreach ($r['result'] ?? [] as $u) {
        $offset = $u['update_id'] + 1;
        $f = tempnam(sys_get_temp_dir(), 'upd');
        file_put_contents($f, json_encode($u));
        // كل رسالة بعملية مستقلة حتى يعمل الجميع بالتوازي
        exec(sprintf('php %s < %s > /dev/null 2>&1 &', escapeshellarg(__DIR__ . '/bot.php'), escapeshellarg($f)));
    }
    if (!$r) sleep(2);
}
