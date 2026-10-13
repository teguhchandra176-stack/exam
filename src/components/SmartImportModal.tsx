import React, { useState, useId } from 'react';
import {
  X,
  FileSpreadsheet,
  Upload,
  ClipboardCheck,
  CheckCircle2,
  AlertCircle,
  Download,
  Copy,
  Layers,
  Sparkles,
  HelpCircle,
  RefreshCw,
  Database,
  ArrowRight
} from 'lucide-react';
import { DatabaseSchema, Student, Supervisor } from '../types';
import { validateBatchRoomCapacities } from '../services/roomCapacity';

interface SmartImportModalProps {
  type: 'students' | 'supervisors';
  isOpen: boolean;
  onClose: () => void;
  database: DatabaseSchema;
  onSaveDatabase: (newDb: DatabaseSchema, actionName: string, actionDetails: string) => Promise<boolean>;
  onRefreshDatabase: () => Promise<void>;
}

export const SmartImportModal: React.FC<SmartImportModalProps> = ({
  type,
  isOpen,
  onClose,
  database,
  onSaveDatabase,
  onRefreshDatabase,
}) => {
  const fileInputId = useId();
  const [activeInputTab, setActiveInputTab] = useState<'paste' | 'file'>('paste');
  const [rawText, setRawText] = useState<string>('');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [copiedTemplate, setCopiedTemplate] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  if (!isOpen) return null;

  // Integrated template specifications & samples
  const studentTemplateHeaders = ['No Peserta', 'NISN', 'NIPD', 'Nama Siswa', 'Kelas', 'Ruang', 'No Tempat Duduk'];
  const studentSampleRows = [
    '26-07-001-01;0091234561;242507001;Ahmad Fauzi Pratama;7-A;Lab Komputer;01',
    '26-07-001-02;0091234562;242507002;Alya Putri Ramadhani;7-A;Lab Komputer;02',
    '26-07-001-03;0091234563;242507003;Bima Arya Wibowo;7-A;Lab Komputer;03',
    '26-07-002-01;0091234564;242507004;Cantika Dewi Lestari;7-B;Ruang 01;01',
  ];

  const supervisorTemplateHeaders = ['NIP/NUPTK', 'Nama Lengkap', 'PIN / Password'];
  const supervisorSampleRows = [
    '198005122005011002;Drs. H. Bambang Suherman, M.Pd.;777001',
    '198403152008012004;Siti Nurhaliza, S.Pd.;777002',
    '197908202006041008;Asep Kurniawan, M.T.;777003',
  ];

  // Helper to trigger CSV download
  const handleDownloadTemplate = () => {
    if (type === 'students') {
      const csv = studentTemplateHeaders.join(';') + '\n' + studentSampleRows.join('\n') + '\n';
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Template_Smart_Import_Siswa_SMPN7.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const csv = supervisorTemplateHeaders.join(';') + '\n' + supervisorSampleRows.join('\n') + '\n';
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Template_Smart_Import_Pengawas_SMPN7.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Helper to copy template sample to clipboard
  const handleCopyTemplate = () => {
    const text = type === 'students'
      ? studentTemplateHeaders.join('\t') + '\n' + studentSampleRows.map(r => r.replace(/;/g, '\t')).join('\n')
      : supervisorTemplateHeaders.join('\t') + '\n' + supervisorSampleRows.map(r => r.replace(/;/g, '\t')).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2500);
  };

  // Handle File Upload reading
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
        setActiveInputTab('paste');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Smart Parser Engine
  const parseRows = (): {
    students: Student[];
    supervisors: Supervisor[];
    totalParsed: number;
    warnings: string[];
  } => {
    const lines = rawText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length === 0) {
      return { students: [], supervisors: [], totalParsed: 0, warnings: [] };
    }

    // Detect delimiter (; , \t |)
    const detectDelimiter = (line: string): string => {
      const countTabs = (line.match(/\t/g) || []).length;
      const countSemis = (line.match(/;/g) || []).length;
      const countCommas = (line.match(/,/g) || []).length;
      const countPipes = (line.match(/\|/g) || []).length;

      if (countTabs >= countSemis && countTabs >= countCommas && countTabs >= countPipes && countTabs > 0) return '\t';
      if (countSemis >= countCommas && countSemis >= countPipes && countSemis > 0) return ';';
      if (countPipes >= countCommas && countPipes > 0) return '|';
      return ',';
    };

    const firstLine = lines[0];
    const delimiter = detectDelimiter(firstLine);

    // Split line into cells respecting quotes
    const splitLine = (str: string, delim: string): string[] => {
      const parts: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === delim && !inQuotes) {
          parts.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      parts.push(current.trim().replace(/^["']|["']$/g, ''));
      return parts;
    };

    const cleanCell = (val: unknown): string => {
      if (val === undefined || val === null) return '';
      return String(val).trim();
    };

    const parsedLines = lines.map(l => splitLine(l, delimiter));
    if (parsedLines.length === 0 || !parsedLines[0]) {
      return { students: [], supervisors: [], totalParsed: 0, warnings: [] };
    }

    const firstRowLower = parsedLines[0].map(c => cleanCell(c).toLowerCase());

    // Check if first row is a header
    const isStudentHeader = firstRowLower.some(c =>
      c.includes('peserta') || c.includes('nisn') || c.includes('nama') || c.includes('kelas')
    );
    const isSupervisorHeader = firstRowLower.some(c =>
      c.includes('nip') || c.includes('nama') || c.includes('pengawas') || c.includes('ruang')
    );

    const isHeaderRow = type === 'students' ? isStudentHeader : isSupervisorHeader;
    const dataRows = isHeaderRow ? parsedLines.slice(1) : parsedLines;

    // Header index mapping
    const colMap: Record<string, number> = {};
    if (isHeaderRow) {
      firstRowLower.forEach((col, idx) => {
        if (col.includes('peserta') || col.includes('ujian')) colMap['noPeserta'] = idx;
        else if (col.includes('nisn')) colMap['nisn'] = idx;
        else if (col.includes('nipd') || col.includes('nis')) colMap['nipd'] = idx;
        else if (col.includes('nama') || col.includes('siswa')) colMap['nama'] = idx;
        else if (col.includes('kelas') || col.includes('rombel')) colMap['kelas'] = idx;
        else if (col.includes('ruang')) colMap['ruang'] = idx;
        else if (col.includes('meja') || col.includes('duduk') || col.includes('seat')) colMap['noTempatDuduk'] = idx;
        else if (col.includes('nip') || col.includes('nuptk') || col.includes('id')) colMap['nip'] = idx;
        else if (col.includes('pin') || col.includes('pass')) colMap['pin'] = idx;
      });
    }

    const warnings: string[] = [];
    const studentsResult: Student[] = [];
    const supervisorsResult: Supervisor[] = [];
    const seenNoPeserta = new Set<string>();
    const seenNip = new Set<string>();

    dataRows.forEach((row, rowIdx) => {
      if (!row || row.length === 0 || row.every(c => cleanCell(c).length === 0)) return;

      const getCell = (colKey: string, fallbackIdx: number, defaultVal: string = ''): string => {
        const mappedIdx = colMap[colKey];
        if (mappedIdx !== undefined && mappedIdx >= 0 && mappedIdx < row.length) {
          const val = cleanCell(row[mappedIdx]);
          if (val.length > 0) return val;
        }
        if (fallbackIdx >= 0 && fallbackIdx < row.length) {
          const val = cleanCell(row[fallbackIdx]);
          if (val.length > 0) return val;
        }
        return defaultVal;
      };

      if (type === 'students') {
        let noPeserta = getCell('noPeserta', 0, `26-02-05-007-${String(rowIdx + 1).padStart(4, '0')}`);
        if (!noPeserta || noPeserta === '26-02-05-007-' || noPeserta.endsWith('-')) {
          noPeserta = `26-02-05-007-${String(rowIdx + 1).padStart(4, '0')}`;
        }
        if (seenNoPeserta.has(noPeserta)) {
          noPeserta = `${noPeserta}-${String(rowIdx + 1).padStart(3, '0')}`;
        }
        seenNoPeserta.add(noPeserta);

        const nisn = getCell('nisn', 1, `009${String(rowIdx + 1).padStart(7, '0')}`);
        const nipd = getCell('nipd', 2, `2425${String(rowIdx + 1).padStart(5, '0')}`);
        const nama = getCell('nama', 3, `Siswa Peserta ${rowIdx + 1}`);
        const kelas = getCell('kelas', 4, '7-A');
        const ruang = getCell('ruang', 5, 'Lab Komputer');
        const noTempatDuduk = getCell('noTempatDuduk', 6, String(rowIdx + 1).padStart(2, '0'));

        if (!noPeserta || !nama) {
          warnings.push(`Baris ${rowIdx + 1}: Nama atau Nomor Peserta kosong.`);
          return;
        }

        studentsResult.push({
          noPeserta,
          nisn,
          nipd,
          nama,
          kelas,
          ruang,
          noTempatDuduk,
          nomorMeja: noTempatDuduk,
          status: 'Belum Masuk',
          violationsCount: 0,
          lastActive: null,
          deviceType: 'Komputer',
          answersSummary: { answered: 0, total: 40 }
        });
      } else {
        let nip = getCell('nip', 0, `198000${String(rowIdx + 1).padStart(6, '0')}`);
        if (seenNip.has(nip)) {
          nip = `${nip}-${rowIdx + 1}`;
        }
        seenNip.add(nip);

        const nama = getCell('nama', 1, `Pengawas ${rowIdx + 1}`);
        const pin = getCell('pin', 2, '777001');

        if (!nip || !nama) {
          warnings.push(`Baris ${rowIdx + 1}: NIP atau Nama Pengawas kosong.`);
          return;
        }

        supervisorsResult.push({
          nip,
          nama,
          pin
        });
      }
    });

    return {
      students: studentsResult,
      supervisors: supervisorsResult,
      totalParsed: type === 'students' ? studentsResult.length : supervisorsResult.length,
      warnings
    };
  };

  const parsedData = parseRows();

  // Execute Import
  const handleExecuteImport = async () => {
    if (parsedData.totalParsed === 0) {
      alert('Peringatan: Tidak ada data yang berhasil diparsing. Silakan tempel data atau unggah file sesuai format template.');
      return;
    }

    setIsProcessing(true);
    try {
      if (type === 'students') {
        const newStudents = parsedData.students;

        // Validasi Kapasitas Ruangan (Maks 44 Siswa per Ruang, Maks 120 Siswa per Lab Komputer)
        const capacityValidation = validateBatchRoomCapacities(
          database.students || [],
          newStudents,
          importMode
        );

        if (!capacityValidation.isValid) {
          const firstThreeErrors = capacityValidation.violations
            .slice(0, 3)
            .map(v => `• ${v.errorMessage}`)
            .join('\n');
          const moreCount = capacityValidation.violations.length - 3;
          const moreText = moreCount > 0 ? `\n...dan ${moreCount} ruangan lainnya.` : '';

          alert(
            `❌ Gagal Impor Data: Batas Kapasitas Ruangan Terlampaui!\n\n` +
            `Aturan sistem: Maksimal Ruang Kelas adalah 44 siswa dan Maksimal Lab Komputer adalah 120 siswa.\n\n` +
            `${firstThreeErrors}${moreText}\n\n` +
            `Silakan periksa dan kurangi pembagian siswa pada ruangan terkait sebelum mengimpor.`
          );
          setIsProcessing(false);
          return;
        }

        const currentStudents = database.students || [];
        const updatedStudents = importMode === 'replace'
          ? newStudents
          : [
              ...currentStudents.filter(s => !newStudents.some(n => n.noPeserta === s.noPeserta)),
              ...newStudents
            ];

        // Also auto-register any new classes or rooms if not present
        const currentClasses = database.classes || [];
        const currentRooms = database.rooms || [];
        const newClasses = Array.from(new Set([...currentClasses, ...newStudents.map(s => s.kelas)])).filter(Boolean);
        const newRooms = Array.from(new Set([...currentRooms, ...newStudents.map(s => s.ruang)])).filter(Boolean);

        const updatedDb: DatabaseSchema = {
          ...database,
          students: updatedStudents,
          classes: newClasses,
          rooms: newRooms
        };

        const success = await onSaveDatabase(
          updatedDb,
          'Smart Import Siswa',
          `Smart Import: ${newStudents.length} peserta siswa berhasil diimpor (${importMode === 'replace' ? 'Mode Gantikan Seluruh Data' : 'Mode Tambahkan'}).`
        );

        if (success) {
          await onRefreshDatabase();
          alert(`Berhasil! ${newStudents.length} data peserta siswa telah disimpan ke sistem BAGJA EXAM.`);
          onClose();
        } else {
          alert('Gagal menyimpan ke server backend. Periksa koneksi data.');
        }
      } else {
        const newSupervisors = parsedData.supervisors;
        const currentSupervisors = database.supervisors || [];
        const updatedSupervisors = importMode === 'replace'
          ? newSupervisors
          : [
              ...currentSupervisors.filter(s => !newSupervisors.some(n => n.nip === s.nip)),
              ...newSupervisors
            ];

        const updatedDb: DatabaseSchema = {
          ...database,
          supervisors: updatedSupervisors
        };

        const success = await onSaveDatabase(
          updatedDb,
          'Smart Import Pengawas',
          `Smart Import: ${newSupervisors.length} data master pengawas berhasil diimpor (${importMode === 'replace' ? 'Mode Gantikan Seluruh Data' : 'Mode Tambahkan'}).`
        );

        if (success) {
          await onRefreshDatabase();
          alert(`Berhasil! ${newSupervisors.length} data master pengawas telah disimpan ke sistem BAGJA EXAM.`);
          onClose();
        } else {
          alert('Gagal menyimpan ke server backend. Periksa koneksi data.');
        }
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat memproses data import.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-sky-600 via-sky-700 to-indigo-700 text-white shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg">
                  Smart Import Master {type === 'students' ? 'Siswa Peserta' : 'Data Pengawas'}
                </h3>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Terintegrasi
                </span>
              </div>
              <p className="text-xs text-sky-100 mt-0.5">
                Impor cerdas cepat dari file Excel, Google Sheets, CSV, atau salin-tempel langsung tabel data.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs">
          {/* SECTION 1: INTEGRATED TEMPLATE & SPECIFICATION */}
          <div className="bg-gradient-to-br from-sky-50 via-indigo-50/40 to-slate-50 p-4 rounded-2xl border border-sky-200/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-sky-700 shrink-0" />
                <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                  Format Template Resmi & Kebutuhan Data Sistem
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh File Template CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyTemplate}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 text-xs"
                >
                  {copiedTemplate ? (
                    <>
                      <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Salin Contoh Template</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Column badges breakdown */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-600">Urutan Kolom Data yang Terintegrasi:</span>
              <div className="flex flex-wrap gap-1.5">
                {type === 'students' ? (
                  <>
                    <span className="px-2 py-0.5 bg-white border border-sky-300 text-sky-900 rounded-lg font-mono font-bold">1. No Peserta*</span>
                    <span className="px-2 py-0.5 bg-white border border-sky-300 text-sky-900 rounded-lg font-mono font-bold">2. NISN*</span>
                    <span className="px-2 py-0.5 bg-white border border-sky-300 text-sky-900 rounded-lg font-mono font-bold">3. NIPD</span>
                    <span className="px-2 py-0.5 bg-white border border-sky-300 text-sky-900 rounded-lg font-mono font-bold">4. Nama Lengkap*</span>
                    <span className="px-2 py-0.5 bg-white border border-sky-300 text-sky-900 rounded-lg font-mono font-bold">5. Kelas*</span>
                    <span className="px-2 py-0.5 bg-white border border-sky-300 text-sky-900 rounded-lg font-mono font-bold">6. Ruang Ujian*</span>
                    <span className="px-2 py-0.5 bg-white border border-emerald-300 text-emerald-900 rounded-lg font-mono font-bold">7. No Tempat Duduk</span>
                  </>
                ) : (
                  <>
                    <span className="px-2 py-0.5 bg-white border border-sky-300 text-sky-900 rounded-lg font-mono font-bold">1. NIP / NUPTK*</span>
                    <span className="px-2 py-0.5 bg-white border border-sky-300 text-sky-900 rounded-lg font-mono font-bold">2. Nama Lengkap & Gelar*</span>
                    <span className="px-2 py-0.5 bg-white border border-sky-300 text-sky-900 rounded-lg font-mono font-bold">3. PIN / Password Masuk*</span>
                  </>
                )}
              </div>
              <p className="text-[10px] text-slate-500 italic">
                * Kolom wajib. Sistem secara otomatis mendeteksi pemisah Titik Koma (;), Tab Excel (\t), atau Koma (,).
              </p>
            </div>
          </div>

          {/* SECTION 2: INPUT METHOD SELECTION */}
          <div className="space-y-3">
            <div className="flex border-b border-slate-200 gap-4">
              <button
                type="button"
                onClick={() => setActiveInputTab('paste')}
                className={`pb-2.5 font-bold transition-all text-xs flex items-center gap-1.5 border-b-2 ${
                  activeInputTab === 'paste'
                    ? 'border-sky-600 text-sky-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>Metode 1: Salin-Tempel dari Excel / Sheets (Rekomendasi Cepat)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveInputTab('file')}
                className={`pb-2.5 font-bold transition-all text-xs flex items-center gap-1.5 border-b-2 ${
                  activeInputTab === 'file'
                    ? 'border-sky-600 text-sky-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Metode 2: Unggah File CSV / TXT</span>
              </button>
            </div>

            {activeInputTab === 'paste' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-600 font-semibold">
                  <span>Tempelkan data tabel di bawah ini (Ctrl + V):</span>
                  {rawText && (
                    <button
                      type="button"
                      onClick={() => setRawText('')}
                      className="text-rose-600 hover:text-rose-800 font-bold"
                    >
                      Bersihkan Kotak
                    </button>
                  )}
                </div>
                <textarea
                  rows={6}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={
                    type === 'students'
                      ? `Contoh:\n26-07-001-01\t0091234561\t242507001\tAhmad Fauzi Pratama\t7-A\tLab Komputer\t01\n26-07-001-02\t0091234562\t242507002\tAlya Putri Ramadhani\t7-A\tLab Komputer\t02`
                      : `Contoh:\n198005122005011002\tDrs. H. Bambang Suherman, M.Pd.\t777001\n198403152008012004\tSiti Nurhaliza, S.Pd.\t777002`
                  }
                  className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white leading-relaxed resize-y"
                />
              </div>
            ) : (
              <div className="p-8 border-2 border-dashed border-sky-200 rounded-2xl bg-sky-50/30 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <label
                    htmlFor={fileInputId}
                    className="inline-block px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-xs cursor-pointer transition-colors"
                  >
                    Pilih File CSV / TXT dari Komputer
                  </label>
                  <input
                    id={fileInputId}
                    type="file"
                    accept=".csv,.txt,.tsv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <p className="text-slate-500 text-[11px] mt-2">Mendukung format .csv (titik koma / koma) atau .txt (tab delimited)</p>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: PARSING RESULT & LIVE PREVIEW */}
          {parsedData.totalParsed > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 p-3 rounded-2xl">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-extrabold text-emerald-950 text-xs">
                      Smart Parser Berhasil Mendeteksi {parsedData.totalParsed} Baris Data
                    </span>
                    <p className="text-[10px] text-emerald-700">
                      Seluruh kolom telah dipetakan secara otomatis sesuai standar sistem BAGJA EXAM.
                    </p>
                  </div>
                </div>

                {/* Import Strategy Options */}
                <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl border border-emerald-200">
                  <span className="text-[10px] font-bold text-slate-600">Strategi:</span>
                  <label className="flex items-center gap-1 cursor-pointer text-[11px] font-bold text-slate-700">
                    <input
                      type="radio"
                      name="importMode"
                      value="append"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="accent-sky-600"
                    />
                    <span>Tambahkan (Append)</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer text-[11px] font-bold text-rose-700 ml-2">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="accent-rose-600"
                    />
                    <span>Gantikan Semua</span>
                  </label>
                </div>
              </div>

              {/* Room Capacity Validation Banner for Students */}
              {type === 'students' && (() => {
                const capCheck = validateBatchRoomCapacities(database.students || [], parsedData.students, importMode);
                if (!capCheck.isValid) {
                  return (
                    <div className="p-3 bg-rose-50 border border-rose-300 rounded-2xl text-rose-900 text-xs space-y-1.5">
                      <div className="flex items-center gap-2 font-black text-rose-700">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                        <span>Peringatan Kapasitas Ruangan Terlampaui (Maks 44 Siswa/Ruang, Maks 120 Siswa/Lab)</span>
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-800">
                        {capCheck.violations.map((v, i) => (
                          <li key={i}>{v.errorMessage}</li>
                        ))}
                      </ul>
                    </div>
                  );
                }
                return (
                  <div className="p-2.5 bg-sky-50/70 border border-sky-200 rounded-xl text-sky-900 text-[11px] flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                      Validasi Kapasitas Ruang: Memenuhi batas standar (Maks Ruang Kelas: 44 siswa, Maks Lab Komputer: 120 siswa).
                    </span>
                  </div>
                );
              })()}

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs max-h-52 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700 sticky top-0">
                    {type === 'students' ? (
                      <tr>
                        <th className="p-2 w-8 text-center">No</th>
                        <th className="p-2">No. Peserta</th>
                        <th className="p-2">NISN</th>
                        <th className="p-2">Nama Siswa</th>
                        <th className="p-2 w-16">Kelas</th>
                        <th className="p-2">Ruang</th>
                        <th className="p-2 w-20 text-center">No. Duduk</th>
                      </tr>
                    ) : (
                      <tr>
                        <th className="p-2 w-8 text-center">No</th>
                        <th className="p-2">NIP / NUPTK</th>
                        <th className="p-2">Nama Lengkap</th>
                        <th className="p-2 text-center">PIN</th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {type === 'students'
                      ? parsedData.students.slice(0, 50).map((s, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80">
                            <td className="p-2 text-center text-slate-400">{idx + 1}</td>
                            <td className="p-2 font-mono font-bold text-sky-800">{s.noPeserta}</td>
                            <td className="p-2 font-mono text-slate-600">{s.nisn}</td>
                            <td className="p-2 font-semibold text-slate-900">{s.nama}</td>
                            <td className="p-2 font-bold text-slate-700">{s.kelas}</td>
                            <td className="p-2 text-slate-600">{s.ruang}</td>
                            <td className="p-2 text-center font-mono font-bold text-sky-700">{s.noTempatDuduk}</td>
                          </tr>
                        ))
                      : parsedData.supervisors.slice(0, 50).map((sup, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80">
                            <td className="p-2 text-center text-slate-400">{idx + 1}</td>
                            <td className="p-2 font-mono font-bold text-sky-800">{sup.nip}</td>
                            <td className="p-2 font-semibold text-slate-900">{sup.nama}</td>
                            <td className="p-2 text-center font-mono font-bold text-slate-700">{sup.pin}</td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
              {parsedData.totalParsed > 50 && (
                <p className="text-[10px] text-slate-400 text-center italic">
                  Menampilkan 50 baris pertama dari total {parsedData.totalParsed} baris.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between">
          <div className="text-slate-500 text-[11px]">
            {parsedData.totalParsed > 0 ? (
              <span className="font-bold text-slate-800">
                {parsedData.totalParsed} Data Siap Diimpor
              </span>
            ) : (
              <span>Tempel data atau unggah file untuk melihat pratinjau</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-200 transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={isProcessing || parsedData.totalParsed === 0}
              className={`px-5 py-2 font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 ${
                parsedData.totalParsed > 0
                  ? 'bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Impor Sekarang ({parsedData.totalParsed} Data)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
