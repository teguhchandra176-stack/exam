import React, { useState, useEffect } from 'react';
import {
  Clock,
  AlertTriangle,
  Calendar,
  Send,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Info
} from 'lucide-react';
import { Schedule, DeviceType } from '../types';
import { formatIndonesianDate } from '../services/dateFormatter';
import { playTimerChime } from '../services/soundAlarm';

export interface ExamCountdownTimerProps {
  schedule: Schedule;
  timeRemainingSeconds: number;
  totalDurationSeconds: number;
  isTimeExpired: boolean;
  onAutoSubmit: () => void | Promise<void>;
  autoSubmitCountdown?: number;
  isSubmitting?: boolean;
  answeredCount?: number;
  totalQuestions?: number;
  studentName?: string;
  noPeserta?: string;
  deviceType?: DeviceType;
  onOpenSubmitModal?: () => void;
  className?: string;
}

export const ExamCountdownTimer: React.FC<ExamCountdownTimerProps> = ({
  schedule,
  timeRemainingSeconds,
  totalDurationSeconds,
  isTimeExpired,
  onAutoSubmit,
  autoSubmitCountdown = 10,
  isSubmitting = false,
  answeredCount = 0,
  totalQuestions = 40,
  studentName,
  noPeserta,
  deviceType = 'Komputer',
  onOpenSubmitModal,
  className = ''
}) => {
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(false);
  const [hasPlayed10MinChime, setHasPlayed10MinChime] = useState<boolean>(false);
  const [hasPlayed5MinChime, setHasPlayed5MinChime] = useState<boolean>(false);
  const [hasPlayedExpiredChime, setHasPlayedExpiredChime] = useState<boolean>(false);

  // Time calculations
  const remainingSec = Math.max(0, timeRemainingSeconds);
  const hours = Math.floor(remainingSec / 3600);
  const minutes = Math.floor((remainingSec % 3600) / 60);
  const seconds = remainingSec % 60;

  const hoursStr = hours.toString().padStart(2, '0');
  const minutesStr = minutes.toString().padStart(2, '0');
  const secondsStr = seconds.toString().padStart(2, '0');

  // Percentage calculations
  const safeTotal = Math.max(60, totalDurationSeconds);
  const elapsedSec = Math.max(0, safeTotal - remainingSec);
  const remainingPercent = Math.min(100, Math.max(0, (remainingSec / safeTotal) * 100));
  const elapsedPercent = Math.min(100, Math.max(0, (elapsedSec / safeTotal) * 100));

  // Urgency status tier
  const isExpired = remainingSec <= 0 || isTimeExpired;
  const isCritical = !isExpired && remainingSec <= 300; // <= 5 minutes
  const isWarning = !isExpired && !isCritical && remainingSec <= 600; // <= 10 minutes
  const isNormal = !isExpired && !isCritical && !isWarning;

  // Audio chimes
  useEffect(() => {
    if (isSoundMuted) return;

    if (remainingSec <= 600 && remainingSec > 540 && !hasPlayed10MinChime) {
      setHasPlayed10MinChime(true);
      playTimerChime('warning');
    }

    if (remainingSec <= 300 && remainingSec > 240 && !hasPlayed5MinChime) {
      setHasPlayed5MinChime(true);
      playTimerChime('urgent');
    }

    if (isExpired && !hasPlayedExpiredChime) {
      setHasPlayedExpiredChime(true);
      playTimerChime('expired');
    }
  }, [remainingSec, isExpired, isSoundMuted, hasPlayed10MinChime, hasPlayed5MinChime, hasPlayedExpiredChime]);

  // Color theme tokens based on urgency
  const getThemeConfig = () => {
    if (isExpired) {
      return {
        bg: 'bg-rose-950 border-rose-500 text-rose-200',
        badgeBg: 'bg-rose-600 text-white',
        badgeText: 'WAKTU SELESAI',
        digitBg: 'bg-rose-900/90 text-rose-100 border border-rose-600',
        ringStroke: '#f43f5e',
        progressGradient: 'from-rose-600 to-red-500',
        pulseClass: 'animate-pulse'
      };
    }
    if (isCritical) {
      return {
        bg: 'bg-rose-950/90 border-rose-500/80 text-rose-100 shadow-[0_0_15px_rgba(244,63,94,0.3)]',
        badgeBg: 'bg-rose-500 text-white animate-pulse',
        badgeText: 'WAKTU KRITIS',
        digitBg: 'bg-rose-900/60 text-rose-200 border border-rose-700/60',
        ringStroke: '#f43f5e',
        progressGradient: 'from-rose-500 to-red-600',
        pulseClass: 'animate-pulse'
      };
    }
    if (isWarning) {
      return {
        bg: 'bg-amber-950/90 border-amber-500/80 text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.25)]',
        badgeBg: 'bg-amber-500 text-slate-950',
        badgeText: 'WAKTU MENIPIS',
        digitBg: 'bg-amber-900/50 text-amber-200 border border-amber-700/50',
        ringStroke: '#f59e0b',
        progressGradient: 'from-amber-400 to-amber-600',
        pulseClass: ''
      };
    }
    return {
      bg: 'bg-slate-900/95 border-slate-700/90 text-slate-100 shadow-sm',
      badgeBg: 'bg-sky-500/20 text-sky-300 border border-sky-400/30',
      badgeText: 'SISA WAKTU',
      digitBg: 'bg-slate-800 text-white border border-slate-700/70',
      ringStroke: '#38bdf8',
      progressGradient: 'from-sky-400 via-teal-400 to-emerald-400',
      pulseClass: ''
    };
  };

  const theme = getThemeConfig();

  // SVG Radial Ring Dimensions
  const circleRadius = 42;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - (remainingPercent / 100) * circumference;

  return (
    <>
      {/* 1. COMPACT / PROMINENT HEADER COUNTDOWN BAR */}
      <div
        className={`relative inline-flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border transition-all duration-300 select-none ${theme.bg} ${theme.pulseClass} ${className}`}
        title="Klik untuk melihat rincian visual durasi ujian"
      >
        {/* Clickable Area to Expand Full Timer HUD */}
        <button
          type="button"
          onClick={() => setShowDetailModal(true)}
          className="flex items-center gap-2 sm:gap-2.5 text-left focus:outline-none group cursor-pointer"
          aria-label="Buka rincian waktu ujian"
        >
          {/* Miniature Circular SVG Gauge */}
          <div className="relative w-7 h-7 sm:w-8 sm:h-8 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="15"
                className="stroke-slate-800"
                strokeWidth="3"
                fill="none"
              />
              <circle
                cx="18"
                cy="18"
                r="15"
                stroke={theme.ringStroke}
                strokeWidth="3.2"
                strokeDasharray={94.2}
                strokeDashoffset={94.2 - (remainingPercent / 100) * 94.2}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <Clock className={`w-3.5 h-3.5 sm:w-4 sm:h-4 absolute transition-transform group-hover:scale-110 ${
              isCritical || isExpired ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-sky-400'
            }`} />
          </div>

          {/* Time Digits & Urgency Badge */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className={`text-[8px] sm:text-[9px] font-black tracking-widest px-1.5 py-0.2 rounded uppercase leading-tight ${theme.badgeBg}`}>
                {theme.badgeText}
              </span>
              <span className="text-[9px] text-slate-400 font-mono hidden md:inline">
                ({Math.round(remainingPercent)}%)
              </span>
            </div>

            {/* Split Digital Clock Digits */}
            <div className="flex items-center gap-0.5 mt-0.5 font-mono font-black tracking-wider text-xs sm:text-sm">
              <span className="tabular-nums">{hoursStr}</span>
              <span className={`animate-pulse ${isCritical ? 'text-rose-400' : 'text-slate-400'}`}>:</span>
              <span className="tabular-nums">{minutesStr}</span>
              <span className={`animate-pulse ${isCritical ? 'text-rose-400' : 'text-slate-400'}`}>:</span>
              <span className="tabular-nums">{secondsStr}</span>
            </div>
          </div>
        </button>

        {/* Schedule Endpoint Tooltip Helper */}
        <div className="hidden xl:flex flex-col text-right pl-2 border-l border-slate-700/60 leading-tight">
          <span className="text-[8px] text-slate-400 uppercase font-semibold">Batas Jadwal</span>
          <span className="text-[10px] font-bold text-slate-200 whitespace-nowrap">
            {schedule.endTime} WIB
          </span>
        </div>
      </div>

      {/* 2. EXPANDED VISUAL COUNTDOWN MODAL / HUD DETAIL PANEL */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 text-white shadow-2xl relative space-y-6">
            {/* Header Dialog */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${isCritical || isExpired ? 'bg-rose-500/20 text-rose-400' : isWarning ? 'bg-amber-500/20 text-amber-400' : 'bg-sky-500/20 text-sky-400'}`}>
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-white">
                    Penghitung Waktu Mundur Ujian
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Sistem Pemantauan Waktu Resmi Real-Time
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                aria-label="Tutup panel rincian"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Big Circular Progress Indicator */}
            <div className="flex flex-col items-center justify-center py-2">
              <div className="relative w-44 h-44 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r={circleRadius}
                    className="stroke-slate-800"
                    strokeWidth="7"
                    fill="none"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r={circleRadius}
                    stroke={theme.ringStroke}
                    strokeWidth="8"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="none"
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>

                {/* Center Counter */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className={`text-[10px] font-black tracking-widest px-2 py-0.5 rounded-full uppercase ${theme.badgeBg}`}>
                    {theme.badgeText}
                  </span>
                  <div className="text-3xl font-black font-mono tracking-tight text-white mt-1">
                    {hoursStr}:{minutesStr}:{secondsStr}
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400 mt-0.5">
                    {Math.round(remainingPercent)}% Tersisa
                  </span>
                </div>
              </div>

              {/* Progress Bar with Labels */}
              <div className="w-full mt-4 space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>Berjalan: {Math.round(elapsedPercent)}%</span>
                  <span>Sisa: {Math.round(remainingPercent)}%</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-linear-to-r ${theme.progressGradient} transition-all duration-1000 ease-linear`}
                    style={{ width: `${remainingPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Split Breakdown Digital Boxes */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700">
                <span className="text-xl font-mono font-black text-white">{hoursStr}</span>
                <span className="block text-[9px] uppercase font-bold text-slate-400 mt-0.5">Jam</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700">
                <span className="text-xl font-mono font-black text-white">{minutesStr}</span>
                <span className="block text-[9px] uppercase font-bold text-slate-400 mt-0.5">Menit</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700">
                <span className="text-xl font-mono font-black text-sky-400">{secondsStr}</span>
                <span className="block text-[9px] uppercase font-bold text-slate-400 mt-0.5">Detik</span>
              </div>
            </div>

            {/* Schedule Info Box */}
            <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-700/60 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Mata Pelajaran:</span>
                <span className="font-extrabold text-white">{schedule.subject}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Jadwal Resmi:</span>
                <span className="font-mono font-bold text-amber-300">
                  {schedule.startTime} – {schedule.endTime} WIB
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Total Alokasi Durasi:</span>
                <span className="font-bold text-slate-200">
                  {schedule.durationMinutes || 90} Menit
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Progres Jawaban:</span>
                <span className="font-bold text-emerald-400">
                  {answeredCount} dari {totalQuestions} Soal
                </span>
              </div>
            </div>

            {/* Audio Alert Notification Settings */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                {isSoundMuted ? (
                  <VolumeX className="w-4 h-4 text-slate-500" />
                ) : (
                  <Volume2 className="w-4 h-4 text-sky-400" />
                )}
                <span>Nada Peringatan (10m, 5m, Waktu Habis)</span>
              </div>
              <button
                type="button"
                onClick={() => setIsSoundMuted(!isSoundMuted)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                  isSoundMuted
                    ? 'bg-slate-800 border-slate-700 text-slate-400'
                    : 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                }`}
              >
                {isSoundMuted ? 'Mati (Mute)' : 'Aktif (On)'}
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Tutup & Lanjutkan Ujian
              </button>
              {onOpenSubmitModal && (
                <button
                  type="button"
                  onClick={() => {
                    setShowDetailModal(false);
                    onOpenSubmitModal();
                  }}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Selesai Ujian</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. AUTO-SUBMIT EMERGENCY OVERLAY (WHEN TIME RUNS OUT / EXPIRED) */}
      {isExpired && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 select-none">
          <div className="bg-slate-900 border-2 border-rose-600 rounded-3xl max-w-lg w-full p-6 sm:p-8 text-white shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-300">
            {/* Alarm Icon */}
            <div className="w-20 h-20 mx-auto rounded-full bg-rose-600/20 text-rose-500 border-2 border-rose-500 flex items-center justify-center animate-pulse">
              <Clock className="w-11 h-11" />
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950 border border-rose-800 text-rose-300 text-xs font-black uppercase tracking-wider">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                WAKTU PENGERJAAN HABIS!
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Jadwal Ujian Telah Berakhir
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
                Batas waktu ujian mata pelajaran <strong>{schedule.subject}</strong> resmi berakhir pada pukul <strong className="text-amber-400">{schedule.endTime} WIB</strong>.
                Sesuai integritas penilaian, lembar ujian ditutup dan dikirimkan otomatis ke server.
              </p>
            </div>

            {/* Countdown to Auto Submit Dial */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-rose-600/30 border border-rose-500 text-rose-300 font-mono font-black text-2xl flex items-center justify-center animate-bounce">
                  {autoSubmitCountdown}
                </div>
                <div className="text-left">
                  <span className="text-xs font-extrabold text-white block">
                    Penyerahan Otomatis Berjalan
                  </span>
                  <span className="text-[11px] text-slate-400 block">
                    Menyerahkan dalam hitungan mundur di samping...
                  </span>
                </div>
              </div>

              {/* Linear Auto-Submit Progress Bar */}
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-linear-to-r from-rose-500 to-amber-500 transition-all duration-1000 ease-linear"
                  style={{ width: `${Math.max(0, (autoSubmitCountdown / 10) * 100)}%` }}
                />
              </div>

              {/* Student Summary */}
              <div className="pt-2 border-t border-slate-700/60 grid grid-cols-2 text-left text-xs gap-2">
                <div>
                  <span className="text-slate-400 text-[10px] block">Peserta:</span>
                  <span className="font-bold text-white truncate block">{studentName || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Soal Terjawab:</span>
                  <span className="font-bold text-emerald-400">
                    {answeredCount} / {totalQuestions} Soal
                  </span>
                </div>
              </div>
            </div>

            {/* Direct Instant Submit Button */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => onAutoSubmit()}
                disabled={isSubmitting}
                className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:bg-rose-900/60 text-white font-extrabold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menyimpan & Mengirimkan Jawaban...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Kirimkan Sekarang Tanpa Menunggu ({autoSubmitCountdown}s)</span>
                  </>
                )}
              </button>
              <p className="text-[11px] text-slate-400">
                Data jawaban yang tersimpan di perangkat akan langsung diarsipkan ke server sekolah.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
