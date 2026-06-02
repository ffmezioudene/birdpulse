// Diagnostic / debug screen — reachable by tapping the Settings version
// row 7 times. Never displays secret values, only "loaded" / "missing"
// markers so it's safe to share screenshots.
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

import { colors, type, spacing, radii } from '@/src/theme';
import { useRevenueCat } from '@/src/providers/RevenueCatProvider';
import {
  IS_RC_AVAILABLE,
  RC_ENTITLEMENT,
  RC_OFFERING_ID,
  isRevenueCatConfigured,
} from '@/src/lib/revenuecat';
import { isProEffective, getFreeIdentifications, getFreeChats } from '@/src/lib/state';
import { getLastBootTrace, getCurrentBootTrace, type BootStep } from '@/src/lib/boot-trace';

function present(v: string | undefined | null): 'loaded' | 'missing' {
  return v && v.length > 0 ? 'loaded' : 'missing';
}

function maskHost(url: string | undefined | null): string {
  if (!url) return '—';
  try {
    const u = new URL(url);
    return u.host;
  } catch {
    return url.slice(0, 32) + (url.length > 32 ? '…' : '');
  }
}

export default function Diagnostics() {
  const router = useRouter();
  const rc = useRevenueCat();
  const [freeIds, setFreeIds] = useState<number | null>(null);
  const [freeChats, setFreeChats] = useState<number | null>(null);
  const [proEff, setProEff] = useState<boolean | null>(null);
  const [lastTrace, setLastTrace] = useState<BootStep[] | null>(null);
  const [currTrace, setCurrTrace] = useState<BootStep[] | null>(null);

  useEffect(() => {
    (async () => {
      setFreeIds(await getFreeIdentifications());
      setFreeChats(await getFreeChats());
      setProEff(await isProEffective());
      setLastTrace(await getLastBootTrace());
      setCurrTrace(await getCurrentBootTrace());
    })();
  }, [rc.isPro]);

  const env = {
    EXPO_PUBLIC_BACKEND_URL: process.env.EXPO_PUBLIC_BACKEND_URL,
    EXPO_PUBLIC_RC_TEST_KEY: process.env.EXPO_PUBLIC_RC_TEST_KEY,
    EXPO_PUBLIC_RC_IOS_KEY: process.env.EXPO_PUBLIC_RC_IOS_KEY,
    EXPO_PUBLIC_RC_ANDROID_KEY: process.env.EXPO_PUBLIC_RC_ANDROID_KEY,
    EXPO_PUBLIC_RC_ENTITLEMENT: process.env.EXPO_PUBLIC_RC_ENTITLEMENT,
    EXPO_PUBLIC_RC_OFFERING: process.env.EXPO_PUBLIC_RC_OFFERING,
  };

  const rows: Array<{ label: string; value: string; ok?: boolean }> = [
    { label: 'App version', value: Constants.expoConfig?.version ?? '—' },
    { label: 'Build profile', value: __DEV__ ? 'development' : 'production' },
    { label: 'Platform', value: `${Platform.OS} ${Platform.Version}` },
    { label: 'Execution env', value: String(Constants.executionEnvironment ?? '—') },
    { label: '—', value: '' },
    { label: 'Backend URL', value: maskHost(env.EXPO_PUBLIC_BACKEND_URL), ok: !!env.EXPO_PUBLIC_BACKEND_URL },
    { label: 'EXPO_PUBLIC_BACKEND_URL', value: present(env.EXPO_PUBLIC_BACKEND_URL), ok: !!env.EXPO_PUBLIC_BACKEND_URL },
    { label: 'EXPO_PUBLIC_RC_TEST_KEY', value: present(env.EXPO_PUBLIC_RC_TEST_KEY), ok: !!env.EXPO_PUBLIC_RC_TEST_KEY || !__DEV__ },
    { label: 'EXPO_PUBLIC_RC_IOS_KEY', value: present(env.EXPO_PUBLIC_RC_IOS_KEY), ok: !!env.EXPO_PUBLIC_RC_IOS_KEY || __DEV__ },
    { label: 'EXPO_PUBLIC_RC_ANDROID_KEY', value: present(env.EXPO_PUBLIC_RC_ANDROID_KEY) },
    { label: 'EXPO_PUBLIC_RC_ENTITLEMENT', value: env.EXPO_PUBLIC_RC_ENTITLEMENT || `(default: ${RC_ENTITLEMENT})` },
    { label: 'EXPO_PUBLIC_RC_OFFERING', value: env.EXPO_PUBLIC_RC_OFFERING || `(default: ${RC_OFFERING_ID})` },
    { label: '—', value: '' },
    { label: 'RC platform support', value: IS_RC_AVAILABLE ? 'yes' : 'no (web/SSR)', ok: IS_RC_AVAILABLE },
    { label: 'RC SDK configured', value: isRevenueCatConfigured() ? 'yes' : 'no', ok: isRevenueCatConfigured() },
    { label: 'RC provider initialized', value: rc.initialized ? 'yes' : 'no', ok: rc.initialized },
    { label: 'Entitlement active', value: rc.isPro ? `yes (${RC_ENTITLEMENT})` : 'no', ok: rc.isPro },
    { label: 'Pro (effective)', value: proEff === null ? '…' : proEff ? 'yes' : 'no' },
    { label: 'Customer ID', value: rc.customerInfo?.originalAppUserId ?? '—' },
    { label: '—', value: '' },
    { label: 'Free identifications left', value: freeIds === null ? '…' : String(freeIds) },
    { label: 'Free chats left', value: freeChats === null ? '…' : String(freeChats) },
  ];

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Diagnostics</Text>
          <View style={{ width: 38 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 8 }}>
          <Text style={styles.note}>
            Internal debug info. No secret values are shown. Safe to share for support.
          </Text>
          {rows.map((r, i) =>
            r.label === '—' ? (
              <View key={`sep-${i}`} style={styles.sep} />
            ) : (
              <View key={`${r.label}-${i}`} style={styles.row}>
                <Text style={styles.k}>{r.label}</Text>
                <Text
                  style={[
                    styles.v,
                    r.ok === true && { color: colors.primary },
                    r.ok === false && { color: colors.danger },
                  ]}
                  numberOfLines={2}
                >
                  {r.value}
                </Text>
              </View>
            ),
          )}

          <View style={styles.sep} />
          <Text style={styles.sectionHeader}>Current boot trace</Text>
          {(currTrace ?? []).length === 0 ? (
            <Text style={styles.note}>No trace recorded yet.</Text>
          ) : (
            (currTrace ?? []).map((s, i) => (
              <View key={`c${i}`} style={styles.traceRow}>
                <Text style={styles.traceT}>{`+${s.t}ms`}</Text>
                <Text
                  style={[
                    styles.traceStep,
                    s.ok === false && { color: colors.danger },
                  ]}
                >
                  {s.step}
                  {s.err ? `  —  ${s.err}` : ''}
                </Text>
              </View>
            ))
          )}

          <View style={styles.sep} />
          <Text style={styles.sectionHeader}>Previous boot trace</Text>
          <Text style={styles.note}>
            If the app hung on the splash last time, the LAST step here is the culprit.
          </Text>
          {(lastTrace ?? []).length === 0 ? (
            <Text style={styles.note}>No previous boot recorded.</Text>
          ) : (
            (lastTrace ?? []).map((s, i) => (
              <View key={`l${i}`} style={styles.traceRow}>
                <Text style={styles.traceT}>{`+${s.t}ms`}</Text>
                <Text
                  style={[
                    styles.traceStep,
                    s.ok === false && { color: colors.danger },
                  ]}
                >
                  {s.step}
                  {s.err ? `  —  ${s.err}` : ''}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  headerTitle: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700' },
  note: { ...type.caption, color: colors.textTertiary, marginBottom: 12 },
  sep: { height: 1, backgroundColor: colors.hairline, marginVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: 8,
  },
  k: { ...type.bodySm, color: colors.textTertiary, flex: 1 },
  v: { ...type.bodySm, color: colors.textPrimary, fontWeight: '600', maxWidth: '55%', textAlign: 'right' },
  sectionHeader: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  traceRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 4, gap: 12 },
  traceT: { ...type.caption, color: colors.textTertiary, width: 70, fontVariant: ['tabular-nums'] },
  traceStep: { ...type.caption, color: colors.textPrimary, flex: 1 },
});
