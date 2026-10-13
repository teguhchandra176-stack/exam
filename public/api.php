<?php
/**
 * BAGJA EXAM - Backend Engine Lengkap untuk cPanel DomaiNesia & Apache/Nginx Web Server
 * Dilengkapi Atomic File Locking flock(LOCK_EX) dan Auto-Chmod 0666
 * SMP NEGERI 7 CIMAHI - TANGGUH - JUARA - PASTI BISA
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dbFile = __DIR__ . '/database.json';
if (!file_exists($dbFile)) {
    $dbFile = dirname(__DIR__) . '/database.json';
}

function read_db_locked($file) {
    if (!file_exists($file)) return null;
    $fp = fopen($file, 'r');
    if (!$fp) return null;
    flock($fp, LOCK_SH);
    $content = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return json_decode($content, true);
}

function write_db_locked($file, $data) {
    $fp = fopen($file, 'c+');
    if (!$fp) return false;
    flock($fp, LOCK_EX);
    ftruncate($fp, 0);
    rewind($fp);
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    fwrite($fp, $json);
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    @chmod($file, 0666);
    return true;
}

$action = isset($_GET['action']) ? $_GET['action'] : '';
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true) ?: $_POST;

switch ($action) {
    case 'health':
        $db = read_db_locked($dbFile);
        echo json_encode([
            'status' => 'ok',
            'app' => 'BAGJA EXAM',
            'engine' => 'PHP cPanel DomaiNesia Engine',
            'serverTime' => date('c'),
            'databaseConnected' => !empty($db),
            'studentsCount' => isset($db['students']) ? count($db['students']) : 0
        ]);
        break;

    case 'get_db':
        $db = read_db_locked($dbFile);
        if (!$db) {
            http_response_code(500);
            echo json_encode(['error' => 'Gagal membaca basis data.']);
            exit;
        }
        echo json_encode($db);
        break;

    case 'save_db':
        if (empty($input)) {
            http_response_code(400);
            echo json_encode(['error' => 'Data tidak valid.']);
            exit;
        }

        // Validasi Kapasitas Ruangan (Maks 44 Siswa per Ruang Kelas, Maks 120 Siswa per Lab Komputer)
        if (isset($input['students']) && is_array($input['students'])) {
            $roomCounts = [];
            foreach ($input['students'] as $st) {
                $r = isset($st['ruang']) ? $st['ruang'] : 'Lab Komputer';
                $roomCounts[$r] = ($roomCounts[$r] ?? 0) + 1;
            }
            foreach ($roomCounts as $rName => $c) {
                $low = strtolower($rName);
                $isLab = (strpos($low, 'lab') !== false || strpos($low, 'laboratorium') !== false || strpos($low, 'komputer') !== false);
                $maxAllowed = $isLab ? 120 : 44;
                if ($c > $maxAllowed) {
                    http_response_code(400);
                    echo json_encode([
                        'error' => "Kapasitas ruangan '{$rName}' melampaui batas maksimal! Maksimal {$maxAllowed} siswa, teralokasi {$c} siswa."
                    ]);
                    exit;
                }
            }
        }

        $success = write_db_locked($dbFile, $input);
        echo json_encode(['success' => $success]);
        break;

    case 'heartbeat':
        $db = read_db_locked($dbFile);
        $noPeserta = isset($input['noPeserta']) ? $input['noPeserta'] : '';
        if (!$db || !$noPeserta) {
            http_response_code(400);
            echo json_encode(['error' => 'Data tidak lengkap']);
            exit;
        }
        foreach ($db['students'] as &$s) {
            if ($s['noPeserta'] === $noPeserta || $s['nisn'] === $noPeserta) {
                $s['lastActive'] = date('c');
                if (isset($input['deviceType'])) $s['deviceType'] = $input['deviceType'];
                if (isset($input['answersSummary'])) $s['answersSummary'] = $input['answersSummary'];
                if ($s['status'] !== 'Ditangguhkan' && $s['status'] !== 'Selesai' && isset($input['status'])) {
                    $s['status'] = $input['status'];
                }
                break;
            }
        }
        write_db_locked($dbFile, $db);
        echo json_encode(['success' => true]);
        break;

    case 'violation':
        $db = read_db_locked($dbFile);
        $noPeserta = isset($input['noPeserta']) ? $input['noPeserta'] : '';
        $type = isset($input['violationType']) ? $input['violationType'] : 'Keluar Tab / Blur Layar';
        $isSuspended = false;

        foreach ($db['students'] as &$s) {
            if ($s['noPeserta'] === $noPeserta || $s['nisn'] === $noPeserta) {
                $s['violationsCount'] = (int)($s['violationsCount'] ?? 0) + 1;
                $tol = (int)($db['systemConfig']['violationTolerance'] ?? 3);
                if ($s['violationsCount'] >= $tol) {
                    $s['status'] = 'Ditangguhkan';
                    $isSuspended = true;
                }
                $violRecord = [
                    'id' => 'VIOL-' . round(microtime(true) * 1000),
                    'timestamp' => date('c'),
                    'noPeserta' => $s['noPeserta'],
                    'nama' => $s['nama'],
                    'kelas' => $s['kelas'],
                    'ruang' => $s['ruang'],
                    'type' => $type,
                    'details' => $input['details'] ?? 'Kehilangan fokus browser terdeteksi.',
                    'violationIndex' => $s['violationsCount'],
                    'isSuspended' => $isSuspended
                ];
                if (!isset($db['integrityLogs'])) $db['integrityLogs'] = [];
                array_unshift($db['integrityLogs'], $violRecord);
                break;
            }
        }
        write_db_locked($dbFile, $db);
        echo json_encode(['success' => true, 'isSuspended' => $isSuspended]);
        break;

    case 'kiosk_unlock':
        $db = read_db_locked($dbFile);
        $noPeserta = isset($input['noPeserta']) ? $input['noPeserta'] : '';
        foreach ($db['students'] as &$s) {
            if ($s['noPeserta'] === $noPeserta || $s['nisn'] === $noPeserta) {
                $s['status'] = 'Sedang Mengerjakan';
                if (!empty($input['resetViolations'])) $s['violationsCount'] = 0;
                break;
            }
        }
        write_db_locked($dbFile, $db);
        echo json_encode(['success' => true]);
        break;

    case 'token_rotate':
        $db = read_db_locked($dbFile);
        if (!$db) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error']);
            exit;
        }
        $letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        $digits = '23456789';
        $newToken = '';
        for ($i = 0; $i < 3; $i++) $newToken .= $letters[rand(0, strlen($letters) - 1)];
        for ($i = 0; $i < 3; $i++) $newToken .= $digits[rand(0, strlen($digits) - 1)];

        $db['systemConfig']['currentToken'] = $newToken;
        $db['systemConfig']['tokenLastRotated'] = date('c');
        $scheduleId = isset($input['scheduleId']) ? $input['scheduleId'] : null;

        if (isset($db['schedules']) && is_array($db['schedules'])) {
            foreach ($db['schedules'] as &$sch) {
                if ($scheduleId && $sch['id'] === $scheduleId) {
                    $sch['token'] = $newToken;
                } else if (!$scheduleId && !empty($sch['isActive'])) {
                    $sch['token'] = $newToken;
                }
            }
        }
        write_db_locked($dbFile, $db);
        echo json_encode(['success' => true, 'token' => $newToken, 'rotatedAt' => $db['systemConfig']['tokenLastRotated']]);
        break;

    default:
        echo json_encode(['status' => 'ready', 'endpoint' => 'api.php', 'time' => date('c')]);
        break;
}
