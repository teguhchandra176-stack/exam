/**
 * Room Capacity Policy Service
 * 
 * Aturan Kapasitas Ujian BAGJA EXAM:
 * - Maksimal Ruang Kelas biasa (Ruang 01, Ruang 02, dsb.): 44 siswa
 * - Maksimal Lab Komputer (Lab Komputer, Laboratorium Komputer, dsb.): 120 siswa
 */

import { Student } from '../types';

export const MAX_STUDENTS_PER_ROOM = 44;
export const MAX_STUDENTS_PER_LAB = 120;

/**
 * Mendeteksi apakah nama ruangan merupakan Lab Komputer atau Ruang Kelas biasa
 */
export function isComputerLab(roomName: string | undefined | null): boolean {
  if (!roomName) return false;
  const normalized = roomName.toLowerCase().trim();
  return (
    normalized.includes('lab') ||
    normalized.includes('laboratorium') ||
    normalized.includes('komputer')
  );
}

/**
 * Mendapatkan batas kapasitas maksimal untuk sebuah ruangan
 */
export function getRoomMaxCapacity(roomName: string | undefined | null): number {
  return isComputerLab(roomName) ? MAX_STUDENTS_PER_LAB : MAX_STUDENTS_PER_ROOM;
}

/**
 * Menghitung jumlah siswa saat ini di ruangan tertentu
 */
export function countStudentsInRoom(
  students: Student[] | undefined | null,
  roomName: string,
  excludeStudentId?: string
): number {
  if (!students) return 0;
  return students.filter(s => {
    if (excludeStudentId && (s.noPeserta === excludeStudentId || s.nisn === excludeStudentId)) {
      return false;
    }
    return s.ruang === roomName;
  }).length;
}

export interface RoomCapacityCheckResult {
  allowed: boolean;
  roomName: string;
  isLab: boolean;
  maxCapacity: number;
  currentCount: number;
  newCount: number;
  remainingSlots: number;
  warningMessage?: string;
}

/**
 * Memvalidasi apakah penambahan sejumlah siswa ke sebuah ruangan diperbolehkan
 */
export function checkRoomCapacity(
  students: Student[] | undefined | null,
  targetRoom: string,
  additionalCount: number = 1,
  excludeStudentId?: string
): RoomCapacityCheckResult {
  const isLab = isComputerLab(targetRoom);
  const maxCapacity = getRoomMaxCapacity(targetRoom);
  const currentCount = countStudentsInRoom(students, targetRoom, excludeStudentId);
  const newCount = currentCount + additionalCount;
  const remainingSlots = Math.max(0, maxCapacity - currentCount);
  const allowed = newCount <= maxCapacity;

  let warningMessage: string | undefined;
  if (!allowed) {
    const roomTypeLabel = isLab ? 'Lab Komputer' : 'Ruang Kelas';
    warningMessage = `Kapasitas ${roomTypeLabel} "${targetRoom}" melebihi batas maksimal! Maksimal ${maxCapacity} siswa, saat ini sudah ada ${currentCount} siswa (akan menjadi ${newCount} siswa).`;
  }

  return {
    allowed,
    roomName: targetRoom,
    isLab,
    maxCapacity,
    currentCount,
    newCount,
    remainingSlots,
    warningMessage
  };
}

export interface BatchCapacityValidation {
  isValid: boolean;
  violations: Array<{
    room: string;
    isLab: boolean;
    maxCapacity: number;
    currentCount: number;
    incomingCount: number;
    totalCount: number;
    overflowCount: number;
    errorMessage: string;
  }>;
  summaryByRoom: Record<string, {
    count: number;
    maxCapacity: number;
    isLab: boolean;
    remaining: number;
  }>;
}

/**
 * Memvalidasi daftar siswa yang akan diimpor atau ditambahkan sekaligus (Batch/Smart Import/CSV)
 */
export function validateBatchRoomCapacities(
  currentStudents: Student[] | undefined | null,
  incomingStudents: Array<{ ruang?: string; noPeserta?: string }>,
  mode: 'append' | 'replace' = 'append'
): BatchCapacityValidation {
  const currentList = currentStudents || [];
  const roomCounts: Record<string, number> = {};

  if (mode === 'append') {
    // Hitung eksisting
    currentList.forEach(s => {
      const r = s.ruang || 'Lab Komputer';
      roomCounts[r] = (roomCounts[r] || 0) + 1;
    });
  }

  // Rekam penambahan per ruangan
  const incomingPerRoom: Record<string, number> = {};
  incomingStudents.forEach(s => {
    const r = s.ruang || 'Lab Komputer';
    incomingPerRoom[r] = (incomingPerRoom[r] || 0) + 1;
  });

  const violations: BatchCapacityValidation['violations'] = [];
  const summaryByRoom: BatchCapacityValidation['summaryByRoom'] = {};

  // Semua ruangan yang terkena dampak
  const allRooms = Array.from(new Set([...Object.keys(roomCounts), ...Object.keys(incomingPerRoom)]));

  allRooms.forEach(room => {
    const existing = roomCounts[room] || 0;
    const incoming = incomingPerRoom[room] || 0;
    const total = mode === 'replace' ? incoming : existing + incoming;
    const isLab = isComputerLab(room);
    const maxCapacity = getRoomMaxCapacity(room);

    summaryByRoom[room] = {
      count: total,
      maxCapacity,
      isLab,
      remaining: Math.max(0, maxCapacity - total)
    };

    if (total > maxCapacity) {
      const overflow = total - maxCapacity;
      const typeLabel = isLab ? 'Lab Komputer' : 'Ruang Kelas';
      violations.push({
        room,
        isLab,
        maxCapacity,
        currentCount: existing,
        incomingCount: incoming,
        totalCount: total,
        overflowCount: overflow,
        errorMessage: `${typeLabel} "${room}" melebihi kapasitas (Maks: ${maxCapacity} siswa, teralokasi: ${total} siswa, lebih ${overflow} siswa).`
      });
    }
  });

  return {
    isValid: violations.length === 0,
    violations,
    summaryByRoom
  };
}
