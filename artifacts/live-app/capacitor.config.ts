import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android and iOS shells around the same web build (dist). The shells talk
 * to the production API: VITE_API_URL must be set when building for them
 * (see README.md, "Mobile apps").
 */
const config: CapacitorConfig = {
  appId: 'space.gahez.live',
  appName: 'Gahez Live',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'never',
  },
  plugins: {
    // Payment pages open in the system browser (Apple Pay needs Safari, not
    // a WebView) and come back through the gahezlive:// deep link.
    Browser: {},
  },
};

export default config;
