import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.santi.midnightmaki',
  appName: 'Midnight Maki',
  webDir: 'dist',
  backgroundColor: '#1f2440',
  android: {
    // no browser behaviours: no zoom, no text selection callouts, no overscroll glow
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
