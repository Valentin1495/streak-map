import { supabase, Photo } from './supabase';

const MILESTONE_VALUES = [3, 7, 14, 30, 100] as const;

function toKstDateString(date: Date): string {
  const kstOffset = 9 * 60 * 60 * 1000;
  return new Date(date.getTime() + kstOffset).toISOString().slice(0, 10);
}

function subtractDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function getThisWeekMonday(): string {
  const kstOffset = 9 * 60 * 60 * 1000;
  const nowKst = new Date(Date.now() + kstOffset);
  const dayOfWeek = nowKst.getUTCDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(nowKst.getTime() - daysFromMonday * 86400000);
  return monday.toISOString().slice(0, 10);
}

function getThisWeekSunday(): string {
  const monday = getThisWeekMonday();
  return subtractDays(monday, -6);
}

export async function checkAndAwardMilestone(userId: string, streak: number): Promise<void> {
  if (!(MILESTONE_VALUES as readonly number[]).includes(streak)) return;

  const { data: existing } = await supabase
    .from('streak_milestones')
    .select('id')
    .eq('user_id', userId)
    .eq('milestone', streak)
    .maybeSingle();

  if (existing != null) return;

  await supabase.from('streak_milestones').insert({
    user_id: userId,
    milestone: streak,
    achieved_at: new Date().toISOString(),
    badge_shown: false,
  });
}

export interface WeeklyRecapData {
  photos: Photo[];
  weekStart: string;
  weekEnd: string;
  milestone: RecapMilestone;
}

export type RecapMilestone = 7 | 14 | 30;

export async function loadWeeklyRecapData(userId: string): Promise<WeeklyRecapData> {
  return loadRecapData(userId, 7);
}

export async function loadRecapData(userId: string, milestone: RecapMilestone): Promise<WeeklyRecapData> {
  const today = toKstDateString(new Date());
  const weekStart = milestone === 7 ? getThisWeekMonday() : subtractDays(today, milestone - 1);
  const weekEnd = milestone === 7 ? getThisWeekSunday() : today;

  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('user_id', userId)
    .gte('streak_date', weekStart)
    .lte('streak_date', weekEnd)
    .order('taken_at', { ascending: false });

  if (error != null) {
    throw new Error(`리캡 기록 로드 실패: ${error.message}`);
  }

  return { photos: data ?? [], weekStart, weekEnd, milestone };
}
