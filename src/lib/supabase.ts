import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://szegjcutxoiwwwegfkfk.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_4gTR06O_jxPF3js6ST__hw_Yk-KpP8f';
const BUCKET = 'streak-photos';

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
}

export interface InsertPhotoParams {
  userId: string;
  imageBase64: string;
  lat: number | null;
  lng: number | null;
  placeName: string | null;
  memo: string | null;
  replaceDate?: string;
  replacementSource?: string;
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
  const replaceDate = params.replaceDate ?? streakDate;

  const { data: existingPhotos, error: existingError } = await supabase
    .from('photos')
    .select('*')
    .eq('user_id', userId)
    .eq('streak_date', replaceDate)
    .order('taken_at', { ascending: false });

  if (existingError != null) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error(`기존 오늘 기록 확인 실패: ${existingError.message}`);
  }

  const existingPhoto = existingPhotos?.[0] ?? null;
  if (existingPhoto != null) {
    const { data, error: updateError } = await supabase
      .from('photos')
      .update({
        storage_path: storagePath,
        lat,
        lng,
        place_name: placeName,
        memo,
        taken_at: now.toISOString(),
        streak_date: streakDate,
      })
      .eq('id', existingPhoto.id)
      .select()
      .single();

    if (updateError != null) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      throw new Error(`기존 오늘 기록 교체 실패: ${updateError.message}`);
    }

    const duplicateIds = existingPhotos.slice(1).map((photo) => photo.id);
    if (duplicateIds.length > 0) {
      const { error: deleteDuplicateError } = await supabase
        .from('photos')
        .delete()
        .in('id', duplicateIds);

      if (deleteDuplicateError != null) {
        console.warn('중복 오늘 기록 정리 실패:', deleteDuplicateError.message);
      }
    }

    const oldStoragePaths = existingPhotos.map((photo) => photo.storage_path);
    const { error: deleteStorageError } = await supabase.storage
      .from(BUCKET)
      .remove(oldStoragePaths);

    if (deleteStorageError != null) {
      console.warn('기존 오늘 사진 파일 삭제 실패:', deleteStorageError.message);
    }

    const { error: replacementLogError } = await supabase
      .from('daily_photo_replacements')
      .insert({
        user_id: userId,
        replacement_date: replaceDate,
        replaced_at: now.toISOString(),
        source: params.replacementSource ?? 'free',
      });

    if (replacementLogError != null) {
      console.warn('오늘 한 컷 교체 기록 저장 실패:', replacementLogError.message);
    }

    return data;
  }

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
    })
    .select()
    .single();

  if (insertError != null) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error(`사진 정보 저장 실패: ${insertError.message}`);
  }
  return data;
}

export async function getDailyReplacementCount(
  userId: string,
  date = toKstDateString(new Date())
): Promise<number> {
  const { count, error } = await supabase
    .from('daily_photo_replacements')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('replacement_date', date);

  if (error != null) {
    throw new Error(`오늘 한 컷 교체 횟수 확인 실패: ${error.message}`);
  }

  return count ?? 0;
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
}

export function getPhotoUrl(storagePath: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}
