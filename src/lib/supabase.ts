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
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + kstOffset);
  const streakDate = kstDate.toISOString().slice(0, 10);

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
    throw new Error(`사진 정보 저장 실패: ${insertError.message}`);
  }
  return data;
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
