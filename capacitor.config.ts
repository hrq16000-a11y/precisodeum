import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.fb56350539614289bd2c34953c61ff99',
  appName: 'precisodeum',
  webDir: 'dist',
  server: {
    url: 'https://fb563505-3961-4289-bd2c-34953c61ff99.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  ios: {
    contentInset: 'always',
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;