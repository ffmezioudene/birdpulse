import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { storage } from '@/src/utils/storage';
import { KEYS, isProEffective } from '@/src/lib/state';
import { colors } from '@/src/theme';

export default function Boot() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const done = await storage.getItem<boolean>(KEYS.onboardingDone, false);
      if (!done) {
        // First launch ever → onboarding → onboarding pushes /paywall at the end.
        router.replace('/onboarding');
        return;
      }
      // Onboarding is done. Free (non-Pro) users see the paywall on every
      // app open — they can dismiss with the X. Once RevenueCat is wired,
      // isProEffective() will read the live entitlement so an actual
      // subscriber will skip this step automatically.
      if (!(await isProEffective())) {
        router.replace('/paywall');
        return;
      }
      router.replace('/(tabs)');
    })();
  }, [router]);

  return (
    <View style={styles.container} testID="boot-screen">
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
