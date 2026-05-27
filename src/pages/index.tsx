import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createRoute } from '@granite-js/react-native';
import { getAnonymousKey, loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/framework';
import { Button, colors } from '@toss/tds-react-native';
import {
  deletePhoto,
  getDailyPhotoLimit,
  grantPhotoSlotReward,
  hasClaimedPhotoSlotRewardToday,
  loadPhotos,
  MAX_DAILY_PHOTOS,
  MAX_REWARDED_DAILY_PHOTOS,
  Photo,
  setRepresentativePhoto,
} from '../lib/supabase';
import { calculateStreak, hasTodayRecord } from '../lib/streak';
import { consumePendingCapture } from '../lib/captureResult';
import {
  applyProtectionIfNeeded,
  checkAndAwardMilestone,
  grantRewardedAdProtectionTicket,
  getProtectionTicketCount,
  hasClaimedRewardedAdTicketToday,
  loadUsedProtectionDates,
} from '../lib/milestones';
import { track } from '../lib/analytics';
import { TabBar, TabKey } from '../components/TabBar';
import { TodayPhoto } from '../components/TodayPhoto';
import { RecordView } from '../components/RecordView';
import { RewardAdStatus, SettingsView } from '../components/SettingsView';
import { StreakAchievedModal } from '../components/StreakAchievedModal';
import { ProtectionToast, ToastVariant } from '../components/ProtectionToast';
import { WeeklyRecapCard } from '../components/WeeklyRecapCard';

export const Route = createRoute('/', {
  component: HomePage,
});

const REWARDED_AD_GROUP_ID = 'ait-ad-test-rewarded-id';

interface ModalState {
  visible: boolean;
  streak: number;
  photoUri: string | null;
  placeName: string | null;
}

interface ToastState {
  visible: boolean;
  variant: ToastVariant;
}

function OnboardingView({ onStart }: { onStart: () => void }) {
  return (
    <View style={styles.onboardingContainer}>
      <View style={styles.onboardingContent}>
        <Text style={styles.onboardingIcon}>📸</Text>
        <Text style={styles.onboardingTitle}>오늘 하루를{'\n'}한 장으로</Text>
        <Text style={styles.onboardingSubtitle}>
          매일 한 컷씩 찍으면{'\n'}내 삶의 지도가 완성돼요
        </Text>
      </View>
      <Button
        type="light"
        style="fill"
        size="large"
        display="full"
        onPress={onStart}
        viewStyle={styles.startButton}
        containerStyle={styles.startButtonContainer}
      >
        시작하기
      </Button>
    </View>
  );
}

function promoteLatestRepresentative(photos: Photo[], streakDate: string): Photo[] {
  const latestPhoto = photos
    .filter((photo) => photo.streak_date === streakDate)
    .sort((a, b) => b.taken_at.localeCompare(a.taken_at))[0];

  if (latestPhoto == null) {
    return photos;
  }

  return photos.map((photo) => {
    if (photo.streak_date !== streakDate) return photo;
    return {
      ...photo,
      is_representative: photo.id === latestPhoto.id,
    };
  });
}

function HomeView({
  todayDone,
  todayPhotos,
  todayPhotoCount,
  dailyPhotoLimit,
  slotAdStatus,
  onCapture,
  onSelectRepresentative,
  onDeletePhoto,
  settingRepresentativePhotoId,
  deletingPhotoId,
}: {
  todayDone: boolean;
  todayPhotos: Photo[];
  todayPhotoCount: number;
  dailyPhotoLimit: number;
  slotAdStatus: RewardAdStatus;
  onCapture: () => void;
  onSelectRepresentative: (photo: Photo) => void;
  onDeletePhoto: (photo: Photo) => void;
  settingRepresentativePhotoId: string | null;
  deletingPhotoId: string | null;
}) {
  const reachedDailyLimit = todayPhotoCount >= dailyPhotoLimit;
  const canEarnExtraSlot =
    reachedDailyLimit &&
    dailyPhotoLimit === MAX_DAILY_PHOTOS &&
    todayPhotoCount < MAX_REWARDED_DAILY_PHOTOS;
  const ctaDisabled =
    reachedDailyLimit && (!canEarnExtraSlot || slotAdStatus !== 'ready');
  const ctaLabel = (() => {
    if (!todayDone) return '오늘 기록하기';
    if (!reachedDailyLimit) return '한 컷 더 남기기';
    if (!canEarnExtraSlot) return `오늘은 최대 ${dailyPhotoLimit}장까지 기록했어요`;
    if (slotAdStatus === 'ready') return '광고 보고 한 컷 더 남기기';
    if (slotAdStatus === 'showing') return '광고 여는 중';
    if (slotAdStatus === 'unsupported') return '토스 앱에서 추가할 수 있어요';
    return '추가 슬롯 준비 중';
  })();

  return (
    <ScrollView
      style={styles.homeScroll}
      contentContainerStyle={styles.homeScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <TodayPhoto
        todayPhotos={todayPhotos}
        maxDailyPhotos={dailyPhotoLimit}
        onSelectRepresentative={onSelectRepresentative}
        onDeletePhoto={onDeletePhoto}
        settingRepresentativePhotoId={settingRepresentativePhotoId}
        deletingPhotoId={deletingPhotoId}
      />
      <View style={styles.homeBottomContainer}>
        {todayDone && (
          <Text style={styles.todayDoneHint}>
            {dailyPhotoLimit > MAX_DAILY_PHOTOS
              ? `오늘 기록 완료 · 광고 보상으로 오늘은 최대 ${dailyPhotoLimit}장까지 가능해요`
              : `오늘 기록 완료 · 원하면 최대 ${MAX_DAILY_PHOTOS}장까지 남길 수 있어요`}
          </Text>
        )}
        <Button
          type={todayDone ? 'dark' : 'primary'}
          style="fill"
          size="large"
          display="full"
          onPress={onCapture}
          disabled={ctaDisabled}
          loading={slotAdStatus === 'showing'}
          leftAccessory={<Text style={styles.ctaIcon}>{todayDone ? '✓' : '📷'}</Text>}
          viewStyle={styles.ctaButton}
          containerStyle={styles.ctaButtonContainer}
        >
          {ctaLabel}
        </Button>
      </View>
    </ScrollView>
  );
}

function HomePage() {
  const navigation = Route.useNavigation();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [ticketCount, setTicketCount] = useState(0);
  const [rewardAdStatus, setRewardAdStatus] = useState<RewardAdStatus>('loading');
  const [dailyPhotoLimit, setDailyPhotoLimit] = useState(MAX_DAILY_PHOTOS);
  const [slotAdStatus, setSlotAdStatus] = useState<RewardAdStatus>('loading');
  const [settingRepresentativePhotoId, setSettingRepresentativePhotoId] = useState<string | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [protectedDates, setProtectedDates] = useState<string[]>([]);
  const [modal, setModal] = useState<ModalState>({
    visible: false,
    streak: 0,
    photoUri: null,
    placeName: null,
  });
  const [toast, setToast] = useState<ToastState>({ visible: false, variant: 'missed' });
  const [showRecap, setShowRecap] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const rewardAdCleanupRef = useRef<(() => void) | null>(null);
  const isRewardAdLoadedRef = useRef(false);
  const hasGrantedCurrentRewardRef = useRef(false);
  const slotAdCleanupRef = useRef<(() => void) | null>(null);
  const isSlotAdLoadedRef = useRef(false);
  const hasEarnedSlotAdRewardRef = useRef(false);

  const todayDone = hasTodayRecord(photos);
  const streak = calculateStreak(photos, protectedDates);
  const todayPhotos = photos.filter((p) => {
    const kstOffset = 9 * 60 * 60 * 1000;
    const today = new Date(Date.now() + kstOffset).toISOString().slice(0, 10);
    return p.streak_date === today;
  });
  const handleSelectRepresentative = useCallback(
    async (photo: Photo) => {
      if (photo.is_representative || settingRepresentativePhotoId != null) return;

      const previousPhotos = photos;
      const nextPhotos = photos.map((item) => {
        if (item.streak_date !== photo.streak_date) return item;
        return {
          ...item,
          is_representative: item.id === photo.id,
        };
      });

      setSettingRepresentativePhotoId(photo.id);
      setPhotos(nextPhotos);

      try {
        await setRepresentativePhoto(photo);
      } catch (e) {
        console.error(e);
        setPhotos(previousPhotos);
      } finally {
        setSettingRepresentativePhotoId(null);
      }
    },
    [photos, settingRepresentativePhotoId]
  );

  const handleDeletePhoto = useCallback(
    (photo: Photo) => {
      if (deletingPhotoId != null) return;

      const sameDayCount = photos.filter((item) => item.streak_date === photo.streak_date).length;
      Alert.alert(
        '사진을 삭제할까요?',
        sameDayCount === 1
          ? '오늘의 마지막 사진이라 삭제하면 오늘 기록도 사라져요.'
          : '삭제한 사진은 복구할 수 없어요.',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '삭제',
            style: 'destructive',
            onPress: () => {
              const previousPhotos = photos;
              const remainingPhotos = photos.filter((item) => item.id !== photo.id);
              const nextPhotos = photo.is_representative
                ? promoteLatestRepresentative(remainingPhotos, photo.streak_date)
                : remainingPhotos;

              setDeletingPhotoId(photo.id);
              setPhotos(nextPhotos);

              void deletePhoto(photo)
                .catch((e) => {
                  console.error(e);
                  setPhotos(previousPhotos);
                })
                .finally(() => setDeletingPhotoId(null));
            },
          },
        ]
      );
    },
    [deletingPhotoId, photos]
  );

  const fetchPhotos = useCallback(async (uid: string) => {
    try {
      const data = await loadPhotos(uid);
      setPhotos(data);
      return data;
    } catch (e) {
      setError('사진 목록을 불러오지 못했어요.');
      console.error(e);
      return null;
    }
  }, []);

  const refreshTicketCount = useCallback(async (uid: string) => {
    try {
      const count = await getProtectionTicketCount(uid);
      setTicketCount(count);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const refreshDailyPhotoLimit = useCallback(async (uid: string) => {
    try {
      const limit = await getDailyPhotoLimit(uid);
      setDailyPhotoLimit(limit);
      return limit;
    } catch (e) {
      console.error(e);
      return MAX_DAILY_PHOTOS;
    }
  }, []);

  const syncRewardAdEligibility = useCallback(async (uid: string, count: number) => {
    if (count >= 2) {
      setRewardAdStatus('max_reached');
      return false;
    }

    try {
      const claimedToday = await hasClaimedRewardedAdTicketToday(uid);
      if (claimedToday) {
        setRewardAdStatus('claimed_today');
        return false;
      }
    } catch (e) {
      console.error(e);
    }

    return true;
  }, []);

  const loadRewardAd = useCallback(async () => {
    const uid = userIdRef.current;
    if (uid == null) return;

    if (!loadFullScreenAd.isSupported() || !showFullScreenAd.isSupported()) {
      isRewardAdLoadedRef.current = false;
      setRewardAdStatus('unsupported');
      return;
    }

    const currentCount = await getProtectionTicketCount(uid);
    setTicketCount(currentCount);
    const canLoadAd = await syncRewardAdEligibility(uid, currentCount);
    if (!canLoadAd) {
      isRewardAdLoadedRef.current = false;
      return;
    }

    slotAdCleanupRef.current?.();
    slotAdCleanupRef.current = null;
    isSlotAdLoadedRef.current = false;
    setSlotAdStatus('loading');

    rewardAdCleanupRef.current?.();
    isRewardAdLoadedRef.current = false;
    setRewardAdStatus('loading');

    rewardAdCleanupRef.current = loadFullScreenAd({
      options: { adGroupId: REWARDED_AD_GROUP_ID },
      onEvent: (event) => {
        if (event.type === 'loaded') {
          isRewardAdLoadedRef.current = true;
          setRewardAdStatus('ready');
        }
      },
      onError: (error) => {
        console.warn('Reward ad load failed:', error);
        isRewardAdLoadedRef.current = false;
        setRewardAdStatus('loading');
      },
    });
  }, [syncRewardAdEligibility]);

  const loadSlotAd = useCallback(() => {
    if (!loadFullScreenAd.isSupported() || !showFullScreenAd.isSupported()) {
      isSlotAdLoadedRef.current = false;
      setSlotAdStatus('unsupported');
      return;
    }

    rewardAdCleanupRef.current?.();
    rewardAdCleanupRef.current = null;
    isRewardAdLoadedRef.current = false;
    setRewardAdStatus('loading');

    slotAdCleanupRef.current?.();
    isSlotAdLoadedRef.current = false;
    setSlotAdStatus('loading');

    slotAdCleanupRef.current = loadFullScreenAd({
      options: { adGroupId: REWARDED_AD_GROUP_ID },
      onEvent: (event) => {
        if (event.type === 'loaded') {
          isSlotAdLoadedRef.current = true;
          setSlotAdStatus('ready');
        }
      },
      onError: (error) => {
        console.warn('Photo slot ad load failed:', error);
        isSlotAdLoadedRef.current = false;
        setSlotAdStatus('loading');
      },
    });
  }, []);

  const refreshProtectedDates = useCallback(async (uid: string) => {
    try {
      const dates = await loadUsedProtectionDates(uid);
      setProtectedDates(dates);
      return dates;
    } catch (e) {
      console.error(e);
      return [];
    }
  }, []);

  const runProtectionCheck = useCallback(async (uid: string) => {
    try {
      const result = await applyProtectionIfNeeded(uid);
      if (result === 'used') {
        const count = await getProtectionTicketCount(uid);
        setTicketCount(count);
        setToast({ visible: true, variant: 'used' });
      } else if (result === 'no_ticket') {
        setToast({ visible: true, variant: 'missed' });
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const checkPendingCapture = useCallback(
    async (freshPhotos: Photo[], uid: string, freshProtectedDates: string[]) => {
      const result = consumePendingCapture();
      if (result == null) return;
      const newStreak = calculateStreak(freshPhotos, freshProtectedDates);

      // 마일스톤 체크 & 보호권 지급
      await checkAndAwardMilestone(uid, newStreak);
      await refreshTicketCount(uid);

      setModal({
        visible: true,
        streak: newStreak,
        photoUri: result.photoUri,
        placeName: result.placeName,
      });
      track('streak_achieved', {
        streak_count: newStreak,
        is_milestone: [3, 7, 14, 30, 100].includes(newStreak),
      });
    },
    [refreshTicketCount]
  );

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
        userIdRef.current = uid;

        const dataPromise = fetchPhotos(uid);
        await runProtectionCheck(uid);
        const [data, , freshProtectedDates] = await Promise.all([
          dataPromise,
          refreshTicketCount(uid),
          refreshProtectedDates(uid),
          refreshDailyPhotoLimit(uid),
        ]);

        if (data != null && data.length === 0) {
          setShowOnboarding(true);
        }
        if (data != null) {
          track('home_viewed', {
            streak_count: calculateStreak(data, freshProtectedDates),
            has_photo_today: hasTodayRecord(data),
          });
        }
      } catch (e) {
        setError('초기화에 실패했어요.');
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [
    fetchPhotos,
    runProtectionCheck,
    refreshTicketCount,
    refreshProtectedDates,
    refreshDailyPhotoLimit,
  ]);

  useEffect(() => {
    const uid = userIdRef.current;
    if (uid == null || activeTab !== 'settings') return;

    if (ticketCount >= 2) {
      setRewardAdStatus('max_reached');
      return;
    }

    if (
      !isRewardAdLoadedRef.current &&
      rewardAdStatus !== 'unsupported' &&
      rewardAdStatus !== 'showing' &&
      rewardAdStatus !== 'claimed_today' &&
      rewardAdStatus !== 'max_reached'
    ) {
      void loadRewardAd();
    }
  }, [activeTab, ticketCount, rewardAdStatus, loadRewardAd]);

  useEffect(() => {
    const uid = userIdRef.current;
    if (
      uid == null ||
      activeTab !== 'home' ||
      todayPhotos.length < dailyPhotoLimit ||
      dailyPhotoLimit !== MAX_DAILY_PHOTOS ||
      todayPhotos.length >= MAX_REWARDED_DAILY_PHOTOS
    ) {
      return;
    }

    if (
      !isSlotAdLoadedRef.current &&
      slotAdStatus !== 'unsupported' &&
      slotAdStatus !== 'showing' &&
      slotAdStatus !== 'claimed_today'
    ) {
      void hasClaimedPhotoSlotRewardToday(uid)
        .then((claimed) => {
          if (claimed) {
            setDailyPhotoLimit(MAX_REWARDED_DAILY_PHOTOS);
            setSlotAdStatus('claimed_today');
            return;
          }
          loadSlotAd();
        })
        .catch(console.error);
    }
  }, [
    activeTab,
    dailyPhotoLimit,
    todayPhotos.length,
    slotAdStatus,
    loadSlotAd,
  ]);

  useEffect(() => {
    return () => {
      rewardAdCleanupRef.current?.();
      slotAdCleanupRef.current?.();
    };
  }, []);

  // Re-fetch + protection check on returning from capture
  useEffect(() => {
    const nav = navigation as unknown as {
      addListener?: (event: string, cb: () => void) => (() => void) | undefined;
    };
    const unsubscribe = nav.addListener?.('focus', async () => {
      const uid = userIdRef.current;
      if (uid == null) return;
      const dataPromise = fetchPhotos(uid);
      await runProtectionCheck(uid);
      const [data, , freshProtectedDates] = await Promise.all([
        dataPromise,
        refreshTicketCount(uid),
        refreshProtectedDates(uid),
        refreshDailyPhotoLimit(uid),
      ]);
      if (data != null) {
        await checkPendingCapture(data, uid, freshProtectedDates);
      }
    });
    return () => unsubscribe?.();
  }, [
    navigation,
    fetchPhotos,
    runProtectionCheck,
    refreshTicketCount,
    refreshProtectedDates,
    refreshDailyPhotoLimit,
    checkPendingCapture,
  ]);

  const handleCapture = async () => {
    const uid = userIdRef.current;
    if (!todayDone || uid == null) {
      navigation.navigate('/capture');
      return;
    }

    if (todayPhotos.length < dailyPhotoLimit) {
      navigation.navigate('/capture');
      return;
    }

    if (
      dailyPhotoLimit !== MAX_DAILY_PHOTOS ||
      todayPhotos.length >= MAX_REWARDED_DAILY_PHOTOS
    ) {
      return;
    }

    if (slotAdStatus !== 'ready' || !isSlotAdLoadedRef.current) {
      return;
    }

    setSlotAdStatus('showing');
    hasEarnedSlotAdRewardRef.current = false;
    showFullScreenAd({
      options: { adGroupId: REWARDED_AD_GROUP_ID },
      onEvent: (event) => {
        if (event.type === 'userEarnedReward') {
          if (hasEarnedSlotAdRewardRef.current) return;
          hasEarnedSlotAdRewardRef.current = true;
          void grantPhotoSlotReward(uid)
            .then((result) => {
              setDailyPhotoLimit(MAX_REWARDED_DAILY_PHOTOS);
              setSlotAdStatus('claimed_today');
              track('photo_slot_ad_result', { result });
              navigation.navigate('/capture');
            })
            .catch((error) => {
              console.error(error);
              setSlotAdStatus('loading');
              loadSlotAd();
            });
        } else if (event.type === 'dismissed') {
          isSlotAdLoadedRef.current = false;
          setSlotAdStatus('loading');
          if (!hasEarnedSlotAdRewardRef.current) {
            track('photo_slot_ad_result', { result: 'dismissed' });
          }
          loadSlotAd();
        } else if (event.type === 'failedToShow') {
          isSlotAdLoadedRef.current = false;
          setSlotAdStatus('loading');
          track('photo_slot_ad_result', { result: 'failed_to_show' });
          loadSlotAd();
        }
      },
      onError: (error) => {
        console.warn('Photo slot ad show failed:', error);
        isSlotAdLoadedRef.current = false;
        setSlotAdStatus('loading');
        track('photo_slot_ad_result', { result: 'error' });
        loadSlotAd();
      },
    });
  };

  const closeModal = () => {
    setModal((prev) => ({ ...prev, visible: false }));
  };

  const handleShowRecap = () => {
    setModal((prev) => ({ ...prev, visible: false }));
    setShowRecap(true);
  };

  const handleRewardAdPress = () => {
    const uid = userIdRef.current;
    if (uid == null || rewardAdStatus !== 'ready' || !isRewardAdLoadedRef.current) return;

    setRewardAdStatus('showing');
    hasGrantedCurrentRewardRef.current = false;
    showFullScreenAd({
      options: { adGroupId: REWARDED_AD_GROUP_ID },
      onEvent: (event) => {
        if (event.type === 'userEarnedReward') {
          if (hasGrantedCurrentRewardRef.current) return;
          hasGrantedCurrentRewardRef.current = true;

          void grantRewardedAdProtectionTicket(uid)
            .then(async (result) => {
              const count = await getProtectionTicketCount(uid);
              setTicketCount(count);

              if (result === 'granted' || result === 'already_claimed_today') {
                setRewardAdStatus('claimed_today');
              } else if (result === 'max_reached') {
                setRewardAdStatus('max_reached');
              }

              track('rewarded_ad_ticket_result', { result });
            })
            .catch((error) => {
              console.error(error);
              setRewardAdStatus('loading');
              void loadRewardAd();
            });
        } else if (event.type === 'dismissed') {
          isRewardAdLoadedRef.current = false;
          if (!hasGrantedCurrentRewardRef.current) {
            void loadRewardAd();
          }
        } else if (event.type === 'failedToShow') {
          isRewardAdLoadedRef.current = false;
          setRewardAdStatus('loading');
          void loadRewardAd();
        }
      },
      onError: (error) => {
        console.warn('Reward ad show failed:', error);
        isRewardAdLoadedRef.current = false;
        setRewardAdStatus('loading');
        void loadRewardAd();
      },
    });
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.blue500} />
      </View>
    );
  }

  if (showOnboarding) {
    return <OnboardingView onStart={() => setShowOnboarding(false)} />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      {error != null && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.body}>
        {activeTab === 'home' && (
          <HomeView
            todayDone={todayDone}
            todayPhotos={todayPhotos}
            todayPhotoCount={todayPhotos.length}
            dailyPhotoLimit={dailyPhotoLimit}
            slotAdStatus={slotAdStatus}
            onCapture={handleCapture}
            onSelectRepresentative={handleSelectRepresentative}
            onDeletePhoto={handleDeletePhoto}
            settingRepresentativePhotoId={settingRepresentativePhotoId}
            deletingPhotoId={deletingPhotoId}
          />
        )}
        {activeTab === 'record' && (
          <RecordView
            photos={photos}
            onPhotosChange={setPhotos}
            streak={streak}
            ticketCount={ticketCount}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsView
            userId={userId}
            ticketCount={ticketCount}
            rewardAdStatus={rewardAdStatus}
            onRewardAdPress={handleRewardAdPress}
            onDebugRecapPress={() => setShowRecap(true)}
          />
        )}
      </View>

      <TabBar activeTab={activeTab} onTabPress={setActiveTab} />

      <ProtectionToast
        visible={toast.visible}
        variant={toast.variant}
        ticketCount={ticketCount}
        onHide={() => setToast((prev) => ({ ...prev, visible: false }))}
      />

      <StreakAchievedModal
        visible={modal.visible}
        streak={modal.streak}
        photoUri={modal.photoUri}
        placeName={modal.placeName}
        onClose={closeModal}
        onShowRecap={modal.streak === 7 ? handleShowRecap : undefined}
      />

      {userId != null && (
        <WeeklyRecapCard
          visible={showRecap}
          userId={userId}
          streak={streak}
          onClose={() => setShowRecap(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.grey50,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.grey50,
  },
  errorBar: {
    backgroundColor: colors.red50,
    marginHorizontal: 16,
    borderRadius: 8,
    padding: 10,
    marginBottom: 4,
  },
  errorText: {
    color: colors.red600,
    fontSize: 13,
    fontWeight: '600',
  },
  body: {
    flex: 1,
  },
  homeScroll: {
    flex: 1,
  },
  homeScrollContent: {
    flexGrow: 1,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 20,
  },
  homeBottomContainer: {
    marginTop: 'auto',
    gap: 12,
  },
  ctaButton: {
    marginHorizontal: 16,
  },
  ctaButtonContainer: {
    borderRadius: 14,
  },
  todayDoneHint: {
    marginHorizontal: 16,
    color: colors.grey600,
    fontSize: 12,
    fontWeight: '600',
  },
  ctaIcon: {
    fontSize: 20,
  },
  onboardingContainer: {
    flex: 1,
    backgroundColor: colors.blue500,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 80,
    paddingBottom: 60,
    paddingHorizontal: 32,
  },
  onboardingContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  onboardingIcon: {
    fontSize: 72,
  },
  onboardingTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.white,
    textAlign: 'center',
    lineHeight: 44,
  },
  onboardingSubtitle: {
    fontSize: 18,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 28,
  },
  startButton: {
    width: '100%',
  },
  startButtonContainer: {
    borderRadius: 16,
  },
});
