import { appsInToss } from '@apps-in-toss/framework/plugins';
import { defineConfig } from '@granite-js/react-native/config';

export default defineConfig({
  scheme: 'intoss',
  appName: 'streak-map',
  plugins: [
    appsInToss({
      brand: {
        displayName: 'Streak Map',
        primaryColor: '#0064FF',
        icon: '',
      },
      permissions: [{name: 'geolocation', access: 'access'}, {name: 'camera', access: 'access'}],
    }),
  ],
});
