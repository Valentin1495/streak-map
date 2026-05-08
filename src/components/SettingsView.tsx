import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type RewardAdStatus =
  | 'unsupported'
  | 'loading'
  | 'ready'
  | 'showing'
  | 'claimed_today'
  | 'max_reached';

interface SettingsViewProps {
  userId: string | null;
  ticketCount?: number;
  rewardAdStatus: RewardAdStatus;
  onRewardAdPress: () => void;
  onDebugRecapPress?: () => void;
}

const REWARD_AD_LABELS: Record<RewardAdStatus, string> = {
  unsupported: '토스 앱에서 사용할 수 있어요',
  loading: '광고 준비 중',
  ready: '광고 보고 보호권 받기',
  showing: '광고 여는 중',
  claimed_today: '오늘은 이미 받았어요',
  max_reached: '보호권은 최대 2개까지 보관돼요',
};

export function SettingsView({
  userId,
  ticketCount = 0,
  rewardAdStatus,
  onRewardAdPress,
  onDebugRecapPress,
}: SettingsViewProps) {
  const rewardAdDisabled = rewardAdStatus !== 'ready';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>설정</Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>기록 보호</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowIcon}>🛡️</Text>
              <View>
                <Text style={styles.rowTitle}>기록 보호권</Text>
                <Text style={styles.rowSub}>내 기록의 흐름을 하루 지켜줘요</Text>
              </View>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{ticketCount}개</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.ticketInfo}>
            <Text style={styles.ticketInfoText}>
              {ticketCount > 0
                ? '하루 누락 시 자동으로 사용돼요. 7일 달성마다 1개 지급.'
                : '7일 연속 기록을 달성하면 보호권이 지급돼요.'}
            </Text>
            <TouchableOpacity
              style={[styles.rewardAdButton, rewardAdDisabled && styles.rewardAdButtonDisabled]}
              onPress={onRewardAdPress}
              disabled={rewardAdDisabled}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.rewardAdButtonText,
                  rewardAdDisabled && styles.rewardAdButtonTextDisabled,
                ]}
              >
                {REWARD_AD_LABELS[rewardAdStatus]}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>계정</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowIcon}>👤</Text>
              <View>
                <Text style={styles.rowTitle}>익명 계정 ID</Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {userId != null ? `${userId.slice(0, 8)}...` : '불러오는 중...'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {__DEV__ && onDebugRecapPress != null && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DEV</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.debugButton}
              onPress={onDebugRecapPress}
              activeOpacity={0.8}
            >
              <Text style={styles.debugButtonText}>리캡 카드 테스트</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Text style={styles.version}>Dayshot</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    paddingHorizontal: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rowIcon: {
    fontSize: 20,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  rowSub: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0064FF',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
  },
  ticketInfo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  ticketInfoText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  rewardAdButton: {
    alignItems: 'center',
    backgroundColor: '#0064FF',
    borderRadius: 10,
    paddingVertical: 12,
  },
  rewardAdButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  rewardAdButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '800',
  },
  rewardAdButtonTextDisabled: {
    color: '#9CA3AF',
  },
  debugButton: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  debugButtonText: {
    color: '#0064FF',
    fontSize: 14,
    fontWeight: '800',
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: '#D1D5DB',
    marginTop: 8,
  },
});
