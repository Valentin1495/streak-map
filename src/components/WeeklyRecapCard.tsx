import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, colors } from '@toss/tds-react-native';
import { getPhotoUrl } from '../lib/supabase';
import { loadRecapData, RecapMilestone, WeeklyRecapData } from '../lib/milestones';
import { brandColors } from '../lib/theme';
import { BottomSheetModal } from './BottomSheetModal';

interface WeeklyRecapCardProps {
  visible: boolean;
  userId: string;
  streak: number;
  milestone?: RecapMilestone;
  onClose: () => void;
}

function SkeletonBlock({ height, style }: { height: number; style?: object }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View style={[{ height, borderRadius: 16, backgroundColor: colors.grey100, opacity: pulse }, style]} />
  );
}

const RECAP_TITLES: Record<RecapMilestone, string> = {
  7: '주간 요약',
  14: '2주 요약',
  30: '월간 요약',
};

export function WeeklyRecapCard({ visible, userId, streak, milestone = 7, onClose }: WeeklyRecapCardProps) {
  const [data, setData] = useState<WeeklyRecapData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;

    setIsLoading(true);
    loadRecapData(userId, milestone)
      .then(setData)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [milestone, userId, visible]);

  const representativePhotos =
    data != null
      ? (() => {
          const byDate = new Map<string, typeof data.photos>();
          data.photos.forEach((p) => {
            const current = byDate.get(p.streak_date) ?? [];
            current.push(p);
            byDate.set(p.streak_date, current);
          });
          const reps = Array.from(byDate.values())
            .map((photos) => photos.find((p) => p.is_representative) ?? photos[0])
            .filter((p): p is NonNullable<typeof p> => p != null);
          return reps.sort((a, b) => b.taken_at.localeCompare(a.taken_at));
        })()
      : [];

  const screenWidth = Dimensions.get('window').width;
  const singlePhotoWidth = screenWidth - 40;
  const multiplePhotoWidth = screenWidth * 0.72;

  const placeCounts =
    data != null
      ? [
          ...data.photos
            .reduce((acc, photo) => {
              const placeName = photo.place_name?.trim();
              if (placeName == null || placeName.length === 0) return acc;
              acc.set(placeName, (acc.get(placeName) ?? 0) + 1);
              return acc;
            }, new Map<string, number>())
            .entries(),
        ].sort((a, b) => b[1] - a[1])
      : [];
  const uniquePlaces = placeCounts.slice(0, 3).map(([place]) => place);

  return (
    <BottomSheetModal visible={visible} onClose={onClose} sheetStyle={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{RECAP_TITLES[milestone]}</Text>
        <Text style={styles.headerStreak}>{streak}일 연속 기록</Text>
      </View>

      {isLoading ? (
        <View style={styles.skeletonBox}>
          <SkeletonBlock height={200} style={styles.skeletonPhoto} />
          <SkeletonBlock height={64} style={styles.skeletonStats} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {representativePhotos.length > 0 ? (
            <View style={styles.photoSection}>
              <Text style={styles.sectionTitle}>
                {representativePhotos.length > 1 ? '이 기간의 대표 사진들' : '이 기간의 대표 사진'}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.photoScrollView}
                contentContainerStyle={styles.photoScrollContent}
                snapToInterval={representativePhotos.length > 1 ? multiplePhotoWidth + 12 : undefined}
                decelerationRate="fast"
              >
                {representativePhotos.map((photo) => (
                  <View
                    key={photo.id}
                    style={[
                      styles.photoFrame,
                      { width: representativePhotos.length > 1 ? multiplePhotoWidth : singlePhotoWidth },
                    ]}
                  >
                    <Image source={{ uri: getPhotoUrl(photo.storage_path) }} style={styles.photo} resizeMode="cover" />
                    <View style={styles.photoOverlay}>
                      <Text style={styles.photoDate}>{photo.streak_date}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.emptyPhoto}>
              <Text style={styles.emptyPhotoText}>이 기간의 기록이 없어요</Text>
            </View>
          )}

          {uniquePlaces.length > 0 && (
            <View style={styles.placesRow}>
              {uniquePlaces.map((place) => (
                <Badge key={place} size="small" type="blue" badgeStyle="weak">
                  {`📍 ${place}`}
                </Badge>
              ))}
            </View>
          )}

          {placeCounts.length > 0 && (
            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>장소 요약</Text>
              <Text style={styles.summaryText}>
                {placeCounts
                  .slice(0, 3)
                  .map(([place, count]) => `${place} ${count}회`)
                  .join(' · ')}
              </Text>
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{data?.photos.length ?? 0}개</Text>
              <Text style={styles.statLabel}>기록</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{placeCounts.length}곳</Text>
              <Text style={styles.statLabel}>방문 장소</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{streak}일</Text>
              <Text style={styles.statLabel}>연속 기록</Text>
            </View>
          </View>
        </ScrollView>
      )}

      <View style={styles.actions}>
        <Button
          type="dark"
          style="weak"
          size="medium"
          display="full"
          onPress={onClose}
          viewStyle={styles.actionButton}
          containerStyle={styles.actionButtonContainer}
        >
          닫기
        </Button>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
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
    borderBottomColor: colors.grey100,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.grey900,
  },
  headerStreak: {
    fontSize: 13,
    fontWeight: '600',
    color: brandColors.primary,
    marginTop: 2,
  },
  skeletonBox: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 16,
  },
  skeletonPhoto: {
    marginBottom: 0,
  },
  skeletonStats: {
    marginBottom: 0,
  },
  body: {
    paddingVertical: 20,
    gap: 20,
  },
  photoSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.grey900,
    paddingHorizontal: 20,
  },
  photoScrollView: {
    flexGrow: 0,
  },
  photoScrollContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  photoFrame: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.grey200,
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
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyPhoto: {
    height: 160,
    backgroundColor: colors.grey100,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
  },
  emptyPhotoText: {
    fontSize: 14,
    color: colors.grey500,
    fontWeight: '600',
  },
  placesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
  },
  summaryBox: {
    backgroundColor: colors.grey50,
    borderRadius: 14,
    padding: 14,
    gap: 4,
    marginHorizontal: 20,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.grey900,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.grey600,
    lineHeight: 19,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.grey50,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.grey900,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.grey500,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.grey200,
  },
  actions: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: colors.grey100,
  },
  actionButton: {
    alignSelf: 'stretch',
  },
  actionButtonContainer: {
    borderRadius: 12,
  },
});
