import React, { useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import WebView, { WebViewMessageEvent } from '@granite-js/native/react-native-webview';
import { Photo, getPhotoUrl } from '../lib/supabase';

const MAP_URL = 'https://streakmap.vercel.app/';

interface PinData {
  id: string;
  latitude: number;
  longitude: number;
  imageUrl: string;
  placeName: string;
  date: string;
}

interface MapMessage {
  type?: 'location' | 'pinTap' | 'error';
  latitude?: number;
  longitude?: number;
  pinId?: string;
  message?: string;
}

interface MapWebViewProps {
  photos: Photo[];
  onPinTap?: (photo: Photo) => void;
}

export function MapWebView({ photos, onPinTap }: MapWebViewProps) {
  const webViewRef = useRef<WebView>(null);

  const injectPins = () => {
    const pins: PinData[] = photos
      .filter((p) => p.lat != null && p.lng != null)
      .map((p) => ({
        id: p.id,
        latitude: p.lat!,
        longitude: p.lng!,
        imageUrl: getPhotoUrl(p.storage_path),
        placeName: p.place_name ?? '',
        date: p.streak_date,
      }));

    console.log('Injecting map pins:', {
      totalPhotos: photos.length,
      pins: pins.length,
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
                    '<button style="width:44px;height:44px;border:3px solid #0064FF;border-radius:22px;overflow:hidden;padding:0;background:#fff;box-shadow:0 4px 10px rgba(0,0,0,.22);">' +
                    '<img src="' + pin.imageUrl + '" style="width:100%;height:100%;object-fit:cover;display:block;" />' +
                    '</button>',
                  size: new window.naver.maps.Size(44, 44),
                  anchor: new window.naver.maps.Point(22, 22)
                }
              });

              window.naver.maps.Event.addListener(marker, 'click', function() {
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'pinTap',
                  pinId: pin.id
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

  useEffect(() => {
    injectPins();
  }, [photos]);

  const scheduleInjectPins = () => {
    [0, 300, 1000, 2000].forEach((delay) => {
      setTimeout(injectPins, delay);
    });
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as MapMessage;

      if (payload.type === 'pinTap' && payload.pinId != null) {
        const tapped = photos.find((p) => p.id === payload.pinId);
        if (tapped != null) {
          onPinTap?.(tapped);
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
