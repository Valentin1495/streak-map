import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
  DailyLimitInfo,
  setRepresentativePhoto,
} from '../lib/supabase';
import { calculateStreak, hasTodayRecord } from '../lib/streak';
import { consumePendingCapture } from '../lib/captureResult';
import {
  checkAndAwardMilestone,
  RecapMilestone,
} from '../lib/milestones';
import { track } from '../lib/analytics';
import { TabBar, TabKey } from '../components/TabBar';
import { TodayPhoto } from '../components/TodayPhoto';
import { RecordView } from '../components/RecordView';
import { RewardAdStatus, SettingsView } from '../components/SettingsView';
import { StreakAchievedModal } from '../components/StreakAchievedModal';
import { WeeklyRecapCard } from '../components/WeeklyRecapCard';

export const Route = createRoute('/', {
  component: HomePage,
});

const REWARDED_AD_GROUP_ID = 'ait-ad-test-rewarded-id';

function getEffectiveDailyLimit(info: DailyLimitInfo): number {
  return (
    MAX_DAILY_PHOTOS +
    (info.hasAdReward ? 1 : 0) +
    (info.hasShareReward ? 1 : 0)
  );
}

interface ModalState {
  visible: boolean;
  streak: number;
  photoUri: string | null;
  placeName: string | null;
}

function OnboardingView({ onStart }: { onStart: () => void }) {
  const iconAnim = useRef(new Animated.Value(0)).current;
  const textAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.timing(iconAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(textAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  }, [iconAnim, textAnim]);

  return (
    <SafeAreaView style={styles.onboardingContainer} edges={['top', 'bottom']}>
      <View style={styles.onboardingContent}>
        <Animated.Text
          style={[
            styles.onboardingIcon,
            {
              opacity: iconAnim,
              transform: [{ translateY: iconAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
            },
          ]}
        >
          📸
        </Animated.Text>
        <Animated.View
          style={{
            opacity: textAnim,
            transform: [{ translateY: textAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Text style={styles.onboardingTitle}>오늘 하루를{'\n'}한 장으로</Text>
          <Text style={styles.onboardingSubtitle}>
            매일 한 컷씩 찍으면{'\n'}내 삶의 지도가 완성돼요
          </Text>
        </Animated.View>
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
    </SafeAreaView>
  );
}

function HomeView({
  todayDone,
  todayPhotos,
  todayPhotoCount,
  dailyLimitInfo,
  slotAdStatus,
  onCapture,
  onGoToSettings,
  onSelectBestPhoto,
  onDeletePhoto,
  settingBestPhotoId,
  deletingPhotoId,
}: {
  todayDone: boolean;
  todayPhotos: Photo[];
  todayPhotoCount: number;
  dailyLimitInfo: DailyLimitInfo;
  slotAdStatus: RewardAdStatus;
  onCapture: () => void;
  onGoToSettings: () => void;
  onSelectBestPhoto: (photo: Photo) => void;
  onDeletePhoto: (photo: Photo) => void;
  settingBestPhotoId: string | null;
  deletingPhotoId: string | null;
}) {
  const effectiveDailyLimit = getEffectiveDailyLimit(dailyLimitInfo);
  const reachedDailyLimit = todayPhotoCount >= effectiveDailyLimit;
  
  let ctaLabel = '';
  let ctaDisabled = false;
  let ctaAction = onCapture;

  if (!todayDone) {
    ctaLabel = '오늘 기록하기';
  } else if (!reachedDailyLimit) {
    ctaLabel = '한 컷 더 남기기';
  } else if (effectiveDailyLimit === MAX_REWARDED_DAILY_PHOTOS) {
    ctaLabel = `오늘은 최대 ${MAX_REWARDED_DAILY_PHOTOS}장까지 모두 기록했어요`;
    ctaDisabled = true;
  } else if (!dailyLimitInfo.hasAdReward) {
    if (slotAdStatus === 'ready') {
      ctaLabel = '광고 보고 1장 더 남기기 (하루 1회)';
    } else if (slotAdStatus === 'showing') {
      ctaLabel = '광고 여는 중';
      ctaDisabled = true;
    } else if (slotAdStatus === 'unsupported') {
      ctaLabel = '토스 앱에서 추가할 수 있어요';
      ctaDisabled = true;
    } else {
      ctaLabel = '추가 슬롯 준비 중';
      ctaDisabled = true;
    }
  } else if (!dailyLimitInfo.hasShareReward) {
    ctaLabel = '친구 초대하고 1장 더 남기기 (하루 1회)';
    ctaAction = onGoToSettings;
  }

  return (
    <ScrollView
      style={styles.homeScroll}
      contentContainerStyle={styles.homeScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <TodayPhoto
        todayPhotos={todayPhotos}
        maxDailyPhotos={effectiveDailyLimit}
        onSelectBestPhoto={onSelectBestPhoto}
        onDeletePhoto={onDeletePhoto}
        settingBestPhotoId={settingBestPhotoId}
        deletingPhotoId={deletingPhotoId}
      />
      <View style={styles.homeBottomContainer}>
        {todayDone && effectiveDailyLimit < MAX_REWARDED_DAILY_PHOTOS && (
          <Text style={styles.todayDoneHint}>
            {`광고·초대로 하루 최대 ${MAX_REWARDED_DAILY_PHOTOS}장까지 추가할 수 있어요`}
          </Text>
        )}
        <Button
          type={todayDone && ctaAction === onGoToSettings ? 'primary' : todayDone ? 'dark' : 'primary'}
          style={todayDone && ctaAction === onGoToSettings ? 'weak' : 'fill'}
          size="large"
          display="full"
          onPress={ctaAction}
          disabled={ctaDisabled}
          loading={slotAdStatus === 'showing'}
          leftAccessory={<Text style={styles.ctaIcon}>{todayDone && ctaAction === onGoToSettings ? '🤝' : todayDone ? '✓' : '📷'}</Text>}
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
  const [recapAdStatus, setRecapAdStatus] = useState<RewardAdStatus>('loading');
  const [dailyLimitInfo, setDailyLimitInfo] = useState<DailyLimitInfo>({ limit: MAX_DAILY_PHOTOS, hasAdReward: false, hasShareReward: false });
  const [slotAdStatus, setSlotAdStatus] = useState<RewardAdStatus>('loading');
  const [settingBestPhotoId, setSettingBestPhotoId] = useState<string | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({
    visible: false,
    streak: 0,
    photoUri: null,
    placeName: null,
  });
  const [showRecap, setShowRecap] = useState(false);
  const [recapMilestone, setRecapMilestone] = useState<RecapMilestone>(7);
  const userIdRef = useRef<string | null>(null);
  const recapAdCleanupRef = useRef<(() => void) | null>(null);
  const isRecapAdLoadedRef = useRef(false);
  const pendingRecapMilestoneRef = useRef<RecapMilestone | null>(null);
  const hasUnlockedCurrentRecapRef = useRef(false);
  const slotAdCleanupRef = useRef<(() => void) | null>(null);
  const isSlotAdLoadedRef = useRef(false);
  const hasEarnedSlotAdRewardRef = useRef(false);

  const todayDone = hasTodayRecord(photos);
  const streak = calculateStreak(photos);
  const todayPhotos = photos.filter((p) => {
    const kstOffset = 9 * 60 * 60 * 1000;
    const today = new Date(Date.now() + kstOffset).toISOString().slice(0, 10);
    return p.streak_date === today;
  });
  const handleSelectBestPhoto = useCallback(
    async (photo: Photo) => {
      if (photo.is_representative || settingBestPhotoId != null) return;

      const previousPhotos = photos;
      const nextPhotos = photos.map((item) => {
        if (item.streak_date !== photo.streak_date) return item;
        return { ...item, is_representative: item.id === photo.id };
      });

      setSettingBestPhotoId(photo.id);
      setPhotos(nextPhotos);

      try {
        await setRepresentativePhoto(photo);
      } catch (e) {
        console.error(e);
        setPhotos(previousPhotos);
      } finally {
        setSettingBestPhotoId(null);
      }
    },
    [photos, settingBestPhotoId]
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
              const nextPhotos = photos.filter((item) => item.id !== photo.id);

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

  const refreshDailyPhotoLimit = useCallback(async (uid: string) => {
    try {
      const info = await getDailyPhotoLimit(uid);
      setDailyLimitInfo(info);
      return info;
    } catch (e) {
      console.error(e);
      const defaultInfo = { limit: MAX_DAILY_PHOTOS, hasAdReward: false, hasShareReward: false };
      setDailyLimitInfo(defaultInfo);
      return defaultInfo;
    }
  }, []);

  const loadRecapAd = useCallback(() => {
    if (!loadFullScreenAd.isSupported() || !showFullScreenAd.isSupported()) {
      isRecapAdLoadedRef.current = false;
      setRecapAdStatus('unsupported');
      return;
    }

    recapAdCleanupRef.current?.();
    isRecapAdLoadedRef.current = false;
    setRecapAdStatus('loading');

    recapAdCleanupRef.current = loadFullScreenAd({
      options: { adGroupId: REWARDED_AD_GROUP_ID },
      onEvent: (event) => {
        if (event.type === 'loaded') {
          isRecapAdLoadedRef.current = true;
          setRecapAdStatus('ready');
        }
      },
      onError: (error) => {
        console.warn('Recap ad load failed:', error);
        isRecapAdLoadedRef.current = false;
        setRecapAdStatus('loading');
      },
    });
  }, []);

  const loadSlotAd = useCallback(() => {
    if (!loadFullScreenAd.isSupported() || !showFullScreenAd.isSupported()) {
      isSlotAdLoadedRef.current = false;
      setSlotAdStatus('unsupported');
      return;
    }

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

  const checkPendingCapture = useCallback(
    async (freshPhotos: Photo[], uid: string) => {
      const result = consumePendingCapture();
      if (result == null) return;
      const newStreak = calculateStreak(freshPhotos);

      await checkAndAwardMilestone(uid, newStreak);

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
    []
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
        const [data] = await Promise.all([dataPromise, refreshDailyPhotoLimit(uid)]);

        if (data != null && data.length === 0) {
          setShowOnboarding(true);
        }
        if (data != null) {
          track('home_viewed', {
            streak_count: calculateStreak(data),
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
    refreshDailyPhotoLimit,
  ]);

  useEffect(() => {
    const uid = userIdRef.current;
    if (uid == null || activeTab !== 'settings') return;

    void refreshDailyPhotoLimit(uid);

    if (
      !isRecapAdLoadedRef.current &&
      recapAdStatus !== 'unsupported' &&
      recapAdStatus !== 'showing'
    ) {
      loadRecapAd();
    }

  }, [activeTab, recapAdStatus, loadRecapAd, refreshDailyPhotoLimit]);

  useEffect(() => {
    const uid = userIdRef.current;
    if (
      uid == null ||
      activeTab !== 'home' ||
      todayPhotos.length < getEffectiveDailyLimit(dailyLimitInfo) ||
      getEffectiveDailyLimit(dailyLimitInfo) === MAX_REWARDED_DAILY_PHOTOS ||
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
      void hasClaimedPhotoSlotRewardToday(uid, 'rewarded_ad')
        .then((claimed) => {
          if (claimed) {
            setSlotAdStatus('claimed_today');
            return;
          }
          loadSlotAd();
        })
        .catch(console.error);
    }
  }, [
    activeTab,
    dailyLimitInfo,
    todayPhotos.length,
    slotAdStatus,
    loadSlotAd,
  ]);

  useEffect(() => {
    return () => {
      recapAdCleanupRef.current?.();
      slotAdCleanupRef.current?.();
    };
  }, []);

  useEffect(() => {
    const nav = navigation as unknown as {
      addListener?: (event: string, cb: () => void) => (() => void) | undefined;
    };
    const unsubscribe = nav.addListener?.('focus', async () => {
      const uid = userIdRef.current;
      if (uid == null) return;
      const dataPromise = fetchPhotos(uid);
      const [data] = await Promise.all([dataPromise, refreshDailyPhotoLimit(uid)]);
      if (data != null) {
        await checkPendingCapture(data, uid);
      }
    });
    return () => unsubscribe?.();
  }, [
    navigation,
    fetchPhotos,
    refreshDailyPhotoLimit,
    checkPendingCapture,
  ]);

  const handleCapture = async () => {
    const uid = userIdRef.current;
    if (!todayDone || uid == null) {
      navigation.navigate('/capture');
      return;
    }

    if (todayPhotos.length < getEffectiveDailyLimit(dailyLimitInfo)) {
      navigation.navigate('/capture');
      return;
    }

    if (
      getEffectiveDailyLimit(dailyLimitInfo) === MAX_REWARDED_DAILY_PHOTOS ||
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
          void grantPhotoSlotReward(uid, 'rewarded_ad')
            .then(async (result) => {
              await refreshDailyPhotoLimit(uid);
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

  const openRecap = (milestone: RecapMilestone) => {
    setRecapMilestone(milestone);
    setShowRecap(true);
  };

  const handleShowRecap = () => {
    setModal((prev) => ({ ...prev, visible: false }));
    openRecap(([7, 14, 30] as RecapMilestone[]).includes(modal.streak as RecapMilestone)
      ? (modal.streak as RecapMilestone)
      : 7);
  };

  const handleRecapPress = (milestone: RecapMilestone) => {
    if (streak >= milestone) {
      openRecap(milestone);
      return;
    }

    if (recapAdStatus !== 'ready' || !isRecapAdLoadedRef.current) {
      if (recapAdStatus !== 'unsupported') {
        loadRecapAd();
      }
      return;
    }

    pendingRecapMilestoneRef.current = milestone;
    hasUnlockedCurrentRecapRef.current = false;
    setRecapAdStatus('showing');

    showFullScreenAd({
      options: { adGroupId: REWARDED_AD_GROUP_ID },
      onEvent: (event) => {
        if (event.type === 'userEarnedReward') {
          if (hasUnlockedCurrentRecapRef.current) return;
          hasUnlockedCurrentRecapRef.current = true;
          const target = pendingRecapMilestoneRef.current ?? milestone;
          track('recap_ad_result', { result: 'unlocked', milestone: target });
        } else if (event.type === 'dismissed') {
          isRecapAdLoadedRef.current = false;
          const target = pendingRecapMilestoneRef.current;
          setRecapAdStatus('loading');
          pendingRecapMilestoneRef.current = null;
          if (hasUnlockedCurrentRecapRef.current && target != null) {
            openRecap(target);
          } else {
            track('recap_ad_result', { result: 'dismissed', milestone });
          }
          loadRecapAd();
        } else if (event.type === 'failedToShow') {
          isRecapAdLoadedRef.current = false;
          setRecapAdStatus('loading');
          pendingRecapMilestoneRef.current = null;
          track('recap_ad_result', { result: 'failed_to_show', milestone });
          loadRecapAd();
        }
      },
      onError: (error) => {
        console.warn('Recap ad show failed:', error);
        isRecapAdLoadedRef.current = false;
        setRecapAdStatus('loading');
        pendingRecapMilestoneRef.current = null;
        track('recap_ad_result', { result: 'error', milestone });
        loadRecapAd();
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
            dailyLimitInfo={dailyLimitInfo}
            slotAdStatus={slotAdStatus}
            onCapture={handleCapture}
            onGoToSettings={() => setActiveTab('settings')}
            onSelectBestPhoto={handleSelectBestPhoto}
            onDeletePhoto={handleDeletePhoto}
            settingBestPhotoId={settingBestPhotoId}
            deletingPhotoId={deletingPhotoId}
          />
        )}
        {activeTab === 'record' && (
          <RecordView
            photos={photos}
            onPhotosChange={setPhotos}
            streak={streak}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsView
            userId={userId}
            streak={streak}
            recapAdStatus={recapAdStatus}
            hasShareReward={dailyLimitInfo.hasShareReward}
            onRecapPress={handleRecapPress}
            onDebugRecapPress={() => {
              setRecapMilestone(7);
              setShowRecap(true);
            }}
            onSlotRewardGranted={() => {
              if (userId != null) {
                void refreshDailyPhotoLimit(userId);
              }
            }}
          />
        )}
      </View>

      <TabBar activeTab={activeTab} onTabPress={setActiveTab} />

      <StreakAchievedModal
        visible={modal.visible}
        streak={modal.streak}
        photoUri={modal.photoUri}
        placeName={modal.placeName}
        onClose={closeModal}
        onShowRecap={[7, 14, 30].includes(modal.streak) ? handleShowRecap : undefined}
      />

      {userId != null && (
        <WeeklyRecapCard
          visible={showRecap}
          userId={userId}
          streak={streak}
          milestone={recapMilestone}
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
    color: colors.grey500,
    fontSize: 13,
    fontWeight: '500',
  },
  ctaIcon: {
    fontSize: 20,
  },
  onboardingContainer: {
    flex: 1,
    backgroundColor: colors.blue500,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 40,
    paddingBottom: 40,
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
