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
import * as Haptics from 'expo-haptics';

import {
  SEED_BIRDS,
  CATEGORIES,
  EXPLORE_TOPICS,
  EXPLORE_ARTICLES,
  OWL_AVATAR,
} from '@/src/lib/birds';
import { colors, type, spacing, radii, shadows } from '@/src/theme';
import { getFreeUses, isPro } from '@/src/lib/state';

export default function Home() {
  const router = useRouter();
  const [pro, setProState] = useState(false);
  const [freeUses, setFreeUses] = useState(2);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setProState(await isPro());
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

  return (
    <View style={styles.root} testID="home-screen">
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => router.push('/settings')}
              style={styles.iconBtn}
              testID="home-settings-button"
            >
              <Ionicons name="settings-outline" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.brand}>
              <View style={styles.brandDot} />
              <Text style={styles.brandText}>BirdLens</Text>
            </View>
            {pro ? (
              <View style={[styles.iconBtn, { backgroundColor: 'rgba(224,164,88,0.18)' }]}>
                <Ionicons name="star" size={16} color={colors.secondary} />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.proPill}
                onPress={() => router.push('/paywall')}
                testID="home-premium-button"
              >
                <Ionicons name="star" size={12} color="#0E0F0D" />
                <Text style={styles.proPillText}>Pro</Text>
              </TouchableOpacity>
            )}
          </View>

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
                    onPress={() => {
                      Haptics.selectionAsync();
                      router.push('/identify?mode=photo');
                    }}
                    testID="home-photo-id-button"
                  />
                  <ActionOrb
                    label="Sound ID"
                    icon="mic"
                    onPress={() => {
                      Haptics.selectionAsync();
                      router.push('/identify?mode=sound');
                    }}
                    testID="home-sound-id-button"
                    secondary
                  />
                </View>
              </View>
            </ImageBackground>
          </View>

          {/* Birds Near You */}
          <SectionHeader
            title="Birds Near You"
            actionLabel="All"
            onAction={() => router.push('/hotspots')}
            testID="section-birds-near-you"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.categoryCard}
                onPress={() => router.push('/(tabs)/collection')}
                testID={`category-${c.id.toLowerCase()}`}
              >
                <ImageBackground
                  source={{ uri: c.image }}
                  style={styles.categoryImg}
                  imageStyle={{ borderRadius: radii.card }}
                >
                  <LinearGradient
                    colors={['transparent', 'rgba(14,15,13,0.85)']}
                    locations={[0.45, 1]}
                    style={[StyleSheet.absoluteFillObject, { borderRadius: radii.card }]}
                  />
                  <Text style={styles.categoryLabel}>{c.title}</Text>
                </ImageBackground>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Popular Birds */}
          <SectionHeader title="Popular Birds" actionLabel="All" onAction={() => {}} testID="section-popular" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {SEED_BIRDS.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={styles.popCard}
                onPress={() => router.push(`/bird/${b.id}` as any)}
                testID={`popular-bird-${b.id}`}
              >
                <Image source={{ uri: b.image }} style={styles.popImage} />
                <View style={styles.popBody}>
                  <Text style={styles.popName} numberOfLines={1}>{b.commonName}</Text>
                  <Text style={styles.popLatin} numberOfLines={1}>{b.scientificName}</Text>
                  <View style={styles.audioRow}>
                    <View style={styles.playPill}>
                      <Ionicons name="play" size={11} color="#0E0F0D" />
                    </View>
                    <View style={styles.waveform}>
                      {[8, 14, 10, 18, 12, 20, 14, 9, 16, 11, 7, 14].map((h, i) => (
                        <View key={i} style={[styles.bar, { height: h }]} />
                      ))}
                    </View>
                    <Text style={styles.audioDur}>0:14</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Explore chips */}
          <SectionHeader title="Explore" actionLabel="" onAction={() => {}} testID="section-explore" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {EXPLORE_TOPICS.map((t) => (
              <View key={t.id} style={styles.chip}>
                <Ionicons name={t.icon as any} size={14} color={colors.primary} />
                <Text style={styles.chipText}>{t.title}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: spacing.md }}>
            {EXPLORE_ARTICLES.map((a) => (
              <TouchableOpacity key={a.id} style={styles.article} activeOpacity={0.85} testID={`article-${a.id}`}>
                <ImageBackground source={{ uri: a.image }} style={styles.articleImg} imageStyle={{ borderRadius: radii.card }}>
                  <LinearGradient
                    colors={['transparent', 'rgba(14,15,13,0.92)']}
                    locations={[0.35, 1]}
                    style={[StyleSheet.absoluteFillObject, { borderRadius: radii.card }]}
                  />
                  <View style={styles.articleCopy}>
                    <Text style={styles.articleSubtitle}>{a.subtitle}</Text>
                    <Text style={styles.articleTitle}>{a.title}</Text>
                  </View>
                </ImageBackground>
              </TouchableOpacity>
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
    <TouchableOpacity style={styles.orbCol} activeOpacity={0.85} onPress={onPress} testID={testID}>
      <View style={[styles.orb, secondary && styles.orbSecondary]}>
        <Ionicons name={icon} size={26} color={secondary ? colors.secondary : '#0E0F0D'} />
      </View>
      <Text style={styles.orbLabel}>{label}</Text>
    </TouchableOpacity>
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
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.sectionAction}>{actionLabel} ›</Text>
        </TouchableOpacity>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
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
  heroWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  hero: { borderRadius: radii.card, overflow: 'hidden', minHeight: 220 },
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
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionTitle: { ...type.h3, color: colors.textPrimary },
  sectionAction: { ...type.bodySm, color: colors.primary, fontWeight: '600' },
  hScroll: { paddingHorizontal: spacing.lg, gap: 12, paddingRight: spacing.xl },
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
  popBody: { padding: spacing.md, gap: 4 },
  popName: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700' },
  popLatin: { ...type.bodySm, color: colors.textTertiary, fontStyle: 'italic' },
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  playPill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveform: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  bar: { width: 2, backgroundColor: colors.primary, borderRadius: 1, opacity: 0.85 },
  audioDur: { ...type.bodySm, color: colors.textTertiary },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.hairline,
    marginRight: 8,
  },
  chipText: { ...type.bodySm, color: colors.textPrimary, fontWeight: '600' },
  article: { borderRadius: radii.card, overflow: 'hidden' },
  articleImg: { height: 180, justifyContent: 'flex-end' },
  articleCopy: { padding: spacing.lg },
  articleSubtitle: { ...type.caption, color: colors.primary, marginBottom: 4 },
  articleTitle: { ...type.h3, color: colors.textPrimary },
  owl: {
    position: 'absolute',
    bottom: 110,
    right: 18,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  owlGlow: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.secondary,
    opacity: 0.2,
  },
  owlImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.secondary,
  },
});
