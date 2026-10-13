import React, { useState } from 'react';
import {
  Printer,
  Edit3,
  Check,
  RotateCcw,
  Building,
  FileText,
  Users,
  CreditCard,
  ShieldAlert,
  Grid,
  ChevronLeft
} from 'lucide-react';
import { DatabaseSchema, Student, Schedule } from '../types';
import { getRoomMaxCapacity, isComputerLab } from '../services/roomCapacity';

interface StudioCetakDokumenProps {
  database: DatabaseSchema;
  defaultRoom?: string;
  onBack?: () => void;
}

type DocType = 'berita_acara' | 'daftar_hadir' | 'kartu_peserta' | 'label_meja' | 'jadwal_pengawas' | 'log_integritas' | 'denah_duduk' | 'tata_tertib';

export const StudioCetakDokumen: React.FC<StudioCetakDokumenProps> = ({
  database,
  defaultRoom,
  onBack,
}) => {
  const [selectedDoc, setSelectedDoc] = useState<DocType>('berita_acara');
  const [selectedRoom, setSelectedRoom] = useState<string>(defaultRoom || database.rooms[0] || 'Lab Komputer');
  const [selectedClass, setSelectedClass] = useState<string>('7-A');
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Editable Form Data for Berita Acara & Tata Tertib
  const [docContent, setDocContent] = useState({
    nomorSurat: database.systemConfig.schoolInfo.defaultNomorSurat || '421.3/000-SMPN.7/2026',
    hariTanggal: 'Senin, 13 Oktober 2026',
    mataPelajaran: database.schedules[0]?.subject || (database.subjects[0] || 'Ilmu Pengetahuan Alam (IPA)'),
    jamMulaiSelesai: '07.30 - 09.00 WIB',
    jumlahSeharusnya: '0 Orang',
    jumlahHadir: '0 Orang',
    jumlahTidakHadir: '0 Orang',
    keteranganTidakHadir: '-',
    catatanPelaksanaan: 'Ujian berlangsung tertib, aman, dan lancar dalam perlindungan sistem BAGJA EXAM. Seluruh gawai siswa berada dalam mode kiosk terkunci.',
    namaPengawas1: 'Pengawas Ruang',
    nipPengawas1: '-',
    namaPengawas2: '-',
    nipPengawas2: '-',
    tataTertibText: `1. Peserta ujian wajib hadir 15 menit sebelum ujian dimulai.\n2. Peserta dilarang membuka tab lain, aplikasi lain, atau meminimalisir layar ujian.\n3. Setiap tindakan alih jendela atau keluar mode layar penuh akan otomatis tercatat dalam sistem integritas BAGJA EXAM.\n4. Apabila batas toleransi pelanggaran (3 kali) terlampaui, layar ujian akan terkunci secara otomatis.\n5. Peserta wajib menjaga ketertiban dan kejujuran selama pelaksanaan ujian berlangsung.`
  });

  const studentsInRoom = (database.students || []).filter(s => s.ruang === selectedRoom);
  const studentsInClass = (database.students || []).filter(s => s.kelas === selectedClass);
  const schoolInfo = database.systemConfig.schoolInfo;
  const letterhead = database.systemConfig.letterhead;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar (Hidden during print) */}
      <div className="no-print bg-white rounded-2xl border border-sky-100 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Studio Cetak Dokumen Resmi
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Format kop surat resmi Pemerintah Kota Cimahi & SMP Negeri 7 Cimahi dengan opsi edit selengkapnya.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Room Selector */}
          <select
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
          >
            {database.rooms.map(r => {
              const count = (database.students || []).filter(s => s.ruang === r).length;
              const max = getRoomMaxCapacity(r);
              return (
                <option key={r} value={r}>
                  {r} ({count}/{max} Siswa)
                </option>
              );
            })}
          </select>

          {/* Edit Mode Toggle */}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              isEditing
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditing ? 'Selesai Edit' : 'Edit Isi Dokumen'}</span>
          </button>

          {/* Print Trigger */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Dokumen (Print)</span>
          </button>
        </div>
      </div>

      {/* 2. Document Switcher Navigation (Hidden during print) */}
      <div className="no-print flex overflow-x-auto gap-2 p-1 bg-slate-100 rounded-2xl">
        <button
          onClick={() => setSelectedDoc('berita_acara')}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            selectedDoc === 'berita_acara' ? 'bg-white text-sky-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Berita Acara Ujian
        </button>
        <button
          onClick={() => setSelectedDoc('daftar_hadir')}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            selectedDoc === 'daftar_hadir' ? 'bg-white text-sky-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Daftar Hadir Peserta
        </button>
        <button
          onClick={() => setSelectedDoc('kartu_peserta')}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            selectedDoc === 'kartu_peserta' ? 'bg-white text-sky-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Kartu Peserta Ujian
        </button>
        <button
          onClick={() => setSelectedDoc('label_meja')}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            selectedDoc === 'label_meja' ? 'bg-white text-sky-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Label Tempat Duduk (Meja)
        </button>
        <button
          onClick={() => setSelectedDoc('jadwal_pengawas')}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            selectedDoc === 'jadwal_pengawas' ? 'bg-white text-sky-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Jadwal Tugas Pengawas
        </button>
        <button
          onClick={() => setSelectedDoc('log_integritas')}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            selectedDoc === 'log_integritas' ? 'bg-white text-sky-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Rekap Log Integritas
        </button>
        <button
          onClick={() => setSelectedDoc('denah_duduk')}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            selectedDoc === 'denah_duduk' ? 'bg-white text-sky-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Denah Duduk Ruangan
        </button>
        <button
          onClick={() => setSelectedDoc('tata_tertib')}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            selectedDoc === 'tata_tertib' ? 'bg-white text-sky-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Tata Tertib & Pakta
        </button>
      </div>

      {/* 3. PRINTABLE CANVAS / PREVIEW */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 sm:p-12 max-w-4xl mx-auto text-slate-900 font-sans print:p-0 print:border-none print:shadow-none">
        {/* KOP SURAT RESMI (Used for Berita Acara, Daftar Hadir, Log Integritas, Tata Tertib) */}
        {['berita_acara', 'daftar_hadir', 'label_meja', 'log_integritas', 'tata_tertib'].includes(selectedDoc) && (
          <div className="border-b-4 border-double border-slate-900 pb-3 mb-6">
            <div className="flex items-center justify-between gap-4">
              {/* Logo Pemkot (Kiri) */}
              <div className="w-20 h-20 shrink-0 flex items-center justify-center">
                <img
                  src={database.systemConfig.logoPemkot || '/logo-pemda.svg'}
                  alt="Logo Pemerintah Kota Cimahi"
                  className="max-h-20 max-w-20 object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src !== window.location.origin + '/logo-pemda.svg') {
                      target.src = '/logo-pemda.svg';
                    }
                  }}
                />
              </div>

              {/* Teks Lembaga & Sekolah - 6 Baris Resmi */}
              <div className="flex-1 text-center space-y-0.5 text-slate-900 font-serif">
                <h3 className="text-sm sm:text-base font-bold tracking-wider uppercase leading-tight">
                  PEMERINTAH KOTA CIMAHI
                </h3>
                <h4 className="text-sm sm:text-base font-bold tracking-wider uppercase leading-tight">
                  DINAS PENDIDIKAN
                </h4>
                <h2 className="text-lg sm:text-xl font-black tracking-tight uppercase leading-tight">
                  SMP NEGERI 7 CIMAHI
                </h2>
                <p className="text-[11px] font-sans text-slate-800 leading-tight pt-0.5">
                  JL. Kebon Jeruk Rt/Rw 01/20, Kel.Cibeureum, Kec.Cimahi Selatan, Kota Cimahi, Jawa Barat 40535
                </p>
                <p className="text-[11px] font-sans text-slate-800 leading-tight">
                  Telepon: (022) 6030009
                </p>
                <p className="text-[11px] font-sans text-slate-800 leading-tight">
                  Laman: <a href="https://smpnegeri7cimahi.sch.id" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-medium hover:text-blue-800 print:text-blue-600" style={{ color: '#2563eb' }}>smpnegeri7cimahi.sch.id</a> | Pos-el: <a href="mailto:smpnegeri7cimahi@gmail.com" className="text-blue-600 underline font-medium hover:text-blue-800 print:text-blue-600" style={{ color: '#2563eb' }}>smpnegeri7cimahi@gmail.com</a>
                </p>
              </div>

              {/* Logo Sekolah (Kanan) */}
              <div className="w-20 h-20 shrink-0 flex items-center justify-center">
                <img
                  src={database.systemConfig.logoSekolah || '/logo-sekolah.svg'}
                  alt="Logo SMPN 7 Cimahi"
                  className="max-h-20 max-w-20 object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src !== window.location.origin + '/logo-sekolah.svg') {
                      target.src = '/logo-sekolah.svg';
                    }
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ================= DOC 1: BERITA ACARA UJIAN ================= */}
        {selectedDoc === 'berita_acara' && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-base font-bold uppercase underline tracking-wider">
                BERITA ACARA PELAKSANAAN PENILAIAN UJIAN
              </h2>
              <div className="text-xs text-slate-700">
                {isEditing ? (
                  <div className="flex items-center justify-center gap-2">
                    <span>Nomor:</span>
                    <input
                      type="text"
                      value={docContent.nomorSurat}
                      onChange={(e) => setDocContent({ ...docContent, nomorSurat: e.target.value })}
                      className="border border-sky-400 px-2 py-0.5 text-xs rounded font-mono"
                    />
                  </div>
                ) : (
                  <span>Nomor: {docContent.nomorSurat}</span>
                )}
              </div>
            </div>

            <p className="text-xs leading-relaxed text-justify">
              Pada hari ini, <strong>{docContent.hariTanggal}</strong>, di <strong>{schoolInfo.namaSekolah}</strong> telah diselenggarakan Penilaian Ujian Sekolah Tahun Ajaran <strong>{schoolInfo.tahunAjaran}</strong> untuk ruang lingkup pengawasan:
            </p>

            {/* Metadata Table */}
            <table className="w-full text-xs border border-slate-300">
              <tbody>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold w-44 bg-slate-50">Ruang Pelaksanaan</td>
                  <td className="p-2">: {selectedRoom}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50">Mata Pelajaran</td>
                  <td className="p-2">
                    {isEditing ? (
                      <input
                        type="text"
                        value={docContent.mataPelajaran}
                        onChange={(e) => setDocContent({ ...docContent, mataPelajaran: e.target.value })}
                        className="w-full border border-sky-400 px-2 py-0.5 rounded"
                      />
                    ) : (
                      `: ${docContent.mataPelajaran}`
                    )}
                  </td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50">Waktu Pengerjaan</td>
                  <td className="p-2">: {docContent.jamMulaiSelesai}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50">Jumlah Seharusnya</td>
                  <td className="p-2">
                    {isEditing ? (
                      <input
                        type="text"
                        value={docContent.jumlahSeharusnya}
                        onChange={(e) => setDocContent({ ...docContent, jumlahSeharusnya: e.target.value })}
                        className="border border-sky-400 px-2 py-0.5 rounded"
                      />
                    ) : (
                      `: ${docContent.jumlahSeharusnya}`
                    )}
                  </td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50">Jumlah Hadir</td>
                  <td className="p-2">
                    {isEditing ? (
                      <input
                        type="text"
                        value={docContent.jumlahHadir}
                        onChange={(e) => setDocContent({ ...docContent, jumlahHadir: e.target.value })}
                        className="border border-sky-400 px-2 py-0.5 rounded"
                      />
                    ) : (
                      `: ${docContent.jumlahHadir}`
                    )}
                  </td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50">Jumlah Tidak Hadir</td>
                  <td className="p-2">
                    {isEditing ? (
                      <input
                        type="text"
                        value={docContent.jumlahTidakHadir}
                        onChange={(e) => setDocContent({ ...docContent, jumlahTidakHadir: e.target.value })}
                        className="border border-sky-400 px-2 py-0.5 rounded"
                      />
                    ) : (
                      `: ${docContent.jumlahTidakHadir}`
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 font-bold bg-slate-50">Keterangan Tidak Hadir</td>
                  <td className="p-2">
                    {isEditing ? (
                      <input
                        type="text"
                        value={docContent.keteranganTidakHadir}
                        onChange={(e) => setDocContent({ ...docContent, keteranganTidakHadir: e.target.value })}
                        className="w-full border border-sky-400 px-2 py-0.5 rounded"
                      />
                    ) : (
                      `: ${docContent.keteranganTidakHadir}`
                    )}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-xs font-bold block">Catatan Selama Pelaksanaan Ujian:</label>
              {isEditing ? (
                <textarea
                  rows={3}
                  value={docContent.catatanPelaksanaan}
                  onChange={(e) => setDocContent({ ...docContent, catatanPelaksanaan: e.target.value })}
                  className="w-full border border-sky-400 p-2 text-xs rounded"
                />
              ) : (
                <p className="text-xs p-3 bg-slate-50 border border-slate-200 rounded leading-relaxed text-justify">
                  {docContent.catatanPelaksanaan}
                </p>
              )}
            </div>

            {/* Signatures */}
            <div className="pt-8 grid grid-cols-2 gap-8 text-xs text-center">
              <div>
                <p>Mengetahui,</p>
                <p className="font-semibold">Kepala {schoolInfo.namaSekolah}</p>
                <div className="h-20"></div>
                <p className="font-bold underline">{schoolInfo.namaKepalaSekolah}</p>
                <p className="text-[11px]">NIP. {schoolInfo.nipKepalaSekolah}</p>
              </div>

              <div>
                <p>Cimahi, {docContent.hariTanggal}</p>
                <p className="font-semibold">Pengawas Ruang ({selectedRoom})</p>
                <div className="h-20"></div>
                <p className="font-bold underline">{docContent.namaPengawas1}</p>
                <p className="text-[11px]">NIP. {docContent.nipPengawas1}</p>
              </div>
            </div>
          </div>
        )}

        {/* ================= DOC 2: DAFTAR HADIR PESERTA ================= */}
        {selectedDoc === 'daftar_hadir' && (
          <div className="space-y-4">
            <div className="text-center space-y-0.5">
              <h2 className="text-base font-bold uppercase underline">
                DAFTAR HADIR PESERTA UJIAN
              </h2>
              <p className="text-xs text-slate-600">
                Ruang: <strong>{selectedRoom}</strong> · Mata Pelajaran: <strong>{docContent.mataPelajaran}</strong>
              </p>
            </div>

            <table className="w-full text-xs border border-slate-300">
              <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                <tr>
                  <th className="p-2 border-r border-slate-300 w-10 text-center">No</th>
                  <th className="p-2 border-r border-slate-300 w-24 text-center">No. Tempat Duduk</th>
                  <th className="p-2 border-r border-slate-300 text-left">No Peserta</th>
                  <th className="p-2 border-r border-slate-300 text-left">NISN / NIPD</th>
                  <th className="p-2 border-r border-slate-300 text-left">Nama Peserta</th>
                  <th className="p-2 border-r border-slate-300 w-16 text-center">Kelas</th>
                  <th className="p-2 w-32 text-center">Tanda Tangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {studentsInRoom.map((s, idx) => (
                  <tr key={`${s.noPeserta}-${s.nisn || s.nipd || idx}`} className="h-10">
                    <td className="p-2 border-r border-slate-300 text-center">{idx + 1}</td>
                    <td className="p-2 border-r border-slate-300 text-center font-mono font-bold text-sky-800">
                      {s.noTempatDuduk || s.nomorMeja || String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="p-2 border-r border-slate-300 font-mono">{s.noPeserta}</td>
                    <td className="p-2 border-r border-slate-300 font-mono">{s.nisn}</td>
                    <td className="p-2 border-r border-slate-300 font-semibold">{s.nama}</td>
                    <td className="p-2 border-r border-slate-300 text-center">{s.kelas}</td>
                    <td className="p-2 text-center text-slate-300 font-mono text-[10px]">
                      {idx % 2 === 0 ? `${idx + 1}. .........` : `        ${idx + 1}. .........`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pt-6 flex justify-between text-xs">
              <div>
                <p>Keterangan:</p>
                <p>Hadir: <strong>{studentsInRoom.length} Siswa</strong></p>
                <p>Tidak Hadir: <strong>0 Siswa</strong></p>
              </div>
              <div className="text-center">
                <p>Pengawas Ruang,</p>
                <div className="h-16"></div>
                <p className="font-bold underline">{docContent.namaPengawas1}</p>
                <p className="text-[11px]">NIP. {docContent.nipPengawas1}</p>
              </div>
            </div>
          </div>
        )}

        {/* ================= DOC 3: KARTU PESERTA UJIAN ================= */}
        {selectedDoc === 'kartu_peserta' && (
          <div className="space-y-6">
            <div className="no-print pb-2 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">Pilih Kelas untuk Cetak Kartu:</span>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
              >
                {database.classes.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Grid of Student Cards (4 per page) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {studentsInClass.map((s, idx) => (
                <div
                  key={`${s.noPeserta}-${s.nisn || s.nipd || idx}`}
                  className="border-2 border-slate-800 rounded-xl p-4 space-y-3 bg-white text-slate-900"
                >
                  {/* Card Header */}
                  <div className="flex items-center gap-2 border-b border-slate-300 pb-2">
                    <div className="w-8 h-8 rounded bg-sky-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      7
                    </div>
                    <div className="flex-1 text-center">
                      <p className="text-[9px] font-bold uppercase">{schoolInfo.namaSekolah}</p>
                      <p className="text-[10px] font-extrabold uppercase text-sky-800">KARTU PESERTA UJIAN</p>
                      <p className="text-[8px] text-slate-500">TA {schoolInfo.tahunAjaran} · SEMESTER {schoolInfo.semester}</p>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="flex gap-3 text-[11px]">
                    {/* Photo Box */}
                    <div className="w-16 h-20 border border-slate-400 bg-slate-100 flex items-center justify-center text-[9px] text-slate-400 text-center p-1 shrink-0">
                      Foto 2x3
                    </div>

                    <div className="flex-1 space-y-1 leading-tight">
                      <div>
                        <span className="text-slate-500 block text-[9px]">Nomor Peserta:</span>
                        <span className="font-bold font-mono text-xs">{s.noPeserta}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px]">NISN / NIPD:</span>
                        <span className="font-mono">{s.nisn} / {s.nipd}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px]">Nama Lengkap:</span>
                        <span className="font-bold text-xs truncate block">{s.nama}</span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] bg-slate-50 p-1 rounded border border-slate-100">
                        <span>Kelas: <strong>{s.kelas}</strong></span>
                        <span>Ruang: <strong>{s.ruang}</strong></span>
                        <span>No. Duduk: <strong className="text-sky-700 font-mono font-black">{s.noTempatDuduk || s.nomorMeja || String(s.nomorMeja || '01')}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="border-t border-slate-200 pt-1.5 flex items-center justify-between text-[9px]">
                    <div className="font-mono text-slate-500">
                      BAGJA EXAM SECURITY
                    </div>
                    <div className="text-right">
                      <p>Kepala Sekolah,</p>
                      <p className="font-bold">{schoolInfo.namaKepalaSekolah.split(',')[0]}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= DOC 3.5: LABEL / KARTU TEMPAT DUDUK MEJA ================= */}
        {selectedDoc === 'label_meja' && (
          <div className="space-y-6">
            <div className="no-print pb-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-slate-800">Cetak Label Tempat Duduk Meja Peserta</span>
                <p className="text-[11px] text-slate-500">
                  Label meja untuk ditempel di meja ruang ujian · Ruang: <strong>{selectedRoom}</strong>
                </p>
              </div>
              <div className="text-xs font-semibold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200">
                Total {studentsInRoom.length} Meja Terdaftar
              </div>
            </div>

            {studentsInRoom.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                <p className="text-sm font-bold text-slate-600">Belum ada siswa terdaftar di {selectedRoom}</p>
                <p className="text-xs text-slate-400 mt-1">Silakan impor atau tambahkan siswa melalui Menu Smart Import pada Master Siswa.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {studentsInRoom.map((s, idx) => {
                  const seatNo = s.noTempatDuduk || s.nomorMeja || String(idx + 1).padStart(2, '0');
                  return (
                    <div
                      key={`${s.noPeserta}-${s.nisn || s.nipd || idx}`}
                      className="border-2 border-slate-800 rounded-xl p-4 bg-white text-slate-900 shadow-2xs relative print:border-slate-900 print:break-inside-avoid"
                    >
                      {/* Kop Mini Label Meja */}
                      <div className="flex items-center justify-between border-b-2 border-slate-800 pb-2 mb-2.5">
                        <div className="w-9 h-9 shrink-0 flex items-center justify-center">
                          <img
                            src={database.systemConfig.logoPemkot || '/logo-pemda.svg'}
                            alt="Logo Pemkot"
                            className="max-h-9 max-w-9 object-contain"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              if (target.src !== window.location.origin + '/logo-pemda.svg') {
                                target.src = '/logo-pemda.svg';
                              }
                            }}
                          />
                        </div>
                        <div className="text-center flex-1 px-1">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-700 leading-tight">
                            SMP NEGERI 7 CIMAHI
                          </p>
                          <p className="text-[11px] font-black uppercase text-slate-950 leading-tight">
                            KARTU TEMPAT DUDUK PESERTA
                          </p>
                          <p className="text-[8px] text-slate-500 leading-tight">
                            Ruang: <strong>{s.ruang}</strong> · TA {schoolInfo.tahunAjaran}
                          </p>
                        </div>
                        <div className="w-9 h-9 shrink-0 flex items-center justify-center">
                          <img
                            src={database.systemConfig.logoSekolah || '/logo-sekolah.svg'}
                            alt="Logo Sekolah"
                            className="max-h-9 max-w-9 object-contain"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              if (target.src !== window.location.origin + '/logo-sekolah.svg') {
                                target.src = '/logo-sekolah.svg';
                              }
                            }}
                          />
                        </div>
                      </div>

                      {/* Main Seat Badge & Student Data */}
                      <div className="flex items-center gap-3 py-1">
                        {/* Huge Seat Number Badge */}
                        <div className="w-20 h-20 rounded-xl bg-slate-900 text-white flex flex-col items-center justify-center shrink-0 border border-slate-950 shadow-inner">
                          <span className="text-[8px] uppercase tracking-wider font-semibold text-slate-300">
                            NO. MEJA
                          </span>
                          <span className="text-3xl font-mono font-black tracking-tight leading-none text-amber-300">
                            {seatNo}
                          </span>
                          <span className="text-[7px] text-slate-400 mt-0.5 uppercase">
                            DUDUK
                          </span>
                        </div>

                        {/* Student Details */}
                        <div className="flex-1 min-w-0 space-y-1 text-xs">
                          <div>
                            <span className="text-[9px] text-slate-500 uppercase tracking-wide block">Nama Lengkap Peserta:</span>
                            <p className="font-extrabold text-slate-950 text-sm truncate leading-snug">
                              {s.nama}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px] pt-0.5">
                            <div>
                              <span className="text-[9px] text-slate-500 block">No. Peserta:</span>
                              <span className="font-mono font-bold text-sky-800">{s.noPeserta}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-500 block">Kelas:</span>
                              <span className="font-bold text-slate-900">{s.kelas}</span>
                            </div>
                          </div>
                          <div className="text-[10px] text-slate-600 font-mono">
                            NISN: {s.nisn} {s.nipd ? `· NIPD: ${s.nipd}` : ''}
                          </div>
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="border-t border-dashed border-slate-300 mt-2.5 pt-1.5 flex items-center justify-between text-[8px] text-slate-500">
                        <span>BAGJA EXAM · INTEGRITAS UJIAN</span>
                        <span className="font-mono font-bold">TEMPEL DI MEJA</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= DOC 3.8: JADWAL TUGAS PENGAWASAN ================= */}
        {selectedDoc === 'jadwal_pengawas' && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-base font-black text-slate-900 uppercase tracking-wide">
                JADWAL PENGAWASAN ASESMEN / UJIAN SEKOLAH
              </h2>
              <p className="text-xs text-slate-700 font-semibold uppercase">
                TAHUN AJARAN {schoolInfo.tahunAjaran} · SEMESTER {schoolInfo.semester}
              </p>
            </div>

            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
                  <tr>
                    <th className="p-2 border-r border-slate-300 w-10 text-center">No</th>
                    <th className="p-2 border-r border-slate-300 w-28">Hari / Tanggal</th>
                    <th className="p-2 border-r border-slate-300 w-28">Waktu / Sesi</th>
                    <th className="p-2 border-r border-slate-300">Mata Pelajaran</th>
                    <th className="p-2 border-r border-slate-300 w-24">Ruang</th>
                    <th className="p-2 border-r border-slate-300">Nama Pengawas Utama (1)</th>
                    <th className="p-2 border-r border-slate-300">Nama Pengawas (2)</th>
                    <th className="p-2 w-20 text-center">Paraf</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(!database.supervisionDuties || database.supervisionDuties.length === 0) ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-500 italic">
                        Belum ada jadwal tugas pengawasan yang diatur di sistem. Silakan atur melalui menu Jadwal Pengawasan di panel admin.
                      </td>
                    </tr>
                  ) : (
                    database.supervisionDuties.map((d, idx) => (
                      <tr key={d.id || idx} className="hover:bg-slate-50">
                        <td className="p-2 border-r border-slate-300 text-center font-mono">{idx + 1}</td>
                        <td className="p-2 border-r border-slate-300 font-medium">{d.date}</td>
                        <td className="p-2 border-r border-slate-300 font-mono text-[11px]">{d.startTime} - {d.endTime}</td>
                        <td className="p-2 border-r border-slate-300 font-bold text-slate-900">{d.subject}</td>
                        <td className="p-2 border-r border-slate-300 font-semibold">{d.room}</td>
                        <td className="p-2 border-r border-slate-300">
                          <div className="font-bold">{d.supervisorNama}</div>
                          <div className="text-[10px] text-slate-500 font-mono">NIP. {d.supervisorNip}</div>
                        </td>
                        <td className="p-2 border-r border-slate-300">
                          {d.supervisorNama2 ? (
                            <>
                              <div className="font-bold">{d.supervisorNama2}</div>
                              <div className="text-[10px] text-slate-500 font-mono">NIP. {d.supervisorNip2 || '-'}</div>
                            </>
                          ) : (
                            <span className="text-slate-400 italic">-</span>
                          )}
                        </td>
                        <td className="p-2 text-center text-slate-300">......</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Catatan Pelaksanaan Pengawasan */}
            <div className="text-[11px] text-slate-700 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <p className="font-bold">Ketentuan Pengawasan Ruang:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-slate-600">
                <li>Pengawas hadir di ruang ujian 15 menit sebelum waktu pengerjaan dimulai.</li>
                <li>Pengawas memastikan seluruh gawai siswa terkunci dalam mode kiosk ujian BAGJA EXAM.</li>
                <li>Pengawas menyampaikan token rotasi ujian yang aktif di dasbor pengawas kepada siswa.</li>
                <li>Pengawas menandatangani berita acara dan daftar hadir pada akhir sesi pelaksanaan.</li>
              </ol>
            </div>

            {/* Official Signatures */}
            <div className="pt-6 grid grid-cols-2 gap-8 text-xs text-center">
              <div>
                <p>Mengetahui,</p>
                <p className="font-semibold">Kepala {schoolInfo.namaSekolah}</p>
                <div className="h-16"></div>
                <p className="font-bold underline">{schoolInfo.namaKepalaSekolah}</p>
                <p className="text-[11px]">NIP. {schoolInfo.nipKepalaSekolah}</p>
              </div>

              <div>
                <p>Cimahi, {docContent.hariTanggal}</p>
                <p className="font-semibold">Ketua Pelaksana Ujian</p>
                <div className="h-16"></div>
                <p className="font-bold underline">{schoolInfo.namaKetuaPelaksana}</p>
                <p className="text-[11px]">NIP. {schoolInfo.nipKetuaPelaksana}</p>
              </div>
            </div>
          </div>
        )}

        {/* ================= DOC 4: REKAPITULASI LOG INTEGRITAS ================= */}
        {selectedDoc === 'log_integritas' && (
          <div className="space-y-4">
            <div className="text-center space-y-0.5">
              <h2 className="text-base font-bold uppercase underline">
                REKAPITULASI BUKTI DIGITAL LOG INTEGRITAS UJIAN
              </h2>
              <p className="text-xs text-slate-600">
                Pencatatan Otomatis Perilaku Ujian Siswa · Ruang: <strong>{selectedRoom}</strong>
              </p>
            </div>

            <table className="w-full text-xs border border-slate-300">
              <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                <tr>
                  <th className="p-2 border-r border-slate-300 w-10 text-center">No</th>
                  <th className="p-2 border-r border-slate-300 text-left">Waktu Kejadian</th>
                  <th className="p-2 border-r border-slate-300 text-left">No Peserta</th>
                  <th className="p-2 border-r border-slate-300 text-left">Nama Siswa</th>
                  <th className="p-2 border-r border-slate-300 text-left">Jenis Pelanggaran</th>
                  <th className="p-2 text-left">Keterangan / Detil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(database.integrityLogs || [])
                  .filter(l => l.ruang === selectedRoom)
                  .map((log, idx) => (
                    <tr key={log.id}>
                      <td className="p-2 border-r border-slate-300 text-center">{idx + 1}</td>
                      <td className="p-2 border-r border-slate-300 font-mono text-[10px]">
                        {new Date(log.timestamp).toLocaleTimeString('id-ID')} WIB
                      </td>
                      <td className="p-2 border-r border-slate-300 font-mono">{log.noPeserta}</td>
                      <td className="p-2 border-r border-slate-300 font-semibold">{log.nama}</td>
                      <td className="p-2 border-r border-slate-300 font-bold text-rose-700">{log.type}</td>
                      <td className="p-2 text-[11px] text-slate-600">{log.details}</td>
                    </tr>
                  ))}
                {(database.integrityLogs || []).filter(l => l.ruang === selectedRoom).length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-400 italic">
                      Nihil - Tidak tercatat adanya pelanggaran integritas di {selectedRoom}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="pt-6 text-right text-xs">
              <p>Cimahi, {docContent.hariTanggal}</p>
              <p className="font-semibold">Petugas Verifikasi Log,</p>
              <div className="h-16"></div>
              <p className="font-bold underline">{docContent.namaPengawas1}</p>
            </div>
          </div>
        )}

        {/* ================= DOC 5: DENAH DUDUK RUANGAN ================= */}
        {selectedDoc === 'denah_duduk' && (
          <div className="space-y-6">
            <div className="text-center border-b border-slate-300 pb-3 space-y-1">
              <h2 className="text-base font-bold uppercase underline">
                DENAH TATA LETAK TEMPAT DUDUK PESERTA UJIAN
              </h2>
              <p className="text-xs text-slate-600">
                {schoolInfo.namaSekolah} · {selectedRoom}
              </p>
            </div>

            {/* Front Stage / Supervisor Desk */}
            <div className="w-1/2 mx-auto py-2 bg-slate-200 border-2 border-slate-400 rounded-lg text-center font-bold text-xs uppercase tracking-wider text-slate-700">
              MEJA PENGAWAS RUANG & PAPAN TULIS
            </div>

            {/* Dynamic Seating Layout according to room capacity (Max 44 for Ruang, Max 120 for Lab) */}
            {(() => {
              const maxCap = getRoomMaxCapacity(selectedRoom);
              const isLab = isComputerLab(selectedRoom);
              // Tampilkan setidaknya sejumlah siswa yang ada, atau minimal 20 meja, maks sesuai maxCap
              const seatsToRender = Math.min(maxCap, Math.max(studentsInRoom.length, isLab ? 40 : 44));
              const gridColsClass = isLab ? 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6' : 'grid-cols-4';

              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                    <span>
                      Daya Tampung: <strong>{studentsInRoom.length}</strong> / {maxCap} Siswa ({isLab ? 'Lab Komputer' : 'Ruang Kelas'})
                    </span>
                    <span>Format: {isLab ? 'Lab Komputer' : '4 Kolom × 11 Baris'}</span>
                  </div>

                  <div className={`grid ${gridColsClass} gap-3 py-3`}>
                    {Array.from({ length: seatsToRender }).map((_, seatIdx) => {
                      const assignedStudent = studentsInRoom[seatIdx];
                      return (
                        <div
                          key={seatIdx}
                          className="border-2 border-dashed border-slate-300 rounded-xl p-2.5 text-center space-y-1 bg-slate-50 min-h-[85px] flex flex-col justify-center"
                        >
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase px-0.5 pb-0.5">
                            <span>M-{seatIdx + 1}</span>
                            <span className="text-[9px] font-mono text-sky-800 bg-sky-100 px-1 rounded font-extrabold">
                              {assignedStudent?.noTempatDuduk || assignedStudent?.nomorMeja || String(seatIdx + 1).padStart(2, '0')}
                            </span>
                          </div>
                          {assignedStudent ? (
                            <>
                              <p className="text-[11px] font-bold text-slate-900 truncate leading-tight">
                                {assignedStudent.nama}
                              </p>
                              <p className="text-[9px] font-mono text-slate-500">
                                {assignedStudent.noPeserta}
                              </p>
                              <p className="text-[9px] font-semibold text-sky-700">
                                Kelas {assignedStudent.kelas}
                              </p>
                            </>
                          ) : (
                            <p className="text-[10px] text-slate-400 italic">Kosong</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div className="pt-4 text-xs text-slate-500 text-center border-t border-slate-200">
              Pintu Masuk Ruangan berada di sisi kanan depan. Siswa menempati meja sesuai nomor urut peserta.
            </div>
          </div>
        )}

        {/* ================= DOC 6: TATA TERTIB & PAKTA INTEGRITAS ================= */}
        {selectedDoc === 'tata_tertib' && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-base font-bold uppercase underline">
                TATA TERTIB & PAKTA INTEGRITAS PESERTA UJIAN
              </h2>
              <p className="text-xs text-slate-600">
                Sistem Pengamanan Layar Terkunci BAGJA EXAM · {schoolInfo.namaSekolah}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold block text-slate-700">Isi Tata Tertib & Aturan:</label>
              {isEditing ? (
                <textarea
                  rows={8}
                  value={docContent.tataTertibText}
                  onChange={(e) => setDocContent({ ...docContent, tataTertibText: e.target.value })}
                  className="w-full border border-sky-400 p-3 text-xs rounded-xl font-mono leading-relaxed"
                />
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs leading-loose whitespace-pre-line text-justify">
                  {docContent.tataTertibText}
                </div>
              )}
            </div>

            {/* Integrity Declaration */}
            <div className="border border-sky-200 bg-sky-50/50 p-4 rounded-xl text-xs space-y-2">
              <h4 className="font-extrabold text-sky-950 uppercase tracking-wide">
                PERNYATAAN PAKTA INTEGRITAS SISWA:
              </h4>
              <p className="text-slate-700 leading-relaxed text-justify">
                "Saya menyatakan dengan sungguh-sungguh bahwa saya akan mengerjakan ujian ini secara jujur, mandiri, tanpa bantuan aplikasi pihak ketiga, orang lain, maupun membuka tab peramban terlarang. Saya siap menerima sanksi pembatalan nilai apabila sistem BAGJA EXAM membuktikan adanya pelanggaran integritas."
              </p>
            </div>

            <div className="pt-6 grid grid-cols-2 gap-8 text-xs text-center">
              <div>
                <p>Menyetujui,</p>
                <p className="font-semibold">Kepala {schoolInfo.namaSekolah}</p>
                <div className="h-16"></div>
                <p className="font-bold underline">{schoolInfo.namaKepalaSekolah}</p>
                <p className="text-[11px]">NIP. {schoolInfo.nipKepalaSekolah}</p>
              </div>

              <div>
                <p>Cimahi, {docContent.hariTanggal}</p>
                <p className="font-semibold">Perwakilan Peserta Ujian</p>
                <div className="h-16"></div>
                <p className="font-bold underline">( ............................................ )</p>
                <p className="text-[11px]">NISN / Nomor Peserta</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
