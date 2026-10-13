/**
 * Helper to format standard ISO dates (YYYY-MM-DD) into Indonesian localized strings
 * e.g., '2026-10-13' -> 'Selasa, 13 Oktober 2026'
 */
export function formatIndonesianDate(dateStr: string | undefined | null, includeDayName: boolean = true): string {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (isNaN(d.getTime())) return dateStr;

      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];

      const dayName = days[d.getDay()];
      const monthName = months[month];

      return includeDayName
        ? `${dayName}, ${day} ${monthName} ${year}`
        : `${day} ${monthName} ${year}`;
    }
    return dateStr;
  } catch {
    return dateStr || '-';
  }
}
