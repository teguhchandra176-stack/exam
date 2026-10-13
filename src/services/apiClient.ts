import { DatabaseSchema, Student, Schedule, Supervisor } from '../types';
import { saveSecureStorage, loadSecureStorage } from './cryptoStorage';

const CACHE_KEY = 'BAGJA_EXAM_SECURE_PAYLOAD';

async function saveLocalEncrypted(data: DatabaseSchema) {
  await saveSecureStorage(CACHE_KEY, data);
}

async function loadLocalEncrypted(): Promise<DatabaseSchema | null> {
  return await loadSecureStorage<DatabaseSchema>(CACHE_KEY);
}

class UniversalApiClient {
  private basePath: string;
  private isPhpBackend: boolean = false;

  constructor() {
    // Detect base URL path for subdirectories or root
    const origin = window.location.origin;
    const pathname = window.location.pathname.replace(/\/+$/, '');
    this.basePath = `${origin}${pathname}`;
    // Check if hosted under a php environment or vite/express
    this.isPhpBackend = window.location.pathname.endsWith('.php');
  }

  private getUrl(endpoint: string, phpAction?: string): string {
    const cacheBuster = `_t=${Date.now()}`;
    if (this.isPhpBackend && phpAction) {
      return `api.php?action=${phpAction}&${cacheBuster}`;
    }
    return `${endpoint}?${cacheBuster}`;
  }

  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    };
  }

  async getHealth(): Promise<{ status: string; databaseConnected: boolean; latencyMs: number }> {
    const start = performance.now();
    try {
      const res = await fetch(this.getUrl('/api/health', 'health'), {
        headers: this.getHeaders()
      });
      const data = await res.json();
      const latencyMs = Math.round(performance.now() - start);
      return { status: data.status || 'ok', databaseConnected: true, latencyMs };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      return { status: 'offline', databaseConnected: false, latencyMs };
    }
  }

  async fetchDatabase(): Promise<DatabaseSchema> {
    try {
      const res = await fetch(this.getUrl('/api/database', 'get_db'), {
        headers: this.getHeaders()
      });
      if (!res.ok) throw new Error('Network error');
      const data: DatabaseSchema = await res.json();
      await saveLocalEncrypted(data);
      return data;
    } catch (err) {
      console.warn('Server fetch failed, falling back to local encrypted storage', err);
      const local = await loadLocalEncrypted();
      if (local) return local;
      throw new Error('Gagal memuat basis data baik dari server maupun penyimpanan lokal.');
    }
  }

  async saveDatabase(db: DatabaseSchema, auditAction?: string, auditDetails?: string): Promise<boolean> {
    await saveLocalEncrypted(db);
    try {
      const res = await fetch(this.getUrl('/api/database', 'save_db'), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ ...db, auditAction, auditDetails })
      });
      if (!res.ok) throw new Error('Save error');
      return true;
    } catch (err) {
      console.warn('Server save failed, saved locally:', err);
      return true; // Local persistence succeeds
    }
  }

  async sendHeartbeat(payload: {
    noPeserta: string;
    status?: string;
    deviceType?: string;
    answersSummary?: { answered: number; total: number };
  }): Promise<{ success: boolean; studentStatus?: string; violationsCount?: number; broadcast?: string | null; maintenanceMode?: boolean }> {
    try {
      const res = await fetch(this.getUrl('/api/heartbeat', 'heartbeat'), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Heartbeat error');
      return await res.json();
    } catch (err) {
      return { success: false };
    }
  }

  async reportViolation(payload: {
    noPeserta: string;
    violationType: string;
    details: string;
    timestamp?: string;
  }): Promise<{ success: boolean; violationsCount: number; isSuspended: boolean }> {
    try {
      const res = await fetch(this.getUrl('/api/violation', 'violation'), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Violation reporting error');
      return await res.json();
    } catch (err) {
      // Local fallback
      const local = await loadLocalEncrypted();
      if (local) {
        const student = local.students.find(s => s.noPeserta === payload.noPeserta || s.nisn === payload.noPeserta);
        if (student) {
          student.violationsCount = (student.violationsCount || 0) + 1;
          const tol = local.systemConfig.violationTolerance || 3;
          const isSuspended = student.violationsCount >= tol;
          if (isSuspended) student.status = 'Ditangguhkan';
          await saveLocalEncrypted(local);
          return { success: true, violationsCount: student.violationsCount, isSuspended };
        }
      }
      return { success: false, violationsCount: 1, isSuspended: false };
    }
  }

  async unlockKiosk(payload: {
    noPeserta: string;
    supervisorPin?: string;
    unlockedBy?: string;
    resetViolations?: boolean;
  }): Promise<{ success: boolean; message: string; student?: Student }> {
    try {
      const res = await fetch(this.getUrl('/api/kiosk-unlock', 'kiosk_unlock'), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Gagal membuka kunci');
      }
      return await res.json();
    } catch (err: any) {
      // Local fallback
      const local = await loadLocalEncrypted();
      if (local) {
        const student = local.students.find(s => s.noPeserta === payload.noPeserta || s.nisn === payload.noPeserta);
        if (student) {
          student.status = 'Sedang Mengerjakan';
          if (payload.resetViolations) student.violationsCount = 0;
          await saveLocalEncrypted(local);
          return { success: true, message: 'Kunci ujian berhasil dibuka.', student };
        }
      }
      throw err;
    }
  }

  async resetStudent(noPeserta: string, resetBy: string): Promise<boolean> {
    try {
      const res = await fetch(this.getUrl('/api/reset-student'), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ noPeserta, resetBy })
      });
      return res.ok;
    } catch (err) {
      const local = await loadLocalEncrypted();
      if (local) {
        const student = local.students.find(s => s.noPeserta === noPeserta || s.nisn === noPeserta);
        if (student) {
          student.status = 'Belum Masuk';
          student.violationsCount = 0;
          student.lastActive = null;
          await saveLocalEncrypted(local);
          return true;
        }
      }
      return false;
    }
  }

  async sendBroadcast(room: string, message: string, supervisorName?: string): Promise<boolean> {
    try {
      const res = await fetch(this.getUrl('/api/broadcast'), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ room, message, supervisorName })
      });
      return res.ok;
    } catch (err) {
      return false;
    }
  }

  async rotateToken(scheduleId?: string): Promise<string | null> {
    try {
      const res = await fetch(this.getUrl('/api/token/rotate', 'token_rotate'), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ scheduleId })
      });
      const data = await res.json();
      return data.token || null;
    } catch (err) {
      // Robust offline fallback generation
      const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
      const digits = '23456789';
      let newToken = '';
      for (let i = 0; i < 3; i++) newToken += letters.charAt(Math.floor(Math.random() * letters.length));
      for (let i = 0; i < 3; i++) newToken += digits.charAt(Math.floor(Math.random() * digits.length));
      const local = await loadLocalEncrypted();
      if (local) {
        local.systemConfig.currentToken = newToken;
        local.systemConfig.tokenLastRotated = new Date().toISOString();
        if (scheduleId) {
          const sch = local.schedules.find(s => s.id === scheduleId);
          if (sch) sch.token = newToken;
        } else {
          local.schedules.forEach(s => { if (s.isActive) s.token = newToken; });
        }
        await saveLocalEncrypted(local);
      }
      return newToken;
    }
  }

  async finishExam(noPeserta: string): Promise<boolean> {
    try {
      const res = await fetch(this.getUrl('/api/finish-exam'), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ noPeserta })
      });
      return res.ok;
    } catch (err) {
      return true;
    }
  }
}

export const apiClient = new UniversalApiClient();
