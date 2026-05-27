import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Badge, Button, colors } from '@toss/tds-react-native';
import { Photo, getPhotoUrl } from '../lib/supabase';

interface TodayPhotoProps {
  todayPhotos: Photo[];
  maxDailyPhotos?: number;
  onSelectRepresentative?: (photo: Photo) => void;
  onDeletePhoto?: (photo: Photo) => void;
  settingRepresentativePhotoId?: string | null;
  deletingPhotoId?: string | null;
}

export function TodayPhoto({
  todayPhotos,
  maxDailyPhotos,
  onSelectRepresentative,
  onDeletePhoto,
  settingRepresentativePhotoId,
  deletingPhotoId,
}: TodayPhotoProps) {
  const todayPhoto = todayPhotos.find((photo) => photo.is_representative) ?? todayPhotos[0] ?? null;
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const selectedPhoto = useMemo(
    () => todayPhotos.find((photo) => photo.id === selectedPhotoId) ?? todayPhoto,
    [selectedPhotoId, todayPhoto, todayPhotos]
  );

  useEffect(() => {
    if (todayPhoto == null) {
      setSelectedPhotoId(null);
      return;
    }
    setSelectedPhotoId((prev) => {
      if (prev != null && todayPhotos.some((photo) => photo.id === prev)) {
        return prev;
      }
      return todayPhoto.id;
    });
  }, [todayPhoto, todayPhotos]);

  if (todayPhoto != null && selectedPhoto != null) {
    const countLabel =
      maxDailyPhotos != null
        ? `${todayPhotos.length}/${maxDailyPhotos}장`
        : null;

    return (
      <View style={styles.container}>
        <View style={styles.titleRow}>
          <Text style={styles.sectionTitle}>오늘의 컷</Text>
          {countLabel != null && (
            <Badge size="small" type="blue" badgeStyle="weak">
              {countLabel}
            </Badge>
          )}
        </View>
        <View style={styles.photoFrame}>
          <Image
            source={{ uri: getPhotoUrl(selectedPhoto.storage_path) }}
            style={styles.photo}
            resizeMode="cover"
          />
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => onDeletePhoto?.(selectedPhoto)}
            disabled={deletingPhotoId != null}
            activeOpacity={0.75}
          >
            <Text style={styles.deleteButtonText}>
              {deletingPhotoId === selectedPhoto.id ? '삭제 중' : '삭제'}
            </Text>
          </TouchableOpacity>
          {selectedPhoto.place_name != null && selectedPhoto.place_name !== '' && (
            <View style={styles.placeTag}>
              <Text style={styles.placeText}>📍 {selectedPhoto.place_name}</Text>
            </View>
          )}
        </View>
        {todayPhotos.length > 1 && (
          <View style={styles.thumbnailRow}>
            {todayPhotos.map((photo) => {
              const isRepresentative = photo.id === todayPhoto.id;
              const isSelected = photo.id === selectedPhoto.id;
              const isSetting = settingRepresentativePhotoId === photo.id;
              const isDeleting = deletingPhotoId === photo.id;

              return (
                <TouchableOpacity
                  key={photo.id}
                  style={[
                    styles.thumbnailButton,
                    isRepresentative && styles.thumbnailButtonActive,
                    isSelected && !isRepresentative && styles.thumbnailButtonSelected,
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
                  {isRepresentative && (
                    <View style={styles.thumbnailBadge}>
                      <Text style={styles.thumbnailBadgeText}>대표</Text>
                    </View>
                  )}
                  {isSelected && !isRepresentative && (
                    <View style={styles.thumbnailBadge}>
                      <Text style={styles.thumbnailBadgeText}>선택</Text>
                    </View>
                  )}
                  {(isSetting || isDeleting) && (
                    <View style={styles.thumbnailDim}>
                      <Text style={styles.thumbnailDimText}>
                        {isDeleting ? '삭제 중' : '설정 중'}
                      </Text>
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
            onPress={() => onSelectRepresentative?.(selectedPhoto)}
            disabled={selectedPhoto.is_representative || settingRepresentativePhotoId != null || deletingPhotoId != null}
            loading={settingRepresentativePhotoId === selectedPhoto.id}
            containerStyle={styles.representativeButtonContainer}
          >
            {selectedPhoto.is_representative ? '현재 대표 사진' : '이 사진을 대표로 지정'}
          </Button>
        )}
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
    flex: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
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
  thumbnailButtonActive: {
    borderColor: colors.blue500,
  },
  thumbnailButtonSelected: {
    borderColor: colors.grey700,
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
    backgroundColor: colors.blue500,
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
  representativeButtonContainer: {
    borderRadius: 12,
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
