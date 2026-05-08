import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import { createRoute } from '@granite-js/react-native';
import {
  getAnonymousKey,
  getCurrentLocation,
  startUpdateLocation,
  openCamera,
  OpenCameraPermissionError,
  GetCurrentLocationPermissionError,
  Accuracy,
  Location,
} from '@apps-in-toss/framework';
import { insertPhoto } from '../lib/supabase';
import { reverseGeocode } from '../lib/geocode';
import { compressImage } from '../lib/compress';
import { consumePendingReplacementSource, setPendingCapture } from '../lib/captureResult';

export const Route = createRoute('/capture', {
  component: CapturePage,
});

type Step = 'idle' | 'shooting' | 'locating' | 'geocoding' | 'compressing' | 'uploading' | 'done';

const LOCATION_ACCURACY_FALLBACKS = [Accuracy.Balanced, Accuracy.Low, Accuracy.Lowest];
const LOCATION_RETRY_DELAY_MS = 700;
const LOCATION_WARMUP_TIMEOUT_MS = 1800;
const LOCATION_ENVIRONMENT_ERROR_MESSAGE =
  '현재 실행 환경에서 위치를 가져오지 못했어요. 장소명을 직접 입력해 주세요.';

const LOCATION_BRIDGE_ERROR_CODES = new Set([
  'METHOD_NOT_FOUND',
  'METHOD_NOT_EXIST',
  'NOT_SUPPORTED',
  'NOT_IMPLEMENTED',
  'UNAVAILABLE',
  'UNSUPPORTED_OPERATION',
]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseErrorInfo(error: unknown): {
  name?: string;
  code?: string;
  message?: string;
  userInfo?: unknown;
} {
  if (error == null || typeof error !== 'object') {
    return {};
  }

  const candidate = error as {
    name?: unknown;
    code?: unknown;
    message?: unknown;
    userInfo?: unknown;
  };

  return {
    name: typeof candidate.name === 'string' ? candidate.name : undefined,
    code: typeof candidate.code === 'string' ? candidate.code : undefined,
    message: typeof candidate.message === 'string' ? candidate.message : undefined,
    userInfo: candidate.userInfo,
  };
}

function isBridgeEnvironmentFailure(error: unknown): boolean {
  const { code, message } = parseErrorInfo(error);
  const normalizedCode = code?.toUpperCase();
  if (normalizedCode != null && LOCATION_BRIDGE_ERROR_CODES.has(normalizedCode)) {
    return true;
  }

  const normalizedMessage = message?.toLowerCase();
  if (normalizedMessage == null) {
    return false;
  }

  return (
    normalizedMessage.includes('현재 실행 환경에서 위치를 가져오지 못했어요') ||
    normalizedMessage.includes('not appsintoss environment') ||
    normalizedMessage.includes('method not found') ||
    normalizedMessage.includes('not supported')
  );
}

function isBedrockLocationDenied(error: unknown): boolean {
  const { code, message } = parseErrorInfo(error);
  if (code !== 'EXECUTION_ERROR' || message == null) {
    return false;
  }

  const normalizedMessage = message.toLowerCase();
  return normalizedMessage.includes('bedrock.locationerror') && normalizedMessage.includes('오류 1');
}

function CapturePage() {
  const navigation = Route.useNavigation();
  const { width: windowWidth } = useWindowDimensions();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [placeName, setPlaceName] = useState('');
  const [memo, setMemo] = useState('');
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isTextInputFocused, setIsTextInputFocused] = useState(false);
  const photoWidth = Math.max(windowWidth - 32, 0);
  const photoBoxExpandedHeight = photoWidth / 1.4;
  const photoBoxCompactHeight = photoWidth / 2.7;
  const photoBoxHeight = useRef(new Animated.Value(photoBoxExpandedHeight)).current;
  const userIdRef = useRef<string | null>(null);
  const isWarmupSupportedRef = useRef(true);

  useEffect(() => {
    Animated.timing(photoBoxHeight, {
      toValue: isTextInputFocused ? photoBoxCompactHeight : photoBoxExpandedHeight,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [isTextInputFocused, photoBoxCompactHeight, photoBoxExpandedHeight, photoBoxHeight]);

  useEffect(() => {
    async function fetchUserId() {
      const result = await getAnonymousKey();
      if (result !== undefined && result !== 'ERROR') {
        userIdRef.current = result.hash;
      }
    }
    fetchUserId();
  }, []);

  const warmupLocationSignal = async () => {
    if (!isWarmupSupportedRef.current) {
      return;
    }

    await new Promise<void>((resolve) => {
      let done = false;
      let stopListening: (() => void) | undefined;

      const finish = (reason: 'event' | 'error' | 'timeout' | 'setup', detail?: unknown) => {
        if (done) {
          return;
        }
        done = true;
        clearTimeout(timeoutId);

        try {
          stopListening?.();
        } catch (stopError) {
          const stopErrorInfo = parseErrorInfo(stopError);
          if (stopErrorInfo.code === 'METHOD_NOT_EXIST') {
            isWarmupSupportedRef.current = false;
            console.log('Location warmup disabled: listener cleanup is not supported');
          } else {
            console.warn('Location warmup listener cleanup failed', stopErrorInfo);
          }
        }

        if (detail === undefined) {
          console.log('Location warmup finished', { reason });
        } else {
          console.log('Location warmup finished', { reason, detail });
        }
        resolve();
      };

      const timeoutId = setTimeout(() => finish('timeout'), LOCATION_WARMUP_TIMEOUT_MS);

      try {
        stopListening = startUpdateLocation({
          options: {
            accuracy: Accuracy.Low,
            timeInterval: 300,
            distanceInterval: 0,
          },
          onEvent: (location) => {
            finish('event', {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy,
            });
          },
          onError: (error) => {
            const errorInfo = parseErrorInfo(error);
            if (errorInfo.code === 'METHOD_NOT_EXIST') {
              isWarmupSupportedRef.current = false;
            }
            finish('error', parseErrorInfo(error));
          },
        });
      } catch (setupError) {
        const setupErrorInfo = parseErrorInfo(setupError);
        if (setupErrorInfo.code === 'METHOD_NOT_EXIST') {
          isWarmupSupportedRef.current = false;
        }
        finish('setup', setupErrorInfo);
      }
    });
  };

  const locateAndFillPlace = async () => {
    setError(null);
    setStep('locating');

    let currentLat: number;
    let currentLng: number;

    try {
      const permission = await getCurrentLocation.getPermission();
      console.log('Location permission status:', permission);

      if (permission !== 'allowed') {
        const requestedPermission = await getCurrentLocation.openPermissionDialog();
        console.log('Location permission request result:', requestedPermission);

        if (requestedPermission !== 'allowed') {
          setError('위치 권한이 허용되지 않았어요. 장소명을 직접 입력해 주세요.');
          return;
        }
      }

      const location = await getCurrentLocationWithFallback();
      currentLat = location.coords.latitude;
      currentLng = location.coords.longitude;
      setLat(currentLat);
      setLng(currentLng);
      console.log('Current location:', {
        latitude: currentLat,
        longitude: currentLng,
        accuracy: location.coords.accuracy,
      });
    } catch (e) {
      const errorInfo = parseErrorInfo(e);
      console.warn('Current location request failed', errorInfo);
      if (isBridgeEnvironmentFailure(e)) {
        setError(LOCATION_ENVIRONMENT_ERROR_MESSAGE);
        return;
      }
      if (isBedrockLocationDenied(e)) {
        setError('?꾩튂 ?쒕퉬?ㅺ? 鍮꾪솢?깊솕?섎릺?덇굅?? ?꾩옱 ?꾩튂瑜?李얠? 紐삵븯?고빀?덈떎. ?ㅼ젙?먯꽌 ?꾩튂 ?쒕퉬?ㅻ? ?뺤씤??二쇱꽭??');
        return;
      }
      if (e instanceof GetCurrentLocationPermissionError) {
        setError('위치 권한이 없어요. 장소명을 직접 입력해 주세요.');
      } else {
        setError(
          '현재 위치를 확인하지 못했어요. 기기 위치 서비스를 켜고, iOS에서는 토스의 정확한 위치를 허용해 주세요.'
        );
      }
      return;
    } finally {
      setStep('idle');
    }

    setStep('geocoding');
    try {
      const name = await reverseGeocode(currentLat, currentLng);
      setPlaceName(name);
      if (name === `${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}`) {
        setError('장소명을 자동으로 찾지 못했어요. 직접 입력해 주세요.');
      }
    } catch (e) {
      console.warn('Reverse geocoding failed in capture flow', e);
      setError('장소명을 자동으로 찾지 못했어요. 직접 입력해 주세요.');
    } finally {
      setStep('idle');
    }
  };

  const getCurrentLocationWithFallback = async (): Promise<Location> => {
    let lastError: unknown;
    await warmupLocationSignal();

    for (const accuracy of LOCATION_ACCURACY_FALLBACKS) {
      try {
        console.log('Requesting current location with accuracy:', accuracy);
        return await getCurrentLocation({ accuracy });
      } catch (e) {
        lastError = e;
        console.warn('Current location attempt failed', {
          accuracy,
          ...parseErrorInfo(e),
        });

        if (e instanceof GetCurrentLocationPermissionError) {
          throw e;
        }
        if (isBedrockLocationDenied(e)) {
          throw e;
        }

        await sleep(LOCATION_RETRY_DELAY_MS);
      }
    }

    throw lastError;
  };

  const shoot = async () => {
    setError(null);
    setStep('shooting');

    let rawBase64: string;
    try {
      const response = await openCamera({ base64: true, maxWidth: 1200 });
      rawBase64 = response.dataUri;
    } catch (e) {
      if (e instanceof OpenCameraPermissionError) {
        setError('카메라 권한이 필요해요. 설정에서 카메라 권한을 허용해 주세요.');
      } else {
        setError('사진 촬영에 실패했어요.');
      }
      setStep('idle');
      return;
    }

    setStep('compressing');
    let compressed: string;
    try {
      compressed = await compressImage(`data:image/jpeg;base64,${rawBase64}`);
    } catch {
      compressed = `data:image/jpeg;base64,${rawBase64}`;
    }
    setImageUri(compressed);

    await sleep(500);
    await locateAndFillPlace();
  };

  const save = async () => {
    if (imageUri == null) {
      setError('먼저 사진을 찍어 주세요.');
      return;
    }
    if (userIdRef.current == null) {
      setError('유저 정보를 가져오지 못했어요. 다시 시도해 주세요.');
      return;
    }

    setError(null);
    setStep('uploading');

    try {
      await insertPhoto({
        userId: userIdRef.current,
        imageBase64: imageUri,
        lat,
        lng,
        placeName: placeName.trim() || null,
        memo: memo.trim() || null,
        replacementSource: consumePendingReplacementSource() ?? undefined,
      });
      setStep('done');
      setPendingCapture({
        photoUri: imageUri,
        placeName: placeName.trim() || null,
      });
      navigation.navigate('/');
    } catch (e) {
      console.error(e);
      setError('저장에 실패했어요. 다시 시도해 주세요.');
      setStep('idle');
    }
  };

  const isWorking = step !== 'idle' && step !== 'done';
  const stepLabel: Record<Step, string> = {
    idle: '',
    shooting: '카메라 열기...',
    compressing: '사진 압축 중...',
    locating: '위치 확인 중...',
    geocoding: '장소명 확인 중...',
    uploading: '저장 중...',
    done: '완료',
  };

  return (
    <View style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.navigate('/')} disabled={isWorking}>
              <Text style={styles.backText}>← 취소</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>오늘 한 컷</Text>
            <View style={{ width: 52 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <Animated.View
              style={[
                styles.photoBox,
                imageUri != null && styles.photoBoxFilled,
                { height: photoBoxHeight },
              ]}
            >
              <TouchableOpacity
                style={styles.photoButton}
                onPress={shoot}
                disabled={isWorking}
                activeOpacity={0.8}
              >
                {imageUri != null ? (
                  <Image source={{ uri: imageUri }} style={styles.photo} resizeMode="cover" />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.photoIcon}>📷</Text>
                    <Text style={styles.photoHint}>탭해서 사진 찍기</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>

            {isWorking && (
              <View style={styles.statusRow}>
                <ActivityIndicator size="small" color="#0064FF" />
                <Text style={styles.statusText}>{stepLabel[step]}</Text>
              </View>
            )}

            {error != null && <Text style={styles.errorText}>{error}</Text>}

            {imageUri != null && (lat == null || lng == null) && (
              <TouchableOpacity
                style={styles.retryLocationButton}
                onPress={locateAndFillPlace}
                disabled={isWorking}
              >
              <Text style={styles.retryLocationText}>현재 위치 다시 시도</Text>
              </TouchableOpacity>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>장소</Text>
              {imageUri != null && (lat == null || lng == null) && (
                <Text style={styles.fieldHint}>
                  iOS/Android 기기 위치 서비스를 켜고, iOS는 토스의 정확한 위치를 허용해 주세요.
                  위치가 없으면 지도 핀 없이 기록만 저장돼요.
                </Text>
              )}
              <TextInput
                style={styles.input}
                value={placeName}
                onChangeText={setPlaceName}
                placeholder="장소명 (자동 입력 또는 직접 입력)"
                placeholderTextColor="#9CA3AF"
                editable={!isWorking}
                returnKeyType="done"
                onFocus={() => setIsTextInputFocused(true)}
                onBlur={() => setIsTextInputFocused(false)}
                onSubmitEditing={Keyboard.dismiss}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>메모 (선택)</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={memo}
                onChangeText={setMemo}
                placeholder="오늘 이 장소에 대한 한 줄 기록"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                editable={!isWorking}
                returnKeyType="default"
                blurOnSubmit={false}
                onFocus={() => setIsTextInputFocused(true)}
                onBlur={() => setIsTextInputFocused(false)}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.saveButton,
                (isWorking || imageUri == null) && styles.saveButtonDisabled,
              ]}
              onPress={save}
              disabled={isWorking || imageUri == null}
            >
              {step === 'uploading' ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.saveButtonText}>오늘 한 컷 저장하기</Text>
              )}
            </TouchableOpacity>

            <View style={styles.keyboardSpacer} />
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  backText: {
    color: '#0064FF',
    fontSize: 15,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  keyboardSpacer: {
    height: 220,
  },
  photoBox: {
    width: '100%',
    backgroundColor: '#E5E7EB',
    borderRadius: 14,
    overflow: 'hidden',
  },
  photoButton: {
    flex: 1,
  },
  photoBoxFilled: {
    backgroundColor: 'transparent',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoIcon: {
    fontSize: 40,
  },
  photoHint: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    color: '#0064FF',
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500',
  },
  retryLocationButton: {
    alignItems: 'center',
    backgroundColor: '#EEF6FF',
    borderColor: '#BFDBFE',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 11,
  },
  retryLocationText: {
    color: '#0064FF',
    fontSize: 14,
    fontWeight: '700',
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  fieldHint: {
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 17,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  inputMultiline: {
    height: 90,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#0064FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
});
