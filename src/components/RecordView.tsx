import React, { useState, useMemo } from 'react';
import {
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  Alert,
} from 'react-native';
import { Button, colors } from '@toss/tds-react-native';
import { Photo, getPhotoUrl, deletePhoto, setRepresentativePhoto } from '../lib/supabase';
import { MapWebView } from './MapWebView';
import { track } from '../lib/analytics';
import { StreakCounter } from './StreakCounter';
import { BottomSheetModal } from './BottomSheetModal';

type RecordViewMode = 'map' | 'calendar';
type StatsSheetMode = 'records' | 'places' | null;

interface PlaceGroup {
  placeName: string;
  photos: Photo[];
}

interface PendingPhotoSelection {
  photo: Photo;
  group?: Photo[];
}

function toKstDateString(date: Date): string {
  const kstOffset = 9 * 60 * 60 * 1000;
  return new Date(date.getTime() + kstOffset).toISOString().slice(0, 10);
}

function formatKoreanDate(dateStr: string): string {
  const parts = dateStr.split('-');
  const month = parseInt(parts[1] ?? '1', 10);
  const day = parseInt(parts[2] ?? '1', 10);
  return `${month}월 ${day}일`;
}

interface CalendarViewProps {
  photos: Photo[];
  streak: number;
  onPhotoPress: (photo: Photo, group?: Photo[]) => void;
  onRecordsPress: () => void;
  onPlacesPress: () => void;
}

function CalendarView({
  photos,
  streak,
  onPhotoPress,
  onRecordsPress,
  onPlacesPress,
}: CalendarViewProps) {
  const today = toKstDateString(new Date());
  const todayParts = today.split('-').map(Number);
  const todayYear = todayParts[0] as number;
  const todayMonth = todayParts[1] as number;

  const [year, setYear] = useState<number>(todayYear);
  const [month, setMonth] = useState<number>(todayMonth);

  const goToPrevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const isCurrentMonth = year === todayYear && month === todayMonth;

  const photosByDate = new Map<string, Photo[]>();
  photos.forEach((photo) => {
    const current = photosByDate.get(photo.streak_date);
    if (current == null) {
      photosByDate.set(photo.streak_date, [photo]);
      return;
    }
    current.push(photo);
  });

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
        <TouchableOpacity onPress={goToPrevMonth} activeOpacity={0.7} style={calStyles.monthNavButton}>
          <Text style={calStyles.monthNavText}>‹</Text>
        </TouchableOpacity>
        <Text style={calStyles.monthTitle}>
          {year}년 {month}월
        </Text>
        <TouchableOpacity
          onPress={goToNextMonth}
          activeOpacity={0.7}
          style={calStyles.monthNavButton}
          disabled={isCurrentMonth}
        >
          <Text style={[calStyles.monthNavText, isCurrentMonth && calStyles.monthNavTextDisabled]}>›</Text>
        </TouchableOpacity>
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
          const datePhotos = [...(photosByDate.get(dateStr) ?? [])].sort((a, b) =>
            b.taken_at.localeCompare(a.taken_at)
          );
          const photo = datePhotos.find((p) => p.is_representative) ?? datePhotos[0] ?? null;
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
                  onPress={() => onPhotoPress(photo, datePhotos)}
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
        <TouchableOpacity
          style={calStyles.statItem}
          onPress={onRecordsPress}
          activeOpacity={0.72}
          disabled={photos.length === 0}
        >
          <Text style={calStyles.statValue}>📸 {photos.length}장</Text>
          <View style={calStyles.statLabelRow}>
            <Text style={calStyles.statLabel}>총 기록</Text>
            <Text style={calStyles.statChevron}>›</Text>
          </View>
        </TouchableOpacity>
        <View style={calStyles.statDivider} />
        <TouchableOpacity
          style={calStyles.statItem}
          onPress={onPlacesPress}
          activeOpacity={0.72}
          disabled={uniquePlaces === 0}
        >
          <Text style={calStyles.statValue}>📍 {uniquePlaces}곳</Text>
          <View style={calStyles.statLabelRow}>
            <Text style={calStyles.statLabel}>방문 장소</Text>
            <Text style={calStyles.statChevron}>›</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface RecordViewProps {
  photos: Photo[];
  onPhotosChange: (photos: Photo[]) => void;
  streak: number;
}

export function RecordView({ photos, onPhotosChange, streak }: RecordViewProps) {
  const [mode, setMode] = useState<RecordViewMode>('map');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [statsSheetMode, setStatsSheetMode] = useState<StatsSheetMode>(null);
  const [selectedPlaceGroup, setSelectedPlaceGroup] = useState<PlaceGroup | null>(null);
  const [selectedRecordPhoto, setSelectedRecordPhoto] = useState<Photo | null>(null);
  const [pendingPhotoSelection, setPendingPhotoSelection] = useState<PendingPhotoSelection | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingRepresentative, setIsSettingRepresentative] = useState(false);

  const [displayPhoto, setDisplayPhoto] = useState<Photo | null>(null);
  const [displayGroup, setDisplayGroup] = useState<Photo[]>([]);

  const sortedPhotos = useMemo(
    () => [...photos].sort((a, b) => b.taken_at.localeCompare(a.taken_at)),
    [photos]
  );

  const photosByDate = useMemo(() => {
    const groups = new Map<string, Photo[]>();
    sortedPhotos.forEach((photo) => {
      const current = groups.get(photo.streak_date);
      if (current == null) {
        groups.set(photo.streak_date, [photo]);
        return;
      }
      current.push(photo);
    });
    return groups;
  }, [sortedPhotos]);

  const placeGroups = useMemo(() => {
    const groups = new Map<string, Photo[]>();
    photos.forEach((photo) => {
      const placeName = photo.place_name?.trim();
      if (placeName == null || placeName.length === 0) return;
      const current = groups.get(placeName);
      if (current == null) {
        groups.set(placeName, [photo]);
        return;
      }
      current.push(photo);
    });

    return [...groups.entries()]
      .map(([placeName, groupPhotos]) => ({
        placeName,
        photos: [...groupPhotos].sort((a, b) => b.taken_at.localeCompare(a.taken_at)),
      }))
      .sort((a, b) => b.photos.length - a.photos.length || a.placeName.localeCompare(b.placeName));
  }, [photos]);

  const handleModeChange = (newMode: RecordViewMode) => {
    setMode(newMode);
    track('record_tab_view_changed', { view: newMode });
  };

  const handlePinTap = (photo: Photo, group?: Photo[]) => {
    setSelectedPhoto(photo);
    setDisplayPhoto(photo);
    setDisplayGroup(group && group.length > 1 ? group : []);
  };

  const closePhotoSheet = () => {
    setSelectedPhoto(null);
  };

  const selectPhotoInSheet = (photo: Photo) => {
    setSelectedPhoto(photo);
    setDisplayPhoto(photo);
  };

  const handleStatsPhotoPress = (photo: Photo) => {
    if (statsSheetMode === 'records' && selectedPlaceGroup == null) {
      setSelectedRecordPhoto(photo);
      return;
    }

    setPendingPhotoSelection({
      photo,
      group: selectedPlaceGroup?.photos ?? photosByDate.get(photo.streak_date),
    });
    setStatsSheetMode(null);
  };

  const handleStatsPlacePress = (group: PlaceGroup) => {
    setSelectedPlaceGroup(group);
  };

  const closeStatsSheet = () => {
    setPendingPhotoSelection(null);
    setStatsSheetMode(null);
  };

  const handleStatsSheetExitComplete = () => {
    setSelectedPlaceGroup(null);
    setSelectedRecordPhoto(null);
    if (pendingPhotoSelection == null) return;

    handlePinTap(pendingPhotoSelection.photo, pendingPhotoSelection.group);
    setPendingPhotoSelection(null);
  };

  const handleSetRepresentative = async () => {
    if (displayPhoto == null) return;
    try {
      setIsSettingRepresentative(true);
      await setRepresentativePhoto(displayPhoto);
      
      const updatedPhotos = photos.map(p => {
        if (p.streak_date !== displayPhoto.streak_date) return p;
        return { ...p, is_representative: p.id === displayPhoto.id };
      });
      onPhotosChange(updatedPhotos);
      setDisplayPhoto({ ...displayPhoto, is_representative: true });
      
      Alert.alert('대표 사진 설정', '이 날의 대표 사진으로 설정되었어요.');
    } catch (e) {
      console.error(e);
      Alert.alert('오류', '대표 사진 설정에 실패했어요.');
    } finally {
      setIsSettingRepresentative(false);
    }
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

  const statsSheetTitle =
    selectedRecordPhoto != null
      ? formatKoreanDate(selectedRecordPhoto.streak_date)
      : statsSheetMode === 'records'
      ? '전체 기록'
      : selectedPlaceGroup?.placeName ?? '방문 장소';

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
            />
            <CalendarView
              photos={photos}
              streak={streak}
              onPhotoPress={handlePinTap}
              onRecordsPress={() => {
                setSelectedPlaceGroup(null);
                setSelectedRecordPhoto(null);
                setStatsSheetMode('records');
              }}
              onPlacesPress={() => {
                setSelectedPlaceGroup(null);
                setSelectedRecordPhoto(null);
                setStatsSheetMode('places');
              }}
            />
          </ScrollView>
        )}
      </View>

      <BottomSheetModal
        visible={statsSheetMode != null}
        onClose={closeStatsSheet}
        sheetStyle={styles.statsSheet}
        onExitComplete={handleStatsSheetExitComplete}
      >
            <View style={styles.statsSheetHeader}>
              {(selectedPlaceGroup != null || selectedRecordPhoto != null) && (
                <TouchableOpacity
                  style={styles.statsBackButton}
                  onPress={() => {
                    setSelectedPlaceGroup(null);
                    setSelectedRecordPhoto(null);
                  }}
                  activeOpacity={0.72}
                >
                  <Text style={styles.statsBackButtonText}>{'←'}</Text>
                </TouchableOpacity>
              )}
              <View style={styles.statsHeaderTitleBlock}>
                <Text style={styles.statsSheetTitle}>{statsSheetTitle}</Text>
                <Text style={styles.statsSheetSubtitle}>
                  {statsSheetMode === 'records'
                    ? selectedRecordPhoto != null
                      ? selectedRecordPhoto.place_name ?? '기록 상세'
                      : `${sortedPhotos.length}개의 사진`
                    : selectedPlaceGroup != null
                      ? `${selectedPlaceGroup.photos.length}개의 기록`
                      : `${placeGroups.length}곳의 장소`}
                </Text>
              </View>
              <Button
                type="dark"
                style="weak"
                size="tiny"
                onPress={closeStatsSheet}
              >
                닫기
              </Button>
            </View>

            {statsSheetMode === 'records' && selectedRecordPhoto != null ? (
              <ScrollView
                style={styles.statsList}
                contentContainerStyle={styles.recordDetailContent}
                showsVerticalScrollIndicator={false}
              >
                <Image
                  source={{ uri: getPhotoUrl(selectedRecordPhoto.storage_path) }}
                  style={styles.recordDetailImage}
                  resizeMode="cover"
                />
                <View style={styles.recordDetailBody}>
                  <Text style={styles.recordTitle}>{formatKoreanDate(selectedRecordPhoto.streak_date)}</Text>
                  {selectedRecordPhoto.place_name != null && selectedRecordPhoto.place_name !== '' && (
                    <Text style={styles.recordMeta}>{selectedRecordPhoto.place_name}</Text>
                  )}
                  {selectedRecordPhoto.memo != null && selectedRecordPhoto.memo !== '' && (
                    <Text style={styles.recordDetailMemo}>{selectedRecordPhoto.memo}</Text>
                  )}
                </View>
              </ScrollView>
            ) : statsSheetMode === 'records' ? (
              <FlatList
                data={sortedPhotos}
                keyExtractor={(item) => item.id}
                style={styles.statsList}
                contentContainerStyle={styles.statsListContent}
                initialNumToRender={12}
                windowSize={7}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.recordRow}
                    onPress={() => handleStatsPhotoPress(item)}
                    activeOpacity={0.75}
                  >
                    <Image
                      source={{ uri: getPhotoUrl(item.storage_path) }}
                      style={styles.recordThumb}
                      resizeMode="cover"
                    />
                    <View style={styles.recordTexts}>
                      <Text style={styles.recordTitle}>{formatKoreanDate(item.streak_date)}</Text>
                      {item.place_name != null && item.place_name !== '' && (
                        <Text style={styles.recordMeta} numberOfLines={1}>
                          {item.place_name}
                        </Text>
                      )}
                      {item.memo != null && item.memo !== '' && (
                        <Text style={styles.recordMemo} numberOfLines={1}>
                          {item.memo}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                )}
              />
            ) : selectedPlaceGroup != null ? (
              <FlatList
                data={selectedPlaceGroup.photos}
                keyExtractor={(item) => item.id}
                style={styles.statsList}
                contentContainerStyle={styles.statsListContent}
                initialNumToRender={12}
                windowSize={7}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.recordRow}
                    onPress={() => handleStatsPhotoPress(item)}
                    activeOpacity={0.75}
                  >
                    <Image
                      source={{ uri: getPhotoUrl(item.storage_path) }}
                      style={styles.recordThumb}
                      resizeMode="cover"
                    />
                    <View style={styles.recordTexts}>
                      <Text style={styles.recordTitle}>{formatKoreanDate(item.streak_date)}</Text>
                      {item.memo != null && item.memo !== '' && (
                        <Text style={styles.recordMemo} numberOfLines={1}>
                          {item.memo}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                )}
              />
            ) : (
              <FlatList
                data={placeGroups}
                keyExtractor={(item) => item.placeName}
                style={styles.statsList}
                contentContainerStyle={styles.statsListContent}
                initialNumToRender={12}
                windowSize={7}
                renderItem={({ item }) => {
                  const firstPhoto = item.photos[0];
                  if (firstPhoto == null) return null;

                  return (
                    <TouchableOpacity
                      style={styles.placeRow}
                      onPress={() => handleStatsPlacePress(item)}
                      activeOpacity={0.75}
                    >
                      <Image
                        source={{ uri: getPhotoUrl(firstPhoto.storage_path) }}
                        style={styles.recordThumb}
                        resizeMode="cover"
                      />
                      <View style={styles.recordTexts}>
                        <Text style={styles.recordTitle} numberOfLines={1}>
                          {item.placeName}
                        </Text>
                        <Text style={styles.recordMeta}>
                          {item.photos.length}개의 기록
                        </Text>
                        <Text style={styles.recordMemo} numberOfLines={1}>
                          최근 {formatKoreanDate(firstPhoto.streak_date)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
      </BottomSheetModal>

      <BottomSheetModal
        visible={selectedPhoto != null}
        onClose={closePhotoSheet}
        sheetStyle={styles.photoBottomSheet}
        onExitComplete={() => {
          setDisplayPhoto(null);
          setDisplayGroup([]);
        }}
      >
            {displayPhoto != null && (
              <View style={styles.photoSheetContent}>
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
                          onPress={() => selectPhotoInSheet(p)}
                          activeOpacity={0.75}
                          style={styles.groupThumbnailButton}
                        >
                          <Image
                            source={{ uri: getPhotoUrl(p.storage_path) }}
                            style={styles.groupThumbnailImage}
                            resizeMode="cover"
                          />
                          {isSelected && <View style={styles.groupThumbnailSelectedBorder} />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
                <View style={styles.detailImageWrapper}>
                  <Image
                    source={{ uri: getPhotoUrl(displayPhoto.storage_path) }}
                    style={styles.detailImage}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.detailBody}>
                  <Text style={styles.detailDate}>{formatKoreanDate(displayPhoto.streak_date)}</Text>
                  {displayPhoto.place_name != null && displayPhoto.place_name !== '' && (
                    <Text style={styles.detailPlace}>📍 {displayPhoto.place_name}</Text>
                  )}
                  {displayPhoto.memo != null && displayPhoto.memo !== '' && (
                    <Text style={styles.detailMemo}>{displayPhoto.memo}</Text>
                  )}
                  
                  <Button
                    type="primary"
                    style="weak"
                    size="medium"
                    display="full"
                    onPress={handleSetRepresentative}
                    disabled={displayPhoto.is_representative || isSettingRepresentative}
                    loading={isSettingRepresentative}
                    viewStyle={styles.repButton}
                    containerStyle={styles.actionButtonContainer}
                  >
                    {displayPhoto.is_representative ? '현재 대표 사진' : '대표 사진으로 설정'}
                  </Button>
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
              </View>
            )}
      </BottomSheetModal>
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
  statsSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '78%',
    overflow: 'hidden',
  },
  statsSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey100,
  },
  statsBackButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  statsBackButtonText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.grey700,
  },
  statsHeaderTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  statsSheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.grey900,
  },
  statsSheetSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: colors.grey500,
  },
  statsList: {
    maxHeight: Dimensions.get('window').height * 0.62,
  },
  statsListContent: {
    padding: 16,
    gap: 10,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  recordThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: colors.grey200,
  },
  recordTexts: {
    flex: 1,
    minWidth: 0,
  },
  recordTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.grey900,
  },
  recordMeta: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '600',
    color: colors.grey600,
  },
  recordMemo: {
    marginTop: 2,
    fontSize: 12,
    color: colors.grey500,
  },
  recordDetailContent: {
    padding: 16,
    gap: 14,
  },
  recordDetailImage: {
    width: '100%',
    aspectRatio: 1.35,
    borderRadius: 12,
    backgroundColor: colors.grey200,
  },
  recordDetailBody: {
    gap: 6,
  },
  recordDetailMemo: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.grey700,
  },
  bottomSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    overflow: 'hidden',
  },
  photoBottomSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: Dimensions.get('window').height * 0.86,
    overflow: 'hidden',
  },
  photoSheetContent: {},
  groupThumbnailScroll: {
    backgroundColor: colors.grey50,
    height: 84,
    flexGrow: 0,
    flexShrink: 0,
  },
  groupThumbnailContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    alignItems: 'center',
  },
  groupThumbnailButton: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
  },
  groupThumbnailImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  groupThumbnailSelectedBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.blue500,
  },
  detailImageWrapper: {
    margin: 12,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.grey200,
  },
  detailImage: {
    width: '100%',
    aspectRatio: 1.4,
  },
  detailBody: {
    padding: 16,
    paddingBottom: 28,
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
  repButton: {
    marginTop: 16,
  },
  deleteButton: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.grey100,
    paddingTop: 16,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.grey900,
  },
  monthNavButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavText: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.grey700,
  },
  monthNavTextDisabled: {
    color: colors.grey300,
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
    position: 'relative',
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
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.grey500,
  },
  statChevron: {
    fontSize: 16,
    color: colors.grey400,
    lineHeight: 16,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.grey200,
  },
});
