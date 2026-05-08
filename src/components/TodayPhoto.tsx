import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Photo, getPhotoUrl } from '../lib/supabase';

interface TodayPhotoProps {
  todayPhoto: Photo | null;
}

export function TodayPhoto({ todayPhoto }: TodayPhotoProps) {
  if (todayPhoto != null) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>오늘의 한 컷</Text>
        <View style={styles.photoFrame}>
          <Image
            source={{ uri: getPhotoUrl(todayPhoto.storage_path) }}
            style={styles.photo}
            resizeMode="cover"
          />
          {todayPhoto.place_name != null && todayPhoto.place_name !== '' && (
            <View style={styles.placeTag}>
              <Text style={styles.placeText}>📍 {todayPhoto.place_name}</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>오늘의 한 컷</Text>
      <View style={styles.emptyFrame}>
        <Text style={styles.emptyIcon}>📷</Text>
        <Text style={styles.emptyText}>오늘의 한 컷을 남겨보세요</Text>
        <Text style={styles.emptyHint}>매일 한 장씩 쌓이는 나의 기록</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  photoFrame: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  photo: {
    width: '100%',
    aspectRatio: 1.6,
  },
  placeTag: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  placeText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyFrame: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    aspectRatio: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FAFAFA',
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  emptyHint: {
    fontSize: 13,
    color: '#9CA3AF',
  },
});
