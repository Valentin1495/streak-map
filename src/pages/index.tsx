import React, { useCallback, useEffect, useState } from 'react';
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
import { createRoute } from '@granite-js/react-native';
import { getAnonymousKey } from '@apps-in-toss/framework';
import { loadPhotos, deletePhoto, getPhotoUrl, Photo } from '../lib/supabase';
import { calculateStreak, hasTodayRecord } from '../lib/streak';
import { MapWebView } from '../components/MapWebView';
import { StreakBanner } from '../components/StreakBanner';

export const Route = createRoute('/', {
  component: HomePage,
});

function HomePage() {
  const navigation = Route.useNavigation();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayDone = hasTodayRecord(photos);
  const streak = calculateStreak(photos);

  const fetchPhotos = useCallback(async (uid: string) => {
    try {
      const data = await loadPhotos(uid);
      setPhotos(data);
    } catch (e) {
      setError('사진 목록을 불러오지 못했어요.');
      console.error(e);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const result = await getAnonymousKey();
        if (result === undefined || result === 'ERROR') {
          setError('유저 정보를 가져오지 못했어요.');
          return;
        }
        const uid = result.hash;
        setUserId(uid);
        await fetchPhotos(uid);
      } catch (e) {
        setError('초기화에 실패했어요.');
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const handleDelete = async () => {
    if (selectedPhoto == null || userId == null) return;
    try {
      setIsDeleting(true);
      await deletePhoto(selectedPhoto);
      setPhotos((prev) => prev.filter((p) => p.id !== selectedPhoto.id));
      setSelectedPhoto(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0064FF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Streak Map</Text>
      </View>

      <StreakBanner streak={streak} hasTodayRecord={todayDone} />

      {error != null && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.mapContainer}>
        <MapWebView photos={photos} onPinTap={setSelectedPhoto} />
      </View>

      <View style={styles.fab}>
        <TouchableOpacity
          style={[styles.fabButton, todayDone && styles.fabButtonDone]}
          onPress={() => navigation.navigate('/capture')}
          activeOpacity={0.85}
        >
          <Text style={styles.fabIcon}>📷</Text>
          <Text style={styles.fabText}>{todayDone ? '더 기록하기' : '오늘 기록 남기기'}</Text>
        </TouchableOpacity>
      </View>

      {/* 핀 상세 모달 */}
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0064FF',
  },
  errorBar: {
    backgroundColor: '#FEE2E2',
    marginHorizontal: 16,
    borderRadius: 8,
    padding: 10,
    marginBottom: 4,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: 0,
    marginBottom: 96,
  },
  fab: {
    position: 'absolute',
    bottom: 28,
    left: 16,
    right: 16,
  },
  fabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0064FF',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
    shadowColor: '#0064FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabButtonDone: {
    backgroundColor: '#374151',
    shadowColor: '#374151',
  },
  fabIcon: {
    fontSize: 20,
  },
  fabText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
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
