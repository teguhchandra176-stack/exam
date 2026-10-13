import React from 'react';
import { ShieldCheck, Monitor, Smartphone, Tablet, AlertTriangle, RefreshCw, LogOut, CheckCircle2 } from 'lucide-react';
import { DeviceType } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface NavbarProps {
  deviceType: DeviceType;
  schoolName: string;
  maintenanceMode: boolean;
  maintenanceVersion?: string;
  isOnline: boolean;
  latencyMs?: number;
  onTestSync?: () => void;
  currentUser?: {
    role: 'student' | 'supervisor' | 'admin';
    name: string;
    detail?: string;
  } | null;
  onLogout?: () => void;
  onSwitchPortal?: (portal: 'portal' | 'supervisor' | 'admin') => void;
  currentView?: string;
  hideNavActions?: boolean;
  schoolLogo?: string;
  pemdaLogo?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  deviceType,
  schoolName,
  maintenanceMode,
  maintenanceVersion = 'v1.0.1',
  isOnline,
  latencyMs,
  onTestSync,
  currentUser,
  onLogout,
  onSwitchPortal,
  currentView = 'portal',
  hideNavActions = false,
  schoolLogo = '/logo-sekolah.svg',
  pemdaLogo = '/logo-pemda.svg',
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-sky-100 shadow-xs">
      {/* Maintenance Notification Banner */}
      {maintenanceMode && (
        <div className="bg-amber-500 text-slate-950 px-4 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 tracking-wide">
          <AlertTriangle className="w-4 h-4 text-slate-950 shrink-0" />
          <span>STATUS: SISTEM SEDANG DALAM MODE PEMELIHARAAN ({maintenanceVersion}). HANYA ADMINISTRATOR & PENGAWAS YANG DAPAT MENGAKSES.</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand & School Logo */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => onSwitchPortal && onSwitchPortal('portal')}
            className="w-10 h-10 rounded-xl bg-white border border-sky-100 p-1 flex items-center justify-center shadow-xs overflow-hidden shrink-0 cursor-pointer hover:border-sky-300 transition-colors"
            title="Kembali ke Beranda Portal Utama"
          >
            <img
              src={schoolLogo || '/logo-sekolah.svg'}
              alt="Logo SMP Negeri 7 Cimahi"
              className="w-full h-full object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (target.src !== window.location.origin + '/logo-sekolah.svg') {
                  target.src = '/logo-sekolah.svg';
                }
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSwitchPortal && onSwitchPortal('portal')}
                className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 hover:text-sky-600 transition-colors text-left"
              >
                BAGJA <span className="text-sky-600">EXAM</span>
              </button>
              <span className="hidden sm:inline-block text-[11px] font-semibold text-sky-700 bg-sky-50 border border-sky-200/60 px-2 py-0.5 rounded-md">
                TANGGUH · JUARA · PASTI BISA
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium truncate max-w-[200px] sm:max-w-xs">
              {schoolName}
            </p>
          </div>
        </div>

        {/* Center / Right Metadata Indicators */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Device Detection Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600">
            {deviceType === 'Handphone' && <Smartphone className="w-3.5 h-3.5 text-sky-600" />}
            {deviceType === 'Tablet' && <Tablet className="w-3.5 h-3.5 text-indigo-600" />}
            {deviceType === 'Komputer' && <Monitor className="w-3.5 h-3.5 text-emerald-600" />}
            <span className="hidden md:inline">Perangkat:</span>
            <span className="font-semibold text-slate-800">{deviceType}</span>
          </div>

          {/* In-App PWA Install Trigger */}
          <PWAInstallButton variant="navbar" />

          {/* User Session Info & Logout */}
          {currentUser && !hideNavActions && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-800 leading-tight">{currentUser.name}</p>
                <p className="text-[10px] text-slate-500 capitalize">{currentUser.role} {currentUser.detail ? `· ${currentUser.detail}` : ''}</p>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title="Keluar Sesi"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
