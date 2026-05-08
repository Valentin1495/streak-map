import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createRoute } from '@granite-js/react-native';
import { getAnonymousKey, loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/framework';
import { getDailyReplacementCount, loadPhotos, Photo } from '../lib/supabase';
import { calculateStreak, hasTodayRecord } from '../lib/streak';
import { consumePendingCapture, setPendingReplacementSource } from '../lib/captureResult';
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
import { StreakCounter } from '../components/StreakCounter';
import { WeekStrip } from '../components/WeekStrip';
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
      <TouchableOpacity style={styles.startButton} onPress={onStart} activeOpacity={0.85}>
        <Text style={styles.startButtonText}>시작하기</Text>
      </TouchableOpacity>
    </View>
  );
}

function HomeView({
  photos,
  streak,
  todayDone,
  todayPhoto,
  ticketCount,
  todayReplacementCount,
  replacementAdStatus,
  onCapture,
}: {
  photos: Photo[];
  streak: number;
  todayDone: boolean;
  todayPhoto: Photo | null;
  ticketCount: number;
  todayReplacementCount: number;
  replacementAdStatus: RewardAdStatus;
  onCapture: () => void;
}) {
  const replacementRequiresAd = todayDone && todayReplacementCount >= 1;
  const ctaDisabled = replacementRequiresAd && replacementAdStatus !== 'ready';
  const ctaLabel = (() => {
    if (!todayDone) return '오늘 기록하기';
    if (!replacementRequiresAd) return '오늘 한 컷 바꾸기';
    if (replacementAdStatus === 'ready') return '광고 보고 한 번 더 바꾸기';
    if (replacementAdStatus === 'showing') return '광고 여는 중';
    if (replacementAdStatus === 'unsupported') return '토스 앱에서 다시 바꿀 수 있어요';
    return '교체 광고 준비 중';
  })();

  return (
    <ScrollView
      style={styles.homeScroll}
      contentContainerStyle={styles.homeScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <StreakCounter streak={streak} hasTodayRecord={todayDone} ticketCount={ticketCount} />
      <WeekStrip photos={photos} />
      <TodayPhoto todayPhoto={todayPhoto} />
      <TouchableOpacity
        style={[
          styles.ctaButton,
          todayDone && styles.ctaButtonDone,
          ctaDisabled && styles.ctaButtonDisabled,
        ]}
        onPress={onCapture}
        disabled={ctaDisabled}
        activeOpacity={0.85}
      >
        <Text style={styles.ctaIcon}>{todayDone ? '✓' : '📷'}</Text>
        <Text style={styles.ctaText}>{ctaLabel}</Text>
      </TouchableOpacity>
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
  const [todayReplacementCount, setTodayReplacementCount] = useState(0);
  const [replacementAdStatus, setReplacementAdStatus] = useState<RewardAdStatus>('loading');
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
  const replacementAdCleanupRef = useRef<(() => void) | null>(null);
  const isReplacementAdLoadedRef = useRef(false);
  const hasEarnedReplacementAdRewardRef = useRef(false);

  const todayDone = hasTodayRecord(photos);
  const streak = calculateStreak(photos, protectedDates);
  const todayPhoto = photos.find((p) => {
    const kstOffset = 9 * 60 * 60 * 1000;
    const today = new Date(Date.now() + kstOffset).toISOString().slice(0, 10);
    return p.streak_date === today;
  }) ?? null;

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

  const refreshTodayReplacementCount = useCallback(async (uid: string) => {
    try {
      const count = await getDailyReplacementCount(uid);
      setTodayReplacementCount(count);
      return count;
    } catch (e) {
      console.error(e);
      return 0;
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

    replacementAdCleanupRef.current?.();
    replacementAdCleanupRef.current = null;
    isReplacementAdLoadedRef.current = false;
    setReplacementAdStatus('loading');

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

  const loadReplacementAd = useCallback(() => {
    if (!loadFullScreenAd.isSupported() || !showFullScreenAd.isSupported()) {
      isReplacementAdLoadedRef.current = false;
      setReplacementAdStatus('unsupported');
      return;
    }

    rewardAdCleanupRef.current?.();
    rewardAdCleanupRef.current = null;
    isRewardAdLoadedRef.current = false;
    setRewardAdStatus('loading');

    replacementAdCleanupRef.current?.();
    isReplacementAdLoadedRef.current = false;
    setReplacementAdStatus('loading');

    replacementAdCleanupRef.current = loadFullScreenAd({
      options: { adGroupId: REWARDED_AD_GROUP_ID },
      onEvent: (event) => {
        if (event.type === 'loaded') {
          isReplacementAdLoadedRef.current = true;
          setReplacementAdStatus('ready');
        }
      },
      onError: (error) => {
        console.warn('Replacement ad load failed:', error);
        isReplacementAdLoadedRef.current = false;
        setReplacementAdStatus('loading');
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
          refreshTodayReplacementCount(uid),
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
    refreshTodayReplacementCount,
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
    if (uid == null || activeTab !== 'home' || !todayDone || todayReplacementCount < 1) {
      return;
    }

    if (
      !isReplacementAdLoadedRef.current &&
      replacementAdStatus !== 'unsupported' &&
      replacementAdStatus !== 'showing'
    ) {
      loadReplacementAd();
    }
  }, [activeTab, todayDone, todayReplacementCount, replacementAdStatus, loadReplacementAd]);

  useEffect(() => {
    return () => {
      rewardAdCleanupRef.current?.();
      replacementAdCleanupRef.current?.();
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
        refreshTodayReplacementCount(uid),
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
    refreshTodayReplacementCount,
    checkPendingCapture,
  ]);

  const handleCapture = async () => {
    const uid = userIdRef.current;
    if (!todayDone || uid == null) {
      navigation.navigate('/capture');
      return;
    }

    const count = await refreshTodayReplacementCount(uid);
    if (count < 1) {
      setPendingReplacementSource('free');
      navigation.navigate('/capture');
      return;
    }

    if (replacementAdStatus !== 'ready' || !isReplacementAdLoadedRef.current) {
      return;
    }

    setReplacementAdStatus('showing');
    hasEarnedReplacementAdRewardRef.current = false;
    showFullScreenAd({
      options: { adGroupId: REWARDED_AD_GROUP_ID },
      onEvent: (event) => {
        if (event.type === 'userEarnedReward') {
          if (hasEarnedReplacementAdRewardRef.current) return;
          hasEarnedReplacementAdRewardRef.current = true;
          track('replacement_ad_result', { result: 'earned' });
          setPendingReplacementSource('rewarded_ad');
          navigation.navigate('/capture');
        } else if (event.type === 'dismissed') {
          isReplacementAdLoadedRef.current = false;
          setReplacementAdStatus('loading');
          if (!hasEarnedReplacementAdRewardRef.current) {
            track('replacement_ad_result', { result: 'dismissed' });
          }
          loadReplacementAd();
        } else if (event.type === 'failedToShow') {
          isReplacementAdLoadedRef.current = false;
          setReplacementAdStatus('loading');
          track('replacement_ad_result', { result: 'failed_to_show' });
          loadReplacementAd();
        }
      },
      onError: (error) => {
        console.warn('Replacement ad show failed:', error);
        isReplacementAdLoadedRef.current = false;
        setReplacementAdStatus('loading');
        track('replacement_ad_result', { result: 'error' });
        loadReplacementAd();
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
        <ActivityIndicator size="large" color="#0064FF" />
      </View>
    );
  }

  if (showOnboarding) {
    return <OnboardingView onStart={() => setShowOnboarding(false)} />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      {error != null && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.body}>
        {activeTab === 'home' && (
          <HomeView
            photos={photos}
            streak={streak}
            todayDone={todayDone}
            todayPhoto={todayPhoto}
            ticketCount={ticketCount}
            todayReplacementCount={todayReplacementCount}
            replacementAdStatus={replacementAdStatus}
            onCapture={handleCapture}
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
    backgroundColor: '#F8FAFC',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
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
  body: {
    flex: 1,
  },
  homeScroll: {
    flex: 1,
  },
  homeScrollContent: {
    paddingTop: 8,
    paddingBottom: 24,
    gap: 20,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0064FF',
    borderRadius: 14,
    paddingVertical: 16,
    marginHorizontal: 16,
    gap: 8,
    shadowColor: '#0064FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  ctaButtonDone: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
  },
  ctaButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaIcon: {
    fontSize: 20,
  },
  ctaText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
  onboardingContainer: {
    flex: 1,
    backgroundColor: '#0064FF',
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
    color: 'white',
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
    backgroundColor: 'white',
    borderRadius: 16,
    paddingVertical: 18,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0064FF',
  },
});
