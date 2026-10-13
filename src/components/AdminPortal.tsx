import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  LayoutDashboard,
  Calendar,
  Users,
  UserCheck,
  Printer,
  FileSpreadsheet,
  Settings,
  Plus,
  Trash2,
  Edit2,
  Download,
  Upload,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Sliders,
  Play,
  Square,
  FileText,
  Save,
  Check,
  X,
  Image as ImageIcon,
  Monitor,
  Smartphone,
  Tablet,
  ExternalLink,
  Maximize2,
  Layers,
  Link2,
  Filter,
  Sparkles,
  CalendarCheck,
  Unlock
} from 'lucide-react';
import {
  DatabaseSchema,
  Student,
  Supervisor,
  Schedule,
  AuditLog,
  SystemConfig,
  DeviceType
} from '../types';
import { apiClient } from '../services/apiClient';
import { StudioCetakDokumen } from './StudioCetakDokumen';
import { SmartImportModal } from './SmartImportModal';
import { JadwalPengawasanManager } from './JadwalPengawasanManager';
import { formatIndonesianDate } from '../services/dateFormatter';
import { getScheduleTiming } from '../services/scheduleTiming';
import {
  MAX_STUDENTS_PER_ROOM,
  MAX_STUDENTS_PER_LAB,
  isComputerLab,
  getRoomMaxCapacity,
  countStudentsInRoom,
  checkRoomCapacity,
  validateBatchRoomCapacities
} from '../services/roomCapacity';

interface AdminPortalProps {
  database: DatabaseSchema;
  onRefreshDatabase: () => Promise<void>;
  onSaveDatabase: (newDb: DatabaseSchema, actionName: string, actionDetails: string) => Promise<boolean>;
  deviceType?: DeviceType;
}

type AdminTab =
  | 'overview'
  | 'jadwal'
  | 'siswa'
  | 'pengawas'
  | 'jadwal_pengawas'
  | 'studio_cetak'
  | 'audit_log'
  | 'pengaturan';

export const AdminPortal: React.FC<AdminPortalProps> = ({
  database,
  onRefreshDatabase,
  onSaveDatabase,
  deviceType = 'Komputer',
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // Search & Filter States
  const [studentSearch, setStudentSearch] = useState('');
  const [studentClassFilter, setStudentClassFilter] = useState('semua');
  const [studentRoomFilter, setStudentRoomFilter] = useState('semua');
  const [supervisorSearch, setSupervisorSearch] = useState('');

  // Modals for CRUD
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isSmartImportStudentOpen, setIsSmartImportStudentOpen] = useState(false);
  const [studentFormData, setStudentFormData] = useState<Partial<Student>>({});

  const [editingSupervisor, setEditingSupervisor] = useState<Supervisor | null>(null);
  const [isAddSupervisorOpen, setIsAddSupervisorOpen] = useState(false);
  const [isSmartImportSupervisorOpen, setIsSmartImportSupervisorOpen] = useState(false);
  const [supervisorFormData, setSupervisorFormData] = useState<Partial<Supervisor>>({});

  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [isAddScheduleOpen, setIsAddScheduleOpen] = useState(false);
  const [scheduleFormData, setScheduleFormData] = useState<Partial<Schedule>>({
    classes: [],
    classFormUrls: {},
    date: new Date().toISOString().split('T')[0],
    durationMinutes: 90,
    startTime: '07:30',
    endTime: '09:00',
    isActive: false,
    totalQuestions: 40,
    formUrl: ''
  });

  // Schedule filtering state
  const [scheduleClassFilter, setScheduleClassFilter] = useState<string>('semua');
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<'semua' | 'aktif' | 'nonaktif'>('semua');
  const [scheduleSearchQuery, setScheduleSearchQuery] = useState<string>('');

  // Class & Question Configuration in Schedule Modal
  const [isPerClassFormMode, setIsPerClassFormMode] = useState<boolean>(false);
  const [scheduleModalGradeTab, setScheduleModalGradeTab] = useState<'all' | '7' | '8' | '9'>('all');
  const [bulkUrlInput, setBulkUrlInput] = useState<string>('');

  // Live Exam Question Preview State
  const [previewSchedule, setPreviewSchedule] = useState<Schedule | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [previewClassSelect, setPreviewClassSelect] = useState<string>('');

  // Safe Confirmation Modal
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: async () => {},
  });

  // Settings local state
  const [settingsForm, setSettingsForm] = useState<SystemConfig>(database.systemConfig);
  const [newAdminPassword, setNewAdminPassword] = useState('');

  // Sync test notification
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Statistics calculation
  const totalStudents = database.students?.length || 0;
  const workingCount = (database.students || []).filter(s => s.status === 'Sedang Mengerjakan').length;
  const suspendedCount = (database.students || []).filter(s => s.status === 'Ditangguhkan').length;
  const finishedCount = (database.students || []).filter(s => s.status === 'Selesai').length;
  const notYetCount = (database.students || []).filter(s => s.status === 'Belum Masuk').length;

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return (database.students || []).filter(s => {
      const matchSearch =
        s.nama.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.noPeserta.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.nisn.toLowerCase().includes(studentSearch.toLowerCase());

      const matchClass = studentClassFilter === 'semua' ? true : s.kelas === studentClassFilter;
      const matchRoom = studentRoomFilter === 'semua' ? true : s.ruang === studentRoomFilter;

      return matchSearch && matchClass && matchRoom;
    });
  }, [database.students, studentSearch, studentClassFilter, studentRoomFilter]);

  // Filtered Supervisors
  const filteredSupervisors = useMemo(() => {
    return (database.supervisors || []).filter(s =>
      s.nama.toLowerCase().includes(supervisorSearch.toLowerCase()) ||
      s.nip.toLowerCase().includes(supervisorSearch.toLowerCase())
    );
  }, [database.supervisors, supervisorSearch]);

  // Helper to open confirmation dialog
  const promptConfirm = (title: string, message: string, onConfirm: () => Promise<void>) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm });
  };

  // Test Online Sync Handler
  const handleTestSync = async () => {
    const health = await apiClient.getHealth();
    if (health.databaseConnected) {
      setSyncNotice(`Sinkronisasi Database Online Berhasil! Latensi: ${health.latencyMs}ms. Status: Server Aktif.`);
    } else {
      setSyncNotice('Peringatan: Gagal menghubungi server backend. Menyimpan perubahan secara lokal.');
    }
    setTimeout(() => setSyncNotice(null), 4000);
  };

  // ==================== CSV / JSON IMPORT & EXPORT ====================

  // Student CSV Template Download
  const downloadStudentTemplate = () => {
    const header = 'No Peserta;NISN;NIPD;Nama Siswa;Kelas;Ruang\n';
    const sample = '26-07-001-01;0091234561;242507001;Ahmad Fauzi Pratama;7-A;Lab Komputer\n26-07-001-02;0091234562;242507002;Alya Putri Ramadhani;7-A;Lab Komputer\n';
    const blob = new Blob([header + sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Template_Peserta_Siswa_SMPN7.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Student CSV
  const exportStudentsCSV = () => {
    let csv = 'No Peserta;NISN;NIPD;Nama Siswa;Kelas;Ruang;Status;Pelanggaran\n';
    (database.students || []).forEach(s => {
      csv += `${s.noPeserta};${s.nisn};${s.nipd};${s.nama};${s.kelas};${s.ruang};${s.status};${s.violationsCount || 0}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Master_Siswa_BAGJA_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import Student CSV
  const handleImportStudentsCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const lines = content.split('\n').filter(l => l.trim().length > 0);
      if (lines.length <= 1) return alert('File CSV kosong atau tidak valid.');

      const newStudents: Student[] = [];
      // Skip header line
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(';').map(p => p.trim());
        if (parts.length >= 6) {
          newStudents.push({
            noPeserta: parts[0],
            nisn: parts[1],
            nipd: parts[2],
            nama: parts[3],
            kelas: parts[4],
            ruang: parts[5],
            status: 'Belum Masuk',
            violationsCount: 0,
            lastActive: null,
            deviceType: 'Komputer',
            answersSummary: { answered: 0, total: 40 }
          });
        }
      }

      // Validasi Kapasitas Ruangan (Maks 44 Siswa per Ruang, Maks 120 Siswa per Lab Komputer)
      const capValidation = validateBatchRoomCapacities(database.students || [], newStudents, 'append');
      if (!capValidation.isValid) {
        const errorList = capValidation.violations
          .slice(0, 3)
          .map(v => `• ${v.errorMessage}`)
          .join('\n');
        const moreCount = capValidation.violations.length - 3;
        const moreText = moreCount > 0 ? `\n...dan ${moreCount} ruangan lainnya.` : '';

        alert(
          `❌ Impor CSV Ditolak: Batas Kapasitas Ruangan Terlampaui!\n\n` +
          `Aturan sistem: Maksimal Ruang Kelas adalah 44 siswa dan Maksimal Lab Komputer adalah 120 siswa.\n\n` +
          `${errorList}${moreText}\n\n` +
          `Silakan sesuaikan alokasi ruang siswa dalam file CSV sebelum mengunggah kembali.`
        );
        return;
      }

      promptConfirm(
        'Impor Data Siswa CSV',
        `Ditemukan ${newStudents.length} data siswa dan seluruhnya memenuhi batas kapasitas ruangan (Maks 44 siswa/ruang, Maks 120 siswa/lab). Apakah Anda ingin menambahkan data ini ke basis data?`,
        async () => {
          const updated = {
            ...database,
            students: [...database.students, ...newStudents]
          };
          await onSaveDatabase(updated, 'Impor Siswa CSV', `Mengimpor ${newStudents.length} siswa dari CSV.`);
          await onRefreshDatabase();
        }
      );
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Supervisor CSV Template Download
  const downloadSupervisorTemplate = () => {
    const header = 'NIP/NUPTK;Nama Lengkap;PIN / Password\n';
    const sample = '198005122005011002;Drs. H. Bambang Suherman, M.Pd.;777001\n198403152008012004;Siti Nurhaliza, S.Pd.;777002\n';
    const blob = new Blob([header + sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Template_Master_Pengawas_SMPN7.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Supervisor CSV
  const exportSupervisorsCSV = () => {
    let csv = 'NIP/NUPTK;Nama Lengkap;PIN / Password\n';
    (database.supervisors || []).forEach(s => {
      csv += `${s.nip};${s.nama};${s.pin}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Master_Pengawas_BAGJA_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Backup Full JSON
  const handleBackupDatabase = () => {
    const dataStr = JSON.stringify(database, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `BAGJA_EXAM_BACKUP_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Reset All Students Session
  const handleResetAllStudents = () => {
    promptConfirm(
      'Reset Status Seluruh Siswa',
      'Apakah Anda yakin ingin mereset seluruh peserta kembali ke status "Belum Masuk" dengan 0 pelanggaran?',
      async () => {
        const resetStudents = database.students.map(s => ({
          ...s,
          status: 'Belum Masuk' as const,
          violationsCount: 0,
          lastActive: null
        }));
        await onSaveDatabase(
          { ...database, students: resetStudents },
          'Reset Status Siswa Masal',
          'Seluruh status peserta direset kembali ke Belum Masuk.'
        );
        await onRefreshDatabase();
      }
    );
  };

  // Factory Reset Database
  const handleFactoryReset = () => {
    promptConfirm(
      'Reset Database ke Setelan Pabrik',
      'TINDAKAN SANGAT KRUSIAL: Semua data jadwal, siswa, log, dan pengawas akan dikosongkan. Apakah Anda yakin?',
      async () => {
        const clearedDb: DatabaseSchema = {
          ...database,
          schedules: [],
          students: [],
          supervisors: [],
          integrityLogs: [],
          broadcasts: [],
          auditLogs: [
            {
              id: `LOG-${Date.now()}`,
              timestamp: new Date().toISOString(),
              userId: 'ADMIN',
              action: 'Reset Pabrik',
              category: 'Sistem',
              details: 'Basis data direset total ke setelan pabrik.'
            }
          ]
        };
        await onSaveDatabase(clearedDb, 'Factory Reset', 'Basis data dibersihkan sepenuhnya.');
        await onRefreshDatabase();
      }
    );
  };

  // Schedule Duration Change: auto-calculate End Time
  const handleScheduleTimeChange = (startTime: string, durationMinutes: number) => {
    const [h, m] = startTime.split(':').map(Number);
    if (!isNaN(h) && !isNaN(m)) {
      const totalMinutes = h * 60 + m + durationMinutes;
      const endH = Math.floor(totalMinutes / 60) % 24;
      const endM = totalMinutes % 60;
      const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
      return endTime;
    }
    return '09:00';
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const updatedConfig = { ...settingsForm };
      if (newAdminPassword.trim()) {
        updatedConfig.adminPassword = newAdminPassword.trim();
      }

      // Update dynamic favicon if configured
      if (updatedConfig.faviconUrl) {
        const link = document.getElementById('dynamic-favicon') as HTMLLinkElement;
        if (link) link.href = updatedConfig.faviconUrl;
      }

      const updatedDb = {
        ...database,
        systemConfig: updatedConfig
      };

      await onSaveDatabase(updatedDb, 'Ubah Pengaturan Sistem', 'Parameter sistem dan identitas diperbarui.');
      setNewAdminPassword('');
      alert('Pengaturan sistem berhasil disimpan dan langsung berlaku secara real-time!');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Navigation Tabs Configuration
  const navTabs: {
    id: AdminTab;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
  }[] = [
    {
      id: 'overview',
      label: 'Ringkasan & Analitik',
      shortLabel: 'Ringkasan',
      icon: LayoutDashboard,
      badge: undefined
    },
    {
      id: 'jadwal',
      label: 'Jadwal & Soal',
      shortLabel: 'Jadwal',
      icon: Calendar,
      badge: (database.schedules || []).length
    },
    {
      id: 'siswa',
      label: 'Master Siswa',
      shortLabel: 'Siswa',
      icon: Users,
      badge: totalStudents
    },
    {
      id: 'pengawas',
      label: 'Master Pengawas',
      shortLabel: 'Pengawas',
      icon: UserCheck,
      badge: (database.supervisors || []).length
    },
    {
      id: 'jadwal_pengawas',
      label: 'Jadwal Pengawasan',
      shortLabel: 'Pengawasan',
      icon: CalendarCheck,
      badge: (database.supervisionDuties || []).length || undefined
    },
    {
      id: 'studio_cetak',
      label: 'Studio Cetak Dokumen',
      shortLabel: 'Cetak',
      icon: Printer,
      badge: undefined
    },
    {
      id: 'audit_log',
      label: 'Log Audit Keamanan',
      shortLabel: 'Log Audit',
      icon: FileText,
      badge: (database.auditLogs || []).length
    },
    {
      id: 'pengaturan',
      label: 'Pengaturan Sistem',
      shortLabel: 'Pengaturan',
      icon: Settings,
      badge: database.systemConfig.maintenanceMode ? 'MT' : undefined
    }
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col lg:flex-row bg-[#f2fdff]">
      {/* ================= 1. SIDEBAR KIRI (MODE KOMPUTER - MENU DI SAMPING KIRI) ================= */}
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 bg-white border-r border-sky-100 shrink-0 sticky top-16 h-[calc(100vh-4rem)] p-4 overflow-y-auto justify-between shadow-xs z-30">
        <div className="space-y-4">
          {/* Identity & Status Badge */}
          <div className="p-3 bg-linear-to-br from-sky-50 to-blue-50/70 rounded-2xl border border-sky-100/90 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sky-600 text-white text-[10px] font-extrabold uppercase tracking-wider shadow-2xs">
                <ShieldCheck className="w-3 h-3" />
                <span>Admin Utama</span>
              </span>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Aktif</span>
              </span>
            </div>
            <h2 className="text-sm font-black text-slate-900 mt-2 leading-snug">
              Pusat Kendali Sistem
            </h2>
            <p className="text-[11px] text-slate-500 truncate mt-0.5" title={database.systemConfig.schoolInfo.namaSekolah}>
              {database.systemConfig.schoolInfo.namaSekolah}
            </p>
          </div>

          {/* Menu Navigasi Samping Kiri */}
          <div className="space-y-1">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-3 mb-1">
              Menu Navigasi
            </p>
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                    isActive
                      ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/25 translate-x-1 font-extrabold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                    <span className="truncate">{tab.label}</span>
                  </div>
                  {tab.badge !== undefined && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md shrink-0 ml-1.5 ${
                        isActive
                          ? 'bg-white/20 text-white font-black'
                          : 'bg-slate-100 text-slate-600 font-semibold'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar Footer Controls */}
        <div className="pt-3 border-t border-slate-100 space-y-2 mt-4">
          <button
            onClick={handleTestSync}
            className="w-full flex items-center justify-between p-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[11px] font-bold rounded-xl transition-colors shadow-2xs"
            title="Uji Sinkronisasi Database Online"
          >
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Sync Database</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-700 font-extrabold">AKTIF</span>
          </button>

          <button
            onClick={handleBackupDatabase}
            className="w-full flex items-center justify-center gap-1.5 p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-xl transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Backup Basis Data</span>
          </button>
        </div>
      </aside>

      {/* ================= 2. MAIN CONTENT VIEWPORT ================= */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6 pb-28 lg:pb-8">
        {/* Notice Banner */}
        {syncNotice && (
          <div className="bg-sky-50 border border-sky-300 text-sky-900 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-sky-600" />
              <span>{syncNotice}</span>
            </div>
            <button onClick={() => setSyncNotice(null)} className="text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Top Header Card */}
        <div className="bg-white rounded-2xl border border-sky-100 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider bg-slate-100 px-2.5 py-0.5 rounded-md">
                PORTAL ADMINISTRATOR UTAMA
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-500 font-medium">NPSN: {database.systemConfig.schoolInfo.npsn}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
              {navTabs.find(t => t.id === activeTab)?.label || 'Pusat Kendali BAGJA EXAM'}
            </h1>
            <p className="text-xs text-slate-500">
              {database.systemConfig.schoolInfo.namaSekolah} · TA {database.systemConfig.schoolInfo.tahunAjaran}
            </p>
          </div>

          {/* Quick Buttons on Header */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleTestSync}
              className="lg:hidden flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Sync Online: AKTIF</span>
            </button>

            <button
              onClick={handleBackupDatabase}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Backup Data</span>
            </button>
          </div>
        </div>

      {/* ================= TAB 1: OVERVIEW & ANALYTICS ================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-sky-100 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase">Total Peserta Ujian</span>
              <div className="text-3xl font-black text-slate-900 mt-2">{totalStudents}</div>
              <p className="text-[11px] text-slate-400 mt-1">Tersebar di {database.rooms.length} Ruang</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-xs">
              <span className="text-xs font-bold text-emerald-600 uppercase">Sedang Mengerjakan</span>
              <div className="text-3xl font-black text-emerald-600 mt-2">{workingCount}</div>
              <p className="text-[11px] text-emerald-500 mt-1">Siswa aktif di pemutar</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-xs">
              <span className="text-xs font-bold text-rose-600 uppercase">Siswa Ditangguhkan</span>
              <div className="text-3xl font-black text-rose-600 mt-2">{suspendedCount}</div>
              <p className="text-[11px] text-rose-500 mt-1">Melampaui batas pelanggaran</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-sky-100 shadow-xs">
              <span className="text-xs font-bold text-sky-600 uppercase">Ujian Selesai</span>
              <div className="text-3xl font-black text-sky-600 mt-2">{finishedCount}</div>
              <p className="text-[11px] text-sky-500 mt-1">Jawaban telah diserahkan</p>
            </div>
          </div>

          {/* Quick Admin Actions */}
          <div className="bg-white rounded-2xl border border-sky-100 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Tindakan Cepat Administrator
            </h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleResetAllStudents}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-colors"
              >
                Reset Status Seluruh Siswa (Belum Masuk)
              </button>

              <button
                onClick={() => setActiveTab('jadwal')}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
              >
                Kelola Jadwal & Soal Ujian
              </button>

              <button
                onClick={() => setActiveTab('studio_cetak')}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
              >
                Cetak Dokumen & Berita Acara
              </button>
            </div>
          </div>

          {/* Active Schedule Overview */}
          <div className="bg-white rounded-2xl border border-sky-100 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Jadwal Ujian Terdaftar
            </h3>
            <div className="divide-y divide-slate-100">
              {(database.schedules || []).map(sch => (
                <div key={sch.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">{sch.subject}</h4>
                    <p className="text-xs text-slate-500">
                      {sch.startTime} - {sch.endTime} WIB ({sch.durationMinutes} Menit) · Token: <strong className="font-mono text-sky-700">{sch.token}</strong>
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    sch.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {sch.isActive ? 'AKTIF SEKARANG' : 'TERJADWAL'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Room Capacity & Occupancy Overview */}
          <div className="bg-white rounded-2xl border border-sky-100 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex flex-wrap items-center gap-2">
                  <span>Monitoring Kapasitas Ruangan & Lab Komputer</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                    Maks Ruang: 44 Siswa · Maks Lab: 120 Siswa
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Distribusi okupansi ruang ujian sesuai ketetapan regulasi teknis BAGJA EXAM.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('siswa')}
                className="text-xs font-bold text-sky-600 hover:text-sky-800 transition-colors self-start sm:self-auto"
              >
                Kelola Alokasi Siswa →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-1">
              {(database.rooms || []).map(room => {
                const count = countStudentsInRoom(database.students, room);
                const maxCap = getRoomMaxCapacity(room);
                const isLab = isComputerLab(room);
                const percent = Math.min(100, Math.round((count / maxCap) * 100));
                const isFull = count >= maxCap;
                const isOver = count > maxCap;

                return (
                  <div
                    key={room}
                    className={`p-3 rounded-xl border transition-all ${
                      isOver
                        ? 'bg-rose-50 border-rose-300'
                        : isFull
                        ? 'bg-amber-50 border-amber-300'
                        : 'bg-slate-50/70 border-slate-200 hover:border-sky-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-extrabold text-xs text-slate-900 truncate">
                        {room}
                      </span>
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        isLab ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {isLab ? 'Lab' : 'Ruang'}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-lg font-black text-slate-900">
                        {count} <span className="text-xs font-medium text-slate-500">/ {maxCap} Siswa</span>
                      </span>
                      <span className={`text-[11px] font-bold ${
                        isOver ? 'text-rose-600' : isFull ? 'text-amber-600' : 'text-slate-600'
                      }`}>
                        {percent}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isOver ? 'bg-rose-600' : isFull ? 'bg-amber-500' : 'bg-sky-600'
                        }`}
                        style={{ width: `${Math.min(100, percent)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: JADWAL & SOAL ================= */}
      {activeTab === 'jadwal' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Manajemen Jadwal Ujian & Integrasi Soal Google Form
              </h3>
              <p className="text-xs text-slate-500">
                Kelola tautan formulir soal, preview langsung tampilan siswa, dan aktivasi ujian.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(database.schedules || []).length > 0 && (
                <button
                  onClick={() => {
                    const activeOrFirst = database.schedules.find(s => s.isActive) || database.schedules[0];
                    setPreviewSchedule(activeOrFirst);
                    setPreviewClassSelect(activeOrFirst.classes?.[0] || '');
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 font-bold text-xs rounded-xl transition-colors shadow-xs"
                >
                  <Eye className="w-4 h-4 text-sky-600" />
                  <span>Preview Soal Aktif</span>
                </button>
              )}
              <button
                onClick={() => {
                  setEditingSchedule(null);
                  setIsPerClassFormMode(false);
                  setBulkUrlInput('');
                  setScheduleFormData({
                    classes: [...database.classes],
                    classFormUrls: {},
                    date: new Date().toISOString().split('T')[0],
                    durationMinutes: 90,
                    startTime: '07:30',
                    endTime: '09:00',
                    isActive: false,
                    totalQuestions: 40,
                    formUrl: ''
                  });
                  setIsAddScheduleOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Jadwal Ujian</span>
              </button>
            </div>
          </div>

          {/* Filter & Search Bar for Schedules */}
          {(database.schedules || []).length > 0 && (
            <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl">
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  <span>Filter Kelas:</span>
                </div>
                <select
                  value={scheduleClassFilter}
                  onChange={(e) => setScheduleClassFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-sky-500"
                >
                  <option value="semua">Semua Tingkat & Kelas</option>
                  <option value="tingkat_7">Seluruh Tingkat 7 (7-A s/d 7-J)</option>
                  <option value="tingkat_8">Seluruh Tingkat 8 (8-A s/d 8-J)</option>
                  <option value="tingkat_9">Seluruh Tingkat 9 (9-A s/d 9-J)</option>
                  <optgroup label="Pilih Kelas Spesifik">
                    {database.classes.map(c => (
                      <option key={c} value={c}>Kelas {c}</option>
                    ))}
                  </optgroup>
                </select>

                <select
                  value={scheduleStatusFilter}
                  onChange={(e) => setScheduleStatusFilter(e.target.value as any)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-sky-500"
                >
                  <option value="semua">Semua Status</option>
                  <option value="aktif">Sedang Berlangsung (Aktif)</option>
                  <option value="nonaktif">Non-Aktif</option>
                </select>
              </div>

              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari mata pelajaran / kelas..."
                  value={scheduleSearchQuery}
                  onChange={(e) => setScheduleSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-sky-500"
                />
              </div>
            </div>
          )}

          {/* Empty state when no schedules exist */}
          {(database.schedules || []).length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-4 shadow-xs">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shadow-xs">
                <Calendar className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-900 text-base">Belum Ada Jadwal Ujian Terdaftar</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Belum ada jadwal ujian yang dibuat. Silakan klik tombol Tambah Jadwal Ujian untuk memasukkan mata pelajaran resmi, target kelas, waktu ujian, dan integrasi soal Google Form.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingSchedule(null);
                  setIsPerClassFormMode(false);
                  setBulkUrlInput('');
                  setScheduleFormData({
                    classes: [...database.classes],
                    classFormUrls: {},
                    date: new Date().toISOString().split('T')[0],
                    durationMinutes: 90,
                    startTime: '07:30',
                    endTime: '09:00',
                    isActive: false,
                    totalQuestions: 40,
                    formUrl: ''
                  });
                  setIsAddScheduleOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Jadwal Ujian Pertama</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(database.schedules || [])
              .filter(sch => {
                if (scheduleStatusFilter === 'aktif' && !sch.isActive) return false;
                if (scheduleStatusFilter === 'nonaktif' && sch.isActive) return false;
                if (scheduleSearchQuery.trim()) {
                  const q = scheduleSearchQuery.toLowerCase();
                  const matchSubject = sch.subject.toLowerCase().includes(q);
                  const matchDesc = sch.description?.toLowerCase().includes(q);
                  const matchClass = sch.classes?.some(c => c.toLowerCase().includes(q));
                  if (!matchSubject && !matchDesc && !matchClass) return false;
                }
                if (scheduleClassFilter !== 'semua') {
                  if (scheduleClassFilter === 'tingkat_7') {
                    if (!sch.classes?.some(c => c.startsWith('7'))) return false;
                  } else if (scheduleClassFilter === 'tingkat_8') {
                    if (!sch.classes?.some(c => c.startsWith('8'))) return false;
                  } else if (scheduleClassFilter === 'tingkat_9') {
                    if (!sch.classes?.some(c => c.startsWith('9'))) return false;
                  } else {
                    if (!sch.classes?.includes(scheduleClassFilter)) return false;
                  }
                }
                return true;
              })
              .map(sch => {
                const cls = sch.classes || [];
                const customFormCount = sch.classFormUrls ? Object.keys(sch.classFormUrls).filter(k => sch.classFormUrls![k]?.trim()).length : 0;

                return (
                  <div key={sch.id} className="bg-white rounded-2xl border border-sky-100 p-5 shadow-xs space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded">
                            ID: {sch.id}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                            <Calendar className="w-3 h-3 text-indigo-600" />
                            <span>{formatIndonesianDate(sch.date)}</span>
                          </span>
                        </div>
                        <h4 className="text-base font-extrabold text-slate-900 mt-1">{sch.subject}</h4>
                        <p className="text-xs text-slate-500">{sch.description || 'Penilaian Sumatif Sekolah'}</p>
                      </div>
                      {(() => {
                        const timing = getScheduleTiming(sch);
                        return (
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 border ${timing.badgeStyle.bg} ${timing.badgeStyle.text} ${timing.badgeStyle.border}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${timing.badgeStyle.dot}`}></span>
                              <span>{timing.statusLabel.toUpperCase()}</span>
                            </span>
                            {timing.isUpcoming && (
                              <span className="text-[10px] text-amber-700 font-semibold">
                                Mulai otomatis dlm {timing.formattedUntilStart}
                              </span>
                            )}
                            {timing.isOngoing && (
                              <span className="text-[10px] text-emerald-700 font-semibold">
                                Sisa waktu {timing.formattedRemaining}
                              </span>
                            )}
                            {timing.isFinished && (
                              <span className="text-[10px] text-slate-500 font-semibold">
                                Selesai ({sch.endTime} WIB)
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Tanggal Ujian:</span>
                        <span className="font-bold text-indigo-900 flex items-center gap-1 text-[11px] truncate mt-0.5">
                          <Calendar className="w-3 h-3 text-indigo-600 shrink-0" />
                          <span>{formatIndonesianDate(sch.date, false)}</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Waktu Ujian:</span>
                        <span className="font-bold text-slate-800 mt-0.5 block">{sch.startTime} - {sch.endTime} WIB</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Durasi Ujian:</span>
                        <span className="font-bold text-slate-800 mt-0.5 block">{sch.durationMinutes} Menit</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Token Ujian:</span>
                        <span className="font-semibold text-emerald-700 text-[11px] flex items-center gap-1 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Terpusat (Rotasi 7 Mnt)
                        </span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-slate-400 block text-[10px]">Pengaturan Kelas:</span>
                        <span className="font-bold text-sky-800 bg-sky-100/70 px-1.5 py-0.5 rounded text-[10px] inline-block mt-0.5">
                          {cls.length === database.classes.length
                            ? `Semua Kelas (${cls.length} Kelas)`
                            : `${cls.length} Kelas Terdaftar`}
                        </span>
                      </div>
                    </div>

                    {/* Classes Chips Display */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 block">Daftar Kelas Berhak Mengikuti:</span>
                      <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-100">
                        {cls.length > 0 ? (
                          cls.map(c => (
                            <span key={c} className="text-[10px] font-bold px-2 py-0.5 bg-white text-slate-700 rounded-md border border-slate-200 shadow-2xs">
                              {c}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-rose-500 font-semibold italic">Belum ada kelas yang dipilih</span>
                        )}
                      </div>
                    </div>

                    {/* Soal Link Status */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">Pengaturan Soal Google Form:</span>
                        {customFormCount > 0 ? (
                          <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px]">
                            {customFormCount} Tautan Soal per Kelas
                          </span>
                        ) : (
                          <span className="font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-100 text-[10px]">
                            1 Tautan Global Terpusat
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-slate-700 truncate bg-slate-100 p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                        <span className="truncate">{sch.formUrl || (customFormCount > 0 ? '(Tautan diatur berbeda per kelas)' : 'Belum diisi')}</span>
                      </div>
                    </div>

                    {/* Primary Action: Preview Langsung Soal */}
                    <button
                      onClick={() => {
                        setPreviewSchedule(sch);
                        setPreviewClassSelect(sch.classes?.[0] || '');
                      }}
                      className="w-full py-2 px-3 bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2 border border-sky-200 transition-colors shadow-xs"
                    >
                      <Eye className="w-4 h-4 text-sky-600" />
                      <span>Preview Langsung Soal (Tampilan Siswa)</span>
                    </button>

                    {/* Actions: Start / Stop Exam, Edit, Delete */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      {sch.isActive ? (
                        <button
                          onClick={() => {
                            const updated = {
                              ...database,
                              schedules: database.schedules.map(s => s.id === sch.id ? { ...s, isActive: false } : s)
                            };
                            onSaveDatabase(updated, 'Hentikan Ujian', `Ujian ${sch.subject} dihentikan.`);
                          }}
                          className="flex-1 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Square className="w-3.5 h-3.5" />
                          <span>Hentikan Ujian</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const updated = {
                              ...database,
                              schedules: database.schedules.map(s => s.id === sch.id ? { ...s, isActive: true } : s)
                            };
                            onSaveDatabase(updated, 'Mulai Ujian', `Ujian ${sch.subject} diaktifkan.`);
                          }}
                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Mulai Ujian</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setEditingSchedule(sch);
                          const hasCustomForms = !!sch.classFormUrls && Object.keys(sch.classFormUrls).length > 0;
                          setIsPerClassFormMode(hasCustomForms);
                          setBulkUrlInput(sch.formUrl || '');
                          setScheduleFormData({
                            ...sch,
                            classes: sch.classes || [...database.classes],
                            classFormUrls: sch.classFormUrls || {}
                          });
                          setIsAddScheduleOpen(true);
                        }}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                        title="Edit Jadwal & Formulir"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                  <button
                    onClick={() => {
                      promptConfirm('Hapus Jadwal', `Hapus jadwal ujian ${sch.subject}?`, async () => {
                        const updated = {
                          ...database,
                          schedules: database.schedules.filter(s => s.id !== sch.id)
                        };
                        await onSaveDatabase(updated, 'Hapus Jadwal', `Jadwal ${sch.subject} dihapus.`);
                        await onRefreshDatabase();
                      });
                    }}
                    className="p-1.5 bg-slate-100 hover:bg-rose-100 hover:text-rose-600 text-slate-500 rounded-xl transition-colors"
                    title="Hapus Jadwal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        </div>
      )}

      {/* ================= TAB 3: MASTER SISWA ================= */}
      {activeTab === 'siswa' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white rounded-2xl border border-sky-100 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari siswa (Nama, No, NISN)..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none"
                />
              </div>

              <select
                value={studentClassFilter}
                onChange={(e) => setStudentClassFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
              >
                <option value="semua">Semua Kelas</option>
                {database.classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <select
                value={studentRoomFilter}
                onChange={(e) => setStudentRoomFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
              >
                <option value="semua">Semua Ruang ({database.students.length} Siswa)</option>
                {database.rooms.map(r => {
                  const count = countStudentsInRoom(database.students, r);
                  const max = getRoomMaxCapacity(r);
                  return (
                    <option key={r} value={r}>
                      {r} ({count}/{max} {isComputerLab(r) ? 'Lab' : 'Ruang'})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Import / Export & Add */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsSmartImportStudentOpen(true)}
                className="px-3.5 py-1.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                title="Smart Import Data Siswa dari Excel, Sheets, atau CSV"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Smart Import</span>
              </button>

              <button
                onClick={exportStudentsCSV}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5"
                title="Ekspor Seluruh Siswa ke CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor CSV</span>
              </button>

              <button
                onClick={() => {
                  setEditingStudent(null);
                  setStudentFormData({
                    kelas: database.classes[0] || '7-A',
                    ruang: database.rooms[0] || 'Lab Komputer',
                    status: 'Belum Masuk',
                    deviceType: 'Komputer'
                  });
                  setIsAddStudentOpen(true);
                }}
                className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Siswa</span>
              </button>
            </div>
          </div>

          {/* Student Table */}
          <div className="bg-white rounded-2xl border border-sky-100 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="py-3 px-4">No Peserta</th>
                    <th className="py-3 px-4">NISN / NIPD</th>
                    <th className="py-3 px-4">Nama Siswa</th>
                    <th className="py-3 px-4">Kelas</th>
                    <th className="py-3 px-4">Ruang</th>
                    <th className="py-3 px-4 text-center">No. Duduk</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Pelanggaran</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {filteredStudents.map((s, idx) => (
                    <tr key={`${s.noPeserta}-${s.nisn || s.nipd || idx}`} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium">{s.noPeserta}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">{s.nisn} / {s.nipd}</td>
                      <td className="py-3 px-4 font-bold">{s.nama}</td>
                      <td className="py-3 px-4 font-semibold text-sky-700">{s.kelas}</td>
                      <td className="py-3 px-4">{s.ruang}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-sky-800">
                        {s.noTempatDuduk || s.nomorMeja || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          s.status === 'Ditangguhkan'
                            ? 'bg-rose-100 text-rose-800'
                            : s.status === 'Sedang Mengerjakan'
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.status === 'Selesai'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-600">{s.violationsCount || 0}</td>
                      <td className="py-3 px-4 text-right space-x-1">
                        {s.status === 'Ditangguhkan' && (
                          <button
                            onClick={async () => {
                              await apiClient.unlockKiosk({
                                noPeserta: s.noPeserta,
                                unlockedBy: 'ADMINISTRATOR',
                                resetViolations: true
                              });
                              await onRefreshDatabase();
                              alert(`Kunci ujian peserta ${s.nama} berhasil dibuka. Sisa waktu ujian siswa otomatis mengikuti waktu selesai jadwal resmi.`);
                            }}
                            className="p-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800"
                            title="Buka Kunci Ujian Siswa (Sisa Waktu Otomatis Sesuai Jadwal)"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditingStudent(s);
                            setStudentFormData(s);
                            setIsAddStudentOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                          title="Edit Siswa"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            promptConfirm('Hapus Siswa', `Hapus peserta ${s.nama}?`, async () => {
                              const updated = {
                                ...database,
                                students: database.students.filter(item => item.noPeserta !== s.noPeserta)
                              };
                              await onSaveDatabase(updated, 'Hapus Siswa', `Siswa ${s.nama} dihapus.`);
                              await onRefreshDatabase();
                            });
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600"
                          title="Hapus Siswa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 4: MASTER PENGAWAS ================= */}
      {activeTab === 'pengawas' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-sky-100 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari pengawas (Nama, NIP)..."
                value={supervisorSearch}
                onChange={(e) => setSupervisorSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsSmartImportSupervisorOpen(true)}
                className="px-3.5 py-1.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                title="Smart Import Data Pengawas dari Excel, Sheets, atau CSV"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Smart Import</span>
              </button>
              <button
                onClick={exportSupervisorsCSV}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor CSV</span>
              </button>
              <button
                onClick={() => {
                  setEditingSupervisor(null);
                  setSupervisorFormData({
                    pin: '777' + Math.floor(100 + Math.random() * 900)
                  });
                  setIsAddSupervisorOpen(true);
                }}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Pengawas</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-sky-100 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-3 px-4">NIP / NUPTK</th>
                  <th className="py-3 px-4">Nama Lengkap</th>
                  <th className="py-3 px-4">Jadwal Tugas</th>
                  <th className="py-3 px-4">PIN / Password</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredSupervisors.map(sup => {
                  const dutyCount = (database.supervisionDuties || []).filter(
                    d => d.supervisorNip === sup.nip || d.supervisorNip2 === sup.nip
                  ).length;
                  return (
                    <tr key={sup.nip} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium">{sup.nip}</td>
                      <td className="py-3 px-4 font-bold">{sup.nama}</td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => setActiveTab('jadwal_pengawas')}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-colors ${
                            dutyCount > 0
                              ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                          title="Klik untuk mengelola jadwal tugas pengawas"
                        >
                          <CalendarCheck className="w-3 h-3 text-indigo-600" />
                          <span>{dutyCount} Sesi Tugas</span>
                        </button>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-600">{sup.pin}</td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <button
                        onClick={() => {
                          setEditingSupervisor(sup);
                          setSupervisorFormData(sup);
                          setIsAddSupervisorOpen(true);
                        }}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                        title="Edit Pengawas"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          promptConfirm('Hapus Pengawas', `Hapus pengawas ${sup.nama}?`, async () => {
                            const updated = {
                              ...database,
                              supervisors: database.supervisors.filter(item => item.nip !== sup.nip)
                            };
                            await onSaveDatabase(updated, 'Hapus Pengawas', `Pengawas ${sup.nama} dihapus.`);
                            await onRefreshDatabase();
                          });
                        }}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600"
                        title="Hapus Pengawas"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 4.5: JADWAL PENGAWASAN ================= */}
      {activeTab === 'jadwal_pengawas' && (
        <JadwalPengawasanManager
          database={database}
          onSaveDatabase={onSaveDatabase}
          onRefreshDatabase={onRefreshDatabase}
          onNavigateToPrintStudio={() => setActiveTab('studio_cetak')}
        />
      )}

      {/* ================= TAB 5: STUDIO CETAK DOKUMEN ================= */}
      {activeTab === 'studio_cetak' && (
        <StudioCetakDokumen database={database} />
      )}

      {/* ================= TAB 6: LOG AUDIT KEAMANAN ================= */}
      {activeTab === 'audit_log' && (
        <div className="bg-white rounded-2xl border border-sky-100 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Log Audit Aktivitas & Integritas Sistem
              </h3>
              <p className="text-xs text-slate-500">
                Rekaman kronologis aksi administrator, pengawas, dan rotasi token demi akuntabilitas data.
              </p>
            </div>
            <button
              onClick={() => {
                promptConfirm('Bersihkan Log Audit', 'Apakah Anda yakin ingin mengosongkan riwayat log?', async () => {
                  const updated = { ...database, auditLogs: [] };
                  await onSaveDatabase(updated, 'Bersihkan Log', 'Log audit dikosongkan.');
                  await onRefreshDatabase();
                });
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 font-bold text-xs rounded-xl transition-colors"
            >
              Bersihkan Log
            </button>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {(database.auditLogs || []).map(log => (
              <div key={log.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{log.action}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800">
                      {log.category}
                    </span>
                    <span className="text-[10px] text-slate-400">Oleh: {log.userId}</span>
                  </div>
                  <p className="text-slate-600">{log.details}</p>
                </div>
                <span className="font-mono text-[10px] text-slate-400 shrink-0">
                  {new Date(log.timestamp).toLocaleString('id-ID')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 7: PENGATURAN SISTEM ================= */}
      {activeTab === 'pengaturan' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Section A: Identitas Sekolah & Lembaga */}
          <div className="bg-white rounded-2xl border border-sky-100 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Identitas Lembaga & Sekolah
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Sekolah</label>
                <input
                  type="text"
                  value={settingsForm.schoolInfo.namaSekolah}
                  onChange={(e) => setSettingsForm({
                    ...settingsForm,
                    schoolInfo: { ...settingsForm.schoolInfo, namaSekolah: e.target.value },
                    letterhead: { ...settingsForm.letterhead, namaSekolah: e.target.value }
                  })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">NPSN</label>
                <input
                  type="text"
                  value={settingsForm.schoolInfo.npsn}
                  onChange={(e) => setSettingsForm({
                    ...settingsForm,
                    schoolInfo: { ...settingsForm.schoolInfo, npsn: e.target.value }
                  })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tahun Ajaran / Semester</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settingsForm.schoolInfo.tahunAjaran}
                    onChange={(e) => setSettingsForm({
                      ...settingsForm,
                      schoolInfo: { ...settingsForm.schoolInfo, tahunAjaran: e.target.value }
                    })}
                    className="w-1/2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                  <input
                    type="text"
                    value={settingsForm.schoolInfo.semester}
                    onChange={(e) => setSettingsForm({
                      ...settingsForm,
                      schoolInfo: { ...settingsForm.schoolInfo, semester: e.target.value }
                    })}
                    className="w-1/2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Kepala Sekolah & NIP</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settingsForm.schoolInfo.namaKepalaSekolah}
                    onChange={(e) => setSettingsForm({
                      ...settingsForm,
                      schoolInfo: { ...settingsForm.schoolInfo, namaKepalaSekolah: e.target.value }
                    })}
                    className="w-1/2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                  <input
                    type="text"
                    value={settingsForm.schoolInfo.nipKepalaSekolah}
                    onChange={(e) => setSettingsForm({
                      ...settingsForm,
                      schoolInfo: { ...settingsForm.schoolInfo, nipKepalaSekolah: e.target.value }
                    })}
                    className="w-1/2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Alamat Sekolah</label>
                <input
                  type="text"
                  value={settingsForm.schoolInfo.alamat}
                  onChange={(e) => setSettingsForm({
                    ...settingsForm,
                    schoolInfo: { ...settingsForm.schoolInfo, alamat: e.target.value },
                    letterhead: { ...settingsForm.letterhead, alamat: e.target.value }
                  })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Section B: Parameter Keamanan & Password */}
          <div className="bg-white rounded-2xl border border-sky-100 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Parameter Keamanan & Kiosk Handphone / Tablet
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Toleransi Pelanggaran (Jumlah Tolerir)</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={settingsForm.violationTolerance}
                  onChange={(e) => setSettingsForm({ ...settingsForm, violationTolerance: parseInt(e.target.value, 10) || 3 })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                />
                <p className="mt-1 text-[11px] text-slate-400">Bila siswa mencapai batas ini, layar ujian ditangguhkan seketika.</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Password Darurat Kiosk HP/Tablet</label>
                <input
                  type="text"
                  value={settingsForm.kioskEmergencyPin}
                  onChange={(e) => setSettingsForm({ ...settingsForm, kioskEmergencyPin: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                />
                <p className="mt-1 text-[11px] text-slate-400">Digunakan pengawas untuk membuka kunci darurat di perangkat.</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Ubah Password Admin</label>
                <input
                  type="password"
                  placeholder="Isi hanya jika ingin mengganti password admin"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
                <p className="mt-1 text-[11px] text-slate-400">Password saat ini: <strong className="font-mono">{settingsForm.adminPassword}</strong></p>
              </div>

              <div className="sm:col-span-2 p-3.5 bg-sky-50/70 border border-sky-200 rounded-xl">
                <div className="flex items-center gap-2 text-sky-900 font-extrabold text-xs">
                  <span className="w-2 h-2 rounded-full bg-sky-600" />
                  <span>Standar Kebijakan Daya Tampung Ujian BAGJA EXAM:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-sky-100 flex items-center justify-between">
                    <span className="font-medium text-slate-700">Maksimal Ruang Kelas:</span>
                    <span className="font-mono font-black text-sky-900 bg-sky-100 px-2 py-0.5 rounded">
                      {MAX_STUDENTS_PER_ROOM} Siswa
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-sky-100 flex items-center justify-between">
                    <span className="font-medium text-slate-700">Maksimal Lab Komputer:</span>
                    <span className="font-mono font-black text-indigo-900 bg-indigo-100 px-2 py-0.5 rounded">
                      {MAX_STUDENTS_PER_LAB} Siswa
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Kebijakan kapasitas diterapkan secara otomatis pada seluruh sistem (Input Siswa Manual, CSV Import, dan Smart Import Excel/Sheets).
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mode Pemeliharaan (Maintenance v1.0.1)</label>
                <button
                  type="button"
                  onClick={() => setSettingsForm({ ...settingsForm, maintenanceMode: !settingsForm.maintenanceMode })}
                  className={`w-full py-2 px-3 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 ${
                    settingsForm.maintenanceMode
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>{settingsForm.maintenanceMode ? 'STATUS: PEMELIHARAAN AKTIF' : 'STATUS: NORMAL (SISWA DAPAT AKSES)'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section C: Sinkronisasi & Koneksi Basis Data Online Real-Time (Dipindahkan dari Header) */}
          <div className="bg-white rounded-2xl border border-emerald-100 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wide">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Status Server: AKTIF
                  </span>
                  <span className="text-xs font-mono text-emerald-700 font-bold">Online Real-time</span>
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mt-1">
                  Sinkronisasi & Konektivitas Basis Data
                </h3>
                <p className="text-xs text-slate-500">
                  Basis data ujian terhubung langsung ke server pusat BAGJA EXAM dengan penyimpanan persisten dan rotasi token otomatis.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleTestSync}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Uji Sinkronisasi Sekarang</span>
                </button>
                <button
                  type="button"
                  onClick={handleBackupDatabase}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Backup JSON</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                <span className="text-slate-500 block text-[11px] font-medium">Status Koneksi Server:</span>
                <span className="font-extrabold text-emerald-800 text-xs flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  TERHUBUNG (Real-time Sync)
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[11px] font-medium">Replikasi Data:</span>
                <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                  Persisten Server & Memori Klien
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[11px] font-medium">Integritas Audit:</span>
                <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                  Log Aktivitas Aktif ({(database.auditLogs || []).length} entri)
                </span>
              </div>
            </div>
          </div>

          {/* Section D: Logo & Favicon Upload / URL with Live Preview */}
          <div className="bg-white rounded-2xl border border-sky-100 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Identitas Visual & Unggah Logo
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
              {/* Logo Pemkot */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-700">Logo Pemerintah Kota Cimahi</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 border rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 p-1">
                    <img
                      src={settingsForm.logoPemkot || '/logo-pemda.svg'}
                      alt="Preview Pemkot"
                      className="max-h-14 max-w-14 object-contain"
                      onError={(e) => {
                        (e.target as any).src = '/logo-pemda.svg';
                      }}
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      placeholder="URL Gambar Logo Pemkot"
                      value={settingsForm.logoPemkot}
                      onChange={(e) => setSettingsForm({ ...settingsForm, logoPemkot: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSettingsForm({ ...settingsForm, logoPemkot: '/logo-pemda.svg' })}
                        className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-lg font-bold text-[10px] transition-colors"
                      >
                        Pakai /logo-pemda.svg
                      </button>
                      <label className="inline-block px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[10px] cursor-pointer">
                        Unggah Berkas
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (evt) => {
                                setSettingsForm({ ...settingsForm, logoPemkot: evt.target?.result as string });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Logo Sekolah */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-700">Logo SMP Negeri 7 Cimahi</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 border rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 p-1">
                    <img
                      src={settingsForm.logoSekolah || '/logo-sekolah.svg'}
                      alt="Preview Sekolah"
                      className="max-h-14 max-w-14 object-contain"
                      onError={(e) => {
                        (e.target as any).src = '/logo-sekolah.svg';
                      }}
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      placeholder="URL Gambar Logo Sekolah"
                      value={settingsForm.logoSekolah}
                      onChange={(e) => setSettingsForm({ ...settingsForm, logoSekolah: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSettingsForm({ ...settingsForm, logoSekolah: '/logo-sekolah.svg' })}
                        className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-lg font-bold text-[10px] transition-colors"
                      >
                        Pakai /logo-sekolah.svg
                      </button>
                      <label className="inline-block px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[10px] cursor-pointer">
                        Unggah Berkas
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (evt) => {
                                setSettingsForm({ ...settingsForm, logoSekolah: evt.target?.result as string });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section D: Factory Reset Master Database */}
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-extrabold text-rose-900">
                Zona Berbahaya: Reset Database ke Setelan Pabrik
              </h4>
              <p className="text-xs text-rose-700 mt-0.5">
                Mengosongkan seluruh master siswa, master pengawas, jadwal ujian, dan log integritas.
              </p>
            </div>
            <button
              type="button"
              onClick={handleFactoryReset}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0"
            >
              Reset Setelan Pabrik
            </button>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSavingSettings}
              className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs hover:shadow transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingSettings ? 'Menyimpan...' : 'Simpan Seluruh Pengaturan Sistem'}</span>
            </button>
          </div>
        </form>
      )}
      </main>

      {/* ================= 3. SMART MENU DI BAGIAN BAWAH (MODE HANDPHONE & TABLET - LG:HIDDEN) ================= */}
      <nav
        aria-label="Smart Menu Bawah Handphone dan Tablet"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_24px_rgba(0,0,0,0.09)] py-1.5 px-2 safe-area-bottom"
      >
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden justify-start sm:justify-around px-1 py-0.5">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-w-[62px] sm:min-w-0 sm:flex-1 flex flex-col items-center justify-center py-1.5 px-1.5 rounded-xl text-[10px] font-bold transition-all relative ${
                    isActive
                      ? 'bg-sky-600 text-white shadow-xs font-extrabold scale-102'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <Icon className={`w-4 h-4 mb-0.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span className="truncate max-w-[62px] text-center leading-tight">{tab.shortLabel}</span>
                  {tab.badge !== undefined && !isActive && (
                    <span className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-sky-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* ================= MODAL ADD / EDIT STUDENT ================= */}
      {isAddStudentOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-base">
                {editingStudent ? 'Edit Data Peserta Siswa' : 'Tambah Peserta Siswa Baru'}
              </h3>
              <button onClick={() => setIsAddStudentOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const targetRuang = studentFormData.ruang || (database.rooms[0] || 'Lab Komputer');

                // Validasi Kapasitas Ruangan (Maks 44 Siswa per Ruang, Maks 120 Siswa per Lab Komputer)
                const capCheck = checkRoomCapacity(
                  database.students,
                  targetRuang,
                  1,
                  editingStudent?.noPeserta
                );

                if (!capCheck.allowed) {
                  alert(
                    `❌ Gagal Menyimpan: Kapasitas Ruangan Penuh!\n\n` +
                    `${capCheck.warningMessage}\n\n` +
                    `Siswa tidak dapat dialokasikan ke ruangan ini. Silakan pilih ruangan lain.`
                  );
                  return;
                }

                const newStudent: Student = {
                  noPeserta: (studentFormData.noPeserta || '').trim(),
                  nisn: (studentFormData.nisn || '').trim(),
                  nipd: (studentFormData.nipd || '').trim(),
                  nama: (studentFormData.nama || '').trim(),
                  kelas: studentFormData.kelas || (database.classes[0] || '7-A'),
                  ruang: targetRuang,
                  noTempatDuduk: (studentFormData.noTempatDuduk || studentFormData.nomorMeja || '').trim(),
                  nomorMeja: (studentFormData.noTempatDuduk || studentFormData.nomorMeja || '').trim(),
                  status: (studentFormData.status as any) || 'Belum Masuk',
                  violationsCount: studentFormData.violationsCount || 0,
                  lastActive: null,
                  deviceType: studentFormData.deviceType || 'Komputer'
                };

                let updatedStudents: Student[];
                if (editingStudent) {
                  updatedStudents = database.students.map(s => s.noPeserta === editingStudent.noPeserta ? newStudent : s);
                } else {
                  updatedStudents = [newStudent, ...database.students];
                }

                await onSaveDatabase(
                  { ...database, students: updatedStudents },
                  editingStudent ? 'Edit Siswa' : 'Tambah Siswa',
                  `Data ${newStudent.nama} disimpan.`
                );
                await onRefreshDatabase();
                setIsAddStudentOpen(false);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nomor Peserta Ujian</label>
                <input
                  type="text"
                  required
                  placeholder="26-07-001-01"
                  value={studentFormData.noPeserta || ''}
                  onChange={(e) => setStudentFormData({ ...studentFormData, noPeserta: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">NISN</label>
                  <input
                    type="text"
                    required
                    placeholder="0091234561"
                    value={studentFormData.nisn || ''}
                    onChange={(e) => setStudentFormData({ ...studentFormData, nisn: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">NIPD</label>
                  <input
                    type="text"
                    required
                    placeholder="242507001"
                    value={studentFormData.nipd || ''}
                    onChange={(e) => setStudentFormData({ ...studentFormData, nipd: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap Siswa</label>
                <input
                  type="text"
                  required
                  placeholder="Nama Lengkap Siswa"
                  value={studentFormData.nama || ''}
                  onChange={(e) => setStudentFormData({ ...studentFormData, nama: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kelas</label>
                  <select
                    value={studentFormData.kelas || '7-A'}
                    onChange={(e) => setStudentFormData({ ...studentFormData, kelas: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    {database.classes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700">Ruang Ujian</label>
                    {(() => {
                      const curRoom = studentFormData.ruang || (database.rooms[0] || 'Lab Komputer');
                      const curCount = countStudentsInRoom(database.students, curRoom, editingStudent?.noPeserta);
                      const maxCap = getRoomMaxCapacity(curRoom);
                      const isFull = curCount >= maxCap;
                      return (
                        <span className={`text-[10px] font-extrabold ${isFull ? 'text-rose-600' : 'text-slate-500'}`}>
                          {curCount}/{maxCap} {isFull ? '(PENUH)' : 'Siswa'}
                        </span>
                      );
                    })()}
                  </div>
                  <select
                    value={studentFormData.ruang || 'Lab Komputer'}
                    onChange={(e) => setStudentFormData({ ...studentFormData, ruang: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    {database.rooms.map(r => {
                      const count = countStudentsInRoom(database.students, r, editingStudent?.noPeserta);
                      const max = getRoomMaxCapacity(r);
                      const isFull = count >= max;
                      return (
                        <option key={r} value={r} disabled={isFull && studentFormData.ruang !== r}>
                          {r} ({count}/{max} {isComputerLab(r) ? 'Lab' : 'Ruang'}{isFull ? ' - PENUH' : ''})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">No. Tempat Duduk / Meja (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: 01, 02, ..."
                  value={studentFormData.noTempatDuduk || studentFormData.nomorMeja || ''}
                  onChange={(e) => setStudentFormData({
                    ...studentFormData,
                    noTempatDuduk: e.target.value,
                    nomorMeja: e.target.value
                  })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddStudentOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-xs"
                >
                  Simpan Siswa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL ADD / EDIT SUPERVISOR ================= */}
      {isAddSupervisorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-base">
                {editingSupervisor ? 'Edit Data Pengawas' : 'Tambah Pengawas Baru'}
              </h3>
              <button onClick={() => setIsAddSupervisorOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const newSupervisor: Supervisor = {
                  nip: (supervisorFormData.nip || '').trim(),
                  nama: (supervisorFormData.nama || '').trim(),
                  pin: (supervisorFormData.pin || '').trim()
                };

                let updatedSupervisors: Supervisor[];
                if (editingSupervisor) {
                  updatedSupervisors = database.supervisors.map(s => s.nip === editingSupervisor.nip ? newSupervisor : s);
                } else {
                  updatedSupervisors = [newSupervisor, ...database.supervisors];
                }

                await onSaveDatabase(
                  { ...database, supervisors: updatedSupervisors },
                  editingSupervisor ? 'Edit Pengawas' : 'Tambah Pengawas',
                  `Pengawas ${newSupervisor.nama} disimpan.`
                );
                await onRefreshDatabase();
                setIsAddSupervisorOpen(false);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 mb-1">NIP / NUPTK</label>
                <input
                  type="text"
                  required
                  placeholder="198005122005011002"
                  value={supervisorFormData.nip || ''}
                  onChange={(e) => setSupervisorFormData({ ...supervisorFormData, nip: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap & Gelar</label>
                <input
                  type="text"
                  required
                  placeholder="Drs. H. Bambang Suherman, M.Pd."
                  value={supervisorFormData.nama || ''}
                  onChange={(e) => setSupervisorFormData({ ...supervisorFormData, nama: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">PIN / Password Masuk</label>
                <input
                  type="text"
                  required
                  placeholder="777001"
                  value={supervisorFormData.pin || ''}
                  onChange={(e) => setSupervisorFormData({ ...supervisorFormData, pin: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Password atau PIN khusus untuk pengawas ini saat login ke ruang ujian.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddSupervisorOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs"
                >
                  Simpan Pengawas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL ADD / EDIT SCHEDULE ================= */}
      {isAddScheduleOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col p-5 sm:p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {editingSchedule ? 'Ubah Konfigurasi Jadwal & Soal' : 'Tambah Jadwal Ujian & Pengaturan Soal'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Atur mata pelajaran, target kelas peserta, dan integrasi formulir Google Form.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddScheduleOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const selectedClasses = scheduleFormData.classes || [];
                if (selectedClasses.length === 0) {
                  alert('Peringatan: Silakan pilih minimal 1 kelas yang berhak mengikuti ujian ini.');
                  return;
                }

                // Check form URL
                const mainUrl = (scheduleFormData.formUrl || '').trim();
                const customUrls = scheduleFormData.classFormUrls || {};
                const hasAnyCustomUrl = Object.values(customUrls).some(u => u && u.trim().length > 0);

                if (!mainUrl && !hasAnyCustomUrl) {
                  alert('Peringatan: Tautan formulir soal Google Form wajib diisi agar siswa dapat mengerjakan ujian.');
                  return;
                }

                const newSchedule: Schedule = {
                  id: editingSchedule?.id || `SCH-${Math.floor(100 + Math.random() * 900)}`,
                  subject: scheduleFormData.subject || database.subjects[0] || 'Ilmu Pengetahuan Alam (IPA)',
                  date: scheduleFormData.date || new Date().toISOString().split('T')[0],
                  startTime: scheduleFormData.startTime || '07:30',
                  durationMinutes: scheduleFormData.durationMinutes || 90,
                  endTime: handleScheduleTimeChange(scheduleFormData.startTime || '07:30', scheduleFormData.durationMinutes || 90),
                  classes: selectedClasses,
                  token: database.systemConfig.currentToken || 'TERPUSAT',
                  formUrl: mainUrl || (hasAnyCustomUrl ? Object.values(customUrls)[0] : ''),
                  classFormUrls: isPerClassFormMode ? customUrls : {},
                  isActive: scheduleFormData.isActive ?? false,
                  description: scheduleFormData.description || 'Penilaian Sumatif Sekolah',
                  totalQuestions: scheduleFormData.totalQuestions || 40
                };

                const updatedSchedules = [newSchedule, ...(database.schedules || []).filter(s => s.id !== newSchedule.id)];

                await onSaveDatabase(
                  { ...database, schedules: updatedSchedules },
                  'Tambah/Ubah Jadwal',
                  `Jadwal ujian ${newSchedule.subject} (${selectedClasses.length} Kelas) disimpan.`
                );
                await onRefreshDatabase();
                setIsAddScheduleOpen(false);
              }}
              className="flex flex-col flex-1 overflow-hidden mt-3"
            >
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
                {/* 1. Mata Pelajaran, Tanggal Ujian & Deskripsi */}
                <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-slate-800">Mata Pelajaran Resmi</label>
                    <span className="text-[10px] text-sky-700 bg-sky-50 px-2 py-0.5 rounded font-semibold border border-sky-100">
                      14 Mata Pelajaran Terdaftar
                    </span>
                  </div>
                  <select
                    value={scheduleFormData.subject || database.subjects[0]}
                    onChange={(e) => setScheduleFormData({ ...scheduleFormData, subject: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                  >
                    {database.subjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[11px] flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-sky-600" />
                        <span>Tanggal Pelaksanaan Ujian</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={scheduleFormData.date || new Date().toISOString().split('T')[0]}
                        onChange={(e) => setScheduleFormData({ ...scheduleFormData, date: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-sky-500"
                      />
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {formatIndonesianDate(scheduleFormData.date || new Date().toISOString().split('T')[0])}
                      </p>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-600 mb-1 text-[11px]">Keterangan / Jenis Ujian</label>
                      <input
                        type="text"
                        placeholder="Contoh: Penilaian Sumatif Akhir Jenjang (PSAJ)"
                        value={scheduleFormData.description || ''}
                        onChange={(e) => setScheduleFormData({ ...scheduleFormData, description: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                      />
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Label pengenal jadwal dan soal ujian
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Jam & Durasi */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Jam Mulai</label>
                    <input
                      type="time"
                      required
                      value={scheduleFormData.startTime || '07:30'}
                      onChange={(e) => {
                        const st = e.target.value;
                        const end = handleScheduleTimeChange(st, scheduleFormData.durationMinutes || 90);
                        setScheduleFormData({ ...scheduleFormData, startTime: st, endTime: end });
                      }}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Durasi (Menit)</label>
                    <input
                      type="number"
                      min={15}
                      max={240}
                      value={scheduleFormData.durationMinutes || 90}
                      onChange={(e) => {
                        const dur = parseInt(e.target.value, 10) || 90;
                        const end = handleScheduleTimeChange(scheduleFormData.startTime || '07:30', dur);
                        setScheduleFormData({ ...scheduleFormData, durationMinutes: dur, endTime: end });
                      }}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-sky-700"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Jam Selesai (Otomatis)</label>
                    <input
                      type="text"
                      disabled
                      value={scheduleFormData.endTime || '09:00'}
                      className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-600"
                    />
                  </div>
                </div>

                {/* 3. PENGATURAN KELAS PESERTA */}
                <div className="p-3.5 bg-sky-50/40 border border-sky-200/70 rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-extrabold text-slate-900 text-xs">
                      <Layers className="w-4 h-4 text-sky-600" />
                      <span>Pengaturan Target Kelas Peserta</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                      {(scheduleFormData.classes || []).length} dari {database.classes.length} Kelas Terpilih
                    </span>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-500 font-semibold mr-1">Pilih Cepat:</span>
                    <button
                      type="button"
                      onClick={() => setScheduleFormData({ ...scheduleFormData, classes: [...database.classes] })}
                      className="px-2.5 py-1 bg-white hover:bg-sky-50 text-sky-800 border border-sky-200 font-bold rounded-lg text-[10px] transition-colors shadow-2xs"
                    >
                      Semua Kelas ({database.classes.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const c7 = database.classes.filter(c => c.startsWith('7'));
                        setScheduleFormData({ ...scheduleFormData, classes: c7 });
                      }}
                      className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold rounded-lg text-[10px] transition-colors shadow-2xs"
                    >
                      Tingkat 7 ({database.classes.filter(c => c.startsWith('7')).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const c8 = database.classes.filter(c => c.startsWith('8'));
                        setScheduleFormData({ ...scheduleFormData, classes: c8 });
                      }}
                      className="px-2.5 py-1 bg-white hover:bg-purple-50 text-purple-800 border border-purple-200 font-bold rounded-lg text-[10px] transition-colors shadow-2xs"
                    >
                      Tingkat 8 ({database.classes.filter(c => c.startsWith('8')).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const c9 = database.classes.filter(c => c.startsWith('9'));
                        setScheduleFormData({ ...scheduleFormData, classes: c9 });
                      }}
                      className="px-2.5 py-1 bg-white hover:bg-amber-50 text-amber-800 border border-amber-200 font-bold rounded-lg text-[10px] transition-colors shadow-2xs"
                    >
                      Tingkat 9 ({database.classes.filter(c => c.startsWith('9')).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleFormData({ ...scheduleFormData, classes: [] })}
                      className="px-2 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-bold rounded-lg text-[10px] transition-colors"
                    >
                      Kosongkan
                    </button>
                  </div>

                  {/* Grade Tabs Filter for View */}
                  <div className="flex items-center gap-1 border-b border-sky-200/60 pb-1.5 pt-1">
                    {(['all', '7', '8', '9'] as const).map(tab => {
                      const label = tab === 'all' ? 'Semua Tingkat' : `Kelas ${tab}`;
                      const count = tab === 'all'
                        ? database.classes.length
                        : database.classes.filter(c => c.startsWith(tab)).length;
                      const isTabActive = scheduleModalGradeTab === tab;
                      return (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setScheduleModalGradeTab(tab)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                            isTabActive
                              ? 'bg-sky-600 text-white shadow-2xs'
                              : 'bg-white text-slate-600 hover:bg-sky-100 border border-slate-200'
                          }`}
                        >
                          {label} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {/* Interactive Class Chips Grid */}
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-36 overflow-y-auto p-1">
                    {database.classes
                      .filter(c => scheduleModalGradeTab === 'all' ? true : c.startsWith(scheduleModalGradeTab))
                      .map(cls => {
                        const isSelected = (scheduleFormData.classes || []).includes(cls);
                        return (
                          <button
                            key={cls}
                            type="button"
                            onClick={() => {
                              const curr = scheduleFormData.classes || [];
                              const updated = isSelected ? curr.filter(c => c !== cls) : [...curr, cls];
                              setScheduleFormData({ ...scheduleFormData, classes: updated });
                            }}
                            className={`px-2 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-between border transition-all ${
                              isSelected
                                ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                                : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                            }`}
                          >
                            <span>{cls}</span>
                            {isSelected ? (
                              <Check className="w-3 h-3 text-white shrink-0 ml-1" />
                            ) : (
                              <span className="w-2.5 h-2.5 rounded-sm border border-slate-300 shrink-0 ml-1" />
                            )}
                          </button>
                        );
                      })}
                  </div>
                </div>

                {/* 4. PENGATURAN TAUTAN SOAL GOOGLE FORM */}
                <div className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-extrabold text-slate-900 text-xs">
                      <Link2 className="w-4 h-4 text-sky-600" />
                      <span>Pengaturan Tautan Soal (Google Form)</span>
                    </div>
                  </div>

                  {/* Mode Selector */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-200/60 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setIsPerClassFormMode(false)}
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-center ${
                        !isPerClassFormMode
                          ? 'bg-white text-sky-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      1 Tautan Global (Semua Kelas Sama)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPerClassFormMode(true);
                        // Pre-populate classFormUrls with current main URL if empty
                        if (!scheduleFormData.classFormUrls || Object.keys(scheduleFormData.classFormUrls).length === 0) {
                          const initial: Record<string, string> = {};
                          (scheduleFormData.classes || []).forEach(c => {
                            initial[c] = scheduleFormData.formUrl || '';
                          });
                          setScheduleFormData({ ...scheduleFormData, classFormUrls: initial });
                        }
                      }}
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-center ${
                        isPerClassFormMode
                          ? 'bg-white text-sky-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Tautan Khusus per Kelas
                    </button>
                  </div>

                  {/* Sub-form based on mode */}
                  {!isPerClassFormMode ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block font-bold text-slate-700">Tautan Soal Google Form (URL Embedded)</label>
                        {scheduleFormData.formUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewSchedule({
                                id: editingSchedule?.id || 'PREVIEW-TEMP',
                                subject: scheduleFormData.subject || 'Preview Soal',
                                date: scheduleFormData.date || '2026-10-13',
                                startTime: scheduleFormData.startTime || '07:30',
                                endTime: scheduleFormData.endTime || '09:00',
                                durationMinutes: scheduleFormData.durationMinutes || 90,
                                token: scheduleFormData.token || database.systemConfig.currentToken,
                                formUrl: scheduleFormData.formUrl || '',
                                classes: scheduleFormData.classes || ['7-A'],
                                isActive: false
                              });
                              setPreviewClassSelect(scheduleFormData.classes?.[0] || '');
                            }}
                            className="text-sky-700 hover:text-sky-900 font-bold text-[11px] flex items-center gap-1 bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-200 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Uji & Preview Formulir</span>
                          </button>
                        )}
                      </div>
                      <input
                        type="url"
                        placeholder="https://docs.google.com/forms/d/e/.../viewform?embedded=true"
                        value={scheduleFormData.formUrl || ''}
                        onChange={(e) => setScheduleFormData({ ...scheduleFormData, formUrl: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-[11px] text-slate-800"
                      />
                      <p className="text-[10px] text-slate-400">
                        Pastikan tautan berakhiran ?embedded=true agar tampilan soal terintegrasi rapi di layar siswa.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Bulk Apply Helper */}
                      <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-amber-900">
                          <span>Terapkan Cepat ke Semua Kelas Terpilih:</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="url"
                            placeholder="Tempel URL Google Form di sini..."
                            value={bulkUrlInput}
                            onChange={(e) => setBulkUrlInput(e.target.value)}
                            className="flex-1 px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-[11px] font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!bulkUrlInput.trim()) {
                                alert('Masukkan URL formulir terlebih dahulu.');
                                return;
                              }
                              const updated: Record<string, string> = { ...(scheduleFormData.classFormUrls || {}) };
                              (scheduleFormData.classes || []).forEach(c => {
                                updated[c] = bulkUrlInput.trim();
                              });
                              setScheduleFormData({
                                ...scheduleFormData,
                                formUrl: bulkUrlInput.trim(),
                                classFormUrls: updated
                              });
                            }}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] shrink-0 transition-colors"
                          >
                            Salin ke Semua Kelas
                          </button>
                        </div>
                      </div>

                      {/* Per-Class URL Inputs */}
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {(scheduleFormData.classes || []).length === 0 ? (
                          <div className="p-3 text-center text-slate-400 italic bg-white rounded-lg border border-slate-200">
                            Silakan pilih target kelas di atas terlebih dahulu untuk mengatur tautan soal masing-masing kelas.
                          </div>
                        ) : (
                          (scheduleFormData.classes || []).map(cls => {
                            const val = (scheduleFormData.classFormUrls && scheduleFormData.classFormUrls[cls]) || '';
                            return (
                              <div key={cls} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
                                <span className="font-extrabold text-sky-800 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200 text-xs shrink-0 w-16 text-center">
                                  {cls}
                                </span>
                                <input
                                  type="url"
                                  placeholder={`URL Soal Google Form untuk Kelas ${cls}...`}
                                  value={val}
                                  onChange={(e) => {
                                    const next = { ...(scheduleFormData.classFormUrls || {}), [cls]: e.target.value };
                                    setScheduleFormData({ ...scheduleFormData, classFormUrls: next });
                                  }}
                                  className="flex-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[11px] text-slate-800 focus:bg-white"
                                />
                                {val && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPreviewSchedule({
                                        id: editingSchedule?.id || 'PREVIEW-TEMP',
                                        subject: `${scheduleFormData.subject || 'Soal'} (${cls})`,
                                        date: scheduleFormData.date || '2026-10-13',
                                        startTime: scheduleFormData.startTime || '07:30',
                                        endTime: scheduleFormData.endTime || '09:00',
                                        durationMinutes: scheduleFormData.durationMinutes || 90,
                                        token: scheduleFormData.token || database.systemConfig.currentToken,
                                        formUrl: val,
                                        classes: [cls],
                                        isActive: false
                                      });
                                      setPreviewClassSelect(cls);
                                    }}
                                    className="p-1.5 text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 shrink-0 transition-colors"
                                    title={`Preview Soal Kelas ${cls}`}
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
                <span className="text-[11px] text-slate-500 font-medium">
                  {(scheduleFormData.classes || []).length} Kelas Terpilih
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddScheduleOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>Simpan Jadwal & Soal</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL PREVIEW LANGSUNG SOAL UJIAN ================= */}
      {previewSchedule && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col p-2 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col flex-1 overflow-hidden shadow-2xl text-white">
            {/* 1. Modal Top Toolbar */}
            <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-600 flex items-center justify-center text-white shadow-xs">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-white text-sm sm:text-base tracking-tight">
                      Preview Langsung Soal: {previewSchedule.subject}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[10px] font-bold flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-indigo-400" />
                      <span>{formatIndonesianDate(previewSchedule.date)}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30 text-[10px] font-mono font-bold">
                      TOKEN: {previewSchedule.token || database.systemConfig.currentToken}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Tanggal Ujian: <strong className="text-white">{formatIndonesianDate(previewSchedule.date)}</strong> · Waktu: {previewSchedule.startTime} - {previewSchedule.endTime} WIB · Durasi: {previewSchedule.durationMinutes} Menit · {previewSchedule.totalQuestions || 40} Butir Soal · Kelas [{previewSchedule.classes ? previewSchedule.classes.join(', ') : 'Semua'}]
                  </p>
                </div>
              </div>

              {/* Class Selector for preview if per-class forms exist */}
              {previewSchedule.classFormUrls && Object.keys(previewSchedule.classFormUrls).length > 0 && (
                <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
                  <span className="text-[11px] font-bold text-sky-300">Simulasi Kelas:</span>
                  <select
                    value={previewClassSelect}
                    onChange={(e) => setPreviewClassSelect(e.target.value)}
                    className="bg-slate-900 text-white text-xs font-bold rounded-lg px-2 py-1 border border-slate-700 focus:outline-sky-500"
                  >
                    {(previewSchedule.classes || []).map(c => (
                      <option key={c} value={c}>
                        Kelas {c} {previewSchedule.classFormUrls?.[c] ? '✓ (Khusus)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Viewport Switcher */}
              <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
                <button
                  onClick={() => setPreviewDevice('desktop')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    previewDevice === 'desktop'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Tampilan Layar Komputer / Desktop"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Komputer</span>
                </button>
                <button
                  onClick={() => setPreviewDevice('tablet')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    previewDevice === 'tablet'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Tampilan Layar Tablet (768px)"
                >
                  <Tablet className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tablet</span>
                </button>
                <button
                  onClick={() => setPreviewDevice('mobile')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    previewDevice === 'mobile'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Tampilan Layar Handphone (385px)"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Handphone</span>
                </button>
              </div>

              {/* Actions: Open in new tab & Close */}
              {(() => {
                const currentFormUrl = (previewSchedule.classFormUrls && previewClassSelect && previewSchedule.classFormUrls[previewClassSelect]?.trim())
                  ? previewSchedule.classFormUrls[previewClassSelect].trim()
                  : previewSchedule.formUrl;

                return (
                  <div className="flex items-center gap-2">
                    {currentFormUrl && (
                      <a
                        href={currentFormUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition-colors"
                        title="Buka Formulir di Tab Baru"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Tab Baru</span>
                      </a>
                    )}
                    <button
                      onClick={() => setPreviewSchedule(null)}
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-rose-300 border border-slate-700 transition-colors"
                      title="Tutup Pratinjau"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* 2. Subheader Status Banner */}
            {(() => {
              const currentFormUrl = (previewSchedule.classFormUrls && previewClassSelect && previewSchedule.classFormUrls[previewClassSelect]?.trim())
                ? previewSchedule.classFormUrls[previewClassSelect].trim()
                : previewSchedule.formUrl;

              return (
                <div className="px-4 py-2 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[11px] font-semibold text-emerald-400">
                      Simulasi Pengerjaan Siswa Kiosk BAGJA EXAM SMP Negeri 7 Cimahi
                      {previewClassSelect ? ` (Kelas ${previewClassSelect})` : ''}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400 truncate max-w-md hidden md:inline">
                    {currentFormUrl}
                  </span>
                </div>
              );
            })()}

            {/* 3. Embedded Viewport Canvas */}
            <div className="flex-1 bg-slate-950 p-2 sm:p-4 flex justify-center items-center overflow-auto">
              {(() => {
                const currentFormUrl = (previewSchedule.classFormUrls && previewClassSelect && previewSchedule.classFormUrls[previewClassSelect]?.trim())
                  ? previewSchedule.classFormUrls[previewClassSelect].trim()
                  : previewSchedule.formUrl;

                return currentFormUrl ? (
                  <div
                    className={`h-full transition-all duration-300 flex flex-col bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-800 ${
                      previewDevice === 'desktop'
                        ? 'w-full'
                        : previewDevice === 'tablet'
                        ? 'w-[768px] max-w-full border-8 border-slate-800'
                        : 'w-[385px] max-w-full border-8 border-slate-800'
                    }`}
                  >
                    {/* Mock Browser/App Bar */}
                    <div className="bg-slate-100 border-b border-slate-200 px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-600 font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      </div>
                      <div className="flex items-center gap-1 bg-white px-3 py-0.5 rounded-md border border-slate-200 text-slate-700 font-sans text-[10px]">
                        <Lock className="w-2.5 h-2.5 text-emerald-600" />
                        <span>bagja-exam.internal/kiosk/{previewSchedule.subject.toLowerCase().replace(/\s+/g, '-')}{previewClassSelect ? `/${previewClassSelect}` : ''}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">SMPN 7 Cimahi</span>
                    </div>

                    {/* Google Form Iframe */}
                    <iframe
                      src={currentFormUrl}
                      title={`Formulir Soal ${previewSchedule.subject}`}
                      className="w-full flex-1 border-0 bg-white"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-modals"
                    />
                  </div>
                ) : (
                  <div className="text-center p-8 text-slate-400 space-y-3">
                    <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
                    <p className="font-bold text-white text-sm">Tautan Google Form Belum Diisi</p>
                    <p className="text-xs text-slate-400 max-w-sm">
                      Silakan edit jadwal ujian ini dan masukkan tautan publik Google Form (?embedded=true).
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ================= SMART IMPORT MODALS ================= */}
      <SmartImportModal
        type="students"
        isOpen={isSmartImportStudentOpen}
        onClose={() => setIsSmartImportStudentOpen(false)}
        database={database}
        onSaveDatabase={onSaveDatabase}
        onRefreshDatabase={onRefreshDatabase}
      />

      <SmartImportModal
        type="supervisors"
        isOpen={isSmartImportSupervisorOpen}
        onClose={() => setIsSmartImportSupervisorOpen(false)}
        database={database}
        onSaveDatabase={onSaveDatabase}
        onRefreshDatabase={onRefreshDatabase}
      />

      {/* ================= GLOBAL SAFE CONFIRMATION DIALOG ================= */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-extrabold text-slate-900 text-base">{confirmDialog.title}</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  await confirmDialog.onConfirm();
                  setConfirmDialog({ ...confirmDialog, isOpen: false });
                }}
                className="flex-1 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors"
              >
                Ya, Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
