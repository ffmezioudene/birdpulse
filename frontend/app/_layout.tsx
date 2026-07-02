import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

import { useIconFonts } from '@/src/hooks/use-icon-fonts';
import { RevenueCatProvider } from '@/src/providers/RevenueCatProvider';
import { bootMark, bootSealCurrentAsLast } from '@/src/lib/boot-trace';

// =============================================================================
// MODULE-LEVEL SPLASH FAILSAFE
//
// Everything inside `useEffect` only runs if React actually mounts. If the
// JS bundle loaded but the very first render hits a synchronous error in
// some imported native module, the splash would otherwise hang forever.
//
// By scheduling `hideAsync()` at module top-level (BEFORE any React code
// runs), we guarantee the native splash hides after 3s no matter what
// happens inside React or any of our providers.
// =============================================================================
try {
  SplashScreen.preventAutoHideAsync().catch(() => {});
  bootMark('splash:prevent-auto-hide');
} catch (e) {
  bootMark('splash:prevent-auto-hide', false, e);
}

const MODULE_FAILSAFE_MS = 3000;
setTimeout(() => {
  SplashScreen.hideAsync()
    .then(() => bootMark('splash:hidden-by-module-failsafe'))
    .catch((e) => bootMark('splash:hidden-by-module-failsafe', false, e));
}, MODULE_FAILSAFE_MS);

// -- Audio setup runs fire-and-forget at module level so a hung native bridge
//    can never stall React boot. The dynamic require also keeps a bad module
//    from crashing the bundle.
(async () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const audio = require('expo-audio');
    if (audio?.setAudioModeAsync) {
      await audio.setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
        shouldPlayInBackground: false,
        interruptionMode: 'mixWithOthers',
      });
      bootMark('audio:mode-set');
    } else {
      bootMark('audio:module-missing', false);
    }
  } catch (e) {
    bootMark('audio:mode-set', false, e);
  }
})();

bootMark('layout:module-evaluated');

// =============================================================================
// FIREBASE ANALYTICS — automatic install tracking for Google Ads.
//
// Importing @react-native-firebase/analytics at module level is enough to
// register the native SDK, which in turn fires the automatic `first_open`
// event on first launch. No manual event logging is added here.
//
// Guarded because:
//   - The RNFB native module doesn't exist on web / Expo Go, so a raw import
//     would crash the bundle.
//   - Dynamic require inside a try/catch mirrors the expo-audio pattern
//     above and keeps a bad native module from stalling boot.
// =============================================================================
(async () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require('react-native');
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      bootMark('firebase:skipped-non-native');
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@react-native-firebase/app');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const analyticsModule = require('@react-native-firebase/analytics');
    // Touch the default export so the JS <-> native bridge actually
    // initializes the SDK (side-effect only; no custom event logging).
    if (analyticsModule?.default) analyticsModule.default();
    bootMark('firebase:analytics-initialized');
  } catch (e) {
    bootMark('firebase:analytics-initialized', false, e);
  }
})();

export default function RootLayout() {
  bootMark('layout:render');

  // Fonts are loaded but we deliberately DO NOT gate render on them. If a
  // font asset is missing or slow to decode in the production bundle, text
  // falls back to system fonts rather than hanging the splash forever.
  // Once fonts finish loading, React Native re-renders the text nodes.
  const [textFontsLoaded, textFontsError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const [iconsLoaded, iconsError] = useIconFonts();
  useEffect(() => {
    if (textFontsLoaded) bootMark('fonts:text-loaded');
    if (textFontsError) bootMark('fonts:text-loaded', false, textFontsError);
    if (iconsLoaded) bootMark('fonts:icons-loaded');
    if (iconsError) bootMark('fonts:icons-loaded', false, iconsError);
  }, [textFontsLoaded, textFontsError, iconsLoaded, iconsError]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0A0B0A' }}>
      <SafeAreaProvider>
        <RevenueCatProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#0A0B0A' },
              animation: 'fade',
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="paywall" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="identify" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="result" />
            <Stack.Screen name="chat" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="settings" />
            <Stack.Screen name="hotspots" />
            <Stack.Screen name="bird/[id]" />
            <Stack.Screen name="collection/[id]" />
            <Stack.Screen name="birds-near-you" />
            <Stack.Screen name="popular-birds" />
            <Stack.Screen name="category/[id]" />
            <Stack.Screen name="article/[id]" />
            <Stack.Screen name="diagnostics" />
          </Stack>
          <BootSealer />
        </RevenueCatProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Seals the current boot trace as "last" once we've made it past first
 *  render. If the next launch hangs, /diagnostics shows this trace and we
 *  can see exactly which step never completed. */
function BootSealer() {
  useEffect(() => {
    bootMark('layout:mounted');
    // Hide the splash as soon as the layout actually mounts — usually well
    // under the module-level 3s failsafe.
    SplashScreen.hideAsync()
      .then(() => bootMark('splash:hidden-by-mount'))
      .catch(() => {});
    // Seal a moment later so subsequent provider effects also land in the trace.
    const t = setTimeout(() => {
      bootMark('boot:complete');
      bootSealCurrentAsLast();
    }, 1500);
    return () => clearTimeout(t);
  }, []);
  return null;
}
