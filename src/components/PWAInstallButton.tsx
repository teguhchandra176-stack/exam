import React, { useState } from 'react';
import { Download, Smartphone, Share2, PlusSquare, X, CheckCircle2, ShieldCheck } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'navbar' | 'banner' | 'card';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'navbar',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already running inside installed standalone PWA app, hide install trigger
  if (isInstalled) {
    if (variant === 'card') {
      return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200/80 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Aplikasi Terpasang (PWA Aktif)</span>
        </div>
      );
    }
    return null;
  }

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      await install();
    } finally {
      setIsInstalling(false);
    }
  };

  // Render for Banner Variant (used on Login Portal / Dashboard)
  if (variant === 'banner') {
    return (
      <>
        <div className={`p-3.5 rounded-2xl bg-linear-to-r from-sky-600 to-indigo-700 text-white shadow-md flex items-center justify-between gap-3 ${className}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/20">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-extrabold tracking-wide uppercase text-sky-200">Mode Kiosk PWA</p>
              <h4 className="text-sm font-bold leading-tight">Install BAGJA EXAM di Layar Utama</h4>
              <p className="text-[11px] text-white/80 line-clamp-1">Performa lebih cepat & proteksi fullscreen tanpa address bar browser.</p>
            </div>
          </div>

          <div>
            {isInstallable ? (
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={isInstalling}
                className="px-3.5 py-1.5 rounded-xl bg-white text-sky-700 hover:bg-sky-50 active:scale-95 text-xs font-bold shadow-xs transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isInstalling ? 'Memasang...' : 'Pasang Aplikasi'}</span>
              </button>
            ) : isIOS ? (
              <button
                type="button"
                onClick={() => setShowIOSGuide(true)}
                className="px-3 py-1.5 rounded-xl bg-white text-sky-700 hover:bg-sky-50 active:scale-95 text-xs font-bold shadow-xs transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Panduan iOS</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  alert('Untuk menginstal aplikasi PWA BAGJA EXAM:\n1. Buka menu browser (titik 3 di kanan atas)\n2. Pilih "Instal aplikasi" atau "Tambahkan ke Layar Utama"');
                }}
                className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Instal PWA</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Panduan iOS Safari */}
        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-sky-100 text-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-tight">Instal di iPhone / iPad</h3>
                    <p className="text-[11px] text-slate-500">Safari iOS Web App</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs text-slate-600">
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-sky-50/60 border border-sky-100">
                  <div className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</div>
                  <p>Tekan tombol <strong className="text-slate-800 inline-flex items-center gap-1"><Share2 className="w-3 h-3 text-sky-600 inline" /> Bagikan (Share)</strong> di bilah bawah peramban Safari.</p>
                </div>
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-sky-50/60 border border-sky-100">
                  <div className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</div>
                  <p>Gulir menu ke bawah dan pilih opsi <strong className="text-slate-800 inline-flex items-center gap-1"><PlusSquare className="w-3 h-3 text-sky-600 inline" /> Tambahkan ke Layar Utama (Add to Home Screen)</strong>.</p>
                </div>
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-sky-50/60 border border-sky-100">
                  <div className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</div>
                  <p>Buka ikon <strong>BAGJA EXAM</strong> dari layar beranda ponsel Anda untuk menikmati mode layar penuh yang terlindungi.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Render for Compact Navbar Variant
  return (
    <>
      {isInstallable ? (
        <button
          type="button"
          onClick={handleInstallClick}
          disabled={isInstalling}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer ${className}`}
          title="Instal aplikasi BAGJA EXAM di perangkat ini"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Instal App</span>
        </button>
      ) : isIOS ? (
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer ${className}`}
          title="Panduan pasang aplikasi di iOS Safari"
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0 text-sky-600" />
          <span className="hidden sm:inline">Instal iOS</span>
        </button>
      ) : null}

      {/* Modal Panduan iOS Safari */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-sky-100 text-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">Instal di iPhone / iPad</h3>
                  <p className="text-[11px] text-slate-500">Safari iOS Web App</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-sky-50/60 border border-sky-100">
                <div className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</div>
                <p>Tekan tombol <strong className="text-slate-800 inline-flex items-center gap-1"><Share2 className="w-3 h-3 text-sky-600 inline" /> Bagikan</strong> di toolbar Safari.</p>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-sky-50/60 border border-sky-100">
                <div className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</div>
                <p>Pilih <strong className="text-slate-800 inline-flex items-center gap-1"><PlusSquare className="w-3 h-3 text-sky-600 inline" /> Tambahkan ke Layar Utama</strong>.</p>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-sky-50/60 border border-sky-100">
                <div className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</div>
                <p>Luncurkan dari Layar Utama untuk membuka mode mandiri (Standalone PWA).</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </>
  );
};
