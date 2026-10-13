import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  UserCheck,
  Users,
  Plus,
  Trash2,
  Edit3,
  Sparkles,
  Filter,
  Search,
  Download,
  Printer,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Layers,
  Briefcase,
  X,
  FileSpreadsheet,
  ChevronDown,
  LayoutGrid,
  Table as TableIcon,
  ShieldCheck,
  CalendarCheck,
  DoorOpen,
  ArrowRight
} from 'lucide-react';
import { DatabaseSchema, SupervisionDuty, Supervisor, Schedule } from '../types';

interface JadwalPengawasanManagerProps {
  database: DatabaseSchema;
  onSaveDatabase: (newDb: DatabaseSchema, actionName: string, actionDetails: string) => Promise<boolean>;
  onRefreshDatabase: () => Promise<void>;
  onNavigateToPrintStudio?: () => void;
}

export const JadwalPengawasanManager: React.FC<JadwalPengawasanManagerProps> = ({
  database,
  onSaveDatabase,
  onRefreshDatabase,
  onNavigateToPrintStudio,
}) => {
  const supervisionDuties = useMemo(() => database.supervisionDuties || [], [database.supervisionDuties]);
  const supervisors = useMemo(() => database.supervisors || [], [database.supervisors]);
  const schedules = useMemo(() => database.schedules || [], [database.schedules]);
  const rooms = useMemo(() => database.rooms || [], [database.rooms]);

  // View state: 'table' | 'by_room' | 'by_supervisor'
  const [activeView, setActiveView] = useState<'table' | 'by_room' | 'by_supervisor'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState<string>('all');
  const [filterRoom, setFilterRoom] = useState<string>('all');
  const [filterSupervisor, setFilterSupervisor] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Modal States
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingDuty, setEditingDuty] = useState<SupervisionDuty | null>(null);
  const [isAutoPlotModalOpen, setIsAutoPlotModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State for Add / Edit
  const [formData, setFormData] = useState<{
    scheduleId: string;
    subject: string;
    date: string;
    startTime: string;
    endTime: string;
    session: string;
    room: string;
    supervisorNip: string;
    supervisorNama: string;
    supervisorNip2: string;
    supervisorNama2: string;
    notes: string;
    status: 'Terjadwal' | 'Bertugas' | 'Selesai';
  }>({
    scheduleId: '',
    subject: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '07:30',
    endTime: '09:00',
    session: 'Sesi 1 (Pagi)',
    room: rooms[0] || 'Lab Komputer',
    supervisorNip: '',
    supervisorNama: '',
    supervisorNip2: '',
    supervisorNama2: '',
    notes: '',
    status: 'Terjadwal',
  });

  // Auto Plot Modal Form State
  const [autoPlotTargetScheduleId, setAutoPlotTargetScheduleId] = useState<string>('all');
  const [autoPlotSelectedRooms, setAutoPlotSelectedRooms] = useState<string[]>(rooms);
  const [autoPlotSelectedSupervisors, setAutoPlotSelectedSupervisors] = useState<string[]>(
    supervisors.map(s => s.nip)
  );
  const [autoPlotMode, setAutoPlotMode] = useState<'single' | 'double'>('single');
  const [autoPlotPreview, setAutoPlotPreview] = useState<SupervisionDuty[] | null>(null);

  // Unique list of dates for filtering
  const uniqueDates = useMemo(() => {
    const dates = new Set<string>();
    supervisionDuties.forEach(d => {
      if (d.date) dates.add(d.date);
    });
    schedules.forEach(s => {
      if (s.date) dates.add(s.date);
    });
    return Array.from(dates).sort();
  }, [supervisionDuties, schedules]);

  // Filtered Duties
  const filteredDuties = useMemo(() => {
    return supervisionDuties.filter(duty => {
      const matchSearch =
        duty.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        duty.room.toLowerCase().includes(searchQuery.toLowerCase()) ||
        duty.supervisorNama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        duty.supervisorNip.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (duty.supervisorNama2 && duty.supervisorNama2.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (duty.notes && duty.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchDate = filterDate === 'all' || duty.date === filterDate;
      const matchRoom = filterRoom === 'all' || duty.room === filterRoom;
      const matchSupervisor =
        filterSupervisor === 'all' ||
        duty.supervisorNip === filterSupervisor ||
        duty.supervisorNip2 === filterSupervisor;
      const matchStatus = filterStatus === 'all' || duty.status === filterStatus;

      return matchSearch && matchDate && matchRoom && matchSupervisor && matchStatus;
    });
  }, [supervisionDuties, searchQuery, filterDate, filterRoom, filterSupervisor, filterStatus]);

  // Metrics
  const totalDuties = supervisionDuties.length;
  const activeSupervisorsCount = useMemo(() => {
    const set = new Set<string>();
    supervisionDuties.forEach(d => {
      if (d.supervisorNip) set.add(d.supervisorNip);
      if (d.supervisorNip2) set.add(d.supervisorNip2);
    });
    return set.size;
  }, [supervisionDuties]);

  const assignedRoomsCount = useMemo(() => {
    const set = new Set<string>();
    supervisionDuties.forEach(d => {
      if (d.room) set.add(d.room);
    });
    return set.size;
  }, [supervisionDuties]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    const defaultSchedule = schedules[0];
    const firstSup = supervisors[0];
    setFormData({
      scheduleId: defaultSchedule?.id || '',
      subject: defaultSchedule?.subject || (database.subjects[0] || 'Mata Pelajaran'),
      date: defaultSchedule?.date || new Date().toISOString().split('T')[0],
      startTime: defaultSchedule?.startTime || '07:30',
      endTime: defaultSchedule?.endTime || '09:00',
      session: 'Sesi 1 (Pagi)',
      room: rooms[0] || 'Lab Komputer',
      supervisorNip: firstSup?.nip || '',
      supervisorNama: firstSup?.nama || '',
      supervisorNip2: '',
      supervisorNama2: '',
      notes: '',
      status: 'Terjadwal',
    });
    setEditingDuty(null);
    setIsAddEditModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (duty: SupervisionDuty) => {
    setEditingDuty(duty);
    setFormData({
      scheduleId: duty.scheduleId || '',
      subject: duty.subject,
      date: duty.date,
      startTime: duty.startTime,
      endTime: duty.endTime,
      session: duty.session || 'Sesi 1 (Pagi)',
      room: duty.room,
      supervisorNip: duty.supervisorNip,
      supervisorNama: duty.supervisorNama,
      supervisorNip2: duty.supervisorNip2 || '',
      supervisorNama2: duty.supervisorNama2 || '',
      notes: duty.notes || '',
      status: duty.status || 'Terjadwal',
    });
    setIsAddEditModalOpen(true);
  };

  // On Schedule Selected in Form
  const handleScheduleSelectChange = (schId: string) => {
    const found = schedules.find(s => s.id === schId);
    if (found) {
      setFormData(prev => ({
        ...prev,
        scheduleId: found.id,
        subject: found.subject,
        date: found.date,
        startTime: found.startTime,
        endTime: found.endTime,
      }));
    } else {
      setFormData(prev => ({ ...prev, scheduleId: '' }));
    }
  };

  // On Supervisor 1 Change
  const handleSupervisor1Change = (nip: string) => {
    const sup = supervisors.find(s => s.nip === nip);
    setFormData(prev => ({
      ...prev,
      supervisorNip: nip,
      supervisorNama: sup ? sup.nama : '',
    }));
  };

  // On Supervisor 2 Change
  const handleSupervisor2Change = (nip: string) => {
    if (!nip) {
      setFormData(prev => ({
        ...prev,
        supervisorNip2: '',
        supervisorNama2: '',
      }));
      return;
    }
    const sup = supervisors.find(s => s.nip === nip);
    setFormData(prev => ({
      ...prev,
      supervisorNip2: nip,
      supervisorNama2: sup ? sup.nama : '',
    }));
  };

  // Save Duty (Add or Update)
  const handleSaveDuty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject || !formData.date || !formData.room || !formData.supervisorNip) {
      alert('Mohon lengkapi mata pelajaran, tanggal, ruang, dan pengawas utama.');
      return;
    }

    setIsSaving(true);
    try {
      const updatedList = [...supervisionDuties];

      if (editingDuty) {
        const idx = updatedList.findIndex(d => d.id === editingDuty.id);
        if (idx !== -1) {
          updatedList[idx] = {
            ...editingDuty,
            ...formData,
          };
        }
      } else {
        const newDuty: SupervisionDuty = {
          id: `DUTY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          ...formData,
        };
        updatedList.push(newDuty);
      }

      const updatedDb: DatabaseSchema = {
        ...database,
        supervisionDuties: updatedList,
      };

      const success = await onSaveDatabase(
        updatedDb,
        editingDuty ? 'Pembaruan Jadwal Pengawasan' : 'Tambah Jadwal Pengawasan',
        `${editingDuty ? 'Mengubah' : 'Menambahkan'} tugas pengawas ${formData.supervisorNama} pada ${formData.subject} (${formData.room})`
      );

      if (success) {
        await onRefreshDatabase();
        setIsAddEditModalOpen(false);
      } else {
        alert('Gagal menyimpan perubahan ke basis data.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Quick Status Toggle
  const handleQuickStatusChange = async (dutyId: string, newStatus: 'Terjadwal' | 'Bertugas' | 'Selesai') => {
    const updated = supervisionDuties.map(d => {
      if (d.id === dutyId) {
        return { ...d, status: newStatus };
      }
      return d;
    });

    const updatedDb: DatabaseSchema = {
      ...database,
      supervisionDuties: updated,
    };

    await onSaveDatabase(
      updatedDb,
      'Ubah Status Pengawasan',
      `Status tugas pengawasan diubah menjadi ${newStatus}.`
    );
    await onRefreshDatabase();
  };

  // Delete Single Duty
  const handleDeleteDuty = async (duty: SupervisionDuty) => {
    if (!confirm(`Hapus jadwal tugas pengawasan untuk ${duty.supervisorNama} di ${duty.room} (${duty.subject})?`)) {
      return;
    }

    const updated = supervisionDuties.filter(d => d.id !== duty.id);
    const updatedDb: DatabaseSchema = {
      ...database,
      supervisionDuties: updated,
    };

    const success = await onSaveDatabase(
      updatedDb,
      'Hapus Jadwal Pengawasan',
      `Menghapus tugas pengawas ${duty.supervisorNama} di ruang ${duty.room}`
    );

    if (success) {
      await onRefreshDatabase();
    }
  };

  // Clear All Duties
  const handleClearAllDuties = async () => {
    if (supervisionDuties.length === 0) return;
    if (!confirm(`Apakah Anda yakin ingin MENGHAPUS SELURUH (${supervisionDuties.length}) jadwal pengawasan yang ada? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    const updatedDb: DatabaseSchema = {
      ...database,
      supervisionDuties: [],
    };

    const success = await onSaveDatabase(
      updatedDb,
      'Reset Seluruh Jadwal Pengawasan',
      'Mengosongkan semua jadwal plotting tugas pengawas ujian.'
    );

    if (success) {
      await onRefreshDatabase();
    }
  };

  // Smart Auto-Plotting Engine
  const generateAutoPlot = () => {
    const targetSchedules = autoPlotTargetScheduleId === 'all'
      ? schedules
      : schedules.filter(s => s.id === autoPlotTargetScheduleId);

    if (targetSchedules.length === 0) {
      alert('Tidak ada jadwal ujian yang dipilih.');
      return;
    }

    if (autoPlotSelectedRooms.length === 0) {
      alert('Pilih setidaknya 1 ruang ujian.');
      return;
    }

    const availableSupervisors = supervisors.filter(s =>
      autoPlotSelectedSupervisors.includes(s.nip)
    );

    if (availableSupervisors.length === 0) {
      alert('Pilih setidaknya 1 pengawas dari master pengawas.');
      return;
    }

    const generatedDuties: SupervisionDuty[] = [];
    let supervisorIndex = 0;

    targetSchedules.forEach((sch, sIdx) => {
      autoPlotSelectedRooms.forEach((roomName, rIdx) => {
        // Pick supervisor 1 (round-robin)
        const sup1 = availableSupervisors[supervisorIndex % availableSupervisors.length];
        supervisorIndex++;

        let sup2: Supervisor | undefined = undefined;
        if (autoPlotMode === 'double' && availableSupervisors.length > 1) {
          sup2 = availableSupervisors[supervisorIndex % availableSupervisors.length];
          // Make sure sup1 and sup2 are not the same person if possible
          if (sup2.nip === sup1.nip && availableSupervisors.length > 1) {
            supervisorIndex++;
            sup2 = availableSupervisors[supervisorIndex % availableSupervisors.length];
          }
          supervisorIndex++;
        }

        const duty: SupervisionDuty = {
          id: `DUTY-AUTO-${Date.now()}-${sIdx}-${rIdx}`,
          scheduleId: sch.id,
          subject: sch.subject,
          date: sch.date,
          startTime: sch.startTime,
          endTime: sch.endTime,
          session: `Sesi ${sIdx + 1} (${sch.startTime} - ${sch.endTime})`,
          room: roomName,
          supervisorNip: sup1.nip,
          supervisorNama: sup1.nama,
          supervisorNip2: sup2 ? sup2.nip : '',
          supervisorNama2: sup2 ? sup2.nama : '',
          notes: 'Plotting Otomatis Sistem BAGJA EXAM',
          status: 'Terjadwal',
        };

        generatedDuties.push(duty);
      });
    });

    setAutoPlotPreview(generatedDuties);
  };

  // Commit Auto-Plot to Database
  const handleCommitAutoPlot = async (mode: 'append' | 'replace') => {
    if (!autoPlotPreview || autoPlotPreview.length === 0) return;

    setIsSaving(true);
    try {
      const updatedList = mode === 'replace'
        ? autoPlotPreview
        : [...supervisionDuties, ...autoPlotPreview];

      const updatedDb: DatabaseSchema = {
        ...database,
        supervisionDuties: updatedList,
      };

      const success = await onSaveDatabase(
        updatedDb,
        'Plotting Otomatis Pengawas',
        `Plotting otomatis menghasilkan ${autoPlotPreview.length} tugas pengawas (${mode === 'replace' ? 'Gantikan Jadwal Lama' : 'Tambahkan'}).`
      );

      if (success) {
        await onRefreshDatabase();
        setIsAutoPlotModalOpen(false);
        setAutoPlotPreview(null);
        alert(`Berhasil! ${autoPlotPreview.length} jadwal tugas pengawasan telah diterapkan.`);
      } else {
        alert('Gagal menyimpan plotting ke basis data.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (supervisionDuties.length === 0) {
      alert('Belum ada data jadwal pengawasan untuk diekspor.');
      return;
    }

    const headers = [
      'No',
      'Hari/Tanggal',
      'Waktu/Sesi',
      'Mata Pelajaran',
      'Ruang Ujian',
      'NIP Pengawas 1',
      'Nama Pengawas 1',
      'NIP Pengawas 2',
      'Nama Pengawas 2',
      'Status',
      'Catatan',
    ];

    const rows = supervisionDuties.map((d, idx) => [
      idx + 1,
      `"${d.date}"`,
      `"${d.startTime} - ${d.endTime} (${d.session || ''})"`,
      `"${d.subject}"`,
      `"${d.room}"`,
      `"'${d.supervisorNip}"`,
      `"${d.supervisorNama}"`,
      `"'${d.supervisorNip2 || '-'}"`,
      `"${d.supervisorNama2 || '-'}"`,
      `"${d.status || 'Terjadwal'}"`,
      `"${d.notes || ''}"`,
    ]);

    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Jadwal_Pengawasan_SMPN7_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <div className="bg-white rounded-3xl border border-sky-100 p-5 sm:p-6 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-sky-500/20">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Pengaturan Jadwal Pengawasan</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 font-extrabold">
                  {totalDuties} Sesi Terjadwal
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Plotting alokasi tugas pengawas ruang per mata pelajaran, tanggal, sesi, dan ruang ujian SMP Negeri 7 Cimahi.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Smart Auto Plot Button */}
          <button
            onClick={() => {
              setAutoPlotSelectedRooms(rooms);
              setAutoPlotSelectedSupervisors(supervisors.map(s => s.nip));
              setAutoPlotPreview(null);
              setIsAutoPlotModalOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all"
            title="Distribusikan pengawas ke ruang ujian secara otomatis"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>Plotting Otomatis</span>
          </button>

          {/* Add Manual Duty */}
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Jadwal Tugas</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            disabled={supervisionDuties.length === 0}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
            title="Ekspor ke CSV/Excel"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Ekspor CSV</span>
          </button>

          {/* Print Studio Nav */}
          {onNavigateToPrintStudio && (
            <button
              onClick={onNavigateToPrintStudio}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-colors"
              title="Buka Studio Cetak Dokumen Resmi"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-600" />
              <span>Studio Cetak</span>
            </button>
          )}

          {/* Clear All */}
          {supervisionDuties.length > 0 && (
            <button
              onClick={handleClearAllDuties}
              className="p-2.5 text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors"
              title="Reset seluruh jadwal tugas pengawasan"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. KPI / Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-sky-100 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Sesi Tugas</span>
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{totalDuties}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Penugasan ruang ujian</p>
        </div>

        <div className="bg-white rounded-2xl border border-sky-100 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pengawas Terplot</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{activeSupervisorsCount} / {supervisors.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Dari total master pengawas</p>
        </div>

        <div className="bg-white rounded-2xl border border-sky-100 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ruang Tercover</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <DoorOpen className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{assignedRoomsCount} / {rooms.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Ruang ujian memiliki pengawas</p>
        </div>

        <div className="bg-white rounded-2xl border border-sky-100 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Jadwal Ujian Aktif</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{schedules.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Mata pelajaran terjadwal</p>
        </div>
      </div>

      {/* 3. Filters and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama pengawas, NIP, mapel, atau ruang..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setActiveView('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeView === 'table' ? 'bg-white text-sky-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Tabel</span>
            </button>
            <button
              onClick={() => setActiveView('by_room')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeView === 'by_room' ? 'bg-white text-sky-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Per Ruang</span>
            </button>
            <button
              onClick={() => setActiveView('by_supervisor')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeView === 'by_supervisor' ? 'bg-white text-sky-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Beban Pengawas</span>
            </button>
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </div>

          {/* Date Filter */}
          <select
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">Semua Tanggal</option>
            {uniqueDates.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Room Filter */}
          <select
            value={filterRoom}
            onChange={(e) => setFilterRoom(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">Semua Ruang</option>
            {rooms.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* Supervisor Filter */}
          <select
            value={filterSupervisor}
            onChange={(e) => setFilterSupervisor(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">Semua Pengawas</option>
            {supervisors.map(s => (
              <option key={s.nip} value={s.nip}>{s.nama}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">Semua Status</option>
            <option value="Terjadwal">Terjadwal</option>
            <option value="Bertugas">Sedang Bertugas</option>
            <option value="Selesai">Selesai</option>
          </select>

          {(filterDate !== 'all' || filterRoom !== 'all' || filterSupervisor !== 'all' || filterStatus !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setFilterDate('all');
                setFilterRoom('all');
                setFilterSupervisor('all');
                setFilterStatus('all');
                setSearchQuery('');
              }}
              className="text-xs text-sky-600 hover:text-sky-800 font-bold ml-auto"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* 4. Main Content Views */}
      {filteredDuties.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center">
          <div className="w-14 h-14 rounded-3xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-4 border border-sky-100">
            <CalendarCheck className="w-7 h-7" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900">
            Belum Ada Jadwal Tugas Pengawasan
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
            Atur jadwal tugas pengawas ruang ujian secara manual atau gunakan fitur otomatis untuk membagi pengawas ke seluruh ruang dengan sekali klik.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                setAutoPlotSelectedRooms(rooms);
                setAutoPlotSelectedSupervisors(supervisors.map(s => s.nip));
                setAutoPlotPreview(null);
                setIsAutoPlotModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all"
            >
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>Gunakan Plotting Otomatis</span>
            </button>
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Jadwal Manual</span>
            </button>
          </div>
        </div>
      ) : activeView === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5 w-12 text-center">No</th>
                  <th className="p-3.5">Hari / Tanggal</th>
                  <th className="p-3.5">Waktu / Sesi</th>
                  <th className="p-3.5">Mata Pelajaran</th>
                  <th className="p-3.5">Ruang Ujian</th>
                  <th className="p-3.5">Pengawas Utama (1)</th>
                  <th className="p-3.5">Pengawas Pendamping (2)</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredDuties.map((duty, idx) => (
                  <tr key={duty.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{duty.date}</div>
                      {duty.notes && (
                        <div className="text-[10px] text-slate-400 truncate max-w-xs">{duty.notes}</div>
                      )}
                    </td>
                    <td className="p-3.5">
                      <div className="inline-flex items-center gap-1 font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{duty.startTime} - {duty.endTime}</span>
                      </div>
                      {duty.session && (
                        <div className="text-[10px] text-slate-500 mt-0.5">{duty.session}</div>
                      )}
                    </td>
                    <td className="p-3.5 font-bold text-sky-900">
                      {duty.subject}
                    </td>
                    <td className="p-3.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 font-bold border border-sky-100">
                        <DoorOpen className="w-3 h-3" />
                        <span>{duty.room}</span>
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="font-extrabold text-slate-900">{duty.supervisorNama}</div>
                      <div className="font-mono text-[10px] text-slate-500">NIP: {duty.supervisorNip}</div>
                    </td>
                    <td className="p-3.5">
                      {duty.supervisorNama2 ? (
                        <>
                          <div className="font-bold text-slate-800">{duty.supervisorNama2}</div>
                          <div className="font-mono text-[10px] text-slate-500">NIP: {duty.supervisorNip2 || '-'}</div>
                        </>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">-</span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <select
                        value={duty.status || 'Terjadwal'}
                        onChange={(e) => handleQuickStatusChange(duty.id, e.target.value as any)}
                        className={`text-[10px] font-extrabold px-2 py-1 rounded-lg border focus:outline-none cursor-pointer ${
                          duty.status === 'Bertugas'
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : duty.status === 'Selesai'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-sky-50 text-sky-800 border-sky-300'
                        }`}
                      >
                        <option value="Terjadwal">Terjadwal</option>
                        <option value="Bertugas">Bertugas</option>
                        <option value="Selesai">Selesai</option>
                      </select>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEditModal(duty)}
                          className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                          title="Edit Jadwal Tugas"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteDuty(duty)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Hapus Jadwal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeView === 'by_room' ? (
        /* ROOM CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map(roomName => {
            const roomDuties = filteredDuties.filter(d => d.room === roomName);
            return (
              <div key={roomName} className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                      <DoorOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">{roomName}</h4>
                      <p className="text-[10px] text-slate-400">{roomDuties.length} sesi tugas dijadwalkan</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {roomDuties.length} Sesi
                  </span>
                </div>

                {roomDuties.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4 text-center">
                    Belum ada pengawas yang diplot di ruang ini.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {roomDuties.map(d => (
                      <div key={d.id} className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-sky-900">{d.subject}</span>
                          <span className="text-[10px] font-mono font-bold text-slate-500">{d.startTime} - {d.endTime}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">Tanggal: {d.date}</div>
                        <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between">
                          <div>
                            <div className="text-xs font-bold text-slate-900">{d.supervisorNama}</div>
                            {d.supervisorNama2 && (
                              <div className="text-[10px] text-slate-600">& {d.supervisorNama2}</div>
                            )}
                          </div>
                          <button
                            onClick={() => handleOpenEditModal(d)}
                            className="text-[10px] font-bold text-sky-600 hover:underline"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* PROCTOR WORKLOAD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {supervisors.map(sup => {
            const assigned = filteredDuties.filter(
              d => d.supervisorNip === sup.nip || d.supervisorNip2 === sup.nip
            );
            return (
              <div key={sup.nip} className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black text-xs border border-indigo-100">
                      {sup.nama.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-xs leading-snug">{sup.nama}</h4>
                      <p className="text-[10px] font-mono text-slate-400">NIP: {sup.nip}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    assigned.length > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {assigned.length} Sesi
                  </span>
                </div>

                {assigned.length === 0 ? (
                  <div className="py-4 text-center">
                    <p className="text-xs text-slate-400 italic mb-2">Belum ada tugas pengawasan.</p>
                    <button
                      onClick={() => {
                        handleOpenAddModal();
                        setFormData(prev => ({
                          ...prev,
                          supervisorNip: sup.nip,
                          supervisorNama: sup.nama,
                        }));
                      }}
                      className="text-xs font-bold text-sky-600 hover:text-sky-700 hover:underline"
                    >
                      + Plot Tugas Sekarang
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {assigned.map(d => (
                      <div key={d.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900">{d.subject}</div>
                          <div className="text-[10px] text-slate-500">{d.date} • {d.room}</div>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded">
                          {d.startTime}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ================= MODAL TAMBAH / EDIT TUGAS PENGAWASAN ================= */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-100 my-auto">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-sky-600 to-indigo-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CalendarCheck className="w-5 h-5 text-amber-300" />
                <h3 className="font-black text-base">
                  {editingDuty ? 'Edit Tugas Pengawasan' : 'Tambah Tugas Pengawasan'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddEditModalOpen(false)}
                className="p-1 rounded-xl text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveDuty} className="p-6 space-y-4 text-xs">
              {/* Linked Schedule Selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Hubungkan dengan Jadwal Ujian (Opsional)
                </label>
                <select
                  value={formData.scheduleId}
                  onChange={(e) => handleScheduleSelectChange(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">-- Input Bebas / Kustom --</option>
                  {schedules.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.subject} ({s.date} | {s.startTime} - {s.endTime})
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Mata Pelajaran <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder="Contoh: Matematika"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tanggal <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Time & Session */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jam Mulai</label>
                  <input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jam Selesai</label>
                  <input
                    type="time"
                    required
                    value={formData.endTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Sesi</label>
                  <input
                    type="text"
                    value={formData.session}
                    onChange={(e) => setFormData(prev => ({ ...prev, session: e.target.value }))}
                    placeholder="Sesi 1"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
                  />
                </div>
              </div>

              {/* Room Selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Ruang Ujian <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.room}
                  onChange={(e) => setFormData(prev => ({ ...prev, room: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {rooms.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Supervisor 1 */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Pengawas Utama (1) <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formData.supervisorNip}
                  onChange={(e) => handleSupervisor1Change(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">-- Pilih Pengawas --</option>
                  {supervisors.map(s => (
                    <option key={s.nip} value={s.nip}>
                      {s.nama} (NIP: {s.nip})
                    </option>
                  ))}
                </select>
              </div>

              {/* Supervisor 2 (Optional) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Pengawas Pendamping (2) (Opsional)
                </label>
                <select
                  value={formData.supervisorNip2}
                  onChange={(e) => handleSupervisor2Change(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="">-- Tidak Ada / 1 Pengawas Saja --</option>
                  {supervisors
                    .filter(s => s.nip !== formData.supervisorNip)
                    .map(s => (
                      <option key={s.nip} value={s.nip}>
                        {s.nama} (NIP: {s.nip})
                      </option>
                    ))}
                </select>
              </div>

              {/* Status & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none"
                  >
                    <option value="Terjadwal">Terjadwal</option>
                    <option value="Bertugas">Sedang Bertugas</option>
                    <option value="Selesai">Selesai</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Catatan Tugas</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Contoh: Pengawas ruang utama"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-extrabold shadow-sm disabled:opacity-50"
                >
                  {isSaving ? 'Menyimpan...' : editingDuty ? 'Perbarui Jadwal' : 'Simpan Jadwal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL PLOTTING OTOMATIS PENGAWAS ================= */}
      {isAutoPlotModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden border border-slate-100 my-auto max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 text-white shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-white/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-black text-base">Plotting Otomatis Pengawas Ruang</h3>
                  <p className="text-[11px] text-indigo-100">
                    Sistem mendistribusikan pengawas master ke seluruh ruang ujian secara merata tanpa bentrok.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAutoPlotModalOpen(false)}
                className="p-1 rounded-xl text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
              {/* Step 1: Target Schedule */}
              <div className="space-y-1.5">
                <label className="block font-black text-slate-800 uppercase tracking-wider text-[11px]">
                  1. Pilih Jadwal Ujian Yang Akan Diplot
                </label>
                <select
                  value={autoPlotTargetScheduleId}
                  onChange={(e) => {
                    setAutoPlotTargetScheduleId(e.target.value);
                    setAutoPlotPreview(null);
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none"
                >
                  <option value="all">Plot Untuk SELURUH Jadwal Ujian Aktif ({schedules.length} Jadwal)</option>
                  {schedules.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.subject} ({s.date} | {s.startTime} - {s.endTime})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Target Rooms */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-black text-slate-800 uppercase tracking-wider text-[11px]">
                    2. Ruang Ujian Yang Digunakan ({autoPlotSelectedRooms.length} Ruang)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (autoPlotSelectedRooms.length === rooms.length) {
                        setAutoPlotSelectedRooms([]);
                      } else {
                        setAutoPlotSelectedRooms(rooms);
                      }
                      setAutoPlotPreview(null);
                    }}
                    className="text-[11px] font-bold text-indigo-600 hover:underline"
                  >
                    {autoPlotSelectedRooms.length === rooms.length ? 'Batal Pilih Semua' : 'Pilih Semua Ruang'}
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 max-h-36 overflow-y-auto">
                  {rooms.map(r => (
                    <label key={r} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoPlotSelectedRooms.includes(r)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAutoPlotSelectedRooms(prev => [...prev, r]);
                          } else {
                            setAutoPlotSelectedRooms(prev => prev.filter(x => x !== r));
                          }
                          setAutoPlotPreview(null);
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{r}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Step 3: Supervisors Pool */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-black text-slate-800 uppercase tracking-wider text-[11px]">
                    3. Pengawas Yang Bertugas ({autoPlotSelectedSupervisors.length} dari {supervisors.length} Pengawas)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (autoPlotSelectedSupervisors.length === supervisors.length) {
                        setAutoPlotSelectedSupervisors([]);
                      } else {
                        setAutoPlotSelectedSupervisors(supervisors.map(s => s.nip));
                      }
                      setAutoPlotPreview(null);
                    }}
                    className="text-[11px] font-bold text-indigo-600 hover:underline"
                  >
                    {autoPlotSelectedSupervisors.length === supervisors.length ? 'Batal Pilih Semua' : 'Pilih Semua Pengawas'}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 max-h-40 overflow-y-auto">
                  {supervisors.map(s => (
                    <label key={s.nip} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer truncate">
                      <input
                        type="checkbox"
                        checked={autoPlotSelectedSupervisors.includes(s.nip)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAutoPlotSelectedSupervisors(prev => [...prev, s.nip]);
                          } else {
                            setAutoPlotSelectedSupervisors(prev => prev.filter(x => x !== s.nip));
                          }
                          setAutoPlotPreview(null);
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500 shrink-0"
                      />
                      <span className="truncate">{s.nama} ({s.nip})</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Step 4: Allocation Mode */}
              <div className="space-y-1.5">
                <label className="block font-black text-slate-800 uppercase tracking-wider text-[11px]">
                  4. Rasio Pengawas Per Ruangan
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`p-3 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all ${
                    autoPlotMode === 'single' ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold' : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}>
                    <input
                      type="radio"
                      name="autoPlotMode"
                      checked={autoPlotMode === 'single'}
                      onChange={() => {
                        setAutoPlotMode('single');
                        setAutoPlotPreview(null);
                      }}
                      className="text-indigo-600"
                    />
                    <div>
                      <div className="text-xs">1 Pengawas / Ruang</div>
                      <div className="text-[10px] text-slate-500 font-normal">Pengawas utama saja</div>
                    </div>
                  </label>

                  <label className={`p-3 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all ${
                    autoPlotMode === 'double' ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold' : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}>
                    <input
                      type="radio"
                      name="autoPlotMode"
                      checked={autoPlotMode === 'double'}
                      onChange={() => {
                        setAutoPlotMode('double');
                        setAutoPlotPreview(null);
                      }}
                      className="text-indigo-600"
                    />
                    <div>
                      <div className="text-xs">2 Pengawas / Ruang</div>
                      <div className="text-[10px] text-slate-500 font-normal">Pengawas utama + pendamping</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Generate Preview Action */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={generateAutoPlot}
                  className="w-full py-2.5 bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-xs transition-all"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Pratinjau Hasil Plotting Otomatis</span>
                </button>
              </div>

              {/* Preview Table */}
              {autoPlotPreview && (
                <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-indigo-950 text-xs">
                      Hasil Simulasi Plotting: {autoPlotPreview.length} Sesi Terbentuk
                    </span>
                    <span className="text-[10px] text-indigo-700 font-semibold bg-white px-2 py-0.5 rounded-full border border-indigo-200">
                      Siap Diterapkan
                    </span>
                  </div>

                  <div className="max-h-52 overflow-y-auto rounded-xl border border-indigo-200/60 bg-white">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 border-b text-[10px] font-bold text-slate-600 uppercase">
                        <tr>
                          <th className="p-2">Mapel</th>
                          <th className="p-2">Ruang</th>
                          <th className="p-2">Pengawas 1</th>
                          {autoPlotMode === 'double' && <th className="p-2">Pengawas 2</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {autoPlotPreview.map((d, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2 font-bold text-slate-900">{d.subject}</td>
                            <td className="p-2 font-bold text-sky-800">{d.room}</td>
                            <td className="p-2 font-medium">{d.supervisorNama}</td>
                            {autoPlotMode === 'double' && (
                              <td className="p-2 font-medium text-slate-600">{d.supervisorNama2 || '-'}</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleCommitAutoPlot('append')}
                      disabled={isSaving}
                      className="w-full sm:w-auto px-4 py-2 bg-white text-indigo-700 border border-indigo-300 hover:bg-indigo-50 rounded-xl font-bold"
                    >
                      Tambahkan ke Jadwal Yang Ada
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCommitAutoPlot('replace')}
                      disabled={isSaving}
                      className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-extrabold shadow-sm"
                    >
                      Gantikan Jadwal Lama
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
