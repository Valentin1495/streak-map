import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { contactsViral } from '@apps-in-toss/framework';
import { Badge, Button, colors } from '@toss/tds-react-native';
import { getPhotoUrl } from '../lib/supabase';
import {
  grantContactsViralProtectionTicket,
  loadWeeklyRecapData,
  WeeklyRecapData,
} from '../lib/milestones';

// 앱스인토스 콘솔의 미니앱 > 공유 리워드 메뉴에서 발급된 moduleId를 넣으면 리워드형 공유가 열려요.
const SHARE_REWARD_MODULE_ID = '';

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
  const shareRewardCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!visible) return;
    setIsLoading(true);
    loadWeeklyRecapData(userId)
      .then(setData)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [visible, userId]);

  useEffect(() => {
    if (visible) return;
    shareRewardCleanupRef.current?.();
    shareRewardCleanupRef.current = null;
    setIsSharing(false);
  }, [visible]);

  useEffect(() => {
    return () => {
      shareRewardCleanupRef.current?.();
      shareRewardCleanupRef.current = null;
    };
  }, []);

  const handleShare = async () => {
    if (isSharing) return;

    const finishSharing = () => {
      shareRewardCleanupRef.current?.();
      shareRewardCleanupRef.current = null;
      setIsSharing(false);
    };

    setIsSharing(true);
    try {
      const shareRewardModuleId = SHARE_REWARD_MODULE_ID.trim();
      if (shareRewardModuleId.length === 0) {
        setIsSharing(false);
        Alert.alert('공유 리워드 설정이 필요해요', '앱스인토스 콘솔에서 발급된 moduleId를 설정해 주세요.');
        return;
      }

      shareRewardCleanupRef.current?.();
      const cleanup = contactsViral({
        options: { moduleId: shareRewardModuleId },
        onEvent: (event) => {
          if (event.type === 'sendViral') {
            void grantContactsViralProtectionTicket(userId)
              .then((result) => {
                if (result === 'granted') {
                  Alert.alert('기록 보호권을 받았어요', '공유 리워드로 기록 보호권 1개가 지급됐어요.');
                  return;
                }

                if (result === 'already_claimed_today') {
                  Alert.alert('오늘 리워드를 이미 받았어요', '공유 리워드는 하루에 한 번 받을 수 있어요.');
                  return;
                }

                Alert.alert('보유 한도에 도달했어요', '기록 보호권은 최대 2개까지 보유할 수 있어요.');
              })
              .catch((error) => {
                console.warn('Weekly recap reward grant failed:', error);
                Alert.alert('공유 리워드 지급에 실패했어요', '잠시 후 다시 시도해 주세요.');
              })
              .finally(finishSharing);
            return;
          }

          if (event.type === 'close' && event.data.closeReason === 'noReward') {
            Alert.alert('받을 수 있는 리워드가 없어요', '오늘 받을 수 있는 공유 리워드를 이미 받았거나 남은 리워드가 없어요.');
          }

          finishSharing();
        },
        onError: (error) => {
          console.warn('Weekly recap reward share failed:', error);
          finishSharing();
          Alert.alert('공유 리워드에 실패했어요', '잠시 후 다시 시도해 주세요.');
        },
      });

      if (cleanup == null) {
        setIsSharing(false);
        Alert.alert('공유 리워드를 사용할 수 없어요', '토스앱을 최신 버전으로 업데이트한 뒤 다시 시도해 주세요.');
        return;
      }

      shareRewardCleanupRef.current = cleanup;
    } catch (error) {
      console.warn('Weekly recap share failed:', error);
      setIsSharing(false);
      Alert.alert('공유에 실패했어요', '잠시 후 다시 시도해 주세요.');
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
              <ActivityIndicator size="large" color={colors.blue500} />
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
                    <Badge key={place} size="small" type="blue" badgeStyle="weak">
                      {`📍 ${place}`}
                    </Badge>
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
            <Button
              type="primary"
              style="fill"
              size="medium"
              display="full"
              onPress={handleShare}
              disabled={isSharing}
              loading={isSharing}
              viewStyle={styles.actionButton}
              containerStyle={styles.actionButtonContainer}
            >
              {isSharing ? '공유 준비 중' : '친구에게 공유하고 보호권 받기'}
            </Button>
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
    color: colors.blue500,
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
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.grey50,
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
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 32,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.grey100,
  },
  actionButton: {
    flex: 1,
  },
  actionButtonContainer: {
    borderRadius: 12,
  },
});
