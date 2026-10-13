import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-50 flex items-center gap-3 rounded-2xl bg-amber-600/95 backdrop-blur-md px-4 py-3 text-xs font-semibold text-white shadow-xl border border-amber-400/40 animate-in slide-in-from-bottom-2 duration-200">
      <div className="w-8 h-8 rounded-xl bg-amber-700/80 flex items-center justify-center shrink-0">
        <WifiOff className="w-4 h-4 text-white animate-pulse" />
      </div>
      <div className="flex-1">
        <p className="font-bold text-amber-100 uppercase text-[10px] tracking-wide">Mode Offline (PWA Aktif)</p>
        <p className="text-white text-xs leading-tight">Koneksi terputus. Aset tampilan tetap dimuat dari cache lokal.</p>
      </div>
    </div>
  );
};
