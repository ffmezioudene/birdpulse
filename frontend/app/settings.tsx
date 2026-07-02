import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

import { colors, type, spacing, radii } from '@/src/theme';
import { isProEffective, resetFreeLimits } from '@/src/lib/state';
import { IS_DEV_MODE, getDevProUnlocked, setDevProUnlocked } from '@/src/lib/devmode';
import { useRevenueCat } from '@/src/providers/RevenueCatProvider';
import { IS_RC_AVAILABLE } from '@/src/lib/revenuecat';
import { openPrivacyPolicy, openTermsOfUse } from '@/src/lib/links';

export default function Settings() {
  const router = useRouter();
  const rc = useRevenueCat();
  const [pro, setProState] = useState(false);
  const [devPro, setDevProState] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const refresh = async () => {
    setProState(await isProEffective());
    setDevProState(await getDevProUnlocked());
  };

  useEffect(() => {
    refresh();
  }, [rc.isPro]);

  const toggleDevPro = async (v: boolean) => {
    setDevProState(v);
    await setDevProUnlocked(v);
    await refresh();
  };

  const onResetLimits = async () => {
    const r = await resetFreeLimits();
    Alert.alert(
      'Free limits reset',
      `Identifications: ${r.ids} · Chats: ${r.chats}. The paywall will trigger again once these are exhausted.`,
    );
  };

  const onRestore = async () => {
    if (!IS_RC_AVAILABLE) {
      Alert.alert(
        'Mobile-only',
        'Purchase restoration is available in the BirdPulse mobile app.',
      );
      return;
    }
    setRestoring(true);
    try {
      const { ok, isPro: nowPro } = await rc.restore();
      if (nowPro) {
        Alert.alert('Restored', 'Your BirdPulse Pro subscription is active.');
      } else if (ok) {
        Alert.alert(
          'Nothing to restore',
          'We couldn’t find an active BirdPulse Pro subscription on this store account.',
        );
      } else {
        Alert.alert('Unable to restore', 'Please try again later.');
      }
    } finally {
      setRestoring(false);
    }
  };

  return (
    <View style={styles.root} testID="settings-screen">
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="settings-back">
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 12, paddingBottom: 60 }}>
          <TouchableOpacity
            style={styles.premiumCard}
            onPress={() => router.push('/paywall')}
            testID="settings-premium"
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.premEyebrow}>BIRDPULSE</Text>
              <Text style={styles.premTitle}>{pro ? 'Pro Member' : 'Upgrade to Pro'}</Text>
              <Text style={styles.premSub}>
                {pro ? 'You have unlimited identifications.' : 'Unlimited IDs, deep insights, expert maps.'}
              </Text>
            </View>
            <Ionicons name={pro ? 'star' : 'arrow-forward'} size={22} color={colors.secondary} />
          </TouchableOpacity>

          <Section title="Subscription">
            <Row
              icon="refresh-outline"
              label={restoring ? 'Restoring…' : 'Restore Purchases'}
              onPress={onRestore}
              testID="settings-restore-purchases"
            />
          </Section>

          <Section title="Support">
            <Row
              icon="mail-outline"
              label="Contact us"
              onPress={() =>
                Linking.openURL(
                  'mailto:contact@bird-identifier.app' +
                    '?subject=' +
                    encodeURIComponent('BirdPulse — Support request') +
                    '&body=' +
                    encodeURIComponent('Hi BirdPulse team,\n\n'),
                ).catch(() => {})
              }
              testID="settings-contact-us"
            />
          </Section>

          <Section title="About">
            <Row icon="information-circle-outline" label="App Info" right="v1.0.0" onPress={() => {}} />
            <Row
              icon="document-text-outline"
              label="Privacy Policy"
              onPress={openPrivacyPolicy}
              testID="settings-privacy"
            />
            <Row
              icon="document-outline"
              label="Terms of Use"
              onPress={openTermsOfUse}
              testID="settings-terms"
            />
          </Section>

          {/* ====== DEVELOPER SECTION — delete this whole block + /src/lib/devmode.ts to ship ====== */}
          {IS_DEV_MODE && (
            <View style={{ gap: 6 }} testID="developer-section">
              <Text style={[styles.sectionLabel, { color: colors.secondary }]}>DEVELOPER · TESTING ONLY</Text>
              <View style={[styles.group, { borderColor: 'rgba(224,164,88,0.4)' }]}>
                <RowSwitch
                  icon="key-outline"
                  label="Unlock Pro (Testing)"
                  value={devPro}
                  onChange={toggleDevPro}
                  testID="dev-unlock-pro-toggle"
                />
                <TouchableOpacity style={styles.row} onPress={onResetLimits} testID="dev-reset-free-uses">
                  <View style={styles.rowIcon}>
                    <Ionicons name="refresh-outline" size={18} color={colors.secondary} />
                  </View>
                  <Text style={styles.rowLabel}>Reset Free Limits (Testing)</Text>
                  <View style={{ flex: 1 }} />
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.devNote}>
                Auto-hidden in production builds (gated by{' '}
                <Text style={{ color: colors.secondary, fontWeight: '700' }}>__DEV__</Text>).
                To strip entirely before ship, delete this block + {' '}
                <Text style={{ color: colors.secondary, fontWeight: '700' }}>src/lib/devmode.ts</Text>.
              </Text>
            </View>
          )}
          {/* ====== END DEVELOPER SECTION ====== */}

          {/* Version footer — tap 7× to open Diagnostics (debug screen). */}
          <VersionFooter onUnlock={() => router.push('/diagnostics' as any)} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** Hidden tap-target for the diagnostic / debug screen. Never gives Pro,
 *  never exposes secrets — just routes to /diagnostics so support can pull
 *  env / RC config info from a real device. */
function VersionFooter({ onUnlock }: { onUnlock: () => void }) {
  const tapsRef = useRef(0);
  const lastTapRef = useRef(0);
  const version = Constants.expoConfig?.version ?? '—';
  const onPress = () => {
    const now = Date.now();
    if (now - lastTapRef.current > 1200) tapsRef.current = 0;
    lastTapRef.current = now;
    tapsRef.current += 1;
    if (tapsRef.current >= 7) {
      tapsRef.current = 0;
      onUnlock();
    }
  };
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.versionWrap} testID="settings-version">
      <Text style={styles.versionText}>BirdPulse · v{version}</Text>
    </TouchableOpacity>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.group}>{children}</View>
    </View>
  );
}

function Row({
  icon, label, onPress, right, testID,
}: { icon: any; label: string; onPress: () => void; right?: string; testID?: string }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} testID={testID}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flex: 1 }} />
      {right && <Text style={styles.rowRight}>{right}</Text>}
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

function RowSwitch({
  icon, label, value, onChange, testID,
}: { icon: any; label: string; value: boolean; onChange: (v: boolean) => void; testID?: string }) {
  const Switch = require('react-native').Switch;
  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flex: 1 }} />
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.hairlineStrong }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.hairline,
  },
  headerTitle: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700' },
  premiumCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: spacing.lg, borderRadius: radii.card,
    backgroundColor: 'rgba(224,164,88,0.1)', borderWidth: 1, borderColor: 'rgba(224,164,88,0.4)',
  },
  premEyebrow: { ...type.caption, color: colors.secondary, marginBottom: 4 },
  premTitle: { ...type.h3, color: colors.textPrimary, fontSize: 22 },
  premSub: { ...type.bodySm, color: colors.textSecondary, marginTop: 4, maxWidth: '92%' },
  sectionLabel: { ...type.caption, color: colors.textTertiary, marginLeft: spacing.sm, marginTop: spacing.md },
  group: { backgroundColor: colors.card, borderRadius: radii.card, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: spacing.md, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: colors.hairline,
  },
  rowIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(123,160,91,0.14)', alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { ...type.body, color: colors.textPrimary },
  rowRight: { ...type.bodySm, color: colors.textTertiary, marginRight: 6 },
  devNote: { ...type.caption, color: colors.textTertiary, paddingHorizontal: spacing.sm, marginTop: 6, lineHeight: 16 },
  versionWrap: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  versionText: { ...type.caption, color: colors.textTertiary, opacity: 0.6 },
});
