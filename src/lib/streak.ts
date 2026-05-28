import { Photo } from './supabase';

function toKstDateString(date: Date): string {
  const kstOffset = 9 * 60 * 60 * 1000;
  return new Date(date.getTime() + kstOffset).toISOString().slice(0, 10);
}

function subtractDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function calculateStreak(photos: Photo[]): number {
  if (photos.length === 0) return 0;

  const recordedDates = new Set(photos.map((p) => p.streak_date));
  const today = toKstDateString(new Date());

  // 오늘 또는 어제 기록이 없으면 스트릭 0
  if (!recordedDates.has(today) && !recordedDates.has(subtractDays(today, 1))) {
    return 0;
  }

  const startDate = recordedDates.has(today) ? today : subtractDays(today, 1);
  let streak = 0;
  let cursor = startDate;

  while (recordedDates.has(cursor)) {
    streak++;
    cursor = subtractDays(cursor, 1);
  }

  return streak;
}

export function hasTodayRecord(photos: Photo[]): boolean {
  const today = toKstDateString(new Date());
  return photos.some((p) => p.streak_date === today);
}
