import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

interface StreakCounterProps {
  streak: number;
  hasTodayRecord: boolean;
  ticketCount?: number;
}

export function StreakCounter({ streak, hasTodayRecord, ticketCount }: StreakCounterProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!hasTodayRecord) {
      pulseAnim.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [hasTodayRecord, pulseAnim]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.circle,
          hasTodayRecord ? styles.circleActive : styles.circleInactive,
          { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <Text style={styles.flame}>{hasTodayRecord ? '🔥' : '💤'}</Text>
        <Text style={[styles.count, hasTodayRecord ? styles.countActive : styles.countInactive]}>
          {streak}
        </Text>
        <Text style={[styles.unit, hasTodayRecord ? styles.unitActive : styles.unitInactive]}>
          일 연속
        </Text>
      </Animated.View>

      <Text style={[styles.status, hasTodayRecord ? styles.statusDone : styles.statusPending]}>
        {hasTodayRecord
          ? '오늘 기록 완료!'
          : streak > 0
            ? '오늘 기록하지 않으면 스트릭이 끊겨요'
            : '첫 기록을 남겨보세요'}
      </Text>

      {ticketCount != null && ticketCount > 0 && (
        <View style={styles.ticketBadge}>
          <Text style={styles.ticketText}>🛡 기록 보호권 {ticketCount}개</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 14,
  },
  circle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  circleActive: {
    backgroundColor: '#FFF7ED',
    borderWidth: 3,
    borderColor: '#FB923C',
  },
  circleInactive: {
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  flame: {
    fontSize: 28,
  },
  count: {
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 40,
  },
  countActive: {
    color: '#EA580C',
  },
  countInactive: {
    color: '#9CA3AF',
  },
  unit: {
    fontSize: 13,
    fontWeight: '700',
  },
  unitActive: {
    color: '#EA580C',
  },
  unitInactive: {
    color: '#9CA3AF',
  },
  status: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusDone: {
    color: '#EA580C',
  },
  statusPending: {
    color: '#6B7280',
  },
  ticketBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  ticketText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0064FF',
  },
});
