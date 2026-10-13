import React, { useState, useEffect, useCallback } from 'react';
import { DatabaseSchema, Student, Supervisor, Schedule, DeviceType } from './types';
import { apiClient } from './services/apiClient';
import { detectDevice } from './services/deviceDetector';
import { Navbar } from './components/Navbar';
import { PortalLogin } from './components/PortalLogin';
import { ExamPlayerPage } from './components/ExamPlayerPage';
import { SupervisorDashboard } from './components/SupervisorDashboard';
import { AdminPortal } from './components/AdminPortal';
import { StudioCetakDokumen } from './components/StudioCetakDokumen';
import { OfflineIndicator } from './components/OfflineIndicator';

export default function App() {
  const [database, setDatabase] = useState<DatabaseSchema | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<{ type: DeviceType; details: string }>({
    type: 'Komputer',
    details: 'Mendeteksi...'
  });
  const [latencyMs, setLatencyMs] = useState<number>(12);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Active View State
  const [currentView, setCurrentView] = useState<'portal' | 'exam_player' | 'supervisor' | 'admin' | 'studio_cetak_room'>('portal');

  // Active Session State
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [activeSchedule, setActiveSchedule] = useState<Schedule | null>(null);
  const [activeSupervisor, setActiveSupervisor] = useState<Supervisor | null>(null);
  const [directPrintRoom, setDirectPrintRoom] = useState<string>('Lab Komputer');

  // Initial Device Detection
  useEffect(() => {
    const detected = detectDevice();
    setDeviceInfo(detected);

    const handleResize = () => {
      setDeviceInfo(detectDevice());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Global Context Menu (Right-Click) Disable
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // Load Database on Mount
  const loadDatabase = useCallback(async () => {
    try {
      const data = await apiClient.fetchDatabase();
      setDatabase(data);
      const health = await apiClient.getHealth();
      setLatencyMs(health.latencyMs);
      setIsOnline(health.databaseConnected);
    } catch (err) {
      console.error('Error loading database:', err);
    }
  }, []);

  useEffect(() => {
    loadDatabase();
  }, [loadDatabase]);

  // Handle Save Database
  const handleSaveDatabase = async (newDb: DatabaseSchema, actionName: string, actionDetails: string): Promise<boolean> => {
    setDatabase(newDb);
    const success = await apiClient.saveDatabase(newDb, actionName, actionDetails);
    return success;
  };

  // Test Online Sync Handler
  const handleTestSync = async () => {
    const health = await apiClient.getHealth();
    setLatencyMs(health.latencyMs);
    setIsOnline(health.databaseConnected);
    alert(`Sinkronisasi Database Online: AKTIF (${health.latencyMs}ms).\nStatus Server: ${health.status.toUpperCase()}\nBasis Data Terhubung: ${health.databaseConnected ? 'YA' : 'TIDAK'}`);
  };

  // Student Login Handler
  const handleStudentLogin = (student: Student, schedule: Schedule) => {
    setActiveStudent(student);
    setActiveSchedule(schedule);
    setCurrentView('exam_player');
  };

  // Supervisor Login Handler
  const handleSupervisorLogin = (supervisor: Supervisor) => {
    setActiveSupervisor(supervisor);
    setCurrentView('supervisor');
  };

  // Admin Login Handler
  const handleAdminLogin = () => {
    setCurrentView('admin');
  };

  // Logout Handler
  const handleLogout = () => {
    setActiveStudent(null);
    setActiveSchedule(null);
    setActiveSupervisor(null);
    setCurrentView('portal');
    loadDatabase();
  };

  // Student Exam Completed Handler
  const handleExamCompleted = () => {
    setActiveStudent(null);
    setActiveSchedule(null);
    setCurrentView('portal');
    loadDatabase();
    alert('Ujian Anda telah selesai dan jawaban telah berhasil diserahkan secara sah ke sistem BAGJA EXAM!');
  };

  if (!database) {
    return (
      <div className="min-h-screen bg-[#f2fdff] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center font-bold text-xl animate-pulse shadow-md">
          B
        </div>
        <p className="mt-4 text-sm font-extrabold text-slate-800">
          Memuat Sistem Keamanan BAGJA EXAM...
        </p>
        <p className="text-xs text-slate-500 mt-1">
          SMP Negeri 7 Cimahi · TANGGUH · JUARA · PASTI BISA
        </p>
      </div>
    );
  }

  // Determine current user session label for Navbar
  let currentUser = null;
  if (currentView === 'supervisor' && activeSupervisor) {
    currentUser = {
      role: 'supervisor' as const,
      name: activeSupervisor.nama,
      detail: activeSupervisor.ruang || 'Pengawas Ruang'
    };
  } else if (currentView === 'admin') {
    currentUser = {
      role: 'admin' as const,
      name: 'Administrator Utama',
      detail: 'Sistem'
    };
  }

  return (
    <div className="min-h-screen bg-[#f2fdff] text-slate-800 font-sans flex flex-col">
      {/* Navbar (Hidden in ExamPlayer for full kiosk immersion) */}
      {currentView !== 'exam_player' && (
        <Navbar
          deviceType={deviceInfo.type}
          schoolName={database.systemConfig.schoolInfo.namaSekolah}
          maintenanceMode={database.systemConfig.maintenanceMode}
          maintenanceVersion={database.systemConfig.maintenanceVersion}
          isOnline={isOnline}
          latencyMs={latencyMs}
          onTestSync={handleTestSync}
          currentUser={currentUser}
          currentView={currentView}
          onSwitchPortal={(portal) => {
            if (portal === 'portal') {
              setCurrentView('portal');
            } else if (portal === 'admin') {
              setCurrentView('admin');
            } else if (portal === 'supervisor') {
              if (activeSupervisor) {
                setCurrentView('supervisor');
              } else {
                // If not logged in as supervisor yet, provide first supervisor or default
                const defaultSup = (database.supervisors && database.supervisors[0]) || {
                  nip: '-',
                  nama: 'Pengawas Ruang',
                  ruang: database.rooms[0] || 'Lab Komputer',
                  pin: database.systemConfig.supervisorDefaultPin
                };
                setActiveSupervisor(defaultSup);
                setCurrentView('supervisor');
              }
            }
          }}
          schoolLogo={database.systemConfig.logoSekolah || '/logo-sekolah.svg'}
          pemdaLogo={database.systemConfig.logoPemkot || '/logo-pemda.svg'}
          onLogout={handleLogout}
        />
      )}

      {/* Main View Router */}
      <main className="flex-1">
        {currentView === 'portal' && (
          <PortalLogin
            database={database}
            deviceType={deviceInfo.type}
            onStudentLogin={handleStudentLogin}
            onSupervisorLogin={handleSupervisorLogin}
            onAdminLogin={handleAdminLogin}
          />
        )}

        {currentView === 'exam_player' && activeStudent && activeSchedule && (
          <ExamPlayerPage
            student={activeStudent}
            schedule={activeSchedule}
            systemConfig={database.systemConfig}
            deviceType={deviceInfo.type}
            onExamCompleted={handleExamCompleted}
          />
        )}

        {currentView === 'supervisor' && activeSupervisor && (
          <SupervisorDashboard
            supervisor={activeSupervisor}
            database={database}
            onRefreshDatabase={loadDatabase}
            onOpenPrintStudio={(room) => {
              setDirectPrintRoom(room);
              setCurrentView('studio_cetak_room');
            }}
            onSwitchPortal={(portal) => {
              if (portal === 'portal') setCurrentView('portal');
              else if (portal === 'admin') setCurrentView('admin');
              else if (portal === 'supervisor') setCurrentView('supervisor');
            }}
            onLogout={handleLogout}
          />
        )}

        {currentView === 'admin' && (
          <AdminPortal
            database={database}
            deviceType={deviceInfo.type}
            onRefreshDatabase={loadDatabase}
            onSaveDatabase={handleSaveDatabase}
          />
        )}

        {currentView === 'studio_cetak_room' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <StudioCetakDokumen
              database={database}
              defaultRoom={directPrintRoom}
              onBack={() => setCurrentView('supervisor')}
            />
          </div>
        )}
      </main>

      {/* Global PWA Offline Connectivity Indicator */}
      <OfflineIndicator />
    </div>
  );
}
