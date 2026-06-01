import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Badge, Button, colors } from '@toss/tds-react-native';
import { brandColors } from '../lib/theme';
import { Photo, getPhotoUrl } from '../lib/supabase';

const WEEK_DAYS = ['일', '월', '화', '수', '목', '금', '토'];

function getTodayKoreanLabel(): string {
  const kstOffset = 9 * 60 * 60 * 1000;
  const now = new Date(Date.now() + kstOffset);
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  const weekDay = WEEK_DAYS[now.getUTCDay()] ?? '';
  return `${month}월 ${day}일 ${weekDay}요일`;
}

interface TodayPhotoProps {
  todayPhotos: Photo[];
  maxDailyPhotos?: number;
  onSelectBestPhoto?: (photo: Photo) => void;
  onDeletePhoto?: (photo: Photo) => void;
  settingBestPhotoId?: string | null;
  deletingPhotoId?: string | null;
}

export function TodayPhoto({
  todayPhotos,
  maxDailyPhotos,
  onSelectBestPhoto,
  onDeletePhoto,
  settingBestPhotoId,
  deletingPhotoId,
}: TodayPhotoProps) {
  const todayPhoto = useMemo(
    () =>
      todayPhotos.find((photo) => photo.is_representative) ??
      [...todayPhotos].sort((a, b) => b.taken_at.localeCompare(a.taken_at))[0] ??
      null,
    [todayPhotos]
  );
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(false);
  const emptyEnterAnim = useRef(new Animated.Value(0)).current;
  const emptyScaleAnim = useRef(new Animated.Value(0.92)).current;
  const selectedPhoto = useMemo(
    () => todayPhotos.find((photo) => photo.id === selectedPhotoId) ?? todayPhoto,
    [selectedPhotoId, todayPhoto, todayPhotos]
  );

  useEffect(() => {
    if (todayPhoto == null) {
      emptyEnterAnim.setValue(0);
      emptyScaleAnim.setValue(0.92);
      Animated.parallel([
        Animated.spring(emptyScaleAnim, {
          toValue: 1,
          tension: 60,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.timing(emptyEnterAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
    if (todayPhoto == null) {
      setSelectedPhotoId(null);
      setShowControls(false);
      return;
    }
    setSelectedPhotoId((prev) => {
      if (prev != null && todayPhotos.some((photo) => photo.id === prev)) {
        return prev;
      }
      return todayPhoto.id;
    });
    setShowControls(false);
  }, [emptyEnterAnim, emptyScaleAnim, todayPhoto, todayPhotos]);

  if (todayPhoto != null && selectedPhoto != null) {
    const countLabel = maxDailyPhotos != null ? `${todayPhotos.length}/${maxDailyPhotos}장` : null;

    return (
      <View style={styles.container}>
        <Text style={styles.dateLabel}>{getTodayKoreanLabel()}</Text>
        <View style={styles.titleRow}>
          <Text style={styles.sectionTitle}>오늘의 샷</Text>
          {countLabel != null && (
            <Badge size="small" type="blue" badgeStyle="weak">
              {countLabel}
            </Badge>
          )}
        </View>
        <TouchableOpacity style={styles.photoFrame} onPress={() => setShowControls((prev) => !prev)} activeOpacity={1}>
          <Image source={{ uri: getPhotoUrl(selectedPhoto.storage_path) }} style={styles.photo} resizeMode="cover" />
          {showControls && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => onDeletePhoto?.(selectedPhoto)}
              disabled={deletingPhotoId != null}
              activeOpacity={0.75}
            >
              <Text style={styles.deleteButtonText}>{deletingPhotoId === selectedPhoto.id ? '삭제 중' : '삭제'}</Text>
            </TouchableOpacity>
          )}
          {selectedPhoto.place_name != null && selectedPhoto.place_name !== '' && (
            <View style={styles.placeTag}>
              <Text style={styles.placeText}>📍 {selectedPhoto.place_name}</Text>
            </View>
          )}
        </TouchableOpacity>
        {todayPhotos.length > 1 && (
          <View style={styles.thumbnailRow}>
            {todayPhotos.map((photo) => {
              const isBestPhoto = photo.id === todayPhoto.id;
              const isSelected = photo.id === selectedPhoto.id;
              const isSetting = settingBestPhotoId === photo.id;
              const isDeleting = deletingPhotoId === photo.id;

              return (
                <TouchableOpacity
                  key={photo.id}
                  style={[
                    styles.thumbnailButton,
                    isBestPhoto && styles.thumbnailButtonBest,
                    isSelected && !isBestPhoto && styles.thumbnailButtonSelected,
                  ]}
                  onPress={() => setSelectedPhotoId(photo.id)}
                  disabled={isSetting || isDeleting || deletingPhotoId != null}
                  activeOpacity={0.75}
                >
                  <Image
                    source={{ uri: getPhotoUrl(photo.storage_path) }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                  />
                  {isBestPhoto && (
                    <View style={styles.thumbnailBadge}>
                      <Text style={styles.thumbnailBadgeText}>베스트</Text>
                    </View>
                  )}
                  {isSelected && !isBestPhoto && (
                    <View style={styles.thumbnailBadge}>
                      <Text style={styles.thumbnailBadgeText}>선택</Text>
                    </View>
                  )}
                  {(isSetting || isDeleting) && (
                    <View style={styles.thumbnailDim}>
                      <Text style={styles.thumbnailDimText}>{isSetting ? '설정 중' : '삭제 중'}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        {todayPhotos.length > 1 && (
          <Button
            type="primary"
            style="weak"
            size="medium"
            display="full"
            onPress={() => onSelectBestPhoto?.(selectedPhoto)}
            disabled={selectedPhoto.is_representative || settingBestPhotoId != null || deletingPhotoId != null}
            loading={settingBestPhotoId === selectedPhoto.id}
            containerStyle={styles.bestButtonContainer}
          >
            {selectedPhoto.is_representative ? '현재 베스트 샷' : '베스트 샷으로 설정'}
          </Button>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.dateLabel}>{getTodayKoreanLabel()}</Text>
      <Text style={styles.sectionTitle}>오늘의 샷</Text>
      <Animated.View style={[styles.emptyFrame, { opacity: emptyEnterAnim, transform: [{ scale: emptyScaleAnim }] }]}>
        <Text style={styles.emptyIcon}>📸</Text>
        <Text style={styles.emptyText}>오늘의 베스트 샷을 남겨보세요</Text>
        <Text style={styles.emptyHint}>오늘 찍은 사진 중 가장 맘에 드는 샷을 선택해 보세요</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    gap: 10,
    flex: 1,
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.grey500,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.grey900,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  photoFrame: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.grey200,
    flex: 1,
    minHeight: 200,
  },
  thumbnailRow: {
    flexDirection: 'row',
    gap: 8,
  },
  thumbnailButton: {
    flex: 1,
    aspectRatio: 1.45,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.grey200,
    backgroundColor: colors.grey100,
  },
  thumbnailButtonSelected: {
    borderColor: colors.grey700,
  },
  thumbnailButtonBest: {
    borderColor: brandColors.primary,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailBadge: {
    position: 'absolute',
    left: 5,
    bottom: 5,
    borderRadius: 999,
    backgroundColor: brandColors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  thumbnailBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  thumbnailDim: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  thumbnailDimText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
  },
  photo: {
    width: '100%',
    height: '100%',
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
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.52)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  deleteButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  bestButtonContainer: {
    borderRadius: 12,
  },
  emptyFrame: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.grey200,
    borderStyle: 'dashed',
    flex: 1,
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.grey50,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.grey700,
  },
  emptyHint: {
    fontSize: 13,
    color: colors.grey500,
  },
});
