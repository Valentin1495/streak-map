import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://szegjcutxoiwwwegfkfk.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_4gTR06O_jxPF3js6ST__hw_Yk-KpP8f';
const BUCKET = 'streak-photos';
export const MAX_DAILY_PHOTOS = 3;
export const MAX_REWARDED_DAILY_PHOTOS = 4;

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export interface Photo {
  id: string;
  user_id: string;
  storage_path: string;
  lat: number | null;
  lng: number | null;
  place_name: string | null;
  memo: string | null;
  taken_at: string;
  streak_date: string;
  is_representative: boolean;
}

export interface InsertPhotoParams {
  userId: string;
  imageBase64: string;
  lat: number | null;
  lng: number | null;
  placeName: string | null;
  memo: string | null;
}

function toKstDateString(date: Date): string {
  const kstOffset = 9 * 60 * 60 * 1000;
  return new Date(date.getTime() + kstOffset).toISOString().slice(0, 10);
}

export async function loadPhotos(userId: string): Promise<Photo[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('user_id', userId)
    .order('taken_at', { ascending: false });

  if (error != null) {
    throw new Error(`사진 목록 로드 실패: ${error.message}`);
  }
  return data ?? [];
}

export async function insertPhoto(params: InsertPhotoParams): Promise<Photo> {
  const { userId, imageBase64, lat, lng, placeName, memo } = params;
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const timestamp = now.getTime();
  const storagePath = `${userId}/${year}/${month}/${timestamp}.webp`;

  const binary = Uint8Array.from(atob(imageBase64.replace(/^data:image\/\w+;base64,/, '')), (c) =>
    c.charCodeAt(0)
  );

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, binary, { contentType: 'image/webp', upsert: false });

  if (uploadError != null) {
    throw new Error(`이미지 업로드 실패: ${uploadError.message}`);
  }

  // KST 기준 streak_date (UTC+9)
  const streakDate = toKstDateString(now);
  const { data: existingPhotos, error: existingError } = await supabase
    .from('photos')
    .select('*')
    .eq('user_id', userId)
    .eq('streak_date', streakDate)
    .order('taken_at', { ascending: false });

  if (existingError != null) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error(`기존 오늘 기록 확인 실패: ${existingError.message}`);
  }

  const dailyPhotos = existingPhotos ?? [];

  const { data, error: insertError } = await supabase
    .from('photos')
    .insert({
      user_id: userId,
      storage_path: storagePath,
      lat,
      lng,
      place_name: placeName,
      memo,
      taken_at: now.toISOString(),
      streak_date: streakDate,
      is_representative: dailyPhotos.length === 0,
    })
    .select()
    .single();

  if (insertError != null) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error(`사진 정보 저장 실패: ${insertError.message}`);
  }
  return data;
}

export async function hasClaimedPhotoSlotRewardToday(
  userId: string,
  date = toKstDateString(new Date())
): Promise<boolean> {
  const { data, error } = await supabase
    .from('daily_photo_slot_rewards')
    .select('id')
    .eq('user_id', userId)
    .eq('reward_date', date)
    .maybeSingle();

  if (error != null) {
    throw new Error(`사진 슬롯 보상 확인 실패: ${error.message}`);
  }

  return data != null;
}

export async function getDailyPhotoLimit(userId: string): Promise<number> {
  return (await hasClaimedPhotoSlotRewardToday(userId))
    ? MAX_REWARDED_DAILY_PHOTOS
    : MAX_DAILY_PHOTOS;
}

export type PhotoSlotRewardResult = 'granted' | 'already_claimed_today';

export async function grantPhotoSlotReward(userId: string): Promise<PhotoSlotRewardResult> {
  const today = toKstDateString(new Date());

  const { error } = await supabase.from('daily_photo_slot_rewards').insert({
    user_id: userId,
    reward_date: today,
    rewarded_at: new Date().toISOString(),
    source: 'rewarded_ad',
  });

  if (error != null) {
    if (error.code === '23505') {
      return 'already_claimed_today';
    }
    throw new Error(`사진 슬롯 보상 지급 실패: ${error.message}`);
  }

  return 'granted';
}

export async function deletePhoto(photo: Photo): Promise<void> {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([photo.storage_path]);
  if (storageError != null) {
    throw new Error(`이미지 삭제 실패: ${storageError.message}`);
  }

  const { error: dbError } = await supabase.from('photos').delete().eq('id', photo.id);
  if (dbError != null) {
    throw new Error(`사진 정보 삭제 실패: ${dbError.message}`);
  }

  if (photo.is_representative) {
    const { data: nextPhoto, error: nextPhotoError } = await supabase
      .from('photos')
      .select('id')
      .eq('user_id', photo.user_id)
      .eq('streak_date', photo.streak_date)
      .order('taken_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (nextPhotoError != null) {
      throw new Error(`대표 사진 확인 실패: ${nextPhotoError.message}`);
    }

    if (nextPhoto != null) {
      const { error: updateError } = await supabase
        .from('photos')
        .update({ is_representative: true })
        .eq('id', nextPhoto.id);

      if (updateError != null) {
        throw new Error(`대표 사진 변경 실패: ${updateError.message}`);
      }
    }
  }
}

export async function setRepresentativePhoto(photo: Photo): Promise<void> {
  const { error: resetError } = await supabase
    .from('photos')
    .update({ is_representative: false })
    .eq('user_id', photo.user_id)
    .eq('streak_date', photo.streak_date);

  if (resetError != null) {
    throw new Error(`기존 대표 사진 해제 실패: ${resetError.message}`);
  }

  const { error: updateError } = await supabase
    .from('photos')
    .update({ is_representative: true })
    .eq('id', photo.id);

  if (updateError != null) {
    throw new Error(`대표 사진 설정 실패: ${updateError.message}`);
  }
}

export function getPhotoUrl(storagePath: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}
