import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@toss/tds-react-native';
import { brandColors } from '../lib/theme';

interface StreakBannerProps {
  streak: number;
  hasTodayRecord: boolean;
}

export function StreakBanner({ streak, hasTodayRecord }: StreakBannerProps) {
  return (
    <View style={[styles.container, hasTodayRecord ? styles.active : styles.inactive]}>
      <View style={styles.left}>
        <Text style={styles.flame}>{hasTodayRecord ? '🔥' : '⭕'}</Text>
        <View>
          <Text style={styles.count}>{streak > 0 ? `${streak}일 연속 기록 중` : '기록을 시작해보세요'}</Text>
          {!hasTodayRecord && streak > 0 && <Text style={styles.warning}>오늘 기록하지 않으면 스트릭이 끊겨요</Text>}
        </View>
      </View>
      {hasTodayRecord && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>오늘 완료</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
  },
  active: {
    backgroundColor: brandColors.primaryWeak,
  },
  inactive: {
    backgroundColor: colors.orange50,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flame: {
    fontSize: 24,
  },
  count: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.grey900,
  },
  warning: {
    fontSize: 12,
    color: colors.orange700,
    marginTop: 2,
  },
  badge: {
    backgroundColor: brandColors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
  },
  badgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
});
