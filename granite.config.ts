import { appsInToss } from '@apps-in-toss/framework/plugins';
import { defineConfig } from '@granite-js/react-native/config';

export default defineConfig({
  scheme: 'intoss',
  appName: 'day-shot',
  plugins: [
    appsInToss({
      brand: {
        displayName: '오늘의 샷',
        primaryColor: '#0064FF',
        icon: '',
      },
      permissions: [{name: 'geolocation', access: 'access'}, {name: 'camera', access: 'access'}],
    }),
  ],
});
