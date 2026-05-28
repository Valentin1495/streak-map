import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Badge, Button, colors } from '@toss/tds-react-native';

const MILESTONES = [3, 7, 14, 30, 100];
const RECAP_MILESTONES = [7, 14, 30];

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
  const hasRecap = RECAP_MILESTONES.includes(streak);
  const countAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;

    countAnim.setValue(0);
    scaleAnim.setValue(0.8);
    opacityAnim.setValue(0);
    progressAnim.setValue(1);

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
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: 2200,
        useNativeDriver: false,
      }).start();
      const timer = setTimeout(onClose, 2200);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [visible, streak, isMilestone, countAnim, scaleAnim, opacityAnim, progressAnim, onClose]);

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
            <AnimatedCount value={countAnim} />
            <Text style={styles.countUnit}>일 연속!</Text>
          </View>

          {isMilestone && (
            <Badge
              size="large"
              type="yellow"
              badgeStyle="weak"
              style={styles.milestoneBadge}
            >
              {`🎉 ${streak}일 달성! 대단해요!`}
            </Badge>
          )}

          {photoUri != null && (
            <Image source={{ uri: photoUri }} style={styles.thumbnail} resizeMode="cover" />
          )}

          {placeName != null && placeName !== '' && (
            <Text style={styles.placeName}>📍 {placeName}</Text>
          )}

          <Button
            type="primary"
            style="fill"
            size="large"
            display="full"
            onPress={hasRecap && onShowRecap != null ? onShowRecap : onClose}
            viewStyle={styles.homeButton}
            containerStyle={styles.homeButtonContainer}
          >
            {hasRecap && onShowRecap != null ? '회고 보기 →' : '홈으로'}
          </Button>

          {!isMilestone && (
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressBar,
                  { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                ]}
              />
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

function AnimatedCount({ value }: { value: Animated.Value }) {
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    const id = value.addListener(({ value: v }) => {
      setDisplay(Math.floor(v));
    });
    return () => value.removeListener(id);
  }, [value]);

  return <Text style={styles.countNumber}>{display}</Text>;
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
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 340,
    shadowColor: colors.black,
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
    color: colors.orange700,
    lineHeight: 60,
  },
  countUnit: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.orange700,
    marginBottom: 6,
  },
  milestoneBadge: {
    alignSelf: 'center',
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 1.5,
    borderRadius: 12,
    backgroundColor: colors.grey200,
  },
  placeName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.grey700,
  },
  homeButton: {
    marginTop: 4,
    alignSelf: 'stretch',
  },
  homeButtonContainer: {
    borderRadius: 12,
  },
  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: colors.grey100,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.blue300,
  },
});
