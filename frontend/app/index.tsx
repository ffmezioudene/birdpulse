import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';

import { storage } from '@/src/utils/storage';
import { KEYS, isProEffective } from '@/src/lib/state';
import { colors, type, spacing } from '@/src/theme';

/** Promise.race a value-returning promise against a timeout that returns a
 *  fallback. Keeps boot from ever stalling on a hung AsyncStorage call. */
function withFallback<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => {
      if (!done) {
        done = true;
        resolve(fallback);
      }
    }, ms);
    p.then(
      (v) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve(v);
      },
      () => {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve(fallback);
      },
    );
  });
}

export default function Boot() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const done = await withFallback(
          storage.getItem<boolean>(KEYS.onboardingDone, false),
          1500,
          false,
        );
        if (!done) {
          router.replace('/onboarding');
          return;
        }
        const pro = await withFallback(isProEffective(), 1500, false);
        if (!pro) {
          router.replace('/paywall');
          return;
        }
        router.replace('/(tabs)');
      } catch (e) {
        if (__DEV__) console.log('[boot] router redirect failed, defaulting to tabs:', e);
        // Last-resort fallback so we never dead-end the user.
        router.replace('/(tabs)');
      }
    })();
  }, [router]);

  return (
    <View style={styles.container} testID="boot-screen">
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.label}>BirdPulse</Text>
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
});
