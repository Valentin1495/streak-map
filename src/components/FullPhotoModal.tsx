import React from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@toss/tds-react-native';

interface FullPhotoModalProps {
  visible: boolean;
  uri: string | null;
  placeName?: string | null;
  onClose: () => void;
}

export function FullPhotoModal({ visible, uri, placeName, onClose }: FullPhotoModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible && uri != null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 18) }]}>
          {placeName != null && placeName !== '' && <Text style={styles.placeName}>📍 {placeName}</Text>}
        </View>

        <TouchableOpacity style={styles.imageTouchArea} onPress={onClose} activeOpacity={1}>
          {uri != null && <Image source={{ uri }} style={styles.image} resizeMode="contain" />}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    alignItems: 'center',
  },
  placeName: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  imageTouchArea: {
    flex: 1,
    paddingHorizontal: 8,
    paddingBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
