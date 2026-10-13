import { Schedule } from '../types';

export interface ScheduleTimingResult {
  status: 'BELUM_DIMULAI' | 'SEDANG_BERLANGSUNG' | 'SELESAI';
  isUpcoming: boolean;
  isOngoing: boolean;
  isFinished: boolean;
  startDate: Date;
  endDate: Date;
  now: Date;
  secondsUntilStart: number;
  remainingSeconds: number;
  totalDurationSeconds: number;
  progressPercent: number;
  formattedRemaining: string;
  formattedUntilStart: string;
  statusLabel: string;
  badgeStyle: {
    bg: string;
    text: string;
    border: string;
    dot: string;
  };
}

/**
 * Parses a schedule's date, startTime, and endTime into precise Date objects.
 * Supports ISO 'YYYY-MM-DD' and 'HH:mm' formats with timezone resilience.
 */
export function parseScheduleDateTimes(schedule: Schedule, baseDate: Date = new Date()): { startDate: Date; endDate: Date } {
  let year = baseDate.getFullYear();
  let month = baseDate.getMonth();
  let day = baseDate.getDate();

  if (schedule.date && /^\d{4}-\d{2}-\d{2}$/.test(schedule.date)) {
    const [y, m, d] = schedule.date.split('-').map(Number);
    year = y;
    month = m - 1;
    day = d;
  }

  const [startH, startM] = (schedule.startTime || '07:30').split(':').map(Number);
  const [endH, endM] = (schedule.endTime || '09:00').split(':').map(Number);

  const startDate = new Date(year, month, day, isNaN(startH) ? 7 : startH, isNaN(startM) ? 30 : startM, 0, 0);
  const endDate = new Date(year, month, day, isNaN(endH) ? 9 : endH, isNaN(endM) ? 0 : endM, 0, 0);

  // If endTime is earlier than startTime (e.g. night schedule 23:00 to 01:00), rollover to next day
  if (endDate.getTime() <= startDate.getTime()) {
    endDate.setDate(endDate.getDate() + 1);
  }

  return { startDate, endDate };
}

/**
 * Formats seconds into HH:MM:SS
 */
export function formatSecondsToHHMMSS(seconds: number): string {
  if (seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Formats seconds into a human-friendly string like "12 Menit 30 Detik" or "01 Jam 15 Menit"
 */
export function formatSecondsToHumanReadable(seconds: number): string {
  if (seconds <= 0) return '0 Detik';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h} Jam ${m > 0 ? `${m} Menit` : ''}`.trim();
  }
  if (m > 0) {
    return `${m} Menit ${s > 0 ? `${s} Detik` : ''}`.trim();
  }
  return `${s} Detik`;
}

/**
 * Analyzes the live timing of a schedule relative to the current real-world clock.
 * Determines whether the exam:
 * 1. Has not started yet ('BELUM_DIMULAI') - provides seconds until auto-start
 * 2. Is currently ongoing ('SEDANG_BERLANGSUNG') - provides seconds remaining until auto-end
 * 3. Has completed ('SELESAI') - time has expired
 */
export function getScheduleTiming(schedule: Schedule, customNow?: Date): ScheduleTimingResult {
  const now = customNow || new Date();
  const { startDate, endDate } = parseScheduleDateTimes(schedule, now);

  const nowMs = now.getTime();
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  const totalDurationSeconds = Math.max(60, Math.round((endMs - startMs) / 1000));

  let status: 'BELUM_DIMULAI' | 'SEDANG_BERLANGSUNG' | 'SELESAI';
  let secondsUntilStart = 0;
  let remainingSeconds = 0;
  let progressPercent = 0;

  if (nowMs < startMs) {
    status = 'BELUM_DIMULAI';
    secondsUntilStart = Math.max(0, Math.ceil((startMs - nowMs) / 1000));
    remainingSeconds = totalDurationSeconds;
    progressPercent = 0;
  } else if (nowMs >= endMs) {
    status = 'SELESAI';
    secondsUntilStart = 0;
    remainingSeconds = 0;
    progressPercent = 100;
  } else {
    status = 'SEDANG_BERLANGSUNG';
    secondsUntilStart = 0;
    remainingSeconds = Math.max(0, Math.floor((endMs - nowMs) / 1000));
    const elapsedSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
    progressPercent = Math.min(100, Math.round((elapsedSec / totalDurationSeconds) * 100));
  }

  const isUpcoming = status === 'BELUM_DIMULAI';
  const isOngoing = status === 'SEDANG_BERLANGSUNG';
  const isFinished = status === 'SELESAI';

  let statusLabel = 'Sedang Berlangsung';
  let badgeStyle = {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
    dot: 'bg-emerald-500 animate-pulse'
  };

  if (isUpcoming) {
    statusLabel = 'Belum Dimulai';
    badgeStyle = {
      bg: 'bg-amber-100',
      text: 'text-amber-800',
      border: 'border-amber-300',
      dot: 'bg-amber-500'
    };
  } else if (isFinished) {
    statusLabel = 'Selesai';
    badgeStyle = {
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      border: 'border-slate-300',
      dot: 'bg-slate-400'
    };
  }

  return {
    status,
    isUpcoming,
    isOngoing,
    isFinished,
    startDate,
    endDate,
    now,
    secondsUntilStart,
    remainingSeconds,
    totalDurationSeconds,
    progressPercent,
    formattedRemaining: formatSecondsToHHMMSS(remainingSeconds),
    formattedUntilStart: formatSecondsToHHMMSS(secondsUntilStart),
    statusLabel,
    badgeStyle
  };
}

/**
 * Calculates remaining exam time for a student when unlocked after being suspended.
 * Strictly calculates remaining time from current time to scheduled endTime:
 * Sisa waktu = Max(0, scheduledEndTime - currentNow).
 * The remaining time follows the scheduled start and finish times.
 */
export function calculateRemainingSecondsOnUnlock(schedule: Schedule, customNow?: Date): {
  remainingSeconds: number;
  isExpired: boolean;
  formatted: string;
  endTimeStr: string;
} {
  const now = customNow || new Date();
  const { endDate } = parseScheduleDateTimes(schedule, now);
  const remainingSeconds = Math.max(0, Math.floor((endDate.getTime() - now.getTime()) / 1000));
  const isExpired = remainingSeconds <= 0;

  return {
    remainingSeconds,
    isExpired,
    formatted: formatSecondsToHHMMSS(remainingSeconds),
    endTimeStr: schedule.endTime || '09:00'
  };
}

/**
 * Syncs schedule isActive status based on real-world time.
 * If current time is within [startTime, endTime], it should be considered active.
 * If prior to startTime or past endTime, it should not be active.
 */
export function evaluateAutoScheduleActive(schedule: Schedule, now: Date = new Date()): boolean {
  const { status } = getScheduleTiming(schedule, now);
  return status === 'SEDANG_BERLANGSUNG';
}
