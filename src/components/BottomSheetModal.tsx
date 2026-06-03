import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, StyleProp, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { colors } from '@toss/tds-react-native';

interface BottomSheetModalProps {
  visible: boolean;
  children: ReactNode;
  onClose: () => void;
  sheetStyle?: StyleProp<ViewStyle>;
  overlayStyle?: StyleProp<ViewStyle>;
  enterDuration?: number;
  exitDuration?: number;
  onExitComplete?: () => void;
}

export function BottomSheetModal({
  visible,
  children,
  onClose,
  sheetStyle,
  overlayStyle,
  enterDuration = 300,
  exitDuration = 250,
  onExitComplete,
}: BottomSheetModalProps) {
  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const onExitCompleteRef = useRef(onExitComplete);

  useEffect(() => {
    onExitCompleteRef.current = onExitComplete;
  }, [onExitComplete]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: enterDuration,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: enterDuration,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    if (!mounted) return;

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: Dimensions.get('window').height,
        duration: exitDuration,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: exitDuration,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMounted(false);
      onExitCompleteRef.current?.();
    });
  }, [enterDuration, exitDuration, opacity, translateY, visible]);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, overlayStyle, { opacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            sheetStyle,
            {
              transform: [{ translateY }],
            },
          ]}
        >
          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
});
