import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { PAYWALL_BG } from '@/src/lib/birds';
import { storage } from '@/src/utils/storage';
import { KEYS, FREE_USES_INITIAL, setPro, getFreeUses, isProEffective } from '@/src/lib/state';
import { colors, type, spacing, radii, shadows } from '@/src/theme';

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
  const [plan, setPlan] = useState<'yearly' | 'weekly'>('yearly');
  const [freeUses, setFreeUses] = useState<number>(FREE_USES_INITIAL);

  useEffect(() => {
    // If user is already Pro (real subscription OR dev Unlock-Pro toggle), skip the paywall entirely.
    (async () => {
      if (await isProEffective()) {
        router.replace('/(tabs)');
        return;
      }
      setFreeUses(await getFreeUses());
      storage.setItem(KEYS.paywallSeen, true);
    })();
  }, [router]);

  const canSkip = freeUses > 0;

  const subscribe = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await setPro(true);
    router.replace('/(tabs)');
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
        {/* Top row */}
        <View style={styles.topRow}>
          {canSkip ? (
            <TouchableOpacity style={styles.closeBtn} onPress={skip} testID="paywall-close-button">
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          ) : (
            <View style={styles.closeBtn} />
          )}
          <Text style={styles.smallNote}>
            {canSkip ? `${freeUses} free uses left` : 'Upgrade to continue'}
          </Text>
          <View style={styles.closeBtn} />
        </View>

        {/* Flexible content area */}
        <View style={styles.content}>
          {/* Title block — pushed down to sit over hero fade */}
          <View style={[styles.titleBlock, COMPACT && { marginTop: spacing.sm }]}>
            <View style={styles.titleRow}>
              <Text style={styles.laurel}>❦</Text>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.eyebrow}>BIRDLENS PRO</Text>
                <Text style={styles.title}>#1 Bird Identifier</Text>
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

          {/* Plans — compact */}
          <View style={[styles.plans, COMPACT && { gap: 8, marginTop: spacing.md }]}>
            <PlanCard
              testID="paywall-plan-yearly"
              active={plan === 'yearly'}
              onPress={() => {
                Haptics.selectionAsync();
                setPlan('yearly');
              }}
              badge="SAVE 83%"
              title="Yearly"
              price="AED 149.99/yr"
              trial="7 days free, then auto-renews"
            />
            <PlanCard
              testID="paywall-plan-weekly"
              active={plan === 'weekly'}
              onPress={() => {
                Haptics.selectionAsync();
                setPlan('weekly');
              }}
              title="Weekly"
              price="AED 14.99/wk"
              trial="Auto-renews weekly"
            />
          </View>

          {/* CTA pinned to bottom of content */}
          <View style={styles.ctaWrap}>
            <TouchableOpacity
              style={styles.cta}
              activeOpacity={0.85}
              onPress={subscribe}
              testID="paywall-subscribe-button"
            >
              <Text style={styles.ctaText}>
                {plan === 'yearly' ? 'Start 7-Day Free Trial' : 'Continue'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.fineprint}>Auto-renewable. Cancel anytime  ·  Terms  ·  Privacy</Text>
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
    paddingTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallNote: { ...type.caption, color: 'rgba(255,255,255,0.85)' },
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
  fineprint: { ...type.bodySm, color: colors.textTertiary, textAlign: 'center', marginTop: 10, fontSize: 12 },
});
