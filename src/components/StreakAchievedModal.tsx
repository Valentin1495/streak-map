import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const MILESTONES = [3, 7, 14, 30, 100];

interface StreakAchievedModalProps {
  visible: boolean;
  streak: number;
  photoUri: string | null;
  placeName: string | null;
  onClose: () => void;
  onShowRecap?: () => void;
}

export function StreakAchievedModal({
  visible,
  streak,
  photoUri,
  placeName,
  onClose,
  onShowRecap,
}: StreakAchievedModalProps) {
  const isMilestone = MILESTONES.includes(streak);
  const countAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    countAnim.setValue(0);
    scaleAnim.setValue(0.8);
    opacityAnim.setValue(0);

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(countAnim, {
        toValue: streak,
        duration: 900,
        useNativeDriver: false,
      }),
    ]).start();

    if (!isMilestone) {
      const timer = setTimeout(onClose, 2200);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [visible, streak, isMilestone, countAnim, scaleAnim, opacityAnim, onClose]);

  const displayCount = countAnim.interpolate({
    inputRange: [0, streak],
    outputRange: [0, streak],
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          <Text style={styles.flameIcon}>🔥</Text>

          <View style={styles.countRow}>
            <AnimatedCount value={displayCount} />
            <Text style={styles.countUnit}>일 연속!</Text>
          </View>

          {isMilestone && (
            <View style={styles.milestoneBadge}>
              <Text style={styles.milestoneText}>🎉 {streak}일 달성! 대단해요!</Text>
            </View>
          )}

          {photoUri != null && (
            <Image source={{ uri: photoUri }} style={styles.thumbnail} resizeMode="cover" />
          )}

          {placeName != null && placeName !== '' && (
            <Text style={styles.placeName}>📍 {placeName}</Text>
          )}

          <TouchableOpacity
            style={styles.homeButton}
            onPress={streak === 7 && onShowRecap != null ? onShowRecap : onClose}
          >
            <Text style={styles.homeButtonText}>
              {streak === 7 && onShowRecap != null ? '주간 리캡 보기 →' : '홈으로'}
            </Text>
          </TouchableOpacity>

          {!isMilestone && (
            <Text style={styles.autoCloseHint}>잠시 후 자동으로 닫혀요</Text>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

function AnimatedCount({ value }: { value: Animated.AnimatedInterpolation<number> }) {
  return (
    <Animated.Text
      style={styles.countNumber}
    >
      {value.interpolate({
        inputRange: [0, 999],
        outputRange: ['0', '999'],
        extrapolate: 'clamp',
      })}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  flameIcon: {
    fontSize: 48,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  countNumber: {
    fontSize: 56,
    fontWeight: '900',
    color: '#EA580C',
    lineHeight: 60,
  },
  countUnit: {
    fontSize: 22,
    fontWeight: '800',
    color: '#EA580C',
    marginBottom: 6,
  },
  milestoneBadge: {
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  milestoneText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#C2410C',
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 1.5,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  placeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  homeButton: {
    backgroundColor: '#0064FF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 4,
  },
  homeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
  autoCloseHint: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
