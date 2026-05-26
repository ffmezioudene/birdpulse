import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Image,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  EXPLORE_TOPICS,
  EXPLORE_ARTICLES,
  OWL_AVATAR,
} from '@/src/lib/birds';
import {
  CATEGORIES as CATALOG_CATEGORIES,
  popularSpecies,
  indexSize,
  precacheSize,
  getPrecachedDetail,
} from '@/src/lib/catalog';
import { colors, type, spacing, radii, shadows } from '@/src/theme';
import { getFreeUses, isProEffective } from '@/src/lib/state';
import { PressableScale } from '@/src/components/PressableScale';
import { BirdCallPlayer } from '@/src/components/BirdCallPlayer';

export default function Home() {
  const router = useRouter();
  const [pro, setProState] = useState(false);
  const [freeUses, setFreeUses] = useState(2);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTopic, setActiveTopic] = useState<string>('all');

  const refresh = async () => {
    setProState(await isProEffective());
    setFreeUses(await getFreeUses());
  };

  useEffect(() => {
    refresh();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setTimeout(() => setRefreshing(false), 600);
  };

  const filteredArticles = EXPLORE_ARTICLES.filter(
    (a) => activeTopic === 'all' || a.topic === activeTopic
  );

  return (
    <View style={styles.root} testID="home-screen">
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 180 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* Top bar */}
          <View style={styles.topBar}>
            <PressableScale
              onPress={() => router.push('/settings')}
              style={styles.iconBtn}
              testID="home-settings-button"
              pressedScale={0.9}
            >
              <Ionicons name="settings-outline" size={20} color={colors.textPrimary} />
            </PressableScale>
            <View style={styles.brand}>
              <View style={styles.brandDot} />
              <Text style={styles.brandText}>BirdLens</Text>
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
          </View>

          {/* Sticky search bar */}
          <PressableScale
            onPress={() => router.push('/search' as any)}
            style={styles.searchBar}
            testID="home-search-bar"
            pressedScale={0.985}
            accessibilityLabel="Search birds"
          >
            <Ionicons name="search" size={16} color={colors.textTertiary} />
            <Text style={styles.searchPlaceholder}>
              Search {indexSize().toLocaleString()} species…
            </Text>
            <View style={styles.searchHint}>
              <Ionicons name="flash" size={10} color={colors.primary} />
              <Text style={styles.searchHintText}>{precacheSize()} instant</Text>
            </View>
          </PressableScale>

          {/* Hero ID card */}
          <View style={styles.heroWrap}>
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
          </View>

          {/* Birds Near You */}
          <SectionHeader
            title="Birds Near You"
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
                    colors={['transparent', 'rgba(10,11,10,0.92)']}
                    locations={[0.45, 1]}
                    style={[StyleSheet.absoluteFillObject, { borderRadius: radii.card }]}
                  />
                  <Text style={styles.categoryLabel}>{c.title}</Text>
                  <View style={styles.categoryCta}>
                    <Text style={styles.categoryCtaText}>Browse</Text>
                    <Ionicons name="arrow-forward" size={12} color={colors.primary} />
                  </View>
                </ImageBackground>
              </PressableScale>
            ))}
          </ScrollView>

          {/* Popular Birds */}
          <SectionHeader
            title="Popular Birds"
            actionLabel="All"
            onAction={() => router.push('/popular-birds')}
            testID="section-popular"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {popularSpecies(12).map((b) => {
              const pre = getPrecachedDetail(b.id);
              return (
                <View key={b.id} style={styles.popCard}>
                  <PressableScale
                    onPress={() => router.push(`/bird/${b.id}` as any)}
                    testID={`popular-bird-${b.id}`}
                  >
                    {pre?.thumb ? (
                      <Image source={{ uri: pre.thumb }} style={styles.popImage} />
                    ) : (
                      <View style={[styles.popImage, styles.popImagePlaceholder]}>
                        <Ionicons name="leaf-outline" size={26} color={colors.primary} />
                      </View>
                    )}
                    <View style={styles.popBody}>
                      <Text style={styles.popName} numberOfLines={1}>{b.c}</Text>
                      <Text style={styles.popLatin} numberOfLines={1}>{b.s}</Text>
                    </View>
                  </PressableScale>
                  <View style={styles.popFooter}>
                    <BirdCallPlayer
                      scientificName={b.s}
                      testID={`popular-bird-play-${b.id}`}
                    />
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Explore chips with filter state */}
          <SectionHeader title="Explore" actionLabel="" onAction={() => {}} testID="section-explore" />
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

          <View style={{ paddingHorizontal: 20, gap: spacing.md, marginTop: spacing.md }}>
            {filteredArticles.length === 0 ? (
              <View style={styles.emptyArticles}>
                <Text style={styles.emptyArticlesText}>No articles for this topic yet — pick another.</Text>
              </View>
            ) : filteredArticles.map((a) => (
              <PressableScale
                key={a.id}
                style={styles.article}
                onPress={() => router.push(`/article/${a.id}` as any)}
                testID={`article-${a.id}`}
              >
                <ImageBackground source={{ uri: a.image }} style={styles.articleImg} imageStyle={{ borderRadius: radii.card }}>
                  <LinearGradient
                    colors={['transparent', 'rgba(10,11,10,0.94)']}
                    locations={[0.35, 1]}
                    style={[StyleSheet.absoluteFillObject, { borderRadius: radii.card }]}
                  />
                  <View style={styles.articleCopy}>
                    <Text style={styles.articleSubtitle}>{a.subtitle}</Text>
                    <Text style={styles.articleTitle}>{a.title}</Text>
                    <View style={styles.articleCta}>
                      <Text style={styles.articleCtaText}>Read</Text>
                      <Ionicons name="arrow-forward" size={13} color={colors.primary} />
                    </View>
                  </View>
                </ImageBackground>
              </PressableScale>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Floating owl */}
      <TouchableOpacity
        style={styles.owl}
        onPress={() => router.push('/chat')}
        activeOpacity={0.85}
        testID="home-owl-chat-button"
      >
        <View style={styles.owlGlow} />
        <Image source={{ uri: OWL_AVATAR }} style={styles.owlImg} />
      </TouchableOpacity>
    </View>
  );
}

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
  actionLabel,
  onAction,
  testID,
}: {
  title: string;
  actionLabel: string;
  onAction: () => void;
  testID: string;
}) {
  return (
    <View style={styles.sectionHeader} testID={testID}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel ? (
        <PressableScale onPress={onAction} pressedScale={0.92} testID={`${testID}-all`} hitSlop={10}>
          <View style={styles.sectionActionWrap}>
            <Text style={styles.sectionAction}>{actionLabel}</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} style={{ marginTop: 1 }} />
          </View>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
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
  heroWrap: { paddingHorizontal: 20, marginTop: spacing.xs },
  hero: { borderRadius: radii.card, overflow: 'hidden', minHeight: 230 },
  heroInner: { padding: spacing.lg, gap: 6 },
  heroEyebrow: { ...type.caption, color: colors.primary },
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 32,
    marginBottom: spacing.md,
  },
  sectionTitle: { ...type.title, color: colors.textPrimary },
  sectionActionWrap: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4, paddingHorizontal: 4 },
  sectionAction: { ...type.bodySm, color: colors.primary, fontWeight: '700' },
  hScroll: { paddingHorizontal: 20, gap: 12, paddingRight: 32 },
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
  categoryCta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  categoryCtaText: { ...type.caption, color: colors.primary, fontWeight: '700' },
  popCard: {
    width: 220,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginRight: 12,
    overflow: 'hidden',
  },
  popImage: { width: '100%', height: 120 },
  popImagePlaceholder: {
    backgroundColor: colors.bgTertiary, alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 1, borderBottomColor: colors.hairline,
  },
  popBody: { padding: spacing.md, paddingBottom: spacing.sm, gap: 4 },
  popName: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700' },
  popLatin: { ...type.bodySm, color: colors.textTertiary, fontStyle: 'italic' },
  popFooter: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  searchBar: {
    marginHorizontal: 20, marginBottom: spacing.lg,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    height: 48, paddingHorizontal: 16,
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    borderWidth: 1, borderColor: colors.hairline,
  },
  searchPlaceholder: { ...type.body, color: colors.textTertiary, flex: 1 },
  searchHint: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(123,160,91,0.14)',
    borderWidth: 1, borderColor: 'rgba(123,160,91,0.3)',
  },
  searchHintText: { ...type.micro, color: colors.primary },
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
  emptyArticles: {
    padding: spacing.lg, alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.hairline,
  },
  emptyArticlesText: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
  article: { borderRadius: radii.card, overflow: 'hidden' },
  articleImg: { height: 180, justifyContent: 'flex-end' },
  articleCopy: { padding: spacing.lg },
  articleSubtitle: { ...type.caption, color: colors.primary, marginBottom: 4 },
  articleTitle: { ...type.h3, color: colors.textPrimary },
  articleCta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  articleCtaText: { ...type.bodySm, color: colors.primary, fontWeight: '700' },
  owl: {
    position: 'absolute',
    bottom: 108,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E0A458',
    shadowOpacity: 0.5,
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
  },
});
