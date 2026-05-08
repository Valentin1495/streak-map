import { appsInToss } from '@apps-in-toss/framework/plugins';
import { defineConfig } from '@granite-js/react-native/config';

export default defineConfig({
  scheme: 'intoss',
  appName: 'dayshot',
  plugins: [
    appsInToss({
      brand: {
        displayName: '오늘 한 컷',
        primaryColor: '#0064FF',
        icon: '',
      },
      permissions: [{name: 'geolocation', access: 'access'}, {name: 'camera', access: 'access'}],
    }),
  ],
});
