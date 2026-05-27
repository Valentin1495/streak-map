import React, { useState, useEffect, useRef } from 'react';
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { Button, colors } from '@toss/tds-react-native';
import { Photo, getPhotoUrl, deletePhoto } from '../lib/supabase';
import { MapWebView } from './MapWebView';
import { track } from '../lib/analytics';
import { StreakCounter } from './StreakCounter';
import { WeekStrip } from './WeekStrip';

type RecordViewMode = 'map' | 'calendar';

function toKstDateString(date: Date): string {
  const kstOffset = 9 * 60 * 60 * 1000;
  return new Date(date.getTime() + kstOffset).toISOString().slice(0, 10);
}

interface CalendarViewProps {
  photos: Photo[];
  streak: number;
  onPhotoPress: (photo: Photo) => void;
}

function CalendarView({ photos, streak, onPhotoPress }: CalendarViewProps) {
  const photosByDate = new Map<string, Photo>();
  photos.forEach((photo) => {
    const current = photosByDate.get(photo.streak_date);
    if (current == null || photo.is_representative) {
      photosByDate.set(photo.streak_date, photo);
    }
  });
  const today = toKstDateString(new Date());
  const parts = today.split('-').map(Number);
  const year = parts[0] as number;
  const month = parts[1] as number;

  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const lastDay = new Date(Date.UTC(year, month, 0));
  const startOffset = firstDay.getUTCDay();
  const totalDays = lastDay.getUTCDate();

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  const uniquePlaces = new Set(
    photos.filter((p) => p.place_name != null && p.place_name !== '').map((p) => p.place_name)
  ).size;

  return (
    <View style={calStyles.container}>
      <View style={calStyles.monthHeader}>
        <Text style={calStyles.monthTitle}>
          {year}년 {month}월
        </Text>
      </View>

      <View style={calStyles.dayHeaders}>
        {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
          <Text key={d} style={calStyles.dayHeader}>
            {d}
          </Text>
        ))}
      </View>

      <View style={calStyles.grid}>
        {cells.map((day, idx) => {
          if (day == null) {
            return <View key={`empty-${idx}`} style={calStyles.cell} />;
          }
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const photo = photosByDate.get(dateStr) ?? null;
          const hasPhoto = photo != null;
          const isToday = dateStr === today;
          const dayContent = (
            <View
              style={[
                calStyles.dayCircle,
                hasPhoto && calStyles.dayCircleActive,
                isToday && !hasPhoto && calStyles.dayCircleToday,
              ]}
            >
              <Text
                style={[calStyles.dayNum, hasPhoto && calStyles.dayNumActive]}
              >
                {day}
              </Text>
            </View>
          );

          return (
            <View key={dateStr} style={calStyles.cell}>
              {photo != null ? (
                <TouchableOpacity
                  onPress={() => onPhotoPress(photo)}
                  activeOpacity={0.72}
                  hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                >
                  {dayContent}
                </TouchableOpacity>
              ) : (
                dayContent
              )}
            </View>
          );
        })}
      </View>

      <View style={calStyles.statsRow}>
        <View style={calStyles.statItem}>
          <Text style={calStyles.statValue}>🔥 {streak}일</Text>
          <Text style={calStyles.statLabel}>현재 스트릭</Text>
        </View>
        <View style={calStyles.statDivider} />
        <View style={calStyles.statItem}>
          <Text style={calStyles.statValue}>📸 {photos.length}장</Text>
          <Text style={calStyles.statLabel}>총 기록</Text>
        </View>
        <View style={calStyles.statDivider} />
        <View style={calStyles.statItem}>
          <Text style={calStyles.statValue}>📍 {uniquePlaces}곳</Text>
          <Text style={calStyles.statLabel}>방문 장소</Text>
        </View>
      </View>
    </View>
  );
}

interface RecordViewProps {
  photos: Photo[];
  onPhotosChange: (photos: Photo[]) => void;
  streak: number;
  ticketCount?: number;
}

export function RecordView({ photos, onPhotosChange, streak, ticketCount }: RecordViewProps) {
  const [mode, setMode] = useState<RecordViewMode>('map');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [groupPhotos, setGroupPhotos] = useState<Photo[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Custom Bottom Sheet Animation States
  const [modalVisible, setModalVisible] = useState(false);
  const [displayPhoto, setDisplayPhoto] = useState<Photo | null>(null);
  const [displayGroup, setDisplayGroup] = useState<Photo[]>([]);
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (selectedPhoto != null) {
      setDisplayPhoto(selectedPhoto);
      setDisplayGroup(groupPhotos);
      setModalVisible(true);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: Dimensions.get('window').height,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setModalVisible(false);
        setDisplayPhoto(null);
        setDisplayGroup([]);
      });
    }
  }, [selectedPhoto, groupPhotos, slideAnim, fadeAnim]);

  const handleModeChange = (newMode: RecordViewMode) => {
    setMode(newMode);
    track('record_tab_view_changed', { view: newMode });
  };

  const handlePinTap = (photo: Photo, group?: Photo[]) => {
    setSelectedPhoto(photo);
    setGroupPhotos(group && group.length > 1 ? group : []);
  };

  const handleDelete = () => {
    if (selectedPhoto == null) return;
    
    Alert.alert(
      '사진을 삭제할까요?',
      '삭제한 사진은 복구할 수 없어요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              await deletePhoto(selectedPhoto);
              onPhotosChange(photos.filter((p) => p.id !== selectedPhoto.id));
              setSelectedPhoto(null);
            } catch (e) {
              console.error(e);
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>기록</Text>
      </View>

      <View style={styles.segmentRow}>
        <TouchableOpacity
          style={[styles.segment, mode === 'map' && styles.segmentActive]}
          onPress={() => handleModeChange('map')}
          activeOpacity={0.7}
        >
          <Text style={[styles.segmentText, mode === 'map' && styles.segmentTextActive]}>
            🗺 지도 보기
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, mode === 'calendar' && styles.segmentActive]}
          onPress={() => handleModeChange('calendar')}
          activeOpacity={0.7}
        >
          <Text style={[styles.segmentText, mode === 'calendar' && styles.segmentTextActive]}>
            📅 캘린더 보기
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {mode === 'map' ? (
          <MapWebView photos={photos} onPinTap={handlePinTap} showPath={streak >= 3} />
        ) : (
          <ScrollView>
            <StreakCounter
              streak={streak}
              hasTodayRecord={photos.some((photo) => photo.streak_date === toKstDateString(new Date()))}
              ticketCount={ticketCount}
            />
            <WeekStrip photos={photos} />
            <CalendarView photos={photos} streak={streak} onPhotoPress={handlePinTap} />
          </ScrollView>
        )}
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setSelectedPhoto(null)}
          />
          <Animated.View
            style={[
              styles.bottomSheet,
              {
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {displayPhoto != null && (
              <ScrollView
                style={styles.bottomSheetContent}
                showsVerticalScrollIndicator={false}
              >
                {displayGroup.length > 1 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.groupThumbnailScroll}
                    contentContainerStyle={styles.groupThumbnailContent}
                  >
                    {displayGroup.map((p) => {
                      const isSelected = displayPhoto.id === p.id;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          onPress={() => setSelectedPhoto(p)}
                          activeOpacity={0.75}
                          style={[
                            styles.groupThumbnailButton,
                            isSelected && styles.groupThumbnailButtonSelected,
                          ]}
                        >
                          <Image
                            source={{ uri: getPhotoUrl(p.storage_path) }}
                            style={styles.groupThumbnailImage}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
                <Image
                  source={{ uri: getPhotoUrl(displayPhoto.storage_path) }}
                  style={styles.detailImage}
                  resizeMode="cover"
                />
                <View style={styles.detailBody}>
                  <Text style={styles.detailDate}>{displayPhoto.streak_date}</Text>
                  {displayPhoto.place_name != null && displayPhoto.place_name !== '' && (
                    <Text style={styles.detailPlace}>📍 {displayPhoto.place_name}</Text>
                  )}
                  {displayPhoto.memo != null && displayPhoto.memo !== '' && (
                    <Text style={styles.detailMemo}>{displayPhoto.memo}</Text>
                  )}
                  <Button
                    type="danger"
                    style="weak"
                    size="medium"
                    display="full"
                    onPress={handleDelete}
                    disabled={isDeleting}
                    loading={isDeleting}
                    viewStyle={styles.deleteButton}
                    containerStyle={styles.actionButtonContainer}
                  >
                    삭제
                  </Button>
                </View>
              </ScrollView>
            )}
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.grey50,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.grey900,
  },
  segmentRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.grey100,
    borderRadius: 12,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  segmentActive: {
    backgroundColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.grey600,
  },
  segmentTextActive: {
    color: colors.grey900,
  },
  content: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    overflow: 'hidden',
  },
  bottomSheetContent: {
    maxHeight: Dimensions.get('window').height * 0.7,
  },
  groupThumbnailScroll: {
    backgroundColor: colors.grey50,
  },
  groupThumbnailContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  groupThumbnailButton: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  groupThumbnailButtonSelected: {
    borderColor: colors.blue500,
  },
  groupThumbnailImage: {
    width: '100%',
    height: '100%',
  },
  detailImage: {
    width: '100%',
    aspectRatio: 1.4,
    backgroundColor: colors.grey200,
  },
  detailBody: {
    padding: 16,
    gap: 8,
  },
  detailDate: {
    fontSize: 12,
    color: colors.grey600,
    fontWeight: '600',
  },
  detailPlace: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.grey900,
  },
  detailMemo: {
    fontSize: 14,
    color: colors.grey700,
    lineHeight: 21,
  },
  deleteButton: {
    marginTop: 12,
  },
  actionButtonContainer: {
    borderRadius: 10,
  },
});

const calStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  monthHeader: {
    paddingVertical: 12,
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.grey900,
  },
  dayHeaders: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: colors.grey500,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.grey100,
  },
  dayCircleActive: {
    backgroundColor: colors.blue500,
  },
  dayCircleToday: {
    borderWidth: 2,
    borderColor: colors.blue500,
    backgroundColor: colors.blue50,
  },
  dayNum: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.grey700,
  },
  dayNumActive: {
    color: colors.white,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 24,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.grey900,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.grey500,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.grey200,
  },
});
