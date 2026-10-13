import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Users,
  Search,
  Filter,
  RefreshCw,
  Unlock,
  RotateCcw,
  AlertTriangle,
  Megaphone,
  CheckCircle2,
  Clock,
  Eye,
  LayoutGrid,
  Table as TableIcon,
  BarChart3,
  Smartphone,
  Tablet,
  Monitor,
  Send,
  X,
  FileText,
  Copy,
  Check,
  KeyRound,
  CalendarCheck,
  Calendar,
  DoorOpen
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { DatabaseSchema, Supervisor, Student, IntegrityLog } from '../types';
import { apiClient } from '../services/apiClient';
import { formatIndonesianDate } from '../services/dateFormatter';
import { getScheduleTiming } from '../services/scheduleTiming';
import { isComputerLab, getRoomMaxCapacity } from '../services/roomCapacity';

interface SupervisorDashboardProps {
  supervisor: Supervisor;
  database: DatabaseSchema;
  onRefreshDatabase: () => Promise<void>;
  onSwitchPortal?: (portal: 'portal' | 'supervisor' | 'admin') => void;
  onLogout?: () => void;
}

export const SupervisorDashboard: React.FC<SupervisorDashboardProps> = ({
  supervisor,
  database,
  onRefreshDatabase,
  onSwitchPortal,
  onLogout,
}) => {
  // ROOM SCOPE: Supports active monitored room switching if proctor has multiple assigned rooms
  const [currentRoom, setCurrentRoom] = useState<string>(supervisor.ruang || (database.rooms && database.rooms[0]) || 'Lab Komputer');
  const assignedRoom = currentRoom;

  // Supervision Duty Schedule Modal State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const myDuties = useMemo(() => {
    return (database.supervisionDuties || []).filter(
      d => d.supervisorNip === supervisor.nip || d.supervisorNip2 === supervisor.nip
    );
  }, [database.supervisionDuties, supervisor.nip]);

  // View state: 'grid' | 'table' | 'chart'
  const [activeView, setActiveView] = useState<'grid' | 'table' | 'chart'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('semua');

  // Emergency Broadcast Form
  const [broadcastInput, setBroadcastInput] = useState('');
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);

  // Inspector Modal State
  const [inspectedStudent, setInspectedStudent] = useState<Student | null>(null);

  // Confirmation Modal State
  const [actionConfirm, setActionConfirm] = useState<{
    type: 'unlock' | 'mass_unlock' | 'reset';
    student?: Student;
    title: string;
    message: string;
  } | null>(null);

  // Real-time Toast Notifications
  const [toastMessage, setToastMessage] = useState<{ id: number; text: string; type: 'warning' | 'info' | 'success' } | null>(null);

  // Rotating Token loading state
  const [isRotatingToken, setIsRotatingToken] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Filter students strictly belonging to this room
  const roomStudents = useMemo(() => {
    return (database.students || []).filter(s => s.ruang === assignedRoom);
  }, [database.students, assignedRoom]);

  // Search and Status filtered
  const filteredStudents = useMemo(() => {
    return roomStudents.filter(s => {
      const matchSearch =
        s.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.noPeserta.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.nisn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.kelas.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus =
        statusFilter === 'semua' ? true : s.status.toLowerCase() === statusFilter.toLowerCase();

      return matchSearch && matchStatus;
    });
  }, [roomStudents, searchQuery, statusFilter]);

  // Violations in this room
  const roomIntegrityLogs = useMemo(() => {
    return (database.integrityLogs || []).filter(log => log.ruang === assignedRoom);
  }, [database.integrityLogs, assignedRoom]);

  // Statistics for this room
  const stats = useMemo(() => {
    const total = roomStudents.length;
    const working = roomStudents.filter(s => s.status === 'Sedang Mengerjakan').length;
    const suspended = roomStudents.filter(s => s.status === 'Ditangguhkan').length;
    const finished = roomStudents.filter(s => s.status === 'Selesai').length;
    const notYet = roomStudents.filter(s => s.status === 'Belum Masuk').length;
    return { total, working, suspended, finished, notYet };
  }, [roomStudents]);

  // Recharts Chart Data: Violations per student
  const chartData = useMemo(() => {
    return roomStudents.map(s => ({
      name: s.nama.split(' ')[0], // First name for neat axis
      fullName: s.nama,
      kelas: s.kelas,
      pelanggaran: s.violationsCount || 0,
      status: s.status
    }));
  }, [roomStudents]);

  // Active token
  const activeSchedule = database.schedules.find(s => s.isActive) || database.schedules[0];
  const activeToken = activeSchedule?.token || database.systemConfig.currentToken;

  // Poll database refresh every 3 seconds for live supervision
  useEffect(() => {
    const interval = setInterval(async () => {
      await onRefreshDatabase();
    }, 3000);
    return () => clearInterval(interval);
  }, [onRefreshDatabase]);

  // Check for suspended alerts to trigger toast
  useEffect(() => {
    const suspendedList = roomStudents.filter(s => s.status === 'Ditangguhkan');
    if (suspendedList.length > 0) {
      const latest = suspendedList[0];
      setToastMessage({
        id: Date.now(),
        text: `PERHATIAN: ${latest.nama} (${latest.kelas}) telah ditangguhkan karena pelanggaran batas toleransi!`,
        type: 'warning'
      });
    }
  }, [roomStudents]);

  // 7-Minute Centralized Token Countdown Timer (420 Seconds)
  const ROTATION_SECONDS = 7 * 60;
  const [tokenCountdown, setTokenCountdown] = useState<number>(() => {
    const last = database.systemConfig.tokenLastRotated
      ? new Date(database.systemConfig.tokenLastRotated).getTime()
      : 0;
    if (!last) return 420;
    const diff = Math.floor((last + 7 * 60 * 1000 - Date.now()) / 1000);
    return diff > 0 ? diff : 420;
  });
  const [hasCopiedToken, setHasCopiedToken] = useState(false);

  // Sync countdown whenever tokenLastRotated changes
  useEffect(() => {
    const last = database.systemConfig.tokenLastRotated
      ? new Date(database.systemConfig.tokenLastRotated).getTime()
      : 0;
    if (last) {
      const diff = Math.floor((last + 7 * 60 * 1000 - Date.now()) / 1000);
      setTokenCountdown(diff > 0 ? diff : 0);
    }
  }, [database.systemConfig.tokenLastRotated]);

  // Handle Token Rotation (Manual or Automatic 7-Minute)
  const handleRotateToken = async (isAuto = false) => {
    setIsRotatingToken(true);
    try {
      const newToken = await apiClient.rotateToken(activeSchedule?.id);
      if (newToken) {
        await onRefreshDatabase();
        setTokenCountdown(420);
        setToastMessage({
          id: Date.now(),
          text: isAuto
            ? `Token berganti otomatis (siklus 7 menit): ${newToken}`
            : `Token berhasil dirotasi secara terpusat: ${newToken}`,
          type: 'success'
        });
      }
    } finally {
      setIsRotatingToken(false);
    }
  };

  // 1-second countdown interval with automatic rotation when reaching 0
  useEffect(() => {
    const timer = setInterval(() => {
      setTokenCountdown(prev => {
        if (prev <= 1) {
          handleRotateToken(true);
          return 420;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeSchedule?.id]);

  const handleCopyToken = () => {
    if (activeToken) {
      navigator.clipboard.writeText(activeToken);
      setHasCopiedToken(true);
      setTimeout(() => setHasCopiedToken(false), 2000);
      setToastMessage({
        id: Date.now(),
        text: `Token ${activeToken} berhasil disalin ke papan klip.`,
        type: 'info'
      });
    }
  };

  const handleBroadcastTokenToRoom = async () => {
    if (!activeToken) return;
    const msg = `📢 TOKEN UJIAN RUANG ${assignedRoom}: ${activeToken} (Berlaku 7 Menit)`;
    const ok = await apiClient.sendBroadcast(assignedRoom, msg, supervisor.nama);
    if (ok) {
      await onRefreshDatabase();
      setToastMessage({
        id: Date.now(),
        text: `Token ${activeToken} telah disiarkan ke seluruh layar siswa di ${assignedRoom}!`,
        type: 'success'
      });
    }
  };

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Handle Emergency Broadcast
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastInput.trim()) return;

    const success = await apiClient.sendBroadcast(assignedRoom, broadcastInput.trim(), supervisor.nama);
    if (success) {
      setBroadcastSuccess(true);
      setBroadcastInput('');
      setToastMessage({
        id: Date.now(),
        text: `Pengumuman terkirim ke seluruh layar siswa di ${assignedRoom}!`,
        type: 'success'
      });
      await onRefreshDatabase();
      setTimeout(() => setBroadcastSuccess(false), 3000);
    }
  };

  // Execute Confirmed Actions
  const handleExecuteAction = async () => {
    if (!actionConfirm) return;
    setIsProcessingAction(true);

    try {
      if (actionConfirm.type === 'unlock' && actionConfirm.student) {
        await apiClient.unlockKiosk({
          noPeserta: actionConfirm.student.noPeserta,
          unlockedBy: supervisor.nama,
          resetViolations: true
        });
        const scheduleEndText = activeSchedule ? ` mengikuti batas akhir jadwal resmi (${activeSchedule.endTime} WIB)` : '';
        setToastMessage({
          id: Date.now(),
          text: `Ujian ${actionConfirm.student.nama} berhasil dibuka kunci. Sisa waktu pengerjaan siswa otomatis${scheduleEndText}.`,
          type: 'success'
        });
      } else if (actionConfirm.type === 'mass_unlock') {
        const suspendedStudents = roomStudents.filter(s => s.status === 'Ditangguhkan');
        for (const s of suspendedStudents) {
          await apiClient.unlockKiosk({
            noPeserta: s.noPeserta,
            unlockedBy: supervisor.nama,
            resetViolations: true
          });
        }
        const scheduleEndText = activeSchedule ? ` (mengikuti batas akhir jadwal pukul ${activeSchedule.endTime} WIB)` : '';
        setToastMessage({
          id: Date.now(),
          text: `Seluruh (${suspendedStudents.length}) siswa ditangguhkan di ${assignedRoom} telah dibuka kunci! Sisa waktu otomatis disesuaikan${scheduleEndText}.`,
          type: 'success'
        });
      } else if (actionConfirm.type === 'reset' && actionConfirm.student) {
        await apiClient.resetStudent(actionConfirm.student.noPeserta, supervisor.nama);
        setToastMessage({
          id: Date.now(),
          text: `Status ${actionConfirm.student.nama} berhasil direset ke Belum Masuk.`,
          type: 'info'
        });
      }

      await onRefreshDatabase();
    } finally {
      setIsProcessingAction(false);
      setActionConfirm(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-28 lg:pb-8">
      {/* Toast Alert Popup */}
      {toastMessage && (
        <div className={`p-4 rounded-xl border shadow-lg flex items-center justify-between gap-3 text-sm font-semibold transition-all ${
          toastMessage.type === 'warning'
            ? 'bg-amber-50 border-amber-300 text-amber-900'
            : toastMessage.type === 'success'
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
            : 'bg-sky-50 border-sky-300 text-sky-900'
        }`}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 rounded-lg hover:bg-black/5 text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Header Supervisor Panel */}
      <div className="bg-white rounded-2xl border border-sky-100 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-sky-700 uppercase tracking-wider bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-md">
              RUANG TUGAS: {assignedRoom}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
              Kapasitas: <strong className="text-slate-900">{roomStudents.length}</strong> / {getRoomMaxCapacity(assignedRoom)} Siswa ({isComputerLab(assignedRoom) ? 'Maks Lab 120' : 'Maks Ruang 44'})
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500 font-medium">Pengawas: {supervisor.nama} (NIP: {supervisor.nip})</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Dasbor Pengawas Ruangan
          </h1>
          <p className="text-xs text-slate-500">
            Pemantauan langsung, kontrol integritas, dan penegakan aturan ujian di {assignedRoom} (Kapasitas: {roomStudents.length}/{getRoomMaxCapacity(assignedRoom)} siswa).
          </p>
        </div>

        {/* Quick Room Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Jadwal Pengawasan Button */}
          <button
            onClick={() => setIsScheduleModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs rounded-xl shadow-2xs transition-colors"
            title="Lihat Jadwal Tugas Pengawasan Saya"
          >
            <CalendarCheck className="w-4 h-4 text-indigo-600" />
            <span>Jadwal Tugas ({myDuties.length})</span>
          </button>

          {/* Mass Unlock Button */}
          <button
            onClick={() => setActionConfirm({
              type: 'mass_unlock',
              title: 'Konfirmasi Buka Kunci Massal',
              message: `Apakah Anda yakin ingin membuka kunci seluruh siswa yang ditangguhkan di ${assignedRoom}?`
            })}
            disabled={stats.suspended === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            <Unlock className="w-4 h-4" />
            <span>Buka Kunci Massal ({stats.suspended})</span>
          </button>

          {/* Quick Portal Switch Actions */}
          {onSwitchPortal && (
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
              <button
                onClick={() => onSwitchPortal('admin')}
                className="flex items-center gap-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-2xs transition-colors"
                title="Buka Portal Admin Utama"
              >
                <span>Portal Admin</span>
              </button>
              <button
                onClick={() => onSwitchPortal('portal')}
                className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                title="Buka Portal Login Peserta Siswa"
              >
                <span>Portal Ujian</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ================= PUSAT TOKEN UJIAN TERPUSAT (ROTASI 7 MENIT) ================= */}
      <div className="bg-linear-to-r from-sky-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-5 shadow-lg border border-sky-800/40 relative overflow-hidden">
        {/* Ambient subtle glow background */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Left: Token Info & Large Display */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-200 border border-sky-400/30 text-[11px] font-bold tracking-wider uppercase">
                <KeyRound className="w-3.5 h-3.5 text-sky-300" />
                <span>Pusat Token Terpusat</span>
              </span>
              {activeSchedule && (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/25 text-indigo-200 border border-indigo-400/30 text-[11px] font-bold">
                  <Calendar className="w-3.5 h-3.5 text-indigo-300" />
                  <span>{activeSchedule.subject} · {formatIndonesianDate(activeSchedule.date)} ({activeSchedule.startTime} - {activeSchedule.endTime} WIB)</span>
                </span>
              )}
              {activeSchedule && (() => {
                const timing = getScheduleTiming(activeSchedule);
                return (
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${timing.badgeStyle.bg} ${timing.badgeStyle.text} ${timing.badgeStyle.border}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${timing.badgeStyle.dot}`}></span>
                    <span>{timing.statusLabel.toUpperCase()} {timing.isOngoing ? `(Sisa ${timing.formattedRemaining})` : ''}</span>
                  </span>
                );
              })()}
              <span className="text-[11px] text-sky-200/80 font-medium">
                Siklus Otomatis Setiap 7 Menit
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-3xl sm:text-4xl font-mono font-black tracking-widest text-white drop-shadow-xs">
                {activeToken || '------'}
              </span>
              <div className="flex items-center gap-1.5 text-xs text-sky-200 bg-white/10 px-2.5 py-1 rounded-lg border border-white/10">
                <Clock className="w-3.5 h-3.5 text-amber-300" />
                <span className="font-mono font-bold text-amber-300 text-sm">
                  {formatCountdown(tokenCountdown)}
                </span>
                <span className="text-[11px] text-slate-300">tersisa</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              Token tersinkronisasi langsung ke seluruh siswa saat login. Token akan berganti secara otomatis setiap 7 menit sekali untuk menjaga integritas ujian sekolah.
            </p>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Copy Button */}
            <button
              onClick={handleCopyToken}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/15 transition-all shadow-xs active:scale-95"
              title="Salin Token Ujian"
            >
              {hasCopiedToken ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-sky-300" />
                  <span>Salin Token</span>
                </>
              )}
            </button>

            {/* Broadcast to Room Button */}
            <button
              onClick={handleBroadcastTokenToRoom}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl transition-all shadow-xs active:scale-95"
              title="Kirim pengumuman token berjalan ke semua gawai siswa di ruangan ini"
            >
              <Megaphone className="w-4 h-4 text-sky-200" />
              <span>Umumkan ke Layar Siswa</span>
            </button>

            {/* Manual Rotate Button */}
            <button
              onClick={() => handleRotateToken(false)}
              disabled={isRotatingToken}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-xs active:scale-95"
              title="Paksa rotasi ganti token baru sekarang"
            >
              <RefreshCw className={`w-4 h-4 ${isRotatingToken ? 'animate-spin' : ''}`} />
              <span>Rotasi Sekarang</span>
            </button>
          </div>
        </div>

        {/* 7-Minute Progress Bar */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300 gap-3">
          <div className="flex-1 bg-white/15 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-amber-400 h-full rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${Math.max(0, Math.min(100, (tokenCountdown / ROTATION_SECONDS) * 100))}%` }}
            />
          </div>
          <span className="font-mono text-[10px] text-slate-300 shrink-0">
            {Math.round((tokenCountdown / ROTATION_SECONDS) * 100)}% Waktu Token Tersisa
          </span>
        </div>
      </div>

      {/* 2. Room Statistics Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-sky-100 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase">Total Peserta</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{stats.total}</div>
          <div className="text-[10px] text-slate-400">Siswa di {assignedRoom}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-xs">
          <div className="text-[11px] font-bold text-emerald-600 uppercase">Mengerjakan</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{stats.working}</div>
          <div className="text-[10px] text-emerald-500">Aktif di layar</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-xs">
          <div className="text-[11px] font-bold text-rose-600 uppercase">Ditangguhkan</div>
          <div className="text-2xl font-black text-rose-600 mt-1">{stats.suspended}</div>
          <div className="text-[10px] text-rose-500">Perlu tindakan pengawas</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-sky-100 shadow-xs">
          <div className="text-[11px] font-bold text-sky-600 uppercase">Selesai</div>
          <div className="text-2xl font-black text-sky-600 mt-1">{stats.finished}</div>
          <div className="text-[10px] text-sky-500">Sudah mengirim jawaban</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase">Belum Masuk</div>
          <div className="text-2xl font-black text-slate-600 mt-1">{stats.notYet}</div>
          <div className="text-[10px] text-slate-400">Belum login token</div>
        </div>
      </div>

      {/* 3. Emergency Room Broadcast Sender */}
      <div className="bg-white rounded-2xl border border-rose-100 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-rose-600" />
            <h2 className="text-sm font-extrabold text-slate-900">
              Siaran Darurat Ruangan ({assignedRoom})
            </h2>
          </div>
          <span className="text-[11px] text-slate-500">
            Hanya tampil sebagai teks berjalan di bilah atas layar siswa di {assignedRoom}
          </span>
        </div>

        <form onSubmit={handleSendBroadcast} className="flex gap-2">
          <input
            type="text"
            placeholder={`Ketik pengumuman penting untuk siswa di ${assignedRoom}...`}
            value={broadcastInput}
            onChange={(e) => setBroadcastInput(e.target.value)}
            className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          <button
            type="submit"
            className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Kirim Siaran</span>
          </button>
        </form>
      </div>

      {/* 4. Controls & Dual-View Tabs Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-sky-100 shadow-xs">
        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari siswa (Nama, No, NISN)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {/* Filter & View Switcher */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="semua">Semua Status ({roomStudents.length})</option>
            <option value="sedang mengerjakan">Sedang Mengerjakan ({stats.working})</option>
            <option value="ditangguhkan">Ditangguhkan ({stats.suspended})</option>
            <option value="selesai">Selesai ({stats.finished})</option>
            <option value="belum masuk">Belum Masuk ({stats.notYet})</option>
          </select>

          {/* View Mode Switcher */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setActiveView('grid')}
              title="Tampilan Grid Kartu"
              className={`p-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeView === 'grid' ? 'bg-white text-sky-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveView('table')}
              title="Tampilan Tabel Rinci"
              className={`p-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeView === 'table' ? 'bg-white text-sky-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveView('chart')}
              title="Grafik Pelanggaran Real-time"
              className={`p-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeView === 'chart' ? 'bg-white text-sky-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. MAIN CONTENT VIEWPORT */}

      {/* VIEW A: INTERACTIVE CARDS GRID */}
      {activeView === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map((s, idx) => {
            const isSusp = s.status === 'Ditangguhkan';
            const isWork = s.status === 'Sedang Mengerjakan';
            const isDone = s.status === 'Selesai';

            return (
              <div
                key={`${s.noPeserta}-${s.nisn || s.nipd || idx}`}
                className={`bg-white rounded-2xl border p-4.5 space-y-3 shadow-xs transition-all ${
                  isSusp
                    ? 'border-rose-400 bg-rose-50/30 ring-2 ring-rose-300'
                    : isWork
                    ? 'border-emerald-200 hover:border-emerald-300'
                    : 'border-slate-200'
                }`}
              >
                {/* Header: Student Name & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                      {s.nama}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                      <span className="font-mono">{s.noPeserta}</span>
                      <span>·</span>
                      <span className="font-semibold text-sky-700">{s.kelas}</span>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    isSusp
                      ? 'bg-rose-100 text-rose-800'
                      : isWork
                      ? 'bg-emerald-100 text-emerald-800'
                      : isDone
                      ? 'bg-sky-100 text-sky-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {s.status}
                  </span>
                </div>

                {/* Metrics: Device, Answers & Violations */}
                <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 text-center">
                  <div className="bg-slate-50 rounded-lg p-1.5">
                    <span className="text-[10px] text-slate-400 block">Perangkat</span>
                    <span className="text-xs font-semibold text-slate-700 flex items-center justify-center gap-1">
                      {s.deviceType === 'Handphone' && <Smartphone className="w-3 h-3 text-sky-600" />}
                      {s.deviceType === 'Tablet' && <Tablet className="w-3 h-3 text-indigo-600" />}
                      {s.deviceType === 'Komputer' && <Monitor className="w-3 h-3 text-emerald-600" />}
                      <span className="truncate">{s.deviceType}</span>
                    </span>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-1.5">
                    <span className="text-[10px] text-slate-400 block">Jawaban</span>
                    <span className="text-xs font-bold text-slate-800">
                      {s.answersSummary ? `${s.answersSummary.answered}/${s.answersSummary.total}` : '0/40'}
                    </span>
                  </div>

                  <div className={`rounded-lg p-1.5 ${s.violationsCount > 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-700'}`}>
                    <span className="text-[10px] block opacity-80">Pelanggaran</span>
                    <span className="text-xs font-extrabold">{s.violationsCount || 0}x</span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setInspectedStudent(s)}
                    className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Detail</span>
                  </button>

                  {isSusp && (
                    <button
                      onClick={() => setActionConfirm({
                        type: 'unlock',
                        student: s,
                        title: 'Buka Kunci Ujian',
                        message: `Buka kunci ujian ${s.nama}? Siswa dapat melanjutkan pengerjaan seketika tanpa perlu login ulang.`
                      })}
                      className="flex-1 py-1.5 px-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Buka Kunci</span>
                    </button>
                  )}

                  {!isSusp && (
                    <button
                      onClick={() => setActionConfirm({
                        type: 'reset',
                        student: s,
                        title: 'Reset Sesi Siswa',
                        message: `Reset status ${s.nama} kembali ke Belum Masuk? Pelanggaran akan dikembalikan ke 0.`
                      })}
                      className="py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 font-bold text-xs rounded-xl transition-colors"
                      title="Reset Sesi"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW B: DETAILED DATA TABLE */}
      {activeView === 'table' && (
        <div className="bg-white rounded-2xl border border-sky-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-3 px-4">No Peserta / NISN</th>
                  <th className="py-3 px-4">Nama Peserta</th>
                  <th className="py-3 px-4">Kelas</th>
                  <th className="py-3 px-4">Perangkat</th>
                  <th className="py-3 px-4">Progres</th>
                  <th className="py-3 px-4">Pelanggaran</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredStudents.map((s, idx) => (
                  <tr key={`${s.noPeserta}-${s.nisn || s.nipd || idx}`} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium">{s.noPeserta}</td>
                    <td className="py-3 px-4 font-bold">{s.nama}</td>
                    <td className="py-3 px-4 font-semibold text-sky-700">{s.kelas}</td>
                    <td className="py-3 px-4 text-slate-600">{s.deviceType}</td>
                    <td className="py-3 px-4 font-medium">
                      {s.answersSummary ? `${s.answersSummary.answered}/${s.answersSummary.total}` : '0/40'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-bold ${s.violationsCount > 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                        {s.violationsCount || 0}
                      </span>
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
                    <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => setInspectedStudent(s)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 inline-flex items-center"
                        title="Detail Siswa"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {s.status === 'Ditangguhkan' ? (
                        <button
                          onClick={() => setActionConfirm({
                            type: 'unlock',
                            student: s,
                            title: 'Buka Kunci Ujian',
                            message: `Buka kunci ujian ${s.nama}?`
                          })}
                          className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold inline-flex items-center gap-1"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>Buka Kunci</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setActionConfirm({
                            type: 'reset',
                            student: s,
                            title: 'Reset Siswa',
                            message: `Reset status ${s.nama}?`
                          })}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 inline-flex items-center"
                          title="Reset Sesi"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW C: REAL-TIME RECHARTS VIOLATION FREQUENCY CHART */}
      {activeView === 'chart' && (
        <div className="bg-white rounded-2xl border border-sky-100 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Visualisasi Frekuensi Pelanggaran per Siswa ({assignedRoom})
              </h2>
              <p className="text-xs text-slate-500">
                Grafik batang real-time pemantauan upaya alih tab atau tindakan terlarang.
              </p>
            </div>
            <span className="text-xs font-bold text-sky-700 bg-sky-50 border border-sky-200 px-3 py-1 rounded-lg">
              Toleransi Maksimal: {database.systemConfig.violationTolerance || 3}x
            </span>
          </div>

          <div className="h-80 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-2.5 rounded-xl text-xs space-y-1 shadow-lg">
                          <p className="font-bold">{d.fullName} ({d.kelas})</p>
                          <p className="text-rose-400 font-extrabold">Pelanggaran: {d.pelanggaran}x</p>
                          <p className="text-slate-300">Status: {d.status}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="pelanggaran" fill="#0284c7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 6. STUDENT INSPECTOR MODAL */}
      {inspectedStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-100">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded">
                  Inspeksi Integritas Siswa
                </span>
                <h3 className="text-lg font-extrabold text-slate-900 mt-1">
                  {inspectedStudent.nama}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {inspectedStudent.noPeserta} · NISN: {inspectedStudent.nisn} · Kelas: {inspectedStudent.kelas}
                </p>
              </div>
              <button
                onClick={() => setInspectedStudent(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Breakdown */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Status Saat Ini:</span>
                <span className="font-bold text-slate-900">{inspectedStudent.status}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Tipe Perangkat:</span>
                <span className="font-bold text-slate-900">{inspectedStudent.deviceType}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Alamat IP:</span>
                <span className="font-mono text-slate-700">{inspectedStudent.ipAddress || '192.168.1.10x'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Total Pelanggaran:</span>
                <span className="font-bold text-rose-600">{inspectedStudent.violationsCount || 0} kali</span>
              </div>
            </div>

            {/* Violation History Records */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Bukti Digital Pelanggaran:
              </h4>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {roomIntegrityLogs
                  .filter(l => l.noPeserta === inspectedStudent.noPeserta)
                  .map((log) => (
                    <div key={log.id} className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs space-y-0.5">
                      <div className="flex items-center justify-between text-rose-900 font-bold">
                        <span>{log.type}</span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {new Date(log.timestamp).toLocaleTimeString('id-ID')}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">{log.details}</p>
                    </div>
                  ))}
                {roomIntegrityLogs.filter(l => l.noPeserta === inspectedStudent.noPeserta).length === 0 && (
                  <p className="text-xs text-slate-400 italic py-2 text-center">
                    Tidak ada catatan pelanggaran integritas untuk peserta ini.
                  </p>
                )}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setInspectedStudent(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. SAFE CONFIRMATION DIALOG */}
      {actionConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-100">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-extrabold text-slate-900 text-base">{actionConfirm.title}</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {actionConfirm.message}
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActionConfirm(null)}
                disabled={isProcessingAction}
                className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteAction}
                disabled={isProcessingAction}
                className="flex-1 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors"
              >
                {isProcessingAction ? 'Memproses...' : 'Ya, Lanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL JADWAL PENGAWASAN SAYA ================= */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden border border-slate-100 my-auto max-h-[90vh] flex flex-col">
            <div className="p-5 bg-gradient-to-r from-indigo-600 to-sky-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <CalendarCheck className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="font-black text-base">Jadwal Tugas Pengawasan Saya</h3>
                  <p className="text-[11px] text-sky-100">
                    Pengawas: {supervisor.nama} (NIP: {supervisor.nip})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              {myDuties.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
                  <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="font-extrabold text-slate-800 text-sm">Belum Ada Jadwal Tugas</p>
                  <p className="text-slate-400 mt-1 max-w-xs mx-auto text-[11px]">
                    Administrator belum memplotkan jadwal pengawasan ruang untuk akun Anda. Silakan hubungi proktor / panitia ujian.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-slate-500 font-bold text-[11px]">
                    <span>Total {myDuties.length} Sesi Terjadwal</span>
                    <span>Ruang Aktif: <strong className="text-sky-700">{assignedRoom}</strong></span>
                  </div>

                  {myDuties.map((duty, idx) => {
                    const isCurrentRoom = duty.room === assignedRoom;
                    return (
                      <div
                        key={duty.id || idx}
                        className={`p-4 rounded-2xl border transition-all ${
                          isCurrentRoom
                            ? 'bg-sky-50/70 border-sky-300 shadow-2xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-black text-slate-900 text-sm">
                              {duty.subject}
                            </span>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-600 font-semibold">
                              <span>📅 {duty.date}</span>
                              <span>•</span>
                              <span>⏰ {duty.startTime} - {duty.endTime} ({duty.session || 'Sesi Ujian'})</span>
                            </div>
                          </div>

                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            duty.status === 'Bertugas'
                              ? 'bg-amber-100 text-amber-800'
                              : duty.status === 'Selesai'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}>
                            {duty.status || 'Terjadwal'}
                          </span>
                        </div>

                        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                            <DoorOpen className="w-3.5 h-3.5 text-sky-600" />
                            <span>Ruang Tugas: <span className="text-sky-900">{duty.room}</span></span>
                            {duty.supervisorNama2 && (
                              <span className="text-[10px] text-slate-500 font-normal ml-2">
                                (Bersama: {duty.supervisorNama2})
                              </span>
                            )}
                          </div>

                          {!isCurrentRoom && (
                            <button
                              onClick={() => {
                                setCurrentRoom(duty.room);
                                setIsScheduleModalOpen(false);
                                setToastMessage({
                                  id: Date.now(),
                                  text: `Tampilan dasbor berhasil dialihkan ke ${duty.room}!`,
                                  type: 'info'
                                });
                              }}
                              className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold text-[10px] transition-colors"
                            >
                              Buka Ruang Ini
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= SMART MENU DI BAGIAN BAWAH (MODE HANDPHONE & TABLET - LG:HIDDEN) ================= */}
      <nav
        aria-label="Smart Menu Pengawas"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_24px_rgba(0,0,0,0.09)] py-1.5 px-3 safe-area-bottom"
      >
        <div className="max-w-md mx-auto grid grid-cols-3 gap-1.5">
          <button
            onClick={() => setActiveView('grid')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[10px] font-bold transition-all ${
              activeView === 'grid'
                ? 'bg-sky-600 text-white shadow-xs font-extrabold'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <LayoutGrid className="w-4 h-4 mb-0.5" />
            <span>Kartu Siswa</span>
          </button>

          <button
            onClick={() => setActiveView('table')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[10px] font-bold transition-all ${
              activeView === 'table'
                ? 'bg-sky-600 text-white shadow-xs font-extrabold'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <TableIcon className="w-4 h-4 mb-0.5" />
            <span>Tabel Rinci</span>
          </button>

          <button
            onClick={() => setActiveView('chart')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[10px] font-bold transition-all ${
              activeView === 'chart'
                ? 'bg-sky-600 text-white shadow-xs font-extrabold'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <BarChart3 className="w-4 h-4 mb-0.5" />
            <span>Grafik Tab</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
