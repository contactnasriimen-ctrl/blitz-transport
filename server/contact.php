<?php
/**
 * Blitz Transport – Anfrageformular.
 * Empfänger/Absender kommen aus site.config.json (beim Build eingesetzt).
 * Läuft auf jedem Webspace mit PHP-mail() (z. B. OVH).
 */
declare(strict_types=1);

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$TO   = '%%email%%';
$FROM = '%%mailFrom%%';
$NAME = '%%company%%';

function reply(int $code, array $data): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    reply(405, ['ok' => false, 'error' => 'method']);
}

// Bots: Honeypot-Feld und Mindest-Ausfüllzeit (3 s).
if (!empty($_POST['website'])) {
    reply(200, ['ok' => true]);
}
$ts = (int)($_POST['ts'] ?? 0);
if ($ts > 0 && (time() * 1000 - $ts) < 3000) {
    reply(200, ['ok' => true]);
}

// Einfache Begrenzung: max. 5 Anfragen pro Stunde und IP (nur als Hash, nach 1 h gelöscht).
foreach (glob(sys_get_temp_dir() . '/blitz_rl_*') ?: [] as $old) {
    if (@filemtime($old) < time() - 3600) {
        @unlink($old);
    }
}
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rlFile = sys_get_temp_dir() . '/blitz_rl_' . hash('sha256', $ip);
$hits = [];
if (is_file($rlFile)) {
    $hits = array_filter(
        array_map('intval', explode(',', (string)file_get_contents($rlFile))),
        fn($t) => $t > time() - 3600
    );
}
if (count($hits) >= 5) {
    reply(429, ['ok' => false, 'error' => 'rate']);
}
$hits[] = time();
@file_put_contents($rlFile, implode(',', $hits));

function field(string $key, int $max = 300): string {
    $v = trim((string)($_POST[$key] ?? ''));
    $v = str_replace(["\r", "\0"], '', $v);
    return mb_substr($v, 0, $max);
}

$service = field('service', 120);
$from    = field('from', 120);
$to      = field('to', 120);
$date    = field('date', 40);
$cargo   = field('cargo', 3000);
$name    = field('name', 120);
$phone   = field('phone', 60);
$email   = field('email', 160);
$consent = field('consent', 10);

if ($name === '' || ($phone === '' && $email === '') || $consent === '') {
    reply(422, ['ok' => false, 'error' => 'missing']);
}
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    reply(422, ['ok' => false, 'error' => 'email']);
}

$oneLine = fn(string $s) => preg_replace('/[\r\n]+/', ' ', $s);

$body = "Neue Transportanfrage über die Website\n"
      . "======================================\n\n"
      . "Leistung:     " . ($service ?: '–') . "\n"
      . "Abholung:     " . ($from ?: '–') . "\n"
      . "Zustellung:   " . ($to ?: '–') . "\n"
      . "Wunschtermin: " . ($date ?: '–') . "\n\n"
      . "Was wird transportiert?\n" . ($cargo ?: '–') . "\n\n"
      . "Kontakt\n"
      . "Name:    " . $name . "\n"
      . "Telefon: " . ($phone ?: '–') . "\n"
      . "E-Mail:  " . ($email ?: '–') . "\n\n"
      . "Gesendet am " . date('d.m.Y H:i') . " Uhr\n";

$subject = 'Anfrage: ' . $oneLine($service ?: 'Transport') . ' – ' . $oneLine($name);

$headers = [
    'From: ' . mb_encode_mimeheader($NAME . ' Website', 'UTF-8') . ' <' . $FROM . '>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
];
if ($email !== '') {
    $headers[] = 'Reply-To: ' . $oneLine($email);
}

$sent = @mail($TO, mb_encode_mimeheader($subject, 'UTF-8'), $body, implode("\r\n", $headers), '-f' . $FROM);

reply($sent ? 200 : 500, ['ok' => $sent]);
