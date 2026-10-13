import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const DB_FILE = path.resolve(__dirname, 'database.json');

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Zero-Cache Headers for all API responses
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Helper for Atomic File Read
function readDatabase() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return null;
    }
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading database.json:', err);
    return null;
  }
}

// Helper for Atomic File Write (Write to temp file and rename)
function writeDatabase(data: any): boolean {
  const tempPath = `${DB_FILE}.tmp.${Date.now()}`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, DB_FILE);
    return true;
  } catch (err) {
    console.error('Error writing database.json:', err);
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch (_) {}
    return false;
  }
}

// 7-Minute Token Rotation Helper
function generateToken(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  let token = '';
  for (let i = 0; i < 3; i++) token += letters.charAt(Math.floor(Math.random() * letters.length));
  for (let i = 0; i < 3; i++) token += digits.charAt(Math.floor(Math.random() * digits.length));
  return token;
}

function checkAndRotateTokenIfExpired(db: any): boolean {
  if (!db || !db.systemConfig) return false;
  const rotationMinutes = db.systemConfig.tokenRotationMinutes || 7;
  const lastRotated = db.systemConfig.tokenLastRotated ? new Date(db.systemConfig.tokenLastRotated).getTime() : 0;
  const now = Date.now();
  if (now - lastRotated >= rotationMinutes * 60 * 1000) {
    const newToken = generateToken();
    db.systemConfig.currentToken = newToken;
    db.systemConfig.tokenLastRotated = new Date(now).toISOString();
    if (db.schedules) {
      db.schedules.forEach((s: any) => {
        if (s.isActive) s.token = newToken;
      });
      if (!db.schedules.some((s: any) => s.isActive) && db.schedules.length > 0) {
        db.schedules[0].token = newToken;
      }
    }
    return true;
  }
  return false;
}

// Auto-sync schedule isActive status without overriding admin manual start/stop
function autoSyncSchedules(db: any): boolean {
  if (!db || !db.schedules) return false;
  let changed = false;
  // Preserve admin manual activation state.
  return changed;
}

// --- API ROUTES ---

// Health & Sync Check
app.get('/api/health', (req, res) => {
  const db = readDatabase();
  res.json({
    status: 'ok',
    app: 'BAGJA EXAM',
    version: '1.0.1',
    serverTime: new Date().toISOString(),
    databaseConnected: !!db,
    totalStudents: db?.students?.length || 0,
    totalSchedules: db?.schedules?.length || 0,
  });
});

// Get Database
app.get('/api/database', (req, res) => {
  const db = readDatabase();
  if (!db) {
    return res.status(500).json({ error: 'Gagal membaca basis data server.' });
  }
  let needsSave = false;
  if (checkAndRotateTokenIfExpired(db)) {
    needsSave = true;
  }
  if (autoSyncSchedules(db)) {
    needsSave = true;
  }
  if (needsSave) {
    writeDatabase(db);
  }
  res.json(db);
});

// Save Full Database
app.post('/api/database', (req, res) => {
  const incoming = req.body;
  if (!incoming || typeof incoming !== 'object') {
    return res.status(400).json({ error: 'Format data tidak valid.' });
  }

  // Validasi Kapasitas Ruangan (Maks 44 Siswa per Ruang Kelas, Maks 120 Siswa per Lab Komputer)
  if (Array.isArray(incoming.students)) {
    const counts: Record<string, number> = {};
    for (const student of incoming.students) {
      const r = student.ruang || 'Lab Komputer';
      counts[r] = (counts[r] || 0) + 1;
    }

    for (const [roomName, count] of Object.entries(counts)) {
      const norm = roomName.toLowerCase();
      const isLab = norm.includes('lab') || norm.includes('laboratorium') || norm.includes('komputer');
      const maxAllowed = isLab ? 120 : 44;
      if (count > maxAllowed) {
        return res.status(400).json({
          error: `Kapasitas ruangan "${roomName}" melampaui batas maksimal! Maksimal ${maxAllowed} siswa (${isLab ? 'Lab Komputer' : 'Ruang Kelas'}), namun teralokasi ${count} siswa.`
        });
      }
    }
  }

  // Audit entry
  const now = new Date().toISOString();
  if (!incoming.auditLogs) incoming.auditLogs = [];
  incoming.auditLogs.unshift({
    id: `LOG-${Date.now()}`,
    timestamp: now,
    userId: req.body.userId || 'ADMIN',
    action: req.body.auditAction || 'Pembaruan Basis Data',
    category: 'Sistem',
    details: req.body.auditDetails || 'Data database.json diperbarui secara menyeluruh.'
  });

  const success = writeDatabase(incoming);
  if (success) {
    res.json({ success: true, message: 'Basis data berhasil disimpan.', timestamp: now });
  } else {
    res.status(500).json({ error: 'Gagal menulis ke database.json.' });
  }
});

// Student Heartbeat
app.post('/api/heartbeat', (req, res) => {
  const { noPeserta, status, deviceType, answersSummary } = req.body;
  if (!noPeserta) return res.status(400).json({ error: 'noPeserta diperlukan' });

  const db = readDatabase();
  if (!db) return res.status(500).json({ error: 'DB Error' });

  const student = db.students.find((s: any) => s.noPeserta === noPeserta || s.nisn === noPeserta);
  if (!student) return res.status(404).json({ error: 'Siswa tidak ditemukan' });

  student.lastActive = new Date().toISOString();
  if (deviceType) student.deviceType = deviceType;
  if (answersSummary) student.answersSummary = answersSummary;
  if (status && student.status !== 'Ditangguhkan' && student.status !== 'Selesai') {
    student.status = status;
  }

  // Get active broadcast for this student's room
  const activeBroadcast = db.broadcasts?.find((b: any) => b.room === student.ruang && b.active);

  writeDatabase(db);
  res.json({
    success: true,
    studentStatus: student.status,
    violationsCount: student.violationsCount,
    broadcast: activeBroadcast?.message || null,
    maintenanceMode: db.systemConfig.maintenanceMode,
    tolerance: db.systemConfig.violationTolerance,
  });
});

// Student Violation Logging
app.post('/api/violation', (req, res) => {
  const { noPeserta, violationType, details, timestamp } = req.body;
  const db = readDatabase();
  if (!db) return res.status(500).json({ error: 'DB Error' });

  const student = db.students.find((s: any) => s.noPeserta === noPeserta || s.nisn === noPeserta);
  if (!student) return res.status(404).json({ error: 'Siswa tidak ditemukan' });

  student.violationsCount = (student.violationsCount || 0) + 1;
  const tolerance = db.systemConfig.violationTolerance || 3;
  let isSuspended = false;

  if (student.violationsCount >= tolerance) {
    student.status = 'Ditangguhkan';
    isSuspended = true;
  }

  const violationRecord = {
    id: `VIOL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: timestamp || new Date().toISOString(),
    noPeserta: student.noPeserta,
    nama: student.nama,
    kelas: student.kelas,
    ruang: student.ruang,
    type: violationType || 'Keluar Tab / Blur Layar',
    details: details || 'Mendeteksi kehilangan fokus peramban atau tindakan terlarang',
    violationIndex: student.violationsCount,
    isSuspended
  };

  if (!db.integrityLogs) db.integrityLogs = [];
  db.integrityLogs.unshift(violationRecord);

  writeDatabase(db);
  res.json({
    success: true,
    violationsCount: student.violationsCount,
    isSuspended,
    status: student.status,
    message: isSuspended ? 'Batas pelanggaran terlampaui. Ujian ditangguhkan!' : 'Pelanggaran tercatat.'
  });
});

// Remote or Local Kiosk Unlock
app.post('/api/kiosk-unlock', (req, res) => {
  const { noPeserta, supervisorPin, unlockedBy, resetViolations } = req.body;
  const db = readDatabase();
  if (!db) return res.status(500).json({ error: 'DB Error' });

  // Verify PIN if provided by student screen
  if (supervisorPin) {
    const validSupervisor = db.supervisors.find((s: any) => s.pin === supervisorPin);
    const isAdmin = supervisorPin === db.systemConfig.adminPassword || supervisorPin === db.systemConfig.kioskEmergencyPin;
    if (!validSupervisor && !isAdmin) {
      return res.status(403).json({ error: 'Password / PIN Pengawas salah!' });
    }
  }

  const student = db.students.find((s: any) => s.noPeserta === noPeserta || s.nisn === noPeserta);
  if (!student) return res.status(404).json({ error: 'Siswa tidak ditemukan' });

  // Direct unlock allows student to continue seamlessly
  student.status = 'Sedang Mengerjakan';
  if (resetViolations) {
    student.violationsCount = 0;
  }

  // Audit
  if (!db.auditLogs) db.auditLogs = [];
  db.auditLogs.unshift({
    id: `LOG-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: unlockedBy || 'PENGAWAS',
    action: 'Buka Kunci Ujian',
    category: 'Pengawasan',
    details: `Ujian siswa ${student.nama} (${student.noPeserta}) dibuka kunci di ruang ${student.ruang}.`
  });

  writeDatabase(db);
  res.json({
    success: true,
    message: 'Kunci ujian berhasil dibuka. Siswa dapat melanjutkan ujian.',
    student
  });
});

// Reset Student
app.post('/api/reset-student', (req, res) => {
  const { noPeserta, resetBy } = req.body;
  const db = readDatabase();
  if (!db) return res.status(500).json({ error: 'DB Error' });

  const student = db.students.find((s: any) => s.noPeserta === noPeserta || s.nisn === noPeserta);
  if (!student) return res.status(404).json({ error: 'Siswa tidak ditemukan' });

  student.status = 'Belum Masuk';
  student.violationsCount = 0;
  student.lastActive = null;

  if (!db.auditLogs) db.auditLogs = [];
  db.auditLogs.unshift({
    id: `LOG-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: resetBy || 'PENGAWAS',
    action: 'Reset Status Siswa',
    category: 'Pengawasan',
    details: `Status ${student.nama} (${student.noPeserta}) direset ke Belum Masuk.`
  });

  writeDatabase(db);
  res.json({ success: true, message: 'Status siswa berhasil direset.', student });
});

// Room Broadcast Announcement
app.post('/api/broadcast', (req, res) => {
  const { room, message, supervisorName } = req.body;
  if (!room || !message) return res.status(400).json({ error: 'Ruang dan pesan wajib diisi.' });

  const db = readDatabase();
  if (!db) return res.status(500).json({ error: 'DB Error' });

  if (!db.broadcasts) db.broadcasts = [];
  
  // Deactivate previous broadcasts for this room
  db.broadcasts.forEach((b: any) => {
    if (b.room === room) b.active = false;
  });

  const newBroadcast = {
    id: `BC-${Date.now()}`,
    room,
    message,
    timestamp: new Date().toISOString(),
    active: true,
    supervisorName: supervisorName || 'Pengawas Ruang'
  };

  db.broadcasts.unshift(newBroadcast);

  writeDatabase(db);
  res.json({ success: true, broadcast: newBroadcast });
});

// Rotate Token
app.post('/api/token/rotate', (req, res) => {
  const { scheduleId } = req.body;
  const db = readDatabase();
  if (!db) return res.status(500).json({ error: 'DB Error' });

  // Generate 6-char token: 3 uppercase letters + 3 digits
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  let newToken = '';
  for (let i = 0; i < 3; i++) newToken += letters.charAt(Math.floor(Math.random() * letters.length));
  for (let i = 0; i < 3; i++) newToken += digits.charAt(Math.floor(Math.random() * digits.length));

  db.systemConfig.currentToken = newToken;
  db.systemConfig.tokenLastRotated = new Date().toISOString();

  if (scheduleId) {
    const sch = db.schedules.find((s: any) => s.id === scheduleId);
    if (sch) sch.token = newToken;
  } else {
    const activeSch = db.schedules.find((s: any) => s.isActive);
    if (activeSch) {
      activeSch.token = newToken;
    } else if (db.schedules && db.schedules.length > 0) {
      db.schedules[0].token = newToken;
    }
  }

  writeDatabase(db);
  res.json({ success: true, token: newToken, rotatedAt: db.systemConfig.tokenLastRotated });
});

// Finish Exam Submission
app.post('/api/finish-exam', (req, res) => {
  const { noPeserta } = req.body;
  const db = readDatabase();
  if (!db) return res.status(500).json({ error: 'DB Error' });

  const student = db.students.find((s: any) => s.noPeserta === noPeserta || s.nisn === noPeserta);
  if (!student) return res.status(404).json({ error: 'Siswa tidak ditemukan' });

  student.status = 'Selesai';
  student.lastActive = new Date().toISOString();

  if (!db.auditLogs) db.auditLogs = [];
  db.auditLogs.unshift({
    id: `LOG-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: student.nama,
    action: 'Kirim Jawaban Ujian',
    category: 'Ujian',
    details: `Siswa ${student.nama} (${student.noPeserta}) telah menyelesaikan ujian secara sah.`
  });

  writeDatabase(db);
  res.json({ success: true, message: 'Ujian berhasil diselesaikan.' });
});

// Download / View cPanel DomaiNesia PHP backend script
app.get('/api.php', (req, res) => {
  const phpPath = path.resolve(__dirname, 'public/api.php');
  if (fs.existsSync(phpPath)) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(fs.readFileSync(phpPath, 'utf-8'));
  } else {
    res.status(404).send('api.php belum di-generate');
  }
});

// Mount Vite in development or Serve Static Build in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BAGJA EXAM Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
