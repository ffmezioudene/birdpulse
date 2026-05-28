import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { PAYWALL_BG } from '@/src/lib/birds';
import { storage } from '@/src/utils/storage';
import { KEYS, setPro, isProEffective } from '@/src/lib/state';
import { colors, type, spacing, radii, shadows } from '@/src/theme';
import { useRevenueCat } from '@/src/providers/RevenueCatProvider';
import {
  IS_RC_AVAILABLE,
  PaywallResult,
  getCurrentOffering,
  purchasePackage,
} from '@/src/lib/revenuecat';
import type { PurchasesPackage } from 'react-native-purchases';

const { height: SCREEN_H } = Dimensions.get('window');
const COMPACT = SCREEN_H < 720; // iPhone SE / 13 mini territory

const BENEFITS = [
  'Instant bird ID with high accuracy',
  'In-depth info for 10,000+ species',
  'Advanced bird-call recognition',
  'Expert insights & range maps',
];

export default function Paywall() {
  const router = useRouter();
  const rc = useRevenueCat();
  const [plan, setPlan] = useState<'yearly' | 'weekly'>('yearly');
  const [busy, setBusy] = useState(false);

  // Live offering packages from RevenueCat (or null on web / failure).
  const [weeklyPkg, setWeeklyPkg] = useState<PurchasesPackage | null>(null);
  const [annualPkg, setAnnualPkg] = useState<PurchasesPackage | null>(null);
  const triedHostedRef = useRef(false);

  // Load packages for the fallback UI so the displayed prices match the store.
  useEffect(() => {
    if (!IS_RC_AVAILABLE || !rc.initialized) return;
    (async () => {
      const off = await getCurrentOffering();
      if (!off) return;
      setWeeklyPkg(off.weekly ?? off.availablePackages.find((p) => /week/i.test(p.identifier)) ?? null);
      setAnnualPkg(off.annual ?? off.availablePackages.find((p) => /annual|year/i.test(p.identifier)) ?? null);
    })();
  }, [rc.initialized]);

  useEffect(() => {
    // If user is already Pro (real subscription OR dev Unlock-Pro toggle), skip the paywall entirely.
    (async () => {
      if (await isProEffective()) {
        router.replace('/(tabs)');
        return;
      }
      storage.setItem(KEYS.paywallSeen, true);

      // Try the RevenueCat-hosted paywall once per mount on native.
      // On web (or if presentation isn't available) we silently keep the
      // custom fallback UI visible.
      if (!IS_RC_AVAILABLE || triedHostedRef.current || !rc.initialized) return;
      triedHostedRef.current = true;
      try {
        const res = await rc.presentPaywallIfNeeded();
        if (res === PaywallResult.Purchased || res === PaywallResult.Restored) {
          router.replace('/(tabs)');
        }
        // CANCELLED / NOT_PRESENTED / ERROR → stay on the custom fallback UI.
      } catch {}
    })();
  }, [router, rc.initialized]); // eslint-disable-line react-hooks/exhaustive-deps

  const subscribe = async () => {
    if (busy) return;
    Haptics.selectionAsync().catch(() => {});

    const chosenPkg = plan === 'yearly' ? annualPkg : weeklyPkg;

    // Native + we have a live package → real RevenueCat purchase.
    if (IS_RC_AVAILABLE && chosenPkg) {
      setBusy(true);
      try {
        const outcome = await purchasePackage(chosenPkg);
        if (outcome.kind === 'purchased') {
          await rc.refresh();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          router.replace('/(tabs)');
        } else if (outcome.kind === 'error') {
          Alert.alert('Purchase failed', outcome.message);
        }
        // 'cancelled' — user backed out, do nothing.
      } finally {
        setBusy(false);
      }
      return;
    }

    // Web preview / no packages loaded → behave as before so the rest of the
    // app stays testable. (Real purchases require a native dev/prod build.)
    if (__DEV__) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await setPro(true);
      router.replace('/(tabs)');
      return;
    }

    Alert.alert(
      'Subscriptions unavailable',
      'In-app purchases require the BirdPulse mobile app. Please try again in the iOS or Android app.',
    );
  };

  const onRestore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { ok, isPro: nowPro } = await rc.restore();
      if (nowPro) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert('Restored', 'Your BirdPulse Pro subscription is active again.');
        router.replace('/(tabs)');
      } else if (ok) {
        Alert.alert(
          'Nothing to restore',
          'We couldn’t find an active BirdPulse Pro subscription on this account.',
        );
      } else {
        Alert.alert('Restore unavailable', 'Restore is only available in the mobile app.');
      }
    } finally {
      setBusy(false);
    }
  };

  const skip = () => {
    Haptics.selectionAsync();
    router.replace('/(tabs)');
  };

  // Hero ~40% of screen
  const heroHeight = Math.max(260, Math.round(SCREEN_H * 0.4));

  return (
    <View style={styles.root} testID="paywall-screen">
      <ImageBackground
        source={{ uri: PAYWALL_BG }}
        style={[styles.heroBg, { height: heroHeight + 80 }]}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(14,15,13,0.15)', 'rgba(14,15,13,0.6)', '#0E0F0D']}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFillObject}
        />
      </ImageBackground>

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Top row — single close (X) button, neatly anchored to the top-left.
            Matches the iconBtn pattern used on detail / settings screens. */}
        <View style={styles.topRow}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={skip}
            testID="paywall-close-button"
            hitSlop={10}
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Flexible content area */}
        <View style={styles.content}>
          {/* Title block — pushed down to sit over hero fade */}
          <View style={[styles.titleBlock, COMPACT && { marginTop: spacing.sm }]}>
            <View style={styles.titleRow}>
              <Text style={styles.laurel}>❦</Text>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.eyebrow}>BIRDPULSE PRO</Text>
                <Text style={styles.title}>Your birding companion</Text>
              </View>
              <Text style={styles.laurel}>❦</Text>
            </View>
          </View>

          {/* Benefits — compact rows */}
          <View style={[styles.benefits, COMPACT && { gap: 8, marginTop: spacing.md }]}>
            {BENEFITS.map((b) => (
              <View key={b} style={styles.benefitRow}>
                <View style={styles.checkPill}>
                  <Ionicons name="checkmark" size={12} color={colors.bg} />
                </View>
                <Text style={styles.benefitText} numberOfLines={1}>{b}</Text>
              </View>
            ))}
          </View>

          {/* Plans — compact. Prices come from the live RevenueCat packages
              when available; falls back to placeholder copy on web / before
              the offering finishes loading. */}
          <View style={[styles.plans, COMPACT && { gap: 8, marginTop: spacing.md }]}>
            <PlanCard
              testID="paywall-plan-yearly"
              active={plan === 'yearly'}
              onPress={() => {
                Haptics.selectionAsync();
                setPlan('yearly');
              }}
              badge="BEST VALUE"
              title="Yearly"
              price={annualPkg?.product?.priceString ?? 'Yearly'}
              trial={annualPkg ? 'Auto-renews yearly' : 'Subscription'}
            />
            <PlanCard
              testID="paywall-plan-weekly"
              active={plan === 'weekly'}
              onPress={() => {
                Haptics.selectionAsync();
                setPlan('weekly');
              }}
              title="Weekly"
              price={weeklyPkg?.product?.priceString ?? 'Weekly'}
              trial={weeklyPkg ? 'Auto-renews weekly' : 'Subscription'}
            />
          </View>

          {/* CTA pinned to bottom of content */}
          <View style={styles.ctaWrap}>
            <TouchableOpacity
              style={[styles.cta, busy && { opacity: 0.6 }]}
              activeOpacity={0.85}
              onPress={subscribe}
              disabled={busy}
              testID="paywall-subscribe-button"
            >
              {busy ? (
                <ActivityIndicator color={'#0E0F0D'} />
              ) : (
                <Text style={styles.ctaText}>Continue</Text>
              )}
            </TouchableOpacity>
            <View style={styles.footerLinks}>
              <TouchableOpacity onPress={onRestore} hitSlop={10} testID="paywall-restore">
                <Text style={styles.footerLink}>Restore Purchases</Text>
              </TouchableOpacity>
              <Text style={styles.footerSep}>·</Text>
              <Text style={styles.footerLinkMuted}>Terms</Text>
              <Text style={styles.footerSep}>·</Text>
              <Text style={styles.footerLinkMuted}>Privacy</Text>
            </View>
            <Text style={styles.fineprint}>Auto-renewable. Cancel anytime in the App Store / Play Store.</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function PlanCard({
  active,
  onPress,
  title,
  price,
  trial,
  badge,
  testID,
}: {
  active: boolean;
  onPress: () => void;
  title: string;
  price: string;
  trial: string;
  badge?: string;
  testID: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.plan, active && styles.planActive]}
      activeOpacity={0.85}
      onPress={onPress}
      testID={testID}
    >
      {badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      <View style={styles.planLeft}>
        <View style={[styles.radio, active && styles.radioActive]}>
          {active && <View style={styles.radioDot} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.planTitle}>{title}</Text>
          <Text style={styles.planTrial} numberOfLines={1}>{trial}</Text>
        </View>
      </View>
      <Text style={styles.planPrice}>{price}</Text>
    </TouchableOpacity>
  );
}

const H_PAD = 20;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  heroBg: { position: 'absolute', top: 0, left: 0, right: 0 },
  safe: { flex: 1 },
  topRow: {
    paddingHorizontal: H_PAD,
    paddingTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  content: {
    flex: 1,
    paddingHorizontal: H_PAD,
    paddingBottom: spacing.md,
    justifyContent: 'flex-end',
  },
  titleBlock: { marginBottom: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  laurel: { color: colors.secondary, fontSize: 22, opacity: 0.85 },
  eyebrow: { ...type.caption, color: colors.secondary, marginBottom: 4 },
  title: { ...type.h2, color: colors.textPrimary, textAlign: 'center', fontSize: 26 },
  benefits: { gap: 10 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkPill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: { ...type.body, color: colors.textPrimary, flex: 1 },
  plans: { gap: 10, marginTop: spacing.lg },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.button,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5,
    borderColor: colors.hairlineStrong,
  },
  planActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(123,160,91,0.12)',
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  planLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.primary },
  planTitle: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700', fontSize: 16 },
  planTrial: { ...type.bodySm, color: colors.textTertiary, fontSize: 12 },
  planPrice: { ...type.body, color: colors.textPrimary, fontWeight: '700' },
  badge: {
    position: 'absolute',
    top: -9,
    right: 14,
    backgroundColor: '#E25C5C',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: { ...type.caption, color: '#fff', fontWeight: '800', fontSize: 10 },
  ctaWrap: { marginTop: spacing.lg },
  cta: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radii.button,
    alignItems: 'center',
    ...shadows.glowPrimary,
  },
  ctaText: { ...type.bodyLg, color: '#0E0F0D', fontWeight: '800' },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  footerLink: { ...type.bodySm, color: colors.textPrimary, fontWeight: '700', fontSize: 12 },
  footerLinkMuted: { ...type.bodySm, color: colors.textTertiary, fontSize: 12 },
  footerSep: { ...type.bodySm, color: colors.textTertiary, fontSize: 12 },
  fineprint: { ...type.bodySm, color: colors.textTertiary, textAlign: 'center', marginTop: 8, fontSize: 11 },
});
