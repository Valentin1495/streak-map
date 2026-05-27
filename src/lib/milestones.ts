import { supabase, Photo } from './supabase';

const MILESTONE_VALUES = [3, 7, 14, 30, 100] as const;
const MAX_TICKETS = 2;
const REWARDED_AD_SOURCE = 'rewarded_ad';
const CONTACTS_VIRAL_SOURCE = 'contacts_viral';

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
  const dayOfWeek = nowKst.getUTCDay(); // 0=Sun, 1=Mon...
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(nowKst.getTime() - daysFromMonday * 86400000);
  return monday.toISOString().slice(0, 10);
}

function getThisWeekSunday(): string {
  const monday = getThisWeekMonday();
  return subtractDays(monday, -6); // +6 days
}

/**
 * 촬영 완료 후 호출. 마일스톤 달성 시 streak_milestones에 기록하고,
 * 7일 달성 시 기록 보호권을 1개 지급한다 (최대 2개 한도).
 */
export async function checkAndAwardMilestone(
  userId: string,
  streak: number
): Promise<void> {
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

  if (streak === 7) {
    const { count } = await supabase
      .from('protection_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('used_at', null);

    const currentCount = count ?? 0;
    if (currentCount < MAX_TICKETS) {
      await supabase.from('protection_tickets').insert({
        user_id: userId,
        earned_at: new Date().toISOString(),
        earned_date: toKstDateString(new Date()),
        source: 'milestone',
      });
    }
  }
}

export type RewardedAdTicketResult = 'granted' | 'already_claimed_today' | 'max_reached';
export type ContactsViralTicketResult = 'granted' | 'already_claimed_today' | 'max_reached';

export async function hasClaimedRewardedAdTicketToday(userId: string): Promise<boolean> {
  const today = toKstDateString(new Date());
  const { data, error } = await supabase
    .from('protection_tickets')
    .select('id')
    .eq('user_id', userId)
    .eq('source', REWARDED_AD_SOURCE)
    .eq('earned_date', today)
    .maybeSingle();

  if (error != null) {
    throw new Error(`광고 보상 확인 실패: ${error.message}`);
  }

  return data != null;
}

export async function grantRewardedAdProtectionTicket(
  userId: string
): Promise<RewardedAdTicketResult> {
  const today = toKstDateString(new Date());

  if (await hasClaimedRewardedAdTicketToday(userId)) {
    return 'already_claimed_today';
  }

  const currentCount = await getProtectionTicketCount(userId);
  if (currentCount >= MAX_TICKETS) {
    return 'max_reached';
  }

  const { error } = await supabase.from('protection_tickets').insert({
    user_id: userId,
    earned_at: new Date().toISOString(),
    earned_date: today,
    source: REWARDED_AD_SOURCE,
  });

  if (error != null) {
    if (error.code === '23505') {
      return 'already_claimed_today';
    }
    throw new Error(`광고 보상 지급 실패: ${error.message}`);
  }

  return 'granted';
}

export async function grantContactsViralProtectionTicket(
  userId: string
): Promise<ContactsViralTicketResult> {
  const today = toKstDateString(new Date());

  const { data: existing, error: existingError } = await supabase
    .from('protection_tickets')
    .select('id')
    .eq('user_id', userId)
    .eq('source', CONTACTS_VIRAL_SOURCE)
    .eq('earned_date', today)
    .maybeSingle();

  if (existingError != null) {
    throw new Error(`공유 리워드 확인 실패: ${existingError.message}`);
  }

  if (existing != null) {
    return 'already_claimed_today';
  }

  const currentCount = await getProtectionTicketCount(userId);
  if (currentCount >= MAX_TICKETS) {
    return 'max_reached';
  }

  const { error } = await supabase.from('protection_tickets').insert({
    user_id: userId,
    earned_at: new Date().toISOString(),
    earned_date: today,
    source: CONTACTS_VIRAL_SOURCE,
  });

  if (error != null) {
    if (error.code === '23505') {
      return 'already_claimed_today';
    }
    throw new Error(`공유 리워드 지급 실패: ${error.message}`);
  }

  return 'granted';
}

export type ProtectionResult = 'used' | 'none' | 'no_ticket';

/**
 * 앱 진입 / focus 시 호출.
 * 어제 기록이 없으면 보호권을 자동 소비한다.
 * 반환값: 'used'=소비됨, 'none'=누락 없음, 'no_ticket'=누락 있지만 티켓 없음
 */
export async function applyProtectionIfNeeded(
  userId: string
): Promise<ProtectionResult> {
  const today = toKstDateString(new Date());
  const yesterday = subtractDays(today, 1);

  // 어제 기록 확인
  const { data: yesterdayPhoto } = await supabase
    .from('photos')
    .select('id')
    .eq('user_id', userId)
    .eq('streak_date', yesterday)
    .maybeSingle();

  if (yesterdayPhoto != null) return 'none';

  const dayBefore = subtractDays(today, 2);
  const { data: recentUsed } = await supabase
    .from('protection_tickets')
    .select('id')
    .eq('user_id', userId)
    .eq('used_for_date', dayBefore)
    .maybeSingle();

  if (recentUsed != null) return 'no_ticket';

  const { data: dayBeforePhoto } = await supabase
    .from('photos')
    .select('id')
    .eq('user_id', userId)
    .eq('streak_date', dayBefore)
    .maybeSingle();

  if (dayBeforePhoto == null) return 'none';

  // 미사용 티켓 중 가장 오래된 것
  const { data: ticket } = await supabase
    .from('protection_tickets')
    .select('id')
    .eq('user_id', userId)
    .is('used_at', null)
    .order('earned_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (ticket == null) return 'no_ticket';

  await supabase
    .from('protection_tickets')
    .update({ used_at: new Date().toISOString(), used_for_date: yesterday })
    .eq('id', ticket.id);

  return 'used';
}

/**
 * 미사용 기록 보호권 개수 반환
 */
export async function getProtectionTicketCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('protection_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('used_at', null);

  return count ?? 0;
}

export async function loadUsedProtectionDates(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('protection_tickets')
    .select('used_for_date')
    .eq('user_id', userId)
    .not('used_at', 'is', null);

  if (error != null) {
    throw new Error(`보호권 사용 날짜 로드 실패: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => row.used_for_date)
    .filter((date): date is string => typeof date === 'string' && date.length > 0);
}

export interface WeeklyRecapData {
  photos: Photo[];
  weekStart: string;
  weekEnd: string;
}

/**
 * 이번 주 월~일 기준 사진 데이터 반환 (최신순)
 */
export async function loadWeeklyRecapData(userId: string): Promise<WeeklyRecapData> {
  const weekStart = getThisWeekMonday();
  const weekEnd = getThisWeekSunday();

  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('user_id', userId)
    .gte('streak_date', weekStart)
    .lte('streak_date', weekEnd)
    .order('taken_at', { ascending: false });

  if (error != null) {
    throw new Error(`주간 기록 로드 실패: ${error.message}`);
  }

  return { photos: data ?? [], weekStart, weekEnd };
}
