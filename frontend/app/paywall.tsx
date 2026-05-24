import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { PAYWALL_BG } from '@/src/lib/birds';
import { storage } from '@/src/utils/storage';
import { KEYS, FREE_USES_INITIAL, setPro, getFreeUses } from '@/src/lib/state';
import { colors, type, spacing, radii, shadows } from '@/src/theme';

const BENEFITS = [
  'Instant bird ID with high accuracy',
  'In-depth info for 10,000+ species',
  'Advanced audio recognition for bird calls',
  'Expert birding insights & range maps',
];

export default function Paywall() {
  const router = useRouter();
  const [plan, setPlan] = useState<'yearly' | 'weekly'>('yearly');
  const [freeUses, setFreeUses] = useState<number>(FREE_USES_INITIAL);

  useEffect(() => {
    getFreeUses().then(setFreeUses);
    storage.setItem(KEYS.paywallSeen, true);
  }, []);

  const canSkip = freeUses > 0;

  const subscribe = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // RevenueCat stub — to be wired in production build
    await setPro(true);
    router.replace('/(tabs)');
  };

  const skip = () => {
    Haptics.selectionAsync();
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.root} testID="paywall-screen">
      <ImageBackground source={{ uri: PAYWALL_BG }} style={StyleSheet.absoluteFill} resizeMode="cover">
        <LinearGradient
          colors={['rgba(14,15,13,0.25)', 'rgba(14,15,13,0.7)', 'rgba(14,15,13,0.98)', '#0E0F0D']}
          locations={[0, 0.4, 0.78, 1]}
          style={StyleSheet.absoluteFillObject}
        />
      </ImageBackground>

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topRow}>
          {canSkip ? (
            <TouchableOpacity style={styles.closeBtn} onPress={skip} testID="paywall-close-button">
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.55)" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 32 }} />
          )}
          <Text style={styles.smallNote}>{canSkip ? `${freeUses} free uses left` : 'Upgrade to continue'}</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleRow}>
            <Text style={styles.laurel}>❦</Text>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.eyebrow}>BIRDLENS PRO</Text>
              <Text style={styles.title}>#1 Bird Identifier</Text>
            </View>
            <Text style={styles.laurel}>❦</Text>
          </View>
          <Text style={styles.subtitle}>
            Unlock the full premium experience{'\n'}loved by birders worldwide.
          </Text>

          <View style={styles.benefits}>
            {BENEFITS.map((b) => (
              <View key={b} style={styles.benefitRow}>
                <View style={styles.checkPill}>
                  <Ionicons name="checkmark" size={14} color={colors.bg} />
                </View>
                <Text style={styles.benefitText}>{b}</Text>
              </View>
            ))}
          </View>

          <View style={styles.plans}>
            <PlanCard
              testID="paywall-plan-yearly"
              active={plan === 'yearly'}
              onPress={() => {
                Haptics.selectionAsync();
                setPlan('yearly');
              }}
              badge="SAVE 83%"
              title="Yearly"
              price="AED 149.99 /yr"
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
              price="AED 14.99 /wk"
              trial="Auto-renews weekly"
            />
          </View>

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
          <Text style={styles.fineprint}>
            Auto-renewable. Cancel anytime.  ·  Terms  ·  Privacy
          </Text>
        </ScrollView>
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
        <View>
          <Text style={styles.planTitle}>{title}</Text>
          <Text style={styles.planTrial}>{trial}</Text>
        </View>
      </View>
      <Text style={styles.planPrice}>{price}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  topRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallNote: { ...type.caption, color: colors.textTertiary },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, flexGrow: 1, justifyContent: 'flex-end' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 320 },
  laurel: { color: colors.secondary, fontSize: 22, opacity: 0.85 },
  eyebrow: { ...type.caption, color: colors.secondary, marginBottom: 6 },
  title: { ...type.h2, color: colors.textPrimary, textAlign: 'center' },
  subtitle: { ...type.bodyLg, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md, marginBottom: spacing.lg },
  benefits: { gap: 12, marginVertical: spacing.md },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: { ...type.bodyLg, color: colors.textPrimary, flex: 1 },
  plans: { gap: 10, marginTop: spacing.lg },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
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
  planLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  planTitle: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700' },
  planTrial: { ...type.bodySm, color: colors.textTertiary },
  planPrice: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700' },
  badge: {
    position: 'absolute',
    top: -10,
    right: 14,
    backgroundColor: '#E25C5C',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { ...type.caption, color: '#fff', fontWeight: '800' },
  cta: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: radii.button,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...shadows.glowPrimary,
  },
  ctaText: { ...type.bodyLg, color: '#0E0F0D', fontWeight: '800' },
  fineprint: { ...type.bodySm, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.md },
});
