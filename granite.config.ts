import { appsInToss } from '@apps-in-toss/framework/plugins';
import { defineConfig } from '@granite-js/react-native/config';

export default defineConfig({
  scheme: 'intoss',
  appName: 'day-shot',
  plugins: [
    appsInToss({
      brand: {
        displayName: '오늘의 샷',
        primaryColor: '#006D77',
        icon: 'https://static.toss.im/appsintoss/25061/d2d5cd56-249e-4722-8c3a-1a006e9014f5.png',
      },
      permissions: [
        { name: 'geolocation', access: 'access' },
        { name: 'camera', access: 'access' },
      ],
    }),
  ],
});
