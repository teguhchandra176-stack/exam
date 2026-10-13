import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  User,
  KeyRound,
  Lock,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  BookOpen,
  Building2,
  ChevronRight,
  ShieldAlert,
  Smartphone,
  Tablet,
  Monitor,
  Hourglass,
  CheckCircle2,
  Shield,
  UserCheck
} from 'lucide-react';
import { DatabaseSchema, Student, Supervisor, Schedule, DeviceType } from '../types';
import { formatIndonesianDate } from '../services/dateFormatter';
import { getScheduleTiming, ScheduleTimingResult } from '../services/scheduleTiming';

interface PortalLoginProps {
  database: DatabaseSchema;
  deviceType: DeviceType;
  onStudentLogin: (student: Student, schedule: Schedule) => void;
  onSupervisorLogin: (supervisor: Supervisor) => void;
  onAdminLogin: () => void;
}

export const PortalLogin: React.FC<PortalLoginProps> = ({
  database,
  deviceType,
  onStudentLogin,
  onSupervisorLogin,
  onAdminLogin,
}) => {
  // Tabs: 'siswa' | 'pengawas' | 'admin'
  const [activeTab, setActiveTab] = useState<'siswa' | 'pengawas' | 'admin'>('siswa');

  // Student Form State
  const [studentId, setStudentId] = useState('');
  const [tokenInput, setTokenInput] = useState('');

  // Supervisor Form State
  const [selectedRoom, setSelectedRoom] = useState(database.rooms[0] || 'Lab Komputer');
  const [supervisorPin, setSupervisorPin] = useState('');

  // Discreet Admin Modal State
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');

  // Feedback Alerts
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live Clock Interval for automated schedule start and end triggers
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Active Schedule Finder: Prioritize ongoing schedule, then upcoming schedule, then first
  const activeSchedule = useMemo(() => {
    const list = database.schedules || [];
    if (list.length === 0) return undefined;
    const ongoing = list.find(s => {
      const t = getScheduleTiming(s, currentTime);
      return t.isOngoing;
    });
    if (ongoing) return ongoing;
    const upcoming = list.find(s => {
      const t = getScheduleTiming(s, currentTime);
      return t.isUpcoming;
    });
    if (upcoming) return upcoming;
    const manualActive = list.find(s => s.isActive);
    if (manualActive) return manualActive;
    return list[0];
  }, [database.schedules, currentTime]);

  // Live Timing Analysis of the active schedule
  const scheduleTiming: ScheduleTimingResult | null = useMemo(() => {
    if (!activeSchedule) return null;
    return getScheduleTiming(activeSchedule, currentTime);
  }, [activeSchedule, currentTime]);

  // Validate Exam Time Window (Automated schedule start & finish check)
  const isTimeAllowed = (schedule: Schedule | undefined): { allowed: boolean; reason?: string } => {
    if (!schedule) return { allowed: false, reason: 'Belum ada jadwal ujian yang terdaftar.' };

    const timing = getScheduleTiming(schedule, currentTime);

    if (timing.isUpcoming) {
      return {
        allowed: false,
        reason: `Ujian ${schedule.subject} belum dimulai sesuai jadwal resmi. Ujian akan dimulai secara otomatis pada pukul ${schedule.startTime} WIB (Tersisa hitung mundur: ${timing.formattedUntilStart}).`
      };
    }

    if (timing.isFinished) {
      return {
        allowed: false,
        reason: `Waktu pelaksanaan ujian ${schedule.subject} telah selesai pada pukul ${schedule.endTime} WIB. Akses masuk pengerjaan soal telah ditutup secara otomatis.`
      };
    }

    return { allowed: true };
  };

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 1. Check Maintenance
    if (database.systemConfig.maintenanceMode) {
      setErrorMessage(`Sistem sedang dalam mode pemeliharaan (${database.systemConfig.maintenanceVersion}). Akses siswa ditutup sementara.`);
      return;
    }

    // 2. Validate Student Identifier
    const cleanId = studentId.trim();
    if (!cleanId) {
      setErrorMessage('Silakan masukkan NISN, NIPD, atau Nomor Peserta.');
      return;
    }

    const student = database.students.find(
      s => s.noPeserta.toLowerCase() === cleanId.toLowerCase() ||
           s.nisn.toLowerCase() === cleanId.toLowerCase() ||
           s.nipd.toLowerCase() === cleanId.toLowerCase()
    );

    if (!student) {
      setErrorMessage('Data peserta tidak terdaftar. Periksa kembali NISN / NIPD / No Peserta Anda.');
      return;
    }

    // 3. Check Student Status
    if (student.status === 'Selesai') {
      setErrorMessage(`Peserta ${student.nama} telah menyelesaikan ujian ini. Akses masuk ditolak kecuali status Anda direset oleh pengawas ruangan.`);
      return;
    }

    // 4. Validate Schedule & Time Window
    if (!activeSchedule) {
      setErrorMessage('Tidak ada jadwal ujian yang aktif saat ini. Hubungi pengawas ruangan.');
      return;
    }

    const timeCheck = isTimeAllowed(activeSchedule);
    if (!timeCheck.allowed) {
      setErrorMessage(timeCheck.reason || 'Ujian belum dapat diakses.');
      return;
    }

    // Check Class Eligibility
    if (activeSchedule.classes && !activeSchedule.classes.includes(student.kelas)) {
      setErrorMessage(`Jadwal ujian saat ini (${activeSchedule.subject}) diperuntukkan bagi kelas [${activeSchedule.classes.join(', ')}]. Anda berada di kelas ${student.kelas}.`);
      return;
    }

    // 5. Validate Token (Centralized 7-Minute Rotating Token)
    const cleanToken = tokenInput.trim().toUpperCase();
    const currentValidToken = (database.systemConfig.currentToken || activeSchedule.token || '').toUpperCase();
    if (cleanToken !== currentValidToken) {
      setErrorMessage('Token ujian tidak valid atau telah kedaluwarsa. Mintalah token terbaru kepada pengawas ruangan.');
      return;
    }

    // Successful student login
    onStudentLogin(student, activeSchedule);
  };

  const handleSupervisorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanPin = supervisorPin.trim();
    if (!cleanPin) {
      setErrorMessage('Silakan masukkan PIN / Password Pengawas.');
      return;
    }

    // Find supervisor in master data matching PIN or NIP
    const matchedSupervisor = (database.supervisors || []).find(
      s => s.pin === cleanPin || s.nip === cleanPin
    );

    let supervisor: Supervisor | null = null;

    if (matchedSupervisor) {
      supervisor = {
        ...matchedSupervisor,
        ruang: selectedRoom
      };
    } else if (
      cleanPin === database.systemConfig.supervisorDefaultPin ||
      cleanPin === database.systemConfig.adminPassword ||
      cleanPin === database.systemConfig.kioskEmergencyPin
    ) {
      supervisor = {
        nip: '-',
        nama: `Pengawas ${selectedRoom}`,
        ruang: selectedRoom,
        pin: cleanPin
      };
    }

    if (!supervisor) {
      setErrorMessage(`Password / PIN Pengawas tidak ditemukan atau tidak valid.`);
      return;
    }

    onSupervisorLogin(supervisor);
  };

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPasswordInput.trim() === database.systemConfig.adminPassword) {
      setIsAdminModalOpen(false);
      onAdminLogin();
    } else {
      alert('Password Administrator tidak valid!');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-between py-6 px-4 sm:px-6">
      <div className="max-w-md w-full mx-auto space-y-6">
        {/* Header Institution Card with Pemkot & School Logos */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3.5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white p-1.5 shadow-xs border border-sky-100 flex items-center justify-center hover:shadow-sm transition-shadow">
              <img
                src={database.systemConfig.logoPemkot || '/logo-pemda.svg'}
                alt="Logo Pemerintah Kota Cimahi"
                className="max-h-full max-w-full object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (target.src !== window.location.origin + '/logo-pemda.svg') {
                    target.src = '/logo-pemda.svg';
                  }
                }}
              />
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white p-1.5 shadow-xs border border-sky-100 flex items-center justify-center hover:shadow-sm transition-shadow">
              <img
                src={database.systemConfig.logoSekolah || '/logo-sekolah.svg'}
                alt="Logo SMP Negeri 7 Cimahi"
                className="max-h-full max-w-full object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (target.src !== window.location.origin + '/logo-sekolah.svg') {
                    target.src = '/logo-sekolah.svg';
                  }
                }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-sky-100/80 text-sky-800 text-[11px] font-bold tracking-wide border border-sky-200">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
              <span>PORTAL KEAMANAN TERPADU</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {database.systemConfig.brandName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-semibold">
              {database.systemConfig.schoolInfo.namaSekolah} · TA {database.systemConfig.schoolInfo.tahunAjaran}
            </p>
          </div>
        </div>

        {/* Active Schedule Notification Card with Real-time Auto-Start & Auto-End */}
        {activeSchedule && scheduleTiming ? (
          <div className="p-4 rounded-xl bg-white border border-sky-100 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-700">
                <BookOpen className="w-4 h-4 text-sky-600" />
                <span>MATA PELAJARAN AKTIF</span>
              </div>
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${scheduleTiming.badgeStyle.bg} ${scheduleTiming.badgeStyle.text} ${scheduleTiming.badgeStyle.border}`}>
                <span className={`w-2 h-2 rounded-full ${scheduleTiming.badgeStyle.dot}`}></span>
                <span>{scheduleTiming.statusLabel.toUpperCase()}</span>
              </span>
            </div>

            <div>
              <div className="text-base font-extrabold text-slate-900 leading-snug">{activeSchedule.subject}</div>
              <p className="text-xs text-slate-500">{activeSchedule.description || 'Penilaian Sumatif Sekolah'}</p>
            </div>

            {/* Dynamic Countdown Banner for Automated Scheduling */}
            {scheduleTiming.isUpcoming && (
              <div className="bg-amber-50 border border-amber-200/90 rounded-xl p-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                    <Hourglass className="w-4 h-4 animate-spin" />
                  </div>
                  <div>
                    <div className="font-extrabold text-amber-950">Hitung Mundur Mulai Otomatis</div>
                    <div className="text-[11px] text-amber-700">Ujian terbuka otomatis pukul {activeSchedule.startTime} WIB</div>
                  </div>
                </div>
                <div className="font-mono text-sm font-black text-amber-900 bg-amber-200/80 px-2.5 py-1 rounded-lg border border-amber-300 shadow-2xs">
                  {scheduleTiming.formattedUntilStart}
                </div>
              </div>
            )}

            {scheduleTiming.isOngoing && (
              <div className="bg-emerald-50 border border-emerald-200/90 rounded-xl p-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <Clock className="w-4 h-4 text-emerald-700 animate-pulse" />
                  </div>
                  <div>
                    <div className="font-extrabold text-emerald-950">Ujian Sedang Berlangsung</div>
                    <div className="text-[11px] text-emerald-700">Otomatis selesai pukul {activeSchedule.endTime} WIB</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-emerald-600 font-semibold uppercase">Sisa Waktu</div>
                  <div className="font-mono text-xs sm:text-sm font-black text-emerald-900">
                    {scheduleTiming.formattedRemaining}
                  </div>
                </div>
              </div>
            )}

            {scheduleTiming.isFinished && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-4 h-4 text-slate-600" />
                  </div>
                  <div>
                    <div className="font-extrabold text-slate-800">Waktu Ujian Telah Selesai</div>
                    <div className="text-[11px] text-slate-500">Berakhir pada pukul {activeSchedule.endTime} WIB</div>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                  Akses Ditutup
                </span>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-xs text-indigo-900 font-bold bg-indigo-50/80 px-2.5 py-1.5 rounded-lg border border-indigo-100">
              <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>Tanggal Ujian: {formatIndonesianDate(activeSchedule.date)}</span>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{activeSchedule.startTime} - {activeSchedule.endTime} WIB ({activeSchedule.durationMinutes} Menit)</span>
              </div>
              <div className="text-sky-700 font-semibold flex items-center gap-1 text-[11px]">
                <Lock className="w-3 h-3 text-sky-600" />
                <span>Token Terproteksi</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
            Belum ada jadwal ujian aktif. Tambahkan jadwal melalui Portal Admin.
          </div>
        )}

        {/* Error Notification Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-medium flex items-start gap-2.5 shadow-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Main Clean 1-Column Login Form Container */}
        <div className="bg-white rounded-2xl border border-sky-100 shadow-sm p-6 space-y-6">
          {/* Clean Segmented Tab Switcher - Integrasi 3 Portal */}
          <div className="grid grid-cols-3 p-1 bg-slate-100 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => { setActiveTab('siswa'); setErrorMessage(null); }}
              className={`py-2 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'siswa'
                  ? 'bg-white text-sky-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span>Portal Siswa</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('pengawas'); setErrorMessage(null); }}
              className={`py-2 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'pengawas'
                  ? 'bg-white text-sky-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Pengawas</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('admin'); setErrorMessage(null); }}
              className={`py-2 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'admin'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>Admin</span>
            </button>
          </div>

          {/* STUDENT LOGIN FORM */}
          {activeTab === 'siswa' && (
            <form onSubmit={handleStudentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nomor Peserta / NISN / NIPD
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Masukkan NISN / NIPD / No Peserta"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Gunakan NISN atau Nomor Peserta resmi yang terdaftar.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Token Ujian (6 Karakter)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    maxLength={6}
                    autoComplete="off"
                    placeholder="••••••"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono tracking-widest text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent uppercase transition-all"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Token diperoleh langsung dari pengawas ruangan saat ujian dimulai.
                </p>
              </div>

              <div className="pt-2">
                {scheduleTiming?.isUpcoming ? (
                  <button
                    type="submit"
                    className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Hourglass className="w-4 h-4 animate-spin" />
                    <span>Ujian Dimulai Otomatis ({scheduleTiming.formattedUntilStart})</span>
                  </button>
                ) : scheduleTiming?.isFinished ? (
                  <button
                    type="submit"
                    className="w-full py-3 px-4 bg-slate-600 hover:bg-slate-700 text-white font-bold text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Waktu Ujian Telah Selesai ({activeSchedule?.endTime} WIB)</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm rounded-xl shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <span>Mulai Kerjakan Ujian</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </form>
          )}

          {/* SUPERVISOR LOGIN FORM */}
          {activeTab === 'pengawas' && (
            <form onSubmit={handleSupervisorSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Ruang Tugas Pengawas
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <select
                    value={selectedRoom}
                    onChange={(e) => setSelectedRoom(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                  >
                    {database.rooms.map(room => (
                      <option key={room} value={room}>{room}</option>
                    ))}
                  </select>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Dasbor pengawas dibatasi khusus untuk ruang tugas yang dipilih.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Password / PIN Pengawas Ruang
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="••••••"
                    value={supervisorPin}
                    onChange={(e) => setSupervisorPin(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Masukkan PIN / Password rahasia yang ditugaskan administrator.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <span>Masuk Dasbor Pengawas Ruangan</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* ADMIN LOGIN FORM - INTEGRATED DIRECT TAB */}
          {activeTab === 'admin' && (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900">Portal Administrator Utama</h4>
                  <p className="text-[11px] text-slate-500">Pusat kendali, bank soal, jadwal & integritas</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Password Administrator
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="Masukkan password admin"
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Otoritas khusus proktor utama atau panitia ujian sekolah.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  <span>Buka Portal Administrator</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Security Feature Highlights for Student Assurance */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2.5 rounded-xl bg-white/70 border border-sky-100 text-[11px] font-semibold text-slate-600">
            Kunci Layar Kiosk
          </div>
          <div className="p-2.5 rounded-xl bg-white/70 border border-sky-100 text-[11px] font-semibold text-slate-600">
            Deteksi Tab Keluar
          </div>
          <div className="p-2.5 rounded-xl bg-white/70 border border-sky-100 text-[11px] font-semibold text-slate-600">
            Watermark Mikro
          </div>
        </div>

        {/* Discreet Footer Link for Administrator Access */}
        <div className="text-center pt-2">
          <button
            onClick={() => { setIsAdminModalOpen(true); setAdminPasswordInput(''); }}
            className="text-xs font-semibold text-slate-400 hover:text-sky-700 transition-colors inline-flex items-center gap-1.5 py-1 px-2 rounded hover:bg-sky-50/50"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Akses Khusus Administrator Sekolah</span>
          </button>
        </div>
      </div>

      {/* Admin Auth Modal */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Portal Administrator</h3>
                <p className="text-xs text-slate-500">Verifikasi otoritas sistem</p>
              </div>
            </div>

            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Password Administrator
                </label>
                <div className="relative">
                  <input
                    type="password"
                    autoFocus
                    required
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Khusus otoritas administrator resmi sekolah.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdminModalOpen(false)}
                  className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors"
                >
                  Buka Portal Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer Copyright */}
      <footer className="text-center text-xs text-slate-400 mt-6">
        &copy; {new Date().getFullYear()} {database.systemConfig.brandName} · {database.systemConfig.schoolInfo.namaSekolah}. Hak Cipta Dilindungi.
      </footer>
    </div>
  );
};
