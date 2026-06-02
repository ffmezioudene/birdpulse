import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { setAudioModeAsync } from 'expo-audio';
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

// Keep the native splash visible until we explicitly hide it. ALWAYS guard
// the call — on web / Node these functions can throw.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Maximum time the native splash is ever allowed to remain visible. If
// something (fonts, network, RC SDK) hangs, we still get into the JS UI
// rather than stranding the user on the launch screen forever.
const SPLASH_FAILSAFE_MS = 6000;

export default function RootLayout() {
  const [iconsLoaded, iconsError] = useIconFonts();
  const [textFontsLoaded, textFontsError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  // "Real" font readiness (resolved OR errored). System fonts will fall back
  // automatically if a typeface failed to bundle.
  const fontsSettled =
    (iconsLoaded || !!iconsError) && (textFontsLoaded || !!textFontsError);

  // `splashHidden` is the single source of truth for "should we render the
  // tree?". Flips to true on whichever happens first: fonts are settled, OR
  // the failsafe timeout fires. Never goes back to false.
  const [splashHidden, setSplashHidden] = useState(false);
  const hidRef = useRef(false);

  const hideSplash = () => {
    if (hidRef.current) return;
    hidRef.current = true;
    SplashScreen.hideAsync().catch(() => {});
    setSplashHidden(true);
  };

  useEffect(() => {
    if (fontsSettled) hideSplash();
  }, [fontsSettled]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (__DEV__ && !hidRef.current) {
        console.log('[boot] splash failsafe fired — proceeding with degraded fonts');
      }
      hideSplash();
    }, SPLASH_FAILSAFE_MS);
    return () => clearTimeout(t);
  }, []);

  // Configure audio session ONCE — without this, iOS phones on silent mode
  // play silently even when expo-audio reports `playing: true`.
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: false,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
    }).catch((e) => {
      if (__DEV__) console.log('[audio-mode] not applied:', e?.message ?? e);
    });
  }, []);

  if (!splashHidden) return null;

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
        </RevenueCatProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
