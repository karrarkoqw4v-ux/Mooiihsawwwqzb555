<?php
// php set_webhook.php https://yourdomain.com/download-bot/bot.php
$cfg = require __DIR__ . '/config.php';
$url = $argv[1] ?? die("usage: php set_webhook.php <https-url-of-bot.php>\n");
$r = file_get_contents("https://api.telegram.org/bot{$cfg['token']}/setWebhook?" . http_build_query([
    'url' => $url, 'secret_token' => $cfg['secret'], 'max_connections' => 40, 'drop_pending_updates' => 'true',
]));
echo $r, "\n";
