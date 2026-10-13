export type DeviceType = 'Komputer' | 'Handphone' | 'Tablet';

export type StudentStatus = 'Belum Masuk' | 'Sedang Mengerjakan' | 'Ditangguhkan' | 'Selesai';

export interface StudentAnswersSummary {
  answered: number;
  total: number;
}

export interface Student {
  noPeserta: string;
  nisn: string;
  nipd: string;
  nama: string;
  kelas: string;
  ruang: string;
  nomorMeja?: string;
  noTempatDuduk?: string;
  status: StudentStatus;
  violationsCount: number;
  lastActive: string | null;
  deviceType: DeviceType;
  answersSummary?: StudentAnswersSummary;
  ipAddress?: string;
  savedAnswers?: Record<string, string>;
}

export interface Supervisor {
  nip: string;
  nama: string;
  ruang?: string;
  pin: string;
}

export interface SupervisionDuty {
  id: string;
  scheduleId?: string;
  subject: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  session?: string; // Sesi 1, Sesi 2, dll.
  room: string;
  supervisorNip: string;
  supervisorNama: string;
  supervisorNip2?: string;
  supervisorNama2?: string;
  notes?: string;
  status?: 'Terjadwal' | 'Bertugas' | 'Selesai';
}

export interface Schedule {
  id: string;
  subject: string;
  date: string;
  startTime: string; // HH:mm
  durationMinutes: number;
  endTime: string; // HH:mm
  classes: string[];
  token?: string;
  formUrl: string;
  classFormUrls?: Record<string, string>;
  isActive: boolean;
  description?: string;
  totalQuestions?: number;
}

export interface SchoolInfo {
  namaSekolah: string;
  npsn: string;
  kabupatenKota: string;
  tahunAjaran: string;
  semester: string;
  alamat: string;
  website: string;
  email: string;
  telepon: string;
  namaKepalaSekolah: string;
  nipKepalaSekolah: string;
  namaKetuaPelaksana: string;
  nipKetuaPelaksana: string;
  defaultNomorSurat: string;
}

export interface LetterheadConfig {
  pemerintahKota: string;
  dinasPendidikan: string;
  namaSekolah: string;
  alamat: string;
  telepon?: string;
  website?: string;
  email?: string;
  kontakInfo: string;
}

export interface SystemConfig {
  brandName: string;
  examType: string;
  tagline: string;
  shortDescription: string;
  maintenanceMode: boolean;
  maintenanceVersion: string;
  violationTolerance: number;
  adminPassword: string;
  kioskEmergencyPin: string;
  supervisorDefaultPin: string;
  soundAlarmEnabled: boolean;
  mobileKioskStrict: boolean;
  screenWakeLock: boolean;
  currentToken: string;
  tokenRotationMinutes: number;
  tokenLastRotated: string;
  logoPemkot: string;
  logoSekolah: string;
  faviconUrl: string;
  schoolInfo: SchoolInfo;
  letterhead: LetterheadConfig;
}

export interface BroadcastMessage {
  id: string;
  room: string;
  message: string;
  timestamp: string;
  active: boolean;
  supervisorName?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  category: 'Sistem' | 'Jadwal' | 'Siswa' | 'Pengawas' | 'Ujian' | 'Pengawasan';
  details: string;
}

export interface IntegrityLog {
  id: string;
  timestamp: string;
  noPeserta: string;
  nama: string;
  kelas: string;
  ruang: string;
  type: string;
  details: string;
  violationIndex: number;
  isSuspended: boolean;
}

export interface DatabaseSchema {
  systemConfig: SystemConfig;
  rooms: string[];
  classes: string[];
  subjects: string[];
  schedules: Schedule[];
  students: Student[];
  supervisors: Supervisor[];
  supervisionDuties?: SupervisionDuty[];
  broadcasts: BroadcastMessage[];
  auditLogs: AuditLog[];
  integrityLogs: IntegrityLog[];
}
