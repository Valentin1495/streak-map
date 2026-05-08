import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

export type ToastVariant = 'used' | 'missed';

interface ProtectionToastProps {
  visible: boolean;
  variant: ToastVariant;
  ticketCount?: number;
  onHide: () => void;
}

const MESSAGES: Record<ToastVariant, (ticketCount?: number) => { icon: string; main: string; sub: string }> = {
  used: (ticketCount) => ({
    icon: '🛡',
    main: '기록 보호권을 사용해 연속 기록을 이어뒀어요.',
    sub: `남은 보호권: ${ticketCount ?? 0}개`,
  }),
  missed: () => ({
    icon: '🙂',
    main: '어제 기록이 비었어요.',
    sub: '오늘부터 다시 이어가요',
  }),
};

export function ProtectionToast({ visible, variant, ticketCount, onHide }: ProtectionToastProps) {
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, tension: 70, friction: 10, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -80, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => onHide());
    }, 3000);

    return () => clearTimeout(timer);
  }, [visible, translateY, opacity, onHide]);

  if (!visible) return null;

  const { icon, main, sub } = MESSAGES[variant](ticketCount);

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }], opacity }]}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.textCol}>
        <Text style={styles.main}>{main}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 100,
    backgroundColor: '#1F2937',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  icon: {
    fontSize: 22,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  main: {
    fontSize: 13,
    fontWeight: '700',
    color: 'white',
    lineHeight: 18,
  },
  sub: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});
