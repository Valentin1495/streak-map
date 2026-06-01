import React, { useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import WebView, { WebViewMessageEvent } from '@granite-js/native/react-native-webview';
import { colors } from '@toss/tds-react-native';
import { Photo, getPhotoUrl } from '../lib/supabase';
import { brandColors } from '../lib/theme';

const MAP_URL = 'https://streakmap.vercel.app/';

interface PinData {
  id: string;
  latitude: number;
  longitude: number;
  imageUrl: string;
  placeName: string;
  date: string;
  count: number;
  photoIds: string[];
}

interface MapMessage {
  type?: 'location' | 'pinTap' | 'error';
  latitude?: number;
  longitude?: number;
  pinId?: string;
  photoIds?: string[];
  message?: string;
}

interface MapWebViewProps {
  photos: Photo[];
  onPinTap?: (photo: Photo, group?: Photo[]) => void;
  showPath?: boolean;
}

export function MapWebView({ photos, onPinTap, showPath = false }: MapWebViewProps) {
  const webViewRef = useRef<WebView>(null);

  const injectPins = () => {
    // 좌표를 소수점 4자리(약 11m) 단위로 그룹화하여 겹치는 마커 처리
    const pinGroups = photos
      .filter((p) => p.lat != null && p.lng != null)
      .reduce(
        (acc, p) => {
          const key = `${p.lat!.toFixed(4)},${p.lng!.toFixed(4)}`;
          if (!acc[key]) acc[key] = [];
          acc[key].push(p);
          return acc;
        },
        {} as Record<string, Photo[]>
      );

    const pins: PinData[] = Object.values(pinGroups).map((group) => {
      // 그룹 내에서 대표 사진을 우선으로 사용 (없으면 가장 최근 사진)
      const sortedGroup = group.sort((a, b) => b.taken_at.localeCompare(a.taken_at));
      const latest = sortedGroup.find((p) => p.is_representative) ?? sortedGroup[0]!;
      return {
        id: latest.id,
        latitude: latest.lat!,
        longitude: latest.lng!,
        imageUrl: `${getPhotoUrl(latest.storage_path)}?v=${encodeURIComponent(latest.taken_at)}`,
        placeName: latest.place_name ?? '',
        date: latest.streak_date,
        count: group.length,
        photoIds: group.map((p) => p.id),
      };
    });

    console.log('Injecting map pins:', {
      totalPhotos: photos.length,
      pinGroups: pins.length,
    });

    const js = `
      (function() {
        if (!window.setStreakPins) {
          window.__streakMarkers = [];
          window.setStreakPins = function(pins) {
            if (!window.naver || !window.naver.maps || !window.map) {
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'error',
                message: 'Naver map is not ready'
              }));
              return;
            }

            window.__streakMarkers.forEach(function(marker) {
              marker.setMap(null);
            });
            window.__streakMarkers = [];

            pins.forEach(function(pin) {
              var position = new window.naver.maps.LatLng(pin.latitude, pin.longitude);
              var marker = new window.naver.maps.Marker({
                position: position,
                map: window.map,
                title: pin.placeName || pin.date,
                icon: {
                  content:
                    '<div style="position:relative;width:44px;height:44px;">' +
                    '<button style="width:44px;height:44px;border:3px solid ${brandColors.primary};border-radius:22px;overflow:hidden;padding:0;background:${colors.white};box-shadow:0 4px 10px rgba(0,0,0,.22);">' +
                    '<img src="' + pin.imageUrl + '" style="width:100%;height:100%;object-fit:cover;display:block;" />' +
                    '</button>' +
                    (pin.count > 1 ? '<div style="position:absolute;top:-4px;right:-4px;background:${colors.red500};color:white;font-size:11px;font-weight:bold;padding:2px 6px;border-radius:10px;box-shadow:0 2px 4px rgba(0,0,0,.2);">' + '+' + (pin.count - 1) + '</div>' : '') +
                    '</div>',
                  size: new window.naver.maps.Size(44, 44),
                  anchor: new window.naver.maps.Point(22, 22)
                }
              });

              window.naver.maps.Event.addListener(marker, 'click', function() {
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'pinTap',
                  pinId: pin.id,
                  photoIds: pin.photoIds
                }));
              });

              window.__streakMarkers.push(marker);
            });

            if (pins.length > 0) {
              var first = pins[0];
              window.map.setCenter(new window.naver.maps.LatLng(first.latitude, first.longitude));
              window.map.setZoom(Math.max(window.map.getZoom(), 13));
            }
          };
        }

        if (window.setStreakPins) {
          window.setStreakPins(${JSON.stringify(pins)});
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'pinsInjected',
            count: ${pins.length}
          }));
        } else {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'error',
            message: 'window.setStreakPins is not ready'
          }));
        }
      })();
      true;
    `;
    webViewRef.current?.injectJavaScript(js);
  };

  const injectPath = () => {
    const pathCoords = photos
      .filter((p) => p.lat != null && p.lng != null)
      .sort((a, b) => a.taken_at.localeCompare(b.taken_at))
      .map((p) => ({ lat: p.lat!, lng: p.lng! }));

    if (pathCoords.length < 2) return;

    const js = `
      (function() {
        if (!window.naver || !window.naver.maps || !window.map) return;

        if (window.__streakPath) {
          window.__streakPath.setMap(null);
        }

        var coords = ${JSON.stringify(pathCoords)}.map(function(c) {
          return new window.naver.maps.LatLng(c.lat, c.lng);
        });

        window.__streakPath = new window.naver.maps.Polyline({
          path: coords,
          map: window.map,
          strokeColor: '${brandColors.primary}',
          strokeOpacity: 0.55,
          strokeWeight: 3,
          strokeStyle: 'solid',
        });
      })();
      true;
    `;
    webViewRef.current?.injectJavaScript(js);
  };

  useEffect(() => {
    injectPins();
    if (showPath) injectPath();
  }, [photos, showPath]);

  const scheduleInjectPins = () => {
    [0, 300, 1000, 2000].forEach((delay) => {
      setTimeout(() => {
        injectPins();
        if (showPath) injectPath();
      }, delay);
    });
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as MapMessage;

      if (payload.type === 'pinTap' && payload.pinId != null) {
        const tapped = photos.find((p) => p.id === payload.pinId);
        if (tapped != null) {
          const group = payload.photoIds ? photos.filter((p) => payload.photoIds!.includes(p.id)) : [tapped];
          onPinTap?.(tapped, group);
        }
      } else if (payload.type === 'error') {
        console.warn('Map WebView message:', payload.message);
      } else {
        console.log('Map WebView message:', payload);
      }
    } catch {
      // 무시
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: MAP_URL }}
        originWhitelist={['https://*']}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        style={styles.webView}
        onLoadEnd={scheduleInjectPins}
        onMessage={handleMessage}
        onError={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
