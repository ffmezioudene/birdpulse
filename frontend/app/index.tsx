import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { storage } from '@/src/utils/storage';
import { KEYS } from '@/src/lib/state';
import { colors } from '@/src/theme';

export default function Boot() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const done = await storage.getItem<boolean>(KEYS.onboardingDone, false);
      if (!done) {
        router.replace('/onboarding');
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
