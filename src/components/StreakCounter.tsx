import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors } from '@toss/tds-react-native';

interface StreakCounterProps {
  streak: number;
  hasTodayRecord: boolean;
}

export function StreakCounter({ streak, hasTodayRecord }: StreakCounterProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!hasTodayRecord) {
      pulseAnim.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
      ]),
      { iterations: 3 }
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
        <Text style={styles.flame}>{hasTodayRecord ? '🔥' : '○'}</Text>
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
            ? '오늘 기록하면 연속 기록이 이어져요'
            : '첫 기록을 남겨보세요'}
      </Text>
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
    backgroundColor: colors.orange50,
    borderWidth: 3,
    borderColor: colors.orange400,
  },
  circleInactive: {
    backgroundColor: colors.grey50,
    borderWidth: 2,
    borderColor: colors.grey200,
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
    color: colors.orange700,
  },
  countInactive: {
    color: colors.grey500,
  },
  unit: {
    fontSize: 13,
    fontWeight: '700',
  },
  unitActive: {
    color: colors.orange700,
  },
  unitInactive: {
    color: colors.grey500,
  },
  status: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusDone: {
    color: colors.orange700,
  },
  statusPending: {
    color: colors.grey600,
  },
});
