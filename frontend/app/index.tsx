import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { storage } from '@/src/utils/storage';
import { KEYS, isProEffective } from '@/src/lib/state';
import { colors, type, spacing } from '@/src/theme';
import { bootMark } from '@/src/lib/boot-trace';

/** Promise.race against a timeout that returns `fallback`. Boot never blocks. */
function withFallback<T>(p: Promise<T>, ms: number, fallback: T, tag: string): Promise<T> {
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => {
      if (!done) {
        done = true;
        bootMark(`${tag}:timeout`, false);
        resolve(fallback);
      }
    }, ms);
    p.then(
      (v) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        bootMark(`${tag}:ok`);
        resolve(v);
      },
      (e) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        bootMark(`${tag}:reject`, false, e);
        resolve(fallback);
      },
    );
  });
}

export default function Boot() {
  const router = useRouter();
  const [showRescue, setShowRescue] = useState(false);
  const [navigated, setNavigated] = useState(false);

  useEffect(() => {
    // If we're STILL on this boot screen 4 s in, surface a rescue button so
    // the user can force-route into the app rather than stare at a spinner.
    const t = setTimeout(() => setShowRescue(true), 4000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    bootMark('boot-router:mounted');
    let aborted = false;
    // Fire-and-forget. Never `await` anything in render. Always reach a
    // route inside 3.5 s no matter what AsyncStorage / Pro check decide.
    (async () => {
      try {
        const done = await withFallback(
          storage.getItem<boolean>(KEYS.onboardingDone, false),
          3000, // bumped from 1.5 s — AsyncStorage first-launch latency on iOS can spike
          false,
          'boot-router:onboarding-read',
        );
        if (aborted) return;
        if (!done) {
          bootMark('boot-router:redirect-onboarding');
          setNavigated(true);
          router.replace('/onboarding');
          return;
        }
        const pro = await withFallback(isProEffective(), 3000, false, 'boot-router:pro-read');
        if (aborted) return;
        if (!pro) {
          bootMark('boot-router:redirect-paywall');
          setNavigated(true);
          router.replace('/paywall');
          return;
        }
        bootMark('boot-router:redirect-tabs');
        setNavigated(true);
        router.replace('/(tabs)');
      } catch (e) {
        bootMark('boot-router:exception', false, e);
        if (!aborted) {
          setNavigated(true);
          router.replace('/(tabs)');
        }
      }
    })();
    return () => {
      aborted = true;
    };
  }, [router]);

  // Once we've issued a redirect, suppress both the spinner and the rescue
  // hatch — some platforms (Metro web) keep the route mounted briefly while
  // the next screen takes over, and we don't want flicker.
  if (navigated) return null;

  return (
    <View style={styles.container} testID="boot-screen">
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.label}>BirdPulse</Text>
      {showRescue && (
        <Pressable
          onPress={() => {
            bootMark('rescue:tapped');
            SplashScreen.hideAsync().catch(() => {});
            setNavigated(true);
            router.replace('/(tabs)');
          }}
          style={styles.rescueBtn}
          testID="boot-rescue"
        >
          <Text style={styles.rescueText}>Tap if stuck</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  label: { ...type.bodySm, color: colors.textTertiary, marginTop: 12 },
  rescueBtn: {
    marginTop: 36,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  rescueText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
