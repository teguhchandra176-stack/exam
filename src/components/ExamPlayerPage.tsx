import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  Maximize2,
  Lock,
  Volume2,
  CheckCircle2,
  Send,
  Eye,
  KeyRound,
  Bell,
  Smartphone,
  Tablet,
  Monitor,
  ExternalLink,
  Info,
  Calendar,
  Cast,
  Columns2,
  RotateCcw,
  VolumeX,
  ShieldCheck,
  HelpCircle,
  Check,
  EyeOff,
  Layers,
  ChevronRight,
  Sparkles,
  Sliders
} from 'lucide-react';
import { Student, Schedule, SystemConfig, DeviceType } from '../types';
import { apiClient } from '../services/apiClient';
import { playViolationAlarm } from '../services/soundAlarm';
import { formatIndonesianDate } from '../services/dateFormatter';
import {
  getScheduleTiming,
  calculateRemainingSecondsOnUnlock,
  parseScheduleDateTimes,
  formatSecondsToHHMMSS
} from '../services/scheduleTiming';
import { ExamCountdownTimer } from './ExamCountdownTimer';

interface ExamPlayerPageProps {
  student: Student;
  schedule: Schedule;
  systemConfig: SystemConfig;
  deviceType: DeviceType;
  onExamCompleted: () => void;
}

export const ExamPlayerPage: React.FC<ExamPlayerPageProps> = ({
  student,
  schedule,
  systemConfig,
  deviceType,
  onExamCompleted,
}) => {
  // Live State
  const [violationsCount, setViolationsCount] = useState<number>(student.violationsCount || 0);
  const [isSuspended, setIsSuspended] = useState<boolean>(student.status === 'Ditangguhkan');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(true);
  const [supervisorPinInput, setSupervisorPinInput] = useState<string>('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [broadcastMessage, setBroadcastMessage] = useState<string | null>(null);

  // Maximum Mobile & Tablet Security Suite States
  const [isLandscapeLocked, setIsLandscapeLocked] = useState<boolean>(() => {
    return typeof window !== 'undefined' && window.innerWidth > window.innerHeight && deviceType !== 'Komputer';
  });
  const [isSplitScreenDetected, setIsSplitScreenDetected] = useState<boolean>(false);
  const [isCastingDetected, setIsCastingDetected] = useState<boolean>(false);
  const [isFlagSecureCurtainActive, setIsFlagSecureCurtainActive] = useState<boolean>(false);
  const [showSecurityGuideModal, setShowSecurityGuideModal] = useState<boolean>(false);
  const [liveForensicTime, setLiveForensicTime] = useState<string>(() => new Date().toLocaleTimeString('id-ID'));
  const [edgeSwipeWarningToast, setEdgeSwipeWarningToast] = useState<string | null>(null);

  // Real-time Schedule Timing Analysis (Strictly follows scheduled startTime & endTime)
  const initialScheduleTiming = getScheduleTiming(schedule);
  const totalDurationSeconds = initialScheduleTiming.totalDurationSeconds;

  // Initialize remaining seconds strictly bounded by schedule start and end time (or session duration if active)
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(() => {
    if (initialScheduleTiming.isOngoing) return initialScheduleTiming.remainingSeconds;
    if (schedule.isActive) return totalDurationSeconds;
    if (initialScheduleTiming.isFinished) return 0;
    return totalDurationSeconds;
  });

  const [isTimeExpired, setIsTimeExpired] = useState<boolean>(
    initialScheduleTiming.isFinished && !schedule.isActive
  );
  const [autoSubmitCountdown, setAutoSubmitCountdown] = useState<number>(10);
  const [timeWarningToast, setTimeWarningToast] = useState<{ id: string; message: string; urgent?: boolean } | null>(null);

  // Target end timestamp locked to scheduled endTime or active duration from now
  const targetEndTimeMsRef = useRef<number>(
    (initialScheduleTiming.isOngoing && initialScheduleTiming.endDate.getTime() > Date.now())
      ? initialScheduleTiming.endDate.getTime()
      : schedule.isActive
      ? Date.now() + (totalDurationSeconds * 1000)
      : initialScheduleTiming.endDate.getTime()
  );
  const hasTriggered10MinWarningRef = useRef<boolean>(false);
  const hasTriggered5MinWarningRef = useRef<boolean>(false);
  const hasAutoSubmittedRef = useRef<boolean>(false);

  // Token Expiration Countdown (7 minutes cycle = 420 seconds)
  const [tokenTimeRemaining, setTokenTimeRemaining] = useState<number>(() => {
    if (systemConfig.tokenLastRotated) {
      const last = new Date(systemConfig.tokenLastRotated).getTime();
      const intervalMs = (systemConfig.tokenRotationMinutes || 7) * 60 * 1000;
      const expiry = last + intervalMs;
      const diffSec = Math.floor((expiry - Date.now()) / 1000);
      return diffSec > 0 ? diffSec : 420;
    }
    return 420;
  });

  // Simulated Answer Tracker (for summary confirmation)
  const totalQuestions = schedule.totalQuestions || 40;
  const [answeredCount, setAnsweredCount] = useState<number>(student.answersSummary?.answered || 0);
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [studentAnswers, setStudentAnswers] = useState<Record<number, string>>(() => {
    return student.savedAnswers ? Object.fromEntries(Object.entries(student.savedAnswers).map(([k, v]) => [Number(k), v])) : {};
  });
  const [showAnswerSheet, setShowAnswerSheet] = useState<boolean>(false);

  const handleSelectAnswer = (qIndex: number, choice: string) => {
    setStudentAnswers(prev => {
      const updated = { ...prev, [qIndex]: choice };
      const count = Object.keys(updated).length;
      setAnsweredCount(count);
      return updated;
    });
  };

  // Wake Lock Sentinel ref
  const wakeLockRef = useRef<any>(null);
  const initialHeightRef = useRef<number>(window.innerHeight);
  const workerRef = useRef<Worker | null>(null);

  // Tolerance
  const maxTolerance = systemConfig.violationTolerance || 3;

  // Format Seconds to HH:MM:SS
  const formatTime = (totalSec: number) => {
    if (totalSec <= 0) return '00:00:00';
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatMinSec = (sec: number) => {
    if (sec <= 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 1. Request Fullscreen Utility with NavigationUI Hide & Keyboard Lock
  const enterFullscreen = useCallback(async () => {
    try {
      const elem = document.documentElement as any;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen({ navigationUI: 'hide' });
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        await elem.mozRequestFullScreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }
      setIsFullscreen(true);

      // Orientation lock for mobile/tablet
      if (screen.orientation && (screen.orientation as any).lock) {
        try {
          await (screen.orientation as any).lock('portrait');
        } catch (_) {}
      }

      // Lock Task Mode / Kiosk Key Lock (Lock Esc, Tab, Meta, Alt, Fn)
      if ('keyboard' in navigator && (navigator as any).keyboard?.lock) {
        try {
          await (navigator as any).keyboard.lock([
            'Escape',
            'Tab',
            'AltLeft',
            'AltRight',
            'MetaLeft',
            'MetaRight',
            'KeyW',
            'KeyN',
            'KeyT',
            'F1',
            'F5',
            'F11',
            'F12'
          ]);
        } catch (_) {}
      }
    } catch (err) {
      console.warn('Fullscreen request rejected:', err);
    }
  }, []);

  // 2. Request Screen Wake Lock (Continuous On-Screen)
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator && (navigator as any).wakeLock) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      } catch (err) {
        console.warn('Wake Lock request error:', err);
      }
    }
  }, []);

  // 3. Register Violation Handler
  const handleViolation = useCallback(async (type: string, details: string) => {
    if (isSuspended) return; // Already suspended

    playViolationAlarm();

    const newCount = violationsCount + 1;
    setViolationsCount(newCount);

    if (newCount >= maxTolerance) {
      setIsSuspended(true);
    }

    // Report to backend
    await apiClient.reportViolation({
      noPeserta: student.noPeserta,
      violationType: type,
      details,
      timestamp: new Date().toISOString()
    });
  }, [isSuspended, violationsCount, maxTolerance, student.noPeserta]);

  // 4. Live Forensic Timestamp Clock (Unforgeable Watermark Digital Forensics)
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveForensicTime(new Date().toLocaleTimeString('id-ID'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 5. Anti-Screen Recording & Anti-Casting Interceptors
  useEffect(() => {
    // Intercept Screen Capture API
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      try {
        (navigator.mediaDevices as any).getDisplayMedia = async () => {
          handleViolation(
            'Perekaman Layar Terdeteksi',
            'Mencoba mengakses API perekaman layar (Screen Capture) sistem.'
          );
          throw new DOMException('Perekaman layar diblokir oleh kebijakan keamanan BAGJA EXAM.', 'NotAllowedError');
        };
      } catch (_) {}
    }

    // Intercept Presentation / Screen Mirroring API
    if (typeof navigator !== 'undefined' && (navigator as any).presentation) {
      try {
        (navigator as any).presentation.defaultRequest = null;
      } catch (_) {}
    }

    // Check for Extended Display / Casting
    const checkCasting = () => {
      const isExtended = !!((window.screen as any)?.isExtended);
      if (isExtended) {
        setIsCastingDetected(true);
        handleViolation('Screen Mirroring / Layar Ganda Terdeteksi', 'Gawai terhubung ke layar eksternal atau transmisi nirkabel.');
      } else {
        setIsCastingDetected(false);
      }
    };
    checkCasting();
    const castInterval = setInterval(checkCasting, 4000);
    return () => clearInterval(castInterval);
  }, [handleViolation]);

  // 6. Portrait Orientation Lock & Split-Screen Viewport Monitor
  useEffect(() => {
    const handleOrientationAndViewport = () => {
      // Portrait orientation check
      const isLandscape = window.innerWidth > window.innerHeight && deviceType !== 'Komputer';
      setIsLandscapeLocked(isLandscape);

      // Split Screen / Floating Apps Detection on Mobile & Tablet
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

      if (!isInputFocused && deviceType !== 'Komputer') {
        const availH = window.screen.availHeight || window.innerHeight;
        const availW = window.screen.availWidth || window.innerWidth;
        const hRatio = window.innerHeight / availH;
        const wRatio = window.innerWidth / availW;

        if (hRatio < 0.72 || wRatio < 0.80) {
          setIsSplitScreenDetected(true);
          handleViolation(
            'Layar Terbagi (Split-Screen) / Jendela Mengambang',
            'Viewport gawai terbagi dengan aplikasi lain (Split-Screen atau Floating Window).'
          );
        } else {
          setIsSplitScreenDetected(false);
        }
      }
    };

    window.addEventListener('resize', handleOrientationAndViewport);
    window.addEventListener('orientationchange', handleOrientationAndViewport);
    handleOrientationAndViewport();

    return () => {
      window.removeEventListener('resize', handleOrientationAndViewport);
      window.removeEventListener('orientationchange', handleOrientationAndViewport);
    };
  }, [deviceType, handleViolation]);

  // 7. FLAG_SECURE Curtain, Focus, Blur & Visibility Protection
  useEffect(() => {
    const handleBlur = () => {
      setIsFlagSecureCurtainActive(true);
      handleViolation(
        'Aplikasi Kehilangan Fokus (Recent Apps / Home)',
        'Fokus layar berpindah, tombol Home ditekan, atau Recent Apps task switcher dibuka.'
      );
    };

    const handleFocus = () => {
      setTimeout(() => {
        setIsFlagSecureCurtainActive(false);
      }, 250);
      enterFullscreen();
      requestWakeLock();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsFlagSecureCurtainActive(true);
        handleViolation(
          'Pindah Tab / Minimize Layar',
          'Layar diminimalkan atau siswa beralih ke aplikasi lain.'
        );
      } else {
        setTimeout(() => {
          setIsFlagSecureCurtainActive(false);
        }, 250);
        requestWakeLock();
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enterFullscreen, requestWakeLock, handleViolation]);

  // 8. Hardware Back Trap, Edge Gestures & Touch Barriers
  useEffect(() => {
    enterFullscreen();
    requestWakeLock();

    // Aggressive history trap for hardware & browser Back button
    for (let i = 0; i < 10; i++) {
      window.history.pushState({ page: i }, '', window.location.href);
    }

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      for (let i = 0; i < 5; i++) {
        window.history.pushState(null, '', window.location.href);
      }
      handleViolation(
        'Tombol Kembali (Back) Ditekan',
        'Mencoba menekan tombol back hardware atau gestur kembali peramban.'
      );
    };
    window.addEventListener('popstate', handlePopState);

    // Prompt on beforeunload
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Ujian sedang berlangsung! Keluar akan membatalkan sesi ujian.';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Fullscreen change listener
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(isCurrentlyFullscreen);
      if (!isCurrentlyFullscreen && !isSuspended) {
        handleViolation('Keluar Layar Penuh', 'Mode layar penuh dinonaktifkan.');
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    // Keyboard Shortcuts & Screenshot Keys Blocker
    const handleKeyDown = (e: KeyboardEvent) => {
      const isScreenshotKey =
        e.key === 'PrintScreen' ||
        (e.ctrlKey && (e.key === 'p' || e.key === 'P')) ||
        (e.metaKey && e.shiftKey && ['3', '4', '5', 's', 'S'].includes(e.key)) ||
        e.key === 'F12' ||
        e.key === 'F5' ||
        (e.ctrlKey && ['w', 'W', 't', 'T', 'n', 'N', 'r', 'R', 'u', 'U', 's', 'S'].includes(e.key)) ||
        (e.altKey && e.key === 'F4') ||
        (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
        e.key === 'Escape' ||
        e.key === 'Meta';

      if (isScreenshotKey) {
        e.preventDefault();
        e.stopPropagation();
        handleViolation(
          'Pintasan Terlarang / Tangkapan Layar',
          `Mencoba menggunakan tombol terlarang: ${e.key}`
        );
        return false;
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);

    // Context Menu / Right Click Disable
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };
    window.addEventListener('contextmenu', handleContextMenu);

    // Touch gesture & Edge Back Swipe protection for mobile/tablet
    let touchStartX = 0;
    const handleTouchStart = (e: TouchEvent) => {
      // 3-finger screenshot gesture trap
      if (e.touches.length >= 3) {
        e.preventDefault();
        handleViolation('Gestur Tangkapan Layar 3-Jari', 'Mencoba gestur 3 jari (indikasi tangkapan layar / screenshot).');
        return;
      }

      const touch = e.touches[0];
      if (touch) {
        touchStartX = touch.clientX;

        // Notification shade pull-down guard
        if (touch.clientY <= 38) {
          e.preventDefault();
          handleViolation('Bilah Notifikasi / Status Bar Ditarik', 'Mencoba menarik bilah notifikasi sistem atas.');
          return;
        }

        // Navigation bar pull-up guard
        if (touch.clientY >= window.innerHeight - 38) {
          e.preventDefault();
          handleViolation('Bilah Navigasi Bawah Ditarik', 'Mencoba menarik bilah navigasi sistem bawah.');
          return;
        }

        // Left or right edge swipe back gesture (Android 10+)
        if (touch.clientX <= 25 || touch.clientX >= window.innerWidth - 25) {
          setEdgeSwipeWarningToast('⚠️ Gestur Usap Tepi Layar Terdeteksi! Navigasi kembali dinonaktifkan demi integritas ujian.');
          setTimeout(() => setEdgeSwipeWarningToast(null), 3000);
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) {
        const deltaX = Math.abs(touch.clientX - touchStartX);
        if ((touchStartX <= 25 || touchStartX >= window.innerWidth - 25) && deltaX > 35) {
          e.preventDefault();
          handleViolation(
            'Gestur Usap Tepi Layar (Edge Back Gesture)',
            'Mencoba gestur usap tepi layar untuk kembali atau berpindah aplikasi.'
          );
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      if (wakeLockRef.current) {
        wakeLockRef.current.release?.().catch(() => {});
      }
    };
  }, [enterFullscreen, requestWakeLock, handleViolation, isSuspended]);

  // 5. Timer Countdown Tick (Drift-proof Real-time Exam Timer & Token Expiry Timer)
  useEffect(() => {
    const timer = setInterval(() => {
      // Drift-proof calculation based on Date.now()
      const nowMs = Date.now();
      const remainingSec = Math.max(0, Math.round((targetEndTimeMsRef.current - nowMs) / 1000));

      setTimeRemainingSeconds(remainingSec);

      // Warning when 10 minutes left (600s)
      if (remainingSec <= 600 && remainingSec > 540 && !hasTriggered10MinWarningRef.current) {
        hasTriggered10MinWarningRef.current = true;
        setTimeWarningToast({
          id: '10min',
          message: '⏰ Peringatan: Waktu ujian tersisa 10 menit! Periksa kembali nomor yang belum terjawab.',
          urgent: false,
        });
      }

      // Urgent warning when 5 minutes left (300s)
      if (remainingSec <= 300 && remainingSec > 240 && !hasTriggered5MinWarningRef.current) {
        hasTriggered5MinWarningRef.current = true;
        playViolationAlarm();
        setTimeWarningToast({
          id: '5min',
          message: '⚠️ Perhatian Kritis: Waktu ujian tersisa 5 menit lagi! Segera selesaikan lembar jawaban Anda.',
          urgent: true,
        });
      }

      // Time expired according to scheduled endTime -> AUTO FINISH!
      if (remainingSec === 0) {
        setIsTimeExpired(true);
        setShowSubmitModal(true);
        setTimeWarningToast({
          id: 'expired',
          message: `⏰ Waktu Pelaksanaan Ujian Telah Selesai Sesuai Jadwal (${schedule.endTime} WIB)! Lembar jawaban ditutup dan diserahkan otomatis.`,
          urgent: true,
        });
      }

      // Token rotation countdown
      setTokenTimeRemaining(prev => {
        return prev <= 1 ? 420 : prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [schedule.endTime]);

  // 8. Submit & Finish Exam
  const handleFinalSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await apiClient.finishExam(student.noPeserta);
      onExamCompleted();
    } catch (err) {
      alert('Gagal mengirimkan ujian. Silakan coba kembali atau hubungi pengawas.');
      setIsSubmitting(false);
    }
  }, [student.noPeserta, onExamCompleted]);

  // Auto-submit countdown when time is expired: guaranteed dispatch
  useEffect(() => {
    if (!isTimeExpired) return;

    if (autoSubmitCountdown > 0) {
      const autoTimer = setTimeout(() => {
        setAutoSubmitCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(autoTimer);
    } else if (!hasAutoSubmittedRef.current && !isSubmitting) {
      hasAutoSubmittedRef.current = true;
      handleFinalSubmit();
    }
  }, [isTimeExpired, autoSubmitCountdown, isSubmitting, handleFinalSubmit]);

  // Auto-dismiss warning toast after 7 seconds if not urgent
  useEffect(() => {
    if (timeWarningToast && !timeWarningToast.urgent) {
      const t = setTimeout(() => {
        setTimeWarningToast(null);
      }, 7000);
      return () => clearTimeout(t);
    }
  }, [timeWarningToast]);

  // Centralized Unlock Handler: Recalculates remaining exam time strictly following scheduled startTime and endTime
  const handleStudentUnlocked = useCallback((source: string) => {
    setIsSuspended(false);
    setUnlockError(null);

    // Sisa waktu ujian disaat siswa baru dibuka kunci setelah ditangguhkan mengikuti waktu mulai dan selesai sesuai jadwal
    const unlockData = calculateRemainingSecondsOnUnlock(schedule);
    const freshRemaining = unlockData.remainingSeconds;

    // Sinkronisasi target timestamp akhir persis ke endTime jadwal resmi
    const { endDate } = parseScheduleDateTimes(schedule);
    targetEndTimeMsRef.current = endDate.getTime();
    setTimeRemainingSeconds(freshRemaining);

    if (freshRemaining <= 0) {
      // Waktu ujian telah habis saat siswa dalam kondisi ditangguhkan! Ujian otomatis selesai.
      setIsTimeExpired(true);
      setShowSubmitModal(true);
      setTimeWarningToast({
        id: 'unlock-expired',
        message: `⏰ Kunci ujian telah dibuka, namun waktu pelaksanaan ujian (${schedule.endTime} WIB) telah habis saat penangguhan. Ujian diselesaikan secara otomatis.`,
        urgent: true
      });
      setTimeout(() => {
        if (!hasAutoSubmittedRef.current) {
          hasAutoSubmittedRef.current = true;
          handleFinalSubmit();
        }
      }, 1500);
      return;
    }

    // Waktu masih tersedia: Berikan notifikasi sisa waktu yang tepat sesuai jadwal resmi
    setTimeWarningToast({
      id: `unlocked-${Date.now()}`,
      message: `🔓 Kunci ujian berhasil dibuka (${source}). Sisa waktu ujian: ${formatSecondsToHHMMSS(freshRemaining)} (mengikuti waktu selesai jadwal resmi pukul ${schedule.endTime} WIB).`,
      urgent: false
    });

    enterFullscreen();
    requestWakeLock();
  }, [schedule, enterFullscreen, requestWakeLock, handleFinalSubmit]);

  // 6. Web Worker for zero-jank background heartbeat & remote unlock polling
  useEffect(() => {
    if (typeof Worker !== 'undefined') {
      try {
        const worker = new Worker('/sync-worker.js');
        workerRef.current = worker;

        worker.postMessage({
          action: 'START_SYNC',
          payload: {
            noPeserta: student.noPeserta,
            status: isSuspended ? 'Ditangguhkan' : 'Sedang Mengerjakan',
            deviceType,
            answersSummary: { answered: answeredCount, total: totalQuestions }
          }
        });

        worker.onmessage = (e) => {
          if (e.data.type === 'SYNC_SUCCESS' && e.data.data) {
            const res = e.data.data;
            if (isSuspended && res.studentStatus === 'Sedang Mengerjakan') {
              setViolationsCount(res.violationsCount || 0);
              handleStudentUnlocked('Pengawas Jarak Jauh');
            }
            if (res.broadcast) {
              setBroadcastMessage(res.broadcast);
            } else {
              setBroadcastMessage(null);
            }
          }
        };

        return () => {
          worker.postMessage({ action: 'STOP_SYNC' });
          worker.terminate();
        };
      } catch (err) {
        console.warn('Web worker initialization error, using fallback polling:', err);
      }
    }

    // Fallback if Worker is unavailable
    const fallbackInterval = setInterval(async () => {
      const res = await apiClient.sendHeartbeat({
        noPeserta: student.noPeserta,
        status: isSuspended ? 'Ditangguhkan' : 'Sedang Mengerjakan',
        deviceType,
        answersSummary: { answered: answeredCount, total: totalQuestions }
      });
      if (res && res.success) {
        if (isSuspended && res.studentStatus === 'Sedang Mengerjakan') {
          setViolationsCount(res.violationsCount || 0);
          handleStudentUnlocked('Pengawas Jarak Jauh');
        }
        setBroadcastMessage(res.broadcast || null);
      }
    }, 2500);

    return () => clearInterval(fallbackInterval);
  }, [student.noPeserta, isSuspended, deviceType, answeredCount, totalQuestions, handleStudentUnlocked]);

  // 7. Manual Supervisor PIN Unlock on Student Screen
  const handleManualUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError(null);

    const enteredPin = supervisorPinInput.trim();
    if (!enteredPin) {
      setUnlockError('Masukkan PIN Pengawas.');
      return;
    }

    try {
      const res = await apiClient.unlockKiosk({
        noPeserta: student.noPeserta,
        supervisorPin: enteredPin,
        unlockedBy: 'Pengawas Langsung di Perangkat',
        resetViolations: true
      });

      if (res.success) {
        setViolationsCount(0);
        setSupervisorPinInput('');
        handleStudentUnlocked('PIN Pengawas di Tempat');
      }
    } catch (err: any) {
      setUnlockError(err.message || 'PIN Pengawas salah atau tidak valid!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col select-none overflow-hidden kiosk-protected">
      {/* A. EMERGENCY ROOM BROADCAST TICKER (RUNNING TEXT RIGHT TO LEFT) */}
      {broadcastMessage && (
        <div className="bg-rose-600 text-white px-4 py-1 text-xs font-bold overflow-hidden shadow-sm flex items-center gap-3">
          <div className="flex items-center gap-1.5 shrink-0 bg-rose-800 px-2 py-0.5 rounded text-[10px] tracking-wider uppercase">
            <Bell className="w-3.5 h-3.5 animate-bounce" />
            <span>PENGUMUMAN PENGAWAS</span>
          </div>
          <div className="flex-1 overflow-hidden relative whitespace-nowrap">
            <span className="animate-marquee inline-block">{broadcastMessage}</span>
          </div>
        </div>
      )}

      {/* B. TOP SECURE HUD / NAVBAR */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-2 text-white flex items-center justify-between gap-3 shadow-md shrink-0">
        {/* Left: Student Identity & Room */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center font-bold text-sm shrink-0">
            {student.nama.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-extrabold truncate text-white leading-tight">
              {student.nama}
            </p>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>{student.noPeserta}</span>
              <span>·</span>
              <span className="font-semibold text-sky-400">{student.kelas}</span>
              <span>·</span>
              <span className="font-semibold text-amber-400">{student.ruang}</span>
            </div>
          </div>
        </div>

        {/* Center: Live Countdown Timers & Exam Info */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Prominent Real-Time Exam Countdown Timer Visual Component */}
          <ExamCountdownTimer
            schedule={schedule}
            timeRemainingSeconds={timeRemainingSeconds}
            totalDurationSeconds={totalDurationSeconds}
            isTimeExpired={isTimeExpired}
            onAutoSubmit={handleFinalSubmit}
            autoSubmitCountdown={autoSubmitCountdown}
            isSubmitting={isSubmitting}
            answeredCount={answeredCount}
            totalQuestions={totalQuestions}
            studentName={student.nama}
            noPeserta={student.noPeserta}
            deviceType={deviceType}
            onOpenSubmitModal={() => setShowSubmitModal(true)}
          />

          {/* Exam Date Info badge */}
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/70 px-2.5 py-1.5 rounded-xl">
            <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <div className="text-left">
              <span className="text-[9px] text-slate-400 block uppercase font-medium">Tanggal Ujian</span>
              <span className="text-[11px] font-bold text-slate-200 block whitespace-nowrap">
                {formatIndonesianDate(schedule.date)}
              </span>
            </div>
          </div>

          {/* Token Rotation Countdown */}
          <div className="hidden md:flex items-center gap-1.5 bg-slate-800/70 border border-slate-700/60 px-2.5 py-1.5 rounded-xl">
            <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <div className="text-right">
              <span className="text-[9px] text-slate-400 block uppercase">Token Aktif</span>
              <span className="text-[11px] font-mono font-bold text-amber-300 block">
                {formatMinSec(tokenTimeRemaining)}
              </span>
            </div>
          </div>

          {/* Violations Indicator HUD */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border ${
            violationsCount === 0
              ? 'bg-emerald-950/50 border-emerald-800/60 text-emerald-400'
              : violationsCount < maxTolerance
              ? 'bg-amber-950/50 border-amber-800/60 text-amber-400'
              : 'bg-rose-950/50 border-rose-800/60 text-rose-400'
          }`}>
            <ShieldAlert className="w-4 h-4" />
            <span className="hidden sm:inline">Pelanggaran:</span>
            <span>{violationsCount}/{maxTolerance}</span>
          </div>
        </div>

        {/* Right: Security Guide, Fullscreen lock check & Finish Exam button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSecurityGuideModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-lg text-xs font-bold transition-all"
            title="Panduan Lock Task Mode, DND & FLAG_SECURE"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Keamanan Gawai</span>
          </button>

          {!isFullscreen && (
            <button
              onClick={enterFullscreen}
              className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold animate-pulse transition-all"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Kunci Layar Penuh</span>
            </button>
          )}

          <button
            onClick={() => setShowSubmitModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs hover:shadow transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Selesai Ujian</span>
          </button>
        </div>
      </header>

      {/* Real-Time Countdown Progress Bar Across Top */}
      <div className="w-full h-1 bg-slate-800/90 overflow-hidden relative z-40 shrink-0">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${
            timeRemainingSeconds <= 300
              ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.9)] animate-pulse'
              : timeRemainingSeconds <= 600
              ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
              : 'bg-linear-to-r from-sky-400 via-teal-400 to-emerald-400'
          }`}
          style={{
            width: `${Math.min(100, Math.max(0, (timeRemainingSeconds / totalDurationSeconds) * 100))}%`
          }}
        />
      </div>

      {/* Real-time Time Alert Banner Toast */}
      {timeWarningToast && (
        <div className={`px-4 py-2 text-xs font-bold flex items-center justify-between gap-3 shadow-md z-40 shrink-0 animate-in fade-in slide-in-from-top-2 duration-300 ${
          timeWarningToast.urgent
            ? 'bg-rose-600 text-white border-b border-rose-700'
            : 'bg-amber-500 text-slate-950 border-b border-amber-600'
        }`}>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0 animate-pulse" />
            <span>{timeWarningToast.message}</span>
          </div>
          <button
            onClick={() => setTimeWarningToast(null)}
            className="p-1 rounded hover:bg-black/10 text-current text-xs font-bold leading-none cursor-pointer"
            aria-label="Tutup notifikasi"
          >
            ✕
          </button>
        </div>
      )}

      {/* Edge Swipe Back Warning Toast */}
      {edgeSwipeWarningToast && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-black flex items-center justify-between gap-3 shadow-lg z-40 shrink-0 border-b border-amber-600 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-slate-950 animate-bounce" />
            <span>{edgeSwipeWarningToast}</span>
          </div>
          <button
            onClick={() => setEdgeSwipeWarningToast(null)}
            className="text-xs font-bold px-2 py-0.5 bg-black/10 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* C. EXAM QUESTION VIEWPORT (GOOGLE FORM INTEGRATION & WORKSPACE) */}
      <main className="flex-1 relative bg-white overflow-hidden flex flex-col exam-player-viewport">
        {/* Dynamic Steganographic Forensic Watermark Overlay (Anti Screen-Record & Photo Forensics) */}
        <div className="absolute inset-0 pointer-events-none z-30 select-none overflow-hidden opacity-40">
          <div className="w-full h-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-10 p-6 animate-watermark-drift scale-110">
            {Array.from({ length: 28 }).map((_, idx) => (
              <div key={idx} className="text-center font-mono text-[10px] sm:text-xs text-sky-950/25 font-black whitespace-nowrap tracking-wider">
                <p>{student.nama}</p>
                <p>{student.nisn} · {student.noPeserta}</p>
                <p>{student.ruang} · {liveForensicTime} WIB</p>
                <p className="text-[9px] text-sky-900/20 uppercase tracking-widest font-bold">BAGJA EXAM · FLAG_SECURE</p>
              </div>
            ))}
          </div>
        </div>

        {/* The Google Form Embedded Frame */}
        <div className="flex-1 w-full h-full relative z-10 flex flex-col">
          {(() => {
            const activeFormUrl = (schedule.classFormUrls && schedule.classFormUrls[student.kelas]?.trim())
              ? schedule.classFormUrls[student.kelas].trim()
              : schedule.formUrl;

            return activeFormUrl ? (
              <iframe
                src={activeFormUrl}
                title={`Soal Ujian ${schedule.subject} - Kelas ${student.kelas}`}
                className="w-full h-full border-0 bg-white"
                allow="camera; microphone"
                sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 space-y-3">
                <Info className="w-10 h-10 text-slate-400" />
                <p className="text-sm font-semibold">Tautan formulir soal ujian belum dikonfigurasi untuk kelas {student.kelas}.</p>
              </div>
            );
          })()}
        </div>

        {/* Mobile Floating Mini-Timer Pill */}
        <div className="sm:hidden fixed bottom-14 right-3 z-30 pointer-events-none">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-xl border backdrop-blur-md font-mono text-xs font-black ${
            timeRemainingSeconds <= 300
              ? 'bg-rose-600/95 text-white border-rose-400 animate-pulse'
              : timeRemainingSeconds <= 600
              ? 'bg-amber-500/95 text-slate-950 border-amber-300'
              : 'bg-slate-900/90 text-sky-300 border-sky-500/40'
          }`}>
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>{formatTime(timeRemainingSeconds)}</span>
          </div>
        </div>

        {/* Bottom Status Bar for Student Confirmation */}
        <footer className="bg-slate-100 border-t border-slate-200 px-4 py-2 flex items-center justify-between text-xs text-slate-600 shrink-0 z-20">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className="font-semibold text-slate-800">{schedule.subject}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1 font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
              <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>{formatIndonesianDate(schedule.date)}</span>
            </span>
            <span>·</span>
            <span>Token: <strong className="font-mono text-sky-700">{schedule.token}</strong></span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setShowSecurityGuideModal(true)}
              className="sm:hidden px-2.5 py-1 bg-slate-800 text-sky-300 font-bold rounded-lg shadow-xs flex items-center gap-1 text-[11px]"
              title="Keamanan Mobile"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
              <span>Keamanan</span>
            </button>
            <span className="text-slate-500 hidden sm:inline">Perangkat: <strong className="text-slate-700">{deviceType}</strong></span>
            <span className="hidden sm:inline">·</span>
            <button
              type="button"
              onClick={() => setShowAnswerSheet(!showAnswerSheet)}
              className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Lembar Jawaban ({answeredCount}/{totalQuestions})</span>
            </button>
          </div>
        </footer>

        {/* Answer Sheet Drawer Panel */}
        {showAnswerSheet && (
          <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-96 bg-white shadow-2xl border-l border-slate-200 flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-sm">Lembar Jawaban Peserta</h4>
                <p className="text-[11px] text-sky-400">Tersimpan Otomatis (Terenkripsi AES-GCM)</p>
              </div>
              <button
                onClick={() => setShowAnswerSheet(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                Tandai jawaban yang telah Anda pilih pada Google Form untuk sinkronisasi cadangan offline real-time.
              </div>

              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: totalQuestions }).map((_, idx) => {
                  const qNum = idx + 1;
                  const currentAnswer = studentAnswers[qNum] || '';
                  return (
                    <div key={qNum} className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-700 w-6">#{qNum}</span>
                      <div className="flex gap-1">
                        {['A', 'B', 'C', 'D'].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleSelectAnswer(qNum, opt)}
                            className={`w-6 h-6 rounded-md text-[11px] font-bold transition-colors ${
                              currentAnswer === opt
                                ? 'bg-sky-600 text-white shadow-xs'
                                : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Terjawab: {answeredCount} dari {totalQuestions}</span>
              <button
                onClick={() => setShowAnswerSheet(false)}
                className="px-3 py-1.5 bg-slate-900 text-white font-bold rounded-lg"
              >
                Tutup Lembar
              </button>
            </div>
          </div>
        )}
      </main>

      {/* D. FULLSCREEN LOCK RESTORE MODAL (WHEN NOT IN FULLSCREEN) */}
      {!isFullscreen && !isSuspended && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 mx-auto rounded-full bg-rose-100 text-rose-600 flex items-center justify-center animate-bounce">
              <Maximize2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Kembalikan Layar Penuh!</h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Aplikasi BAGJA EXAM wajib berada dalam mode layar penuh terkunci demi menjaga integritas penilaian.
              </p>
            </div>
            <button
              onClick={enterFullscreen}
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-lg transition-all"
            >
              Aktifkan Kembali Layar Penuh
            </button>
          </div>
        </div>
      )}

      {/* E. STRICT SUSPENSION LOCKDOWN MODAL (EXCEEDED VIOLATION TOLERANCE) */}
      {isSuspended && (
        <div className="fixed inset-0 z-50 bg-rose-950/95 backdrop-blur-lg flex items-center justify-center p-4 text-white">
          <div className="bg-slate-900 border border-rose-600/50 rounded-2xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-rose-600/20 text-rose-500 border border-rose-500 flex items-center justify-center animate-pulse">
              <ShieldAlert className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-rose-400 tracking-tight">
                AKSES UJIAN DITANGGUHKAN!
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Anda telah melampaui batas toleransi pelanggaran integritas ({maxTolerance}x).
                Sistem mendeteksi aktivitas keluar jendela, pemindahan tab, atau gestur terlarang.
              </p>
            </div>

            {/* Student details summary */}
            <div className="bg-slate-800/80 rounded-xl p-3 text-xs text-left grid grid-cols-2 gap-2 border border-slate-700">
              <div>
                <span className="text-slate-400 block text-[10px]">Nama Peserta:</span>
                <span className="font-bold text-white">{student.nama}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">No Peserta:</span>
                <span className="font-mono text-white">{student.noPeserta}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Ruang Tugas:</span>
                <span className="font-bold text-amber-400">{student.ruang}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Pelanggaran:</span>
                <span className="font-bold text-rose-400">{violationsCount} Pelanggaran</span>
              </div>
            </div>

            {/* Schedule End Time & Policy Warning */}
            <div className="bg-amber-950/60 border border-amber-800/60 rounded-xl p-3 text-xs text-amber-200 text-left flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-300">Waktu Ujian Berjalan Sesuai Jadwal Resmi:</span>
                <p className="text-[11px] text-amber-100/90 mt-0.5 leading-relaxed">
                  Jadwal ujian resmi berlangsung hingga pukul <strong className="text-white">{schedule.endTime} WIB</strong>. Waktu ujian tetap berjalan selama status penangguhan ini. Saat kunci ujian dibuka oleh pengawas, sisa waktu pengerjaan Anda akan <strong>secara otomatis mengikuti batas akhir jadwal resmi</strong> tersebut.
                </p>
              </div>
            </div>

            {/* Remote Unlock Notice */}
            <div className="bg-sky-950/60 border border-sky-800/60 rounded-xl p-3 text-xs text-sky-200 text-left flex items-start gap-2.5">
              <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Buka Kunci Jarak Jauh (Remote):</span> Pengawas di ruang <strong className="text-amber-300">{student.ruang}</strong> dapat membuka kunci langsung dari dasbor pengawas tanpa perlu memasukkan PIN manual di layar ini. Layar akan otomatis terbuka!
              </div>
            </div>

            {/* Manual PIN Unlock Option */}
            <form onSubmit={handleManualUnlock} className="space-y-3 pt-2 border-t border-slate-800 text-left">
              <label className="block text-xs font-bold text-slate-300">
                Atau Buka Kunci dengan PIN Pengawas di Tempat:
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="PIN / Password Pengawas"
                  value={supervisorPinInput}
                  onChange={(e) => setSupervisorPinInput(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0"
                >
                  Buka Kunci
                </button>
              </div>
              {unlockError && (
                <p className="text-xs text-rose-400 font-semibold">{unlockError}</p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* F. EXAM SUBMISSION SUMMARY CONFIRMATION MODAL */}
      {showSubmitModal && !isTimeExpired && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isTimeExpired ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {isTimeExpired ? <Clock className="w-6 h-6 animate-pulse" /> : <CheckCircle2 className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  {isTimeExpired ? 'Waktu Ujian Telah Habis!' : 'Konfirmasi Pengumpulan Ujian'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isTimeExpired
                    ? 'Durasi ujian telah berakhir, silakan serahkan jawaban'
                    : 'Periksa ringkasan sebelum menyelesaikan'}
                </p>
              </div>
            </div>

            {/* Answer Summary Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200/80">
                <span className="font-extrabold text-slate-800">{schedule.subject}</span>
                <span className="font-bold text-indigo-700 flex items-center gap-1 text-[11px]">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  {formatIndonesianDate(schedule.date)}
                </span>
              </div>
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Ringkasan Pengerjaan:
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <div className="text-2xl font-extrabold text-emerald-600">{answeredCount}</div>
                  <div className="text-[11px] font-semibold text-slate-500">Soal Terjawab</div>
                </div>
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <div className="text-2xl font-extrabold text-amber-600">
                    {Math.max(0, totalQuestions - answeredCount)}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500">Belum Terjawab</div>
                </div>
              </div>

              {isTimeExpired ? (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 space-y-1">
                  <div className="font-extrabold flex items-center gap-1.5 text-rose-700">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Waktu Pengerjaan Selesai</span>
                  </div>
                  <p className="text-[11px] text-rose-800 leading-relaxed">
                    Sistem akan menyerahkan lembar ujian secara otomatis dalam <strong>{autoSubmitCountdown} detik</strong>.
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Peringatan: Setelah menekan tombol <strong>Kirim & Selesai</strong>, status Anda akan berubah menjadi <strong>Selesai</strong> dan Anda tidak dapat masuk kembali ke ruang ujian ini.
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              {!isTimeExpired && (
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Kembali Kerjakan
                </button>
              )}
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className={`flex-1 py-2.5 text-xs font-bold text-white rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                  isTimeExpired
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isSubmitting
                  ? 'Mengirimkan...'
                  : isTimeExpired
                  ? `Serahkan Sekarang (${autoSubmitCountdown}s)`
                  : 'Kirim & Selesai'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* G. FLAG_SECURE PRIVACY CURTAIN (ANTI-SCREENSHOT & RECENT APPS BLANKING) */}
      {isFlagSecureCurtainActive && !isSuspended && (
        <div
          onClick={() => {
            setIsFlagSecureCurtainActive(false);
            enterFullscreen();
          }}
          className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6 text-white text-center select-none cursor-pointer"
        >
          <div className="w-16 h-16 rounded-full bg-rose-600/20 border border-rose-500 text-rose-500 flex items-center justify-center mb-4 animate-pulse">
            <ShieldAlert className="w-9 h-9" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950 border border-rose-800 text-rose-300 text-[11px] font-extrabold uppercase tracking-widest mb-3">
            FLAG_SECURE AKTIF · PRIVASI LAYAR TERKUNCI
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Layar Ujian Diamankan
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm mt-2 leading-relaxed">
            Sistem mendeteksi kehilangan fokus peramban, pembukaan task switcher (Recent Apps), tombol Home, atau indikasi tangkapan layar.
          </p>
          <div className="mt-4 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 font-mono">
            <span>{student.nama} · {student.noPeserta} · {liveForensicTime} WIB</span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsFlagSecureCurtainActive(false);
              enterFullscreen();
            }}
            className="mt-6 px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
          >
            Ketuk untuk Kembali Mengerjakan Ujian
          </button>
        </div>
      )}

      {/* H. KUNCI ORIENTASI POTRET (PORTRAIT ORIENTATION LOCK ENFORCER) */}
      {isLandscapeLocked && !isSuspended && (
        <div className="fixed inset-0 z-50 bg-slate-950/98 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500 text-amber-400 flex items-center justify-center mb-4 animate-spin">
            <RotateCcw className="w-8 h-8" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950 border border-amber-800 text-amber-300 text-[11px] font-extrabold uppercase tracking-widest mb-3">
            ORIENTASI WAJIB POTRET
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            Putar Gawai ke Posisi Tegak (Potret)
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-sm mt-2 leading-relaxed">
            Pengerjaan ujian pada gawai handphone dan tablet wajib dalam orientasi tegak lurus (vertikal) demi menjaga tata letak soal dan integritas pengawasan.
          </p>
          <button
            type="button"
            onClick={enterFullscreen}
            className="mt-6 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Smartphone className="w-4 h-4" />
            <span>Kunci Ulang Posisi Potret</span>
          </button>
        </div>
      )}

      {/* I. DETEKSI SPLIT-SCREEN & JENDELA MENGAMBANG (SPLIT-SCREEN DETECTOR) */}
      {isSplitScreenDetected && !isSuspended && (
        <div className="fixed inset-0 z-50 bg-rose-950/98 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-600/20 border border-rose-500 text-rose-400 flex items-center justify-center mb-4 animate-pulse">
            <Columns2 className="w-9 h-9" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-900 border border-rose-700 text-rose-200 text-[11px] font-extrabold uppercase tracking-widest mb-3">
            PELANGGARAN SPLIT-SCREEN TERDETEKSI
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            Mode Layar Terbagi Dilarang!
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-sm mt-2 leading-relaxed">
            Sistem mendeteksi gawai Anda terbagi (Split-Screen) atau membuka jendela mengambang (Floating App / Pop-up). Tutup aplikasi lain dan kembalikan ke 1 layar penuh untuk membuka soal.
          </p>
          <button
            type="button"
            onClick={enterFullscreen}
            className="mt-6 px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
          >
            Pulihkan ke 1 Layar Penuh
          </button>
        </div>
      )}

      {/* J. BLOKIR SCREEN CASTING & MIRRORING (SCREEN MIRRORING DETECTOR) */}
      {isCastingDetected && !isSuspended && (
        <div className="fixed inset-0 z-50 bg-slate-950/98 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500 text-indigo-400 flex items-center justify-center mb-4 animate-pulse">
            <Cast className="w-9 h-9" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-950 border border-indigo-800 text-indigo-300 text-[11px] font-extrabold uppercase tracking-widest mb-3">
            SCREEN MIRRORING DIBLOKIR
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            Koneksi Layar Eksternal Terdeteksi
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-sm mt-2 leading-relaxed">
            Transmisi nirkabel (Wireless Casting / Chromecast / AirPlay) atau kabel layar ganda dilarang selama ujian berlangsung. Putuskan sambungan layar sekunder untuk melanjutkan.
          </p>
        </div>
      )}

      {/* K. MODAL PANDUAN KEAMANAN MOBILE (LOCK TASK MODE & DND GUIDE) */}
      {showSecurityGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-sky-800/60 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-600/20 border border-sky-500/40 text-sky-400 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-white">
                    Protokol Keamanan Mode Gawai
                  </h3>
                  <p className="text-[11px] text-sky-400">SMPN 7 Cimahi · Perlindungan Kiosk Ketat</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSecurityGuideModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-300">
              {/* Feature 1: Lock Task Mode */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-sky-400 font-bold">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>1. Lock Task Mode (Kunci Tombol Home & Recent Apps)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Pada Android (Samsung, Xiaomi, Oppo, Vivo, Realme), Anda dapat mengaktifkan fitur <strong>Sematkan Aplikasi (App Pinning)</strong> di Pengaturan Keamanan. Fitur ini secara fisik mengunci tombol Home dan Recent Apps agar layar tidak dapat keluar secara tidak sengaja.
                </p>
              </div>

              {/* Feature 2: FLAG_SECURE */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-rose-400 font-bold">
                  <EyeOff className="w-4 h-4 shrink-0" />
                  <span>2. FLAG_SECURE & Proteksi Tangkapan Layar</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Sistem mengaktifkan <em>Privacy Curtain</em> yang otomatis menghitamkan layar saat task switcher dibuka. Kombinasi tombol tangkapan layar, gestur 3 jari, dan perekaman layar akan langsung memicu sirine alarm dan mencatat pelanggaran.
                </p>
              </div>

              {/* Feature 3: Penanganan Tombol Back */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <RotateCcw className="w-4 h-4 shrink-0" />
                  <span>3. Penanganan Tombol Back & Usap Tepi Layar</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Tombol kembali hardware dan gestur usap tepi (<em>edge back gesture</em>) Android 10+ dinonaktifkan. Anda tidak akan keluar dari ujian saat mengusap tepi layar.
                </p>
              </div>

              {/* Feature 4: Kebijakan DND */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <VolumeX className="w-4 h-4 shrink-0" />
                  <span>4. Kebijakan Jangan Ganggu (DND) & Notifikasi</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Peserta diwajibkan menyalakan <strong>Mode Jangan Ganggu (Do Not Disturb)</strong> dan mematikan gelembung obrolan (*floating bubbles*). Menarik bilah notifikasi atas terdeteksi sebagai pelanggaran.
                </p>
              </div>

              {/* Feature 5: Split-Screen & Orientation */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-400 font-bold">
                  <Columns2 className="w-4 h-4 shrink-0" />
                  <span>5. Deteksi Split-Screen & Kunci Orientasi Potret</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Mode layar terbagi (Split-Screen), jendela mengambang, serta orientasi lanskap dilarang keras. Gawai wajib dalam posisi tegak lurus (potret) dengan 1 layar penuh.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowSecurityGuideModal(false);
                  enterFullscreen();
                }}
                className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
              >
                Saya Mengerti & Lanjutkan Ujian
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
