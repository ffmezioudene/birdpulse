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
  Animated,
  Easing,
  Modal,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { PAYWALL_BG } from '@/src/lib/birds';
import { storage } from '@/src/utils/storage';
import { KEYS, isProEffective } from '@/src/lib/state';
import { colors, type, spacing, radii, shadows } from '@/src/theme';
import { useRevenueCat } from '@/src/providers/RevenueCatProvider';
import {
  IS_RC_AVAILABLE,
  getCurrentOffering,
  purchasePackage,
} from '@/src/lib/revenuecat';
import { openPrivacyPolicy, openTermsOfUse } from '@/src/lib/links';
import type { PurchasesPackage } from 'react-native-purchases';

const { height: SCREEN_H } = Dimensions.get('window');
const COMPACT = SCREEN_H < 720; // iPhone SE / 13 mini territory

// How long (ms) the close [X] button stays hidden after the paywall mounts.
// Apple-compliant (still dismissable via gesture; the visible button just
// fades in to discourage reflex-tap dismissal of the conversion screen).
const CLOSE_REVEAL_DELAY_MS = 3000;

const BENEFITS = [
  'Instant bird ID with high accuracy',
  'In-depth info for 10,000+ species',
  'Advanced bird-call recognition',
  'Expert insights & species deep-dives',
];

export default function Paywall() {
  const router = useRouter();
  const rc = useRevenueCat();
  const [plan, setPlan] = useState<'yearly' | 'weekly'>('yearly');
  const [busy, setBusy] = useState(false);

  // Exit Reframe Drawer — shown when user taps the [X] button. Lets them
  // see a weekly-cost breakdown of the Yearly plan before fully dismissing.
  const [exitDrawerOpen, setExitDrawerOpen] = useState(false);

  // Live offering packages from RevenueCat (or null on web / failure).
  const [weeklyPkg, setWeeklyPkg] = useState<PurchasesPackage | null>(null);
  const [annualPkg, setAnnualPkg] = useState<PurchasesPackage | null>(null);
  // Lifecycle of the offerings fetch — controls loading / error states.
  const [offeringsState, setOfferingsState] =
    useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  // ---- Delayed close-button reveal ---------------------------------------
  // Per spec: the [X] should NOT be visible the moment the paywall mounts.
  // It fades in after CLOSE_REVEAL_DELAY_MS. This is purely visual — we
  // intentionally leave the underlying nav gesture unmodified for Apple
  // compliance (users can still swipe back if they want to).
  const closeOpacity = useRef(new Animated.Value(0)).current;
  const [closeRevealed, setCloseRevealed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setCloseRevealed(true);
      Animated.timing(closeOpacity, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }, CLOSE_REVEAL_DELAY_MS);
    return () => clearTimeout(t);
  }, [closeOpacity]);

  // Load the live offering. Prices, currency, trial, everything comes from
  // RevenueCat — we never hardcode a price in this UI.
  useEffect(() => {
    if (!IS_RC_AVAILABLE) {
      setOfferingsState('idle');
      return;
    }
    if (!rc.initialized) return;
    setOfferingsState('loading');
    (async () => {
      const off = await getCurrentOffering();
      if (!off) {
        setOfferingsState('error');
        return;
      }
      const w =
        off.weekly ??
        off.availablePackages.find((p) => /week/i.test(p.identifier)) ??
        null;
      const a =
        off.annual ??
        off.availablePackages.find((p) => /annual|year/i.test(p.identifier)) ??
        null;
      setWeeklyPkg(w);
      setAnnualPkg(a);
      setOfferingsState(w || a ? 'ready' : 'error');
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
    })();
  }, [router]);

  // ------------------------------------------------------------------------
  // Purchase action. Used by BOTH the main paywall CTA and the Exit Reframe
  // Drawer CTA. The drawer passes its own `whichPlan` override.
  // ------------------------------------------------------------------------
  const subscribe = async (overridePlan?: 'yearly' | 'weekly') => {
    if (busy) return;
    Haptics.selectionAsync().catch(() => {});

    const whichPlan = overridePlan ?? plan;
    const chosenPkg = whichPlan === 'yearly' ? annualPkg : weeklyPkg;
    if (!IS_RC_AVAILABLE || !chosenPkg) {
      Alert.alert(
        'Subscriptions unavailable',
        'In-app purchases require the BirdPulse mobile app. Please open the BirdPulse app on your phone to subscribe.',
      );
      return;
    }

    setBusy(true);
    try {
      const outcome = await purchasePackage(chosenPkg);
      if (outcome.kind === 'purchased') {
        await rc.refresh();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setExitDrawerOpen(false);
        router.replace('/(tabs)');
      } else if (outcome.kind === 'error') {
        Alert.alert('Purchase failed', outcome.message);
      }
      // 'cancelled' — user backed out, do nothing.
    } finally {
      setBusy(false);
    }
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

  /** Hard-dismiss the paywall and return to the app. Used by the drawer's
   *  "No thanks" button — NOT by the top [X] button (that opens the drawer
   *  first, see `onClosePress` below). */
  const dismissPaywall = () => {
    Haptics.selectionAsync().catch(() => {});
    setExitDrawerOpen(false);
    router.replace('/(tabs)');
  };

  /** [X] tap handler. Opens the Exit Reframe Drawer if we have enough info
   *  to show a meaningful weekly-cost reframe. Otherwise just dismisses. */
  const onClosePress = () => {
    Haptics.selectionAsync().catch(() => {});
    // Need an annual package to do the weekly-breakdown reframe. If we
    // don't have it (web preview, RC error, weekly-only offering) the
    // drawer would render with nothing useful → just dismiss directly.
    if (annualPkg && IS_RC_AVAILABLE) {
      setExitDrawerOpen(true);
    } else {
      dismissPaywall();
    }
  };

  // ---- Derived strings (NEVER hardcoded prices) --------------------------

  /** Format a numeric amount in the same currency as a RevenueCat product. */
  const formatPrice = (amount: number, currencyCode?: string | null): string => {
    const ccy = (currencyCode || 'USD').toUpperCase();
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: ccy,
        // Allow up to 2 fractional digits; if the input is integer-cents it
        // will collapse naturally to the locale's normal money format.
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${ccy} ${amount.toFixed(2)}`;
    }
  };

  /** Human-readable intro offer description for a single product. */
  const formatIntro = (pkg: PurchasesPackage | null): string | null => {
    const intro = pkg?.product?.introPrice;
    if (!intro) return null;
    const units = intro.periodNumberOfUnits;
    const unit = (intro.periodUnit || '').toUpperCase();
    if (!units || !unit) return null;
    const isFree = intro.price === 0;
    if (isFree) {
      const days =
        unit === 'DAY'
          ? units
          : unit === 'WEEK'
            ? units * 7
            : unit === 'MONTH'
              ? units * 30
              : unit === 'YEAR'
                ? units * 365
                : units;
      return `${days} ${days === 1 ? 'day' : 'days'} free`;
    }
    const label =
      unit === 'DAY'
        ? units === 1 ? 'day' : 'days'
        : unit === 'WEEK'
          ? units === 1 ? 'week' : 'weeks'
          : unit === 'MONTH'
            ? units === 1 ? 'month' : 'months'
            : unit === 'YEAR'
              ? units === 1 ? 'year' : 'years'
              : 'period';
    return `${units} ${label} at ${intro.priceString}`;
  };

  /** Per-period subtitle for each plan card. */
  const subtitleFor = (
    pkg: PurchasesPackage | null,
    period: 'year' | 'week',
  ): string => {
    if (!pkg) return '';
    const intro = formatIntro(pkg);
    if (intro) return `${intro}, then auto-renews ${period}ly`;
    return `Auto-renews ${period}ly`;
  };

  /** Free-trial day count for a given package, or 0 if none. */
  const freeTrialDays = (pkg: PurchasesPackage | null): number => {
    const intro = pkg?.product?.introPrice;
    if (!intro || intro.price !== 0) return 0;
    const units = intro.periodNumberOfUnits;
    const unit = (intro.periodUnit || '').toUpperCase();
    if (!units || !unit) return 0;
    return unit === 'DAY'
      ? units
      : unit === 'WEEK'
        ? units * 7
        : unit === 'MONTH'
          ? units * 30
          : unit === 'YEAR'
            ? units * 365
            : units;
  };

  /** Discount badge on the yearly plan vs the weekly plan. */
  const yearlyBadge = ((): string | null => {
    if (!annualPkg || !weeklyPkg) return null;
    const annualPerWeek =
      annualPkg.product.pricePerWeek ?? annualPkg.product.price / 52;
    const weeklyPrice = weeklyPkg.product.price;
    if (!annualPerWeek || !weeklyPrice || annualPerWeek >= weeklyPrice) {
      return null;
    }
    const savings = 1 - annualPerWeek / weeklyPrice;
    if (savings < 0.1) return null;
    const pct = Math.round(savings * 100);
    return `SAVE ${pct}%`;
  })();

  /** Main CTA label. Per spec: short and ownership-framed ("Start My Free
   *  Trial →"). Trial-day detail lives in the trust line below it. */
  const ctaLabel = ((): string => {
    const chosen = plan === 'yearly' ? annualPkg : weeklyPkg;
    if (!chosen) return 'Continue';
    const hasFreeTrial = freeTrialDays(chosen) > 0;
    if (hasFreeTrial) return 'Start My Free Trial';
    return `Continue with ${chosen.product.priceString}`;
  })();

  /** Trust line shown under the CTA. Carries the 7-day/price transparency. */
  const trustLine = ((): string => {
    const chosen = plan === 'yearly' ? annualPkg : weeklyPkg;
    if (!chosen) return 'Cancel anytime.';
    const days = freeTrialDays(chosen);
    const periodWord = plan === 'yearly' ? 'year' : 'week';
    if (days > 0) {
      return `${days}-day free trial, then ${chosen.product.priceString}/${periodWord} · Cancel anytime`;
    }
    return `${chosen.product.priceString}/${periodWord} · Cancel anytime`;
  })();

  /** Weekly-equivalent for the Yearly plan — used in the Exit Drawer copy. */
  const yearlyWeeklyEquivalentString = ((): string => {
    if (!annualPkg) return '';
    const perWeek =
      annualPkg.product.pricePerWeek ?? annualPkg.product.price / 52;
    return formatPrice(perWeek, annualPkg.product.currencyCode);
  })();

  // Render-state guards.
  const showLoading = IS_RC_AVAILABLE && offeringsState === 'loading' && !weeklyPkg && !annualPkg;
  const showError = IS_RC_AVAILABLE && offeringsState === 'error';
  const showMobileOnlyNotice = !IS_RC_AVAILABLE;

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
        {/* Top row — de-emphasized close [X], fades in after 3s. No solid
            pill / border; a soft translucent glyph so it doesn't compete
            with the CTA. The opacity ramp is purely cosmetic (Apple still
            lets users back-gesture at any time). */}
        <View style={styles.topRow}>
          <Animated.View
            style={{ opacity: closeOpacity, pointerEvents: closeRevealed ? 'auto' : 'none' }}
          >
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClosePress}
              testID="paywall-close-button"
              hitSlop={16}
              accessibilityLabel="Close"
              disabled={!closeRevealed}
            >
              <Ionicons name="close" size={18} color="rgba(244,246,242,0.55)" />
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Flexible content area */}
        <View style={styles.content}>
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

          {/* Plans + CTA — purchase UI ONLY rendered when we have real live
              prices from RevenueCat. */}
          {showLoading && (
            <View style={[styles.plans, COMPACT && { gap: 8, marginTop: spacing.md }]}>
              <View style={[styles.plan, styles.planSkeleton]}>
                <View style={[styles.skelLine, { width: '40%' }]} />
                <View style={[styles.skelLine, { width: '30%', marginTop: 8 }]} />
              </View>
              <View style={[styles.plan, styles.planSkeleton]}>
                <View style={[styles.skelLine, { width: '35%' }]} />
                <View style={[styles.skelLine, { width: '28%', marginTop: 8 }]} />
              </View>
              <View style={{ alignItems: 'center', marginTop: spacing.md }}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingNote}>Loading subscription options…</Text>
              </View>
            </View>
          )}

          {showError && (
            <View style={styles.unavailableBox}>
              <Ionicons name="cloud-offline-outline" size={32} color={colors.textTertiary} />
              <Text style={styles.unavailableTitle}>Subscriptions unavailable</Text>
              <Text style={styles.unavailableBody}>
                We couldn’t load your subscription options right now. Check your connection and try again.
              </Text>
              <TouchableOpacity
                style={styles.unavailableBtn}
                onPress={() => router.replace('/paywall')}
                testID="paywall-retry"
              >
                <Text style={styles.unavailableBtnText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {showMobileOnlyNotice && (
            <View style={styles.unavailableBox}>
              <Ionicons name="phone-portrait-outline" size={32} color={colors.textTertiary} />
              <Text style={styles.unavailableTitle}>Available in the mobile app</Text>
              <Text style={styles.unavailableBody}>
                BirdPulse subscriptions are purchased through the App Store. Open the BirdPulse app on your phone to subscribe.
              </Text>
            </View>
          )}

          {!showLoading && !showError && !showMobileOnlyNotice && (
            <>
              <View style={[styles.plans, COMPACT && { gap: 8, marginTop: spacing.md }]}>
                {annualPkg && (
                  <PlanCard
                    testID="paywall-plan-yearly"
                    active={plan === 'yearly'}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setPlan('yearly');
                    }}
                    badge={yearlyBadge ?? 'BEST VALUE'}
                    title="Yearly"
                    price={annualPkg.product.priceString}
                    trial={subtitleFor(annualPkg, 'year')}
                  />
                )}
                {weeklyPkg && (
                  <PlanCard
                    testID="paywall-plan-weekly"
                    active={plan === 'weekly'}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setPlan('weekly');
                    }}
                    title="Weekly"
                    price={weeklyPkg.product.priceString}
                    trial={subtitleFor(weeklyPkg, 'week')}
                  />
                )}
              </View>

              <View style={styles.ctaWrap}>
                <TouchableOpacity
                  style={[styles.cta, busy && { opacity: 0.6 }]}
                  activeOpacity={0.85}
                  onPress={() => subscribe()}
                  disabled={busy}
                  testID="paywall-subscribe-button"
                >
                  {busy ? (
                    <ActivityIndicator color={'#0E0F0D'} />
                  ) : (
                    <View style={styles.ctaInner}>
                      <Text style={styles.ctaText}>{ctaLabel}</Text>
                      <Ionicons
                        name="chevron-forward"
                        size={22}
                        color="#0E0F0D"
                        style={styles.ctaChevron}
                      />
                    </View>
                  )}
                </TouchableOpacity>

                {/* Single trust line — small, secondary. Carries the 7-day
                    free trial + transparent renewal price. */}
                <Text style={styles.trustLine} testID="paywall-trust-line">
                  {trustLine}
                </Text>

                <View style={styles.footerLinks}>
                  <TouchableOpacity onPress={onRestore} hitSlop={10} testID="paywall-restore">
                    <Text style={styles.footerLink}>Restore Purchases</Text>
                  </TouchableOpacity>
                  <Text style={styles.footerSep}>·</Text>
                  <TouchableOpacity onPress={openTermsOfUse} hitSlop={10} testID="paywall-terms">
                    <Text style={styles.footerLinkMuted}>Terms</Text>
                  </TouchableOpacity>
                  <Text style={styles.footerSep}>·</Text>
                  <TouchableOpacity onPress={openPrivacyPolicy} hitSlop={10} testID="paywall-privacy">
                    <Text style={styles.footerLinkMuted}>Privacy</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </View>
      </SafeAreaView>

      {/* ----------------------------------------------------------------
          EXIT REFRAME DRAWER — opened when the user taps the top [X].
          Reframes the Yearly cost as a per-week price, keeps Yearly
          pre-selected, surfaces Weekly as a secondary option, and offers
          a "No thanks" escape that ACTUALLY dismisses the paywall.
          ---------------------------------------------------------------- */}
      <ExitReframeDrawer
        visible={exitDrawerOpen}
        annualPkg={annualPkg}
        weeklyPkg={weeklyPkg}
        weeklyEquivalentString={yearlyWeeklyEquivalentString}
        freeTrialDays={freeTrialDays}
        subtitleFor={subtitleFor}
        yearlyBadge={yearlyBadge}
        busy={busy}
        onClose={() => setExitDrawerOpen(false)}
        onSubscribe={(p) => subscribe(p)}
        onNoThanks={dismissPaywall}
      />
    </View>
  );
}

// ----------------------------------------------------------------------------
// Exit Reframe Drawer
// ----------------------------------------------------------------------------

function ExitReframeDrawer({
  visible,
  annualPkg,
  weeklyPkg,
  weeklyEquivalentString,
  freeTrialDays,
  subtitleFor,
  yearlyBadge,
  busy,
  onClose,
  onSubscribe,
  onNoThanks,
}: {
  visible: boolean;
  annualPkg: PurchasesPackage | null;
  weeklyPkg: PurchasesPackage | null;
  weeklyEquivalentString: string;
  freeTrialDays: (pkg: PurchasesPackage | null) => number;
  subtitleFor: (pkg: PurchasesPackage | null, p: 'year' | 'week') => string;
  yearlyBadge: string | null;
  busy: boolean;
  onClose: () => void;
  onSubscribe: (plan: 'yearly' | 'weekly') => void;
  onNoThanks: () => void;
}) {
  // Local plan state — pre-selected to Yearly per spec.
  const [drawerPlan, setDrawerPlan] = useState<'yearly' | 'weekly'>('yearly');

  // Reset to Yearly every time the drawer is re-opened.
  useEffect(() => {
    if (visible) setDrawerPlan('yearly');
  }, [visible]);

  // Per-selection CTA + trust line, computed from the live package data.
  const chosenPkg = drawerPlan === 'yearly' ? annualPkg : weeklyPkg;
  const periodWord = drawerPlan === 'yearly' ? 'year' : 'week';
  const days = freeTrialDays(chosenPkg);

  const drawerCtaLabel = ((): string => {
    if (!chosenPkg) return 'Continue';
    if (days > 0) return 'Start My Free Trial';
    return `Continue with ${chosenPkg.product.priceString}`;
  })();

  const drawerTrustLine = ((): string => {
    if (!chosenPkg) return 'Cancel anytime.';
    if (days > 0) {
      return `${days}-day free trial, then ${chosenPkg.product.priceString}/${periodWord} · Cancel anytime`;
    }
    return `${chosenPkg.product.priceString}/${periodWord} · Cancel anytime`;
  })();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      testID="paywall-exit-drawer"
    >
      <Pressable style={drawerStyles.backdrop} onPress={onClose} />
      <SafeAreaView edges={['bottom']} style={drawerStyles.sheetWrap} pointerEvents="box-none">
        <View style={drawerStyles.sheet}>
          {/* Grab handle for visual affordance */}
          <View style={drawerStyles.grab} />

          <Text style={drawerStyles.headline}>Not ready for a full year?</Text>
          <Text style={drawerStyles.sub}>
            {weeklyEquivalentString
              ? `That's just ${weeklyEquivalentString}/week, billed yearly.`
              : 'Try a smaller plan instead.'}
          </Text>

          <View style={drawerStyles.plans}>
            {annualPkg && (
              <PlanCard
                testID="exit-drawer-plan-yearly"
                active={drawerPlan === 'yearly'}
                onPress={() => {
                  Haptics.selectionAsync();
                  setDrawerPlan('yearly');
                }}
                badge={yearlyBadge ?? 'BEST VALUE'}
                title="Yearly"
                price={annualPkg.product.priceString}
                trial={subtitleFor(annualPkg, 'year')}
              />
            )}
            {weeklyPkg && (
              <PlanCard
                testID="exit-drawer-plan-weekly"
                active={drawerPlan === 'weekly'}
                onPress={() => {
                  Haptics.selectionAsync();
                  setDrawerPlan('weekly');
                }}
                title="Weekly"
                price={weeklyPkg.product.priceString}
                trial={subtitleFor(weeklyPkg, 'week')}
              />
            )}
          </View>

          <TouchableOpacity
            style={[drawerStyles.cta, busy && { opacity: 0.6 }]}
            activeOpacity={0.85}
            onPress={() => onSubscribe(drawerPlan)}
            disabled={busy}
            testID="exit-drawer-subscribe"
          >
            {busy ? (
              <ActivityIndicator color={'#0E0F0D'} />
            ) : (
              <View style={drawerStyles.ctaInner}>
                <Text style={drawerStyles.ctaText}>{drawerCtaLabel}</Text>
                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color="#0E0F0D"
                  style={{ marginLeft: 6 }}
                />
              </View>
            )}
          </TouchableOpacity>
          <Text style={drawerStyles.trustLine}>{drawerTrustLine}</Text>

          <TouchableOpacity
            onPress={onNoThanks}
            hitSlop={12}
            style={drawerStyles.noThanksBtn}
            testID="exit-drawer-no-thanks"
          >
            <Text style={drawerStyles.noThanksText}>No thanks</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// Plan card (shared by main paywall + exit drawer)
// ----------------------------------------------------------------------------

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
    minHeight: 32,
  },
  // De-emphasized close: smaller, no pill background, no border.
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
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
  // Larger CTA + chevron — primary conversion action.
  cta: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.button,
    alignItems: 'center',
    ...shadows.glowPrimary,
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { ...type.bodyLg, color: '#0E0F0D', fontWeight: '800', fontSize: 17 },
  ctaChevron: { marginLeft: 6 },
  trustLine: {
    ...type.bodySm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    fontSize: 12,
  },
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
  // ---- Loading & error states ---------------------------------------------
  planSkeleton: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  skelLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  loadingNote: {
    ...type.bodySm,
    color: colors.textTertiary,
    marginTop: 8,
    fontSize: 12,
  },
  unavailableBox: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    gap: 8,
  },
  unavailableTitle: {
    ...type.bodyLg,
    color: colors.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  unavailableBody: {
    ...type.body,
    color: colors.textTertiary,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
  },
  unavailableBtn: {
    marginTop: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radii.button,
    backgroundColor: colors.primary,
  },
  unavailableBtnText: { ...type.body, color: '#0E0F0D', fontWeight: '800' },
});

const drawerStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface2,
    borderTopLeftRadius: radii.modal,
    borderTopRightRadius: radii.modal,
    paddingHorizontal: H_PAD,
    paddingTop: spacing.s12,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.hairline,
  },
  grab: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: spacing.md,
  },
  headline: {
    ...type.heading,
    color: colors.textPrimary,
    textAlign: 'center',
    fontSize: 20,
  },
  sub: {
    ...type.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    fontSize: 14,
  },
  plans: {
    gap: 10,
    marginTop: spacing.lg,
  },
  cta: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingVertical: 18,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.button,
    alignItems: 'center',
    ...shadows.glowPrimary,
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { ...type.bodyLg, color: '#0E0F0D', fontWeight: '800', fontSize: 17 },
  trustLine: {
    ...type.bodySm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    fontSize: 12,
  },
  noThanksBtn: {
    alignSelf: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  noThanksText: {
    ...type.bodySm,
    color: colors.textTertiary,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
