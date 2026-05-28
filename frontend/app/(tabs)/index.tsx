// Home — the BirdPulse cinematic landing.
//
// Order (the value, then the content):
//   1) Header (settings • wordmark • Pro)
//   2) Search bar (sticky-feel, no jargon)
//   3) Identify hero card
//   4) Bird of the Day (rotates by date)
//   5) Birds Near You (month-aware)
//   6) Popular Birds (horizontal)
//   7) Explore (topic chips + editorial cards)
//
// Every section fades up with a tasteful 50ms stagger on mount.
// Every card shares the same DNA: 20px corner radius, 20px screen padding,
// a strong dark scrim guaranteeing legible text on ANY photo.
import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ImageBackground,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

import { EXPLORE_TOPICS, EXPLORE_ARTICLES, OWL_AVATAR } from '@/src/lib/birds';
import {
  CATEGORIES as CATALOG_CATEGORIES,
  popularSpecies,
  indexSize,
  getPrecachedDetail,
  allSpecies,
} from '@/src/lib/catalog';
import { colors, type, spacing, radii, shadows } from '@/src/theme';
import { isProEffective } from '@/src/lib/state';
import { PressableScale } from '@/src/components/PressableScale';
import { BirdCallPlayer } from '@/src/components/BirdCallPlayer';
import { SpeciesThumb } from '@/src/components/SpeciesThumb';

const SCREEN_PADDING = 20;
const SECTION_GAP = 32;

const SCRIM_COLORS = ['transparent', 'rgba(10,11,10,0.55)', 'rgba(10,11,10,0.96)'] as const;
const SCRIM_LOCATIONS = [0, 0.45, 1] as const;

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pro, setPro] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTopic, setActiveTopic] = useState<string>('all');

  useEffect(() => {
    isProEffective().then(setPro);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    setPro(await isProEffective());
    setTimeout(() => setRefreshing(false), 500);
  };

  const monthName = new Date().toLocaleString('en-US', { month: 'long' });

  // Deterministic Bird of the Day — rotates by day-of-year over precached set.
  const birdOfTheDay = useMemo(() => {
    const pool = popularSpecies(48).filter((s) => !!getPrecachedDetail(s.id));
    const fallback = pool.length ? pool : allSpecies().slice(0, 1);
    if (fallback.length === 0) return null;
    const start = new Date(new Date().getFullYear(), 0, 0);
    const diff = Date.now() - start.getTime();
    const dayOfYear = Math.floor(diff / 86_400_000);
    return fallback[dayOfYear % fallback.length];
  }, []);

  const botd = birdOfTheDay ? getPrecachedDetail(birdOfTheDay.id) : undefined;
  const botdHook = useMemo(() => {
    if (!botd?.summary) return 'Tap to discover today’s featured bird.';
    // First sentence, capped.
    const sentence = botd.summary.split(/(?<=[.!?])\s/)[0] || botd.summary;
    return sentence.length > 140 ? sentence.slice(0, 137).trim() + '…' : sentence;
  }, [botd]);

  const filteredArticles = EXPLORE_ARTICLES.filter(
    (a) => activeTopic === 'all' || a.topic === activeTopic,
  );

  // Owl FAB sits ABOVE the tab bar. We pad ScrollView bottom by FAB height
  // + tab bar height so the last card never disappears behind the FAB.
  const TAB_BAR_HEIGHT = 84;
  const FAB_SIZE = 56;
  const FAB_BOTTOM_OFFSET = TAB_BAR_HEIGHT + 16; // 16 = breathing gap
  const SCROLL_BOTTOM_PAD = FAB_BOTTOM_OFFSET + FAB_SIZE + 24;

  return (
    <View style={styles.root} testID="home-screen">
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: SCROLL_BOTTOM_PAD }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* 1. Header */}
          <Animated.View entering={FadeIn.duration(420)} style={styles.topBar}>
            <PressableScale
              onPress={() => router.push('/settings')}
              style={styles.iconBtn}
              testID="home-settings-button"
              pressedScale={0.9}
              accessibilityLabel="Settings"
            >
              <Ionicons name="settings-outline" size={20} color={colors.textPrimary} />
            </PressableScale>
            <View style={styles.brand}>
              <View style={styles.brandDot} />
              <Text style={styles.brandText}>BirdPulse</Text>
            </View>
            {pro ? (
              <View style={[styles.iconBtn, { backgroundColor: 'rgba(224,164,88,0.18)' }]}>
                <Ionicons name="star" size={16} color={colors.secondary} />
              </View>
            ) : (
              <PressableScale
                style={styles.proPill}
                onPress={() => router.push('/paywall')}
                testID="home-premium-button"
                pressedScale={0.92}
              >
                <Ionicons name="star" size={12} color="#0E0F0D" />
                <Text style={styles.proPillText}>Pro</Text>
              </PressableScale>
            )}
          </Animated.View>

          {/* 2. Search bar (no jargon, no badge) */}
          <Animated.View entering={FadeInDown.delay(50).duration(420)}>
            <PressableScale
              onPress={() => router.push('/search' as any)}
              style={styles.searchBar}
              testID="home-search-bar"
              pressedScale={0.985}
              accessibilityLabel="Search birds"
            >
              <Ionicons name="search" size={16} color={colors.textTertiary} />
              <Text style={styles.searchPlaceholder} numberOfLines={1}>
                Search {indexSize().toLocaleString()} species…
              </Text>
              <Ionicons name="arrow-forward" size={14} color={colors.textTertiary} />
            </PressableScale>
          </Animated.View>

          {/* 3. Identify hero card */}
          <Animated.View entering={FadeInDown.delay(100).duration(450)} style={styles.heroWrap}>
            <ImageBackground
              source={require('../../assets/images/app-image.png')}
              style={styles.hero}
              imageStyle={{ borderRadius: radii.card, opacity: 0.18 }}
            >
              <LinearGradient
                colors={['#1F3A22', '#0F1F12']}
                style={[StyleSheet.absoluteFillObject, { borderRadius: radii.card }]}
              />
              <View style={styles.heroInner}>
                <Text style={styles.heroEyebrow}>WHO'S THAT BIRD?</Text>
                <Text style={styles.heroTitle}>Identify in seconds</Text>
                <Text style={styles.heroSubtitle}>Snap a photo or record a call</Text>

                <View style={styles.heroActions}>
                  <ActionOrb
                    label="Photo ID"
                    icon="camera"
                    onPress={() => router.push('/identify?mode=photo')}
                    testID="home-photo-id-button"
                  />
                  <ActionOrb
                    label="Sound ID"
                    icon="mic"
                    onPress={() => router.push('/identify?mode=sound')}
                    testID="home-sound-id-button"
                  />
                </View>
              </View>
            </ImageBackground>
          </Animated.View>

          {/* 4. Bird of the Day */}
          {birdOfTheDay && (
            <Animated.View entering={FadeInDown.delay(150).duration(450)}>
              <SectionHeader title="Bird of the Day" />
              <View style={{ paddingHorizontal: SCREEN_PADDING }}>
                <PressableScale
                  onPress={() => router.push(`/bird/${birdOfTheDay.id}` as any)}
                  style={styles.botdCard}
                  pressedScale={0.985}
                  testID="home-bird-of-day"
                >
                  <View style={styles.botdImageWrap}>
                    <SpeciesThumb species={birdOfTheDay} fullWidth height={260} radius={radii.card} />
                  </View>
                  <LinearGradient
                    colors={SCRIM_COLORS}
                    locations={SCRIM_LOCATIONS}
                    style={[StyleSheet.absoluteFillObject, { borderRadius: radii.card }]}
                    pointerEvents="none"
                  />
                  <View style={styles.botdCopy}>
                    <View style={styles.botdEyebrowRow}>
                      <Ionicons name="sunny-outline" size={12} color={colors.primary} />
                      <Text style={styles.cardEyebrow}>FEATURED TODAY</Text>
                    </View>
                    <Text style={styles.botdTitle}>{birdOfTheDay.c}</Text>
                    <Text style={styles.botdHook} numberOfLines={2}>{botdHook}</Text>
                    <View style={styles.cardCta}>
                      <Text style={styles.cardCtaText}>Read more</Text>
                      <Ionicons name="arrow-forward" size={13} color={colors.primary} />
                    </View>
                  </View>
                </PressableScale>
              </View>
            </Animated.View>
          )}

          {/* 5. Birds Near You — month aware */}
          <Animated.View entering={FadeInDown.delay(200).duration(450)}>
            <SectionHeader
              title="Birds Near You"
              subtitle={`Active in ${monthName}`}
              actionLabel="All"
              onAction={() => router.push('/birds-near-you')}
              testID="section-birds-near-you"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {CATALOG_CATEGORIES.map((c) => (
                <PressableScale
                  key={c.id}
                  style={styles.categoryCard}
                  onPress={() => router.push(`/category/${encodeURIComponent(c.id)}` as any)}
                  testID={`category-${c.id}`}
                >
                  <ImageBackground
                    source={{ uri: c.image }}
                    style={styles.categoryImg}
                    imageStyle={{ borderRadius: radii.card }}
                  >
                    <LinearGradient
                      colors={SCRIM_COLORS}
                      locations={SCRIM_LOCATIONS}
                      style={[StyleSheet.absoluteFillObject, { borderRadius: radii.card }]}
                      pointerEvents="none"
                    />
                    <Text style={styles.categoryLabel}>{c.title}</Text>
                    <View style={styles.cardCta}>
                      <Text style={styles.cardCtaText}>Browse</Text>
                      <Ionicons name="arrow-forward" size={12} color={colors.primary} />
                    </View>
                  </ImageBackground>
                </PressableScale>
              ))}
            </ScrollView>
          </Animated.View>

          {/* 6. Popular Birds */}
          <Animated.View entering={FadeInDown.delay(250).duration(450)}>
            <SectionHeader
              title="Popular Birds"
              actionLabel="All"
              onAction={() => router.push('/popular-birds')}
              testID="section-popular"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {popularSpecies(12).map((b) => (
                <View key={b.id} style={styles.popCard}>
                  <PressableScale
                    onPress={() => router.push(`/bird/${b.id}` as any)}
                    testID={`popular-bird-${b.id}`}
                  >
                    <SpeciesThumb species={b} fullWidth height={120} radius={0} />
                    <View style={styles.popBody}>
                      <Text style={styles.popName} numberOfLines={1}>{b.c}</Text>
                      <Text style={styles.popLatin} numberOfLines={1}>{b.s}</Text>
                    </View>
                  </PressableScale>
                  <View style={styles.popFooter}>
                    <BirdCallPlayer scientificName={b.s} testID={`popular-bird-play-${b.id}`} />
                  </View>
                </View>
              ))}
            </ScrollView>
          </Animated.View>

          {/* 7. Explore */}
          <Animated.View entering={FadeInDown.delay(300).duration(450)}>
            <SectionHeader title="Explore" testID="section-explore" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {EXPLORE_TOPICS.map((t) => {
                const active = activeTopic === t.id;
                return (
                  <PressableScale
                    key={t.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setActiveTopic(t.id)}
                    testID={`explore-chip-${t.id}`}
                    pressedScale={0.94}
                  >
                    <Ionicons name={t.icon as any} size={14} color={active ? '#0A0B0A' : colors.primary} />
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.title}</Text>
                  </PressableScale>
                );
              })}
            </ScrollView>

            <View style={styles.articlesWrap}>
              {filteredArticles.length === 0 ? (
                <View style={styles.emptyArticles}>
                  <Text style={styles.emptyArticlesText}>No articles for this topic yet — pick another.</Text>
                </View>
              ) : (
                filteredArticles.map((a, idx) => (
                  <Animated.View
                    key={a.id}
                    entering={FadeInDown.delay(340 + idx * 40).duration(420)}
                  >
                    <PressableScale
                      style={styles.article}
                      onPress={() => router.push(`/article/${a.id}` as any)}
                      testID={`article-${a.id}`}
                    >
                      <ImageBackground
                        source={{ uri: a.image }}
                        style={styles.articleImg}
                        imageStyle={{ borderRadius: radii.card }}
                      >
                        <LinearGradient
                          colors={SCRIM_COLORS}
                          locations={SCRIM_LOCATIONS}
                          style={[StyleSheet.absoluteFillObject, { borderRadius: radii.card }]}
                          pointerEvents="none"
                        />
                        <View style={styles.articleCopy}>
                          <Text style={styles.cardEyebrow}>{a.subtitle}</Text>
                          <Text style={styles.articleTitle} numberOfLines={2}>{a.title}</Text>
                          <View style={styles.cardCta}>
                            <Text style={styles.cardCtaText}>Read</Text>
                            <Ionicons name="arrow-forward" size={13} color={colors.primary} />
                          </View>
                        </View>
                      </ImageBackground>
                    </PressableScale>
                  </Animated.View>
                ))
              )}
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      {/* Floating Owl FAB — fixed above tab bar, never overlaps card content */}
      <Animated.View
        entering={FadeIn.delay(450).duration(380)}
        style={[styles.owlFab, { bottom: FAB_BOTTOM_OFFSET }]}
        pointerEvents="box-none"
      >
        <PressableScale
          onPress={() => router.push('/chat')}
          style={styles.owlPress}
          pressedScale={0.9}
          testID="home-owl-chat-button"
          accessibilityLabel="Open Owl assistant chat"
        >
          <View style={styles.owlGlow} pointerEvents="none" />
          <ImageBackground
            source={{ uri: OWL_AVATAR }}
            style={styles.owlImg}
            imageStyle={{ borderRadius: 28 }}
          />
          <View style={styles.owlBadge}>
            <Ionicons name="sparkles" size={9} color="#0A0B0A" />
          </View>
        </PressableScale>
      </Animated.View>
    </View>
  );
}

/* ----------------------------- Subcomponents ----------------------------- */

function ActionOrb({
  label,
  icon,
  onPress,
  testID,
  secondary,
}: {
  label: string;
  icon: any;
  onPress: () => void;
  testID: string;
  secondary?: boolean;
}) {
  return (
    <PressableScale style={styles.orbCol} onPress={onPress} testID={testID} pressedScale={0.9}>
      <View style={[styles.orb, secondary && styles.orbSecondary]}>
        <Ionicons name={icon} size={26} color={secondary ? colors.secondary : '#0E0F0D'} />
      </View>
      <Text style={styles.orbLabel}>{label}</Text>
    </PressableScale>
  );
}

function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  testID,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}) {
  return (
    <View style={styles.sectionHeader} testID={testID}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <PressableScale
          onPress={onAction}
          pressedScale={0.92}
          testID={testID ? `${testID}-all` : undefined}
          hitSlop={10}
        >
          <View style={styles.sectionActionWrap}>
            <Text style={styles.sectionAction}>{actionLabel}</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} style={{ marginTop: 1 }} />
          </View>
        </PressableScale>
      ) : null}
    </View>
  );
}

/* --------------------------------- Styles -------------------------------- */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  // Header
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
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
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  brandText: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700', letterSpacing: 0.3 },
  proPill: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.secondary,
  },
  proPillText: { ...type.bodySm, color: '#0E0F0D', fontWeight: '800' },

  // Search
  searchBar: {
    marginHorizontal: SCREEN_PADDING,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 50,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  searchPlaceholder: { ...type.body, color: colors.textTertiary, flex: 1 },

  // Identify hero
  heroWrap: { paddingHorizontal: SCREEN_PADDING, marginTop: spacing.xs },
  hero: { borderRadius: radii.card, overflow: 'hidden', minHeight: 230 },
  heroInner: { padding: spacing.lg, gap: 6 },
  heroEyebrow: { ...type.caption, color: colors.primary, letterSpacing: 1 },
  heroTitle: { ...type.h2, color: colors.textPrimary, marginTop: 4 },
  heroSubtitle: { ...type.body, color: colors.textSecondary, marginBottom: spacing.lg },
  heroActions: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm },
  orbCol: { alignItems: 'center', gap: 8 },
  orb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.glowPrimary,
  },
  orbSecondary: { backgroundColor: 'rgba(224,164,88,0.18)', borderWidth: 1, borderColor: colors.secondary },
  orbLabel: { ...type.bodySm, color: colors.textPrimary, fontWeight: '600' },

  // Section header (consistent)
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    marginTop: SECTION_GAP,
    marginBottom: spacing.md,
    gap: 8,
  },
  sectionTitle: { ...type.title, color: colors.textPrimary },
  sectionSubtitle: { ...type.caption, color: colors.primary, letterSpacing: 0.6, marginTop: 2 },
  sectionActionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  sectionAction: { ...type.bodySm, color: colors.primary, fontWeight: '700' },

  // Bird of the Day
  botdCard: {
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: colors.bgTertiary,
    minHeight: 260,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  botdImageWrap: { ...StyleSheet.absoluteFillObject, borderRadius: radii.card, overflow: 'hidden' },
  botdCopy: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg, gap: 6 },
  botdEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  botdTitle: { ...type.h2, color: colors.textPrimary, fontWeight: '800' },
  botdHook: { ...type.body, color: colors.textSecondary, marginBottom: 4 },

  // Horizontal scrollers
  hScroll: { paddingHorizontal: SCREEN_PADDING, gap: 12, paddingRight: 32 },

  // Category cards (in Birds Near You row)
  categoryCard: { marginRight: 12 },
  categoryImg: {
    width: 160,
    height: 200,
    borderRadius: radii.card,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  categoryLabel: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700' },

  // Popular cards
  popCard: {
    width: 220,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginRight: 12,
    overflow: 'hidden',
  },
  popBody: { padding: spacing.md, paddingBottom: spacing.sm, gap: 4 },
  popName: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700' },
  popLatin: { ...type.bodySm, color: colors.textTertiary, fontStyle: 'italic' },
  popFooter: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },

  // Explore chips + articles
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.hairline,
    marginRight: 8,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...type.bodySm, color: colors.textPrimary, fontWeight: '600' },
  chipTextActive: { color: '#0A0B0A', fontWeight: '800' },

  articlesWrap: {
    paddingHorizontal: SCREEN_PADDING,
    marginTop: spacing.md,
    gap: spacing.md,
  },
  emptyArticles: {
    padding: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  emptyArticlesText: { ...type.body, color: colors.textSecondary, textAlign: 'center' },

  // Article card — ONE consistent style
  article: {
    borderRadius: radii.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  articleImg: { height: 180, justifyContent: 'flex-end' },
  articleCopy: { padding: spacing.lg, gap: 4 },
  articleTitle: { ...type.h3, color: colors.textPrimary, fontWeight: '800', marginTop: 2 },

  // Shared card text helpers
  cardEyebrow: {
    ...type.caption,
    color: colors.primary,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cardCta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  cardCtaText: { ...type.bodySm, color: colors.primary, fontWeight: '700' },

  // Owl FAB — fixed, above tab bar, never overlaps card content
  owlFab: {
    position: 'absolute',
    right: 16,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  owlPress: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E0A458',
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  owlGlow: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.secondary,
    opacity: 0.18,
  },
  owlImg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.secondary,
    backgroundColor: colors.bgTertiary,
    overflow: 'hidden',
  },
  owlBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
});
