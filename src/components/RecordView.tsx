import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Photo, getPhotoUrl, deletePhoto } from '../lib/supabase';
import { MapWebView } from './MapWebView';
import { track } from '../lib/analytics';

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
  const photosByDate = new Map(photos.map((p) => [p.streak_date, p]));
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
    <ScrollView contentContainerStyle={calStyles.container}>
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
    </ScrollView>
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
  const [isDeleting, setIsDeleting] = useState(false);

  const handleModeChange = (newMode: RecordViewMode) => {
    setMode(newMode);
    track('record_tab_view_changed', { view: newMode });
  };

  const handleDelete = async () => {
    if (selectedPhoto == null) return;
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
          <MapWebView photos={photos} onPinTap={setSelectedPhoto} showPath={streak >= 3} />
        ) : (
          <CalendarView photos={photos} streak={streak} onPhotoPress={setSelectedPhoto} />
        )}
      </View>

      <Modal
        visible={selectedPhoto != null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedPhoto(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.bottomSheet}>
            {selectedPhoto != null && (
              <ScrollView>
                <Image
                  source={{ uri: getPhotoUrl(selectedPhoto.storage_path) }}
                  style={styles.detailImage}
                  resizeMode="cover"
                />
                <View style={styles.detailBody}>
                  <Text style={styles.detailDate}>{selectedPhoto.streak_date}</Text>
                  {selectedPhoto.place_name != null && selectedPhoto.place_name !== '' && (
                    <Text style={styles.detailPlace}>📍 {selectedPhoto.place_name}</Text>
                  )}
                  {selectedPhoto.memo != null && selectedPhoto.memo !== '' && (
                    <Text style={styles.detailMemo}>{selectedPhoto.memo}</Text>
                  )}
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <ActivityIndicator color="#DC2626" />
                    ) : (
                      <Text style={styles.deleteText}>삭제</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  segmentRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#F3F4F6',
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
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  segmentTextActive: {
    color: '#111827',
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
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    overflow: 'hidden',
  },
  detailImage: {
    width: '100%',
    aspectRatio: 1.4,
    backgroundColor: '#E5E7EB',
  },
  detailBody: {
    padding: 16,
    gap: 8,
  },
  detailDate: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  detailPlace: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  detailMemo: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 21,
  },
  deleteButton: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  deleteText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 14,
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
    color: '#111827',
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
    color: '#9CA3AF',
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
    backgroundColor: '#F3F4F6',
  },
  dayCircleActive: {
    backgroundColor: '#0064FF',
  },
  dayCircleToday: {
    borderWidth: 2,
    borderColor: '#0064FF',
    backgroundColor: '#EFF6FF',
  },
  dayNum: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  dayNumActive: {
    color: 'white',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 24,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
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
    color: '#111827',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
  },
});
