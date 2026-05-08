import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getTossShareLink, share } from '@apps-in-toss/framework';
import { getPhotoUrl } from '../lib/supabase';
import { loadWeeklyRecapData, WeeklyRecapData } from '../lib/milestones';

const SHARE_DEEP_LINK = 'intoss://dayshot';

interface WeeklyRecapCardProps {
  visible: boolean;
  userId: string;
  streak: number;
  onClose: () => void;
}

export function WeeklyRecapCard({ visible, userId, streak, onClose }: WeeklyRecapCardProps) {
  const [data, setData] = useState<WeeklyRecapData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setIsLoading(true);
    loadWeeklyRecapData(userId)
      .then(setData)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [visible, userId]);

  const handleShare = async () => {
    if (isSharing) return;

    setIsSharing(true);
    try {
      const photoCount = data?.photos.length ?? 0;
      const placeCount = uniquePlaces.length;
      const shareLink = await getTossShareLink(SHARE_DEEP_LINK);
      const message = [
        `오늘 한 컷에서 ${streak}일 연속 기록 중이에요.`,
        `이번 주 ${photoCount}장의 순간${placeCount > 0 ? `, ${placeCount}곳의 장소` : ''}를 모았어요.`,
        shareLink,
      ].join('\n');

      await share({ message });
    } catch (error) {
      console.warn('Weekly recap share failed:', error);
      Alert.alert('공유에 실패했어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSharing(false);
    }
  };

  const representativePhoto = data?.photos[0] ?? null;
  const uniquePlaces = data != null
    ? [...new Set(
        data.photos
          .map((p) => p.place_name)
          .filter((n): n is string => n != null && n !== '')
      )].slice(0, 3)
    : [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>이번 주 기록 🗺</Text>
            <Text style={styles.headerStreak}>{streak}일 연속 중</Text>
          </View>

          {isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#0064FF" />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              {representativePhoto != null ? (
                <View style={styles.photoFrame}>
                  <Image
                    source={{ uri: getPhotoUrl(representativePhoto.storage_path) }}
                    style={styles.photo}
                    resizeMode="cover"
                  />
                  <View style={styles.photoOverlay}>
                    <Text style={styles.photoDate}>{representativePhoto.streak_date}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.emptyPhoto}>
                  <Text style={styles.emptyPhotoText}>이번 주 기록이 없어요</Text>
                </View>
              )}

              {uniquePlaces.length > 0 && (
                <View style={styles.placesRow}>
                  {uniquePlaces.map((place) => (
                    <View key={place} style={styles.placeChip}>
                      <Text style={styles.placeChipText}>📍 {place}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{data?.photos.length ?? 0}장</Text>
                  <Text style={styles.statLabel}>이번 주 기록</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{uniquePlaces.length}곳</Text>
                  <Text style={styles.statLabel}>방문 장소</Text>
                </View>
              </View>
            </ScrollView>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.shareButton, isSharing && styles.shareButtonDisabled]}
              onPress={handleShare}
              disabled={isSharing}
              activeOpacity={0.8}
            >
              <Text style={styles.shareButtonText}>
                {isSharing ? '공유 준비 중' : '공유하기'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.closeButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  headerStreak: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0064FF',
    marginTop: 2,
  },
  loadingBox: {
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 20,
    gap: 16,
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
  photoOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  photoDate: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyPhoto: {
    height: 160,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPhotoText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  placesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  placeChip: {
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  placeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0064FF',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 32,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  shareButton: {
    flex: 1,
    backgroundColor: '#0064FF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  shareButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  shareButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '800',
  },
  closeButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '700',
  },
});
