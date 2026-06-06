import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Share, TouchableOpacity, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { colors, spacing, type, radii } from '@/src/theme';
import { EXPLORE_ARTICLES } from '@/src/lib/birds';
import { FeatherWave } from '@/src/components/FeatherWave';
import { PressableScale } from '@/src/components/PressableScale';

export default function ArticleReader() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const article = useMemo(() => EXPLORE_ARTICLES.find((a) => a.id === id), [id]);
  const related = useMemo(
    () => EXPLORE_ARTICLES.filter((a) => a.id !== id).slice(0, 4),
    [id]
  );

  const onShare = async () => {
    if (!article) return;
    Haptics.selectionAsync();
    try {
      await Share.share({ message: `${article.title} — ${article.subtitle} · via BirdPulse` });
    } catch {}
  };

  if (!article) {
    return (
      <View style={styles.root}>
        <SafeAreaView edges={['top']}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="article-back">
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </SafeAreaView>
        <View style={styles.empty}>
          <FeatherWave size={60} mode="static" glow />
          <Text style={styles.emptyTitle}>Article not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="article-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          <Image source={{ uri: article.image }} style={styles.heroImg} />
          <LinearGradient
            colors={['rgba(10,11,10,0.25)', 'transparent', 'rgba(10,11,10,0.96)', colors.bg]}
            locations={[0, 0.3, 0.85, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <SafeAreaView edges={['top']} style={styles.heroHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="article-back">
              <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onShare} style={styles.iconBtn} testID="article-share">
              <Ionicons name="share-outline" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </SafeAreaView>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>
              FIELD NOTES{(article as any).readingMinutes ? `  ·  ${(article as any).readingMinutes} MIN READ` : ''}
            </Text>
            <Text style={styles.title}>{article.title}</Text>
            <Text style={styles.subtitle}>{article.subtitle}</Text>
          </View>
        </View>

        <View style={styles.bodyWrap}>
          {/* Lede paragraph — pulled from the article's `body` field. Renders
              first in both legacy (body-only) and new (body + sections) articles. */}
          {article.body ? <Text style={styles.lede}>{article.body}</Text> : null}

          {/* Long-form sections. When present, they replace the rest of the
              article. Each section gets a heading + paragraph for scannability. */}
          {(article as any).sections && Array.isArray((article as any).sections)
            ? (article as any).sections.map((s: { heading: string; body: string }, i: number) => (
                <View key={`sec-${i}`} style={styles.section}>
                  <Text style={styles.sectionHeading}>{s.heading}</Text>
                  <Text style={styles.body}>{s.body}</Text>
                </View>
              ))
            : null}

          <View style={styles.signature}>
            <FeatherWave size={28} mode="static" />
            <Text style={styles.signatureText}>BirdPulse · Field Guide</Text>
          </View>

          {related.length > 0 && (
            <View style={{ gap: spacing.s12 }}>
              <Text style={styles.relatedEyebrow}>KEEP READING</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 12 }}>
                {related.map((r) => (
                  <PressableScale
                    key={r.id}
                    style={styles.relCard}
                    onPress={() => router.replace(`/article/${r.id}` as any)}
                    testID={`article-related-${r.id}`}
                  >
                    <ImageBackground source={{ uri: r.image }} style={styles.relImg} imageStyle={{ borderRadius: radii.card }}>
                      <LinearGradient
                        colors={['transparent', 'rgba(10,11,10,0.94)']}
                        locations={[0.35, 1]}
                        style={[StyleSheet.absoluteFillObject, { borderRadius: radii.card }]}
                      />
                      <View style={styles.relCopy}>
                        <Text style={styles.relSub} numberOfLines={1}>{r.subtitle}</Text>
                        <Text style={styles.relTitle} numberOfLines={2}>{r.title}</Text>
                      </View>
                    </ImageBackground>
                  </PressableScale>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  heroWrap: { height: 420, position: 'relative' },
  heroImg: { width: '100%', height: '100%' },
  heroHeader: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: spacing.sm,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  heroCopy: { position: 'absolute', bottom: spacing.lg, left: 20, right: 20, gap: 8 },
  eyebrow: { ...type.micro, color: colors.primary, textTransform: 'uppercase' },
  title: { ...type.displayL, color: colors.textPrimary, fontSize: 30 },
  subtitle: { ...type.bodyL, color: colors.textSecondary },
  bodyWrap: { padding: 20, gap: spacing.xl },
  lede: {
    ...type.bodyL,
    color: colors.textPrimary,
    lineHeight: 28,
    fontWeight: '500',
    // Subtle visual separation from the section body that follows.
    marginBottom: 4,
  },
  section: { gap: 10 },
  sectionHeading: {
    ...type.bodyL,
    color: colors.primary,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  body: { ...type.bodyL, color: colors.textSecondary, lineHeight: 28 },
  signature: { flexDirection: 'row', alignItems: 'center', gap: 12, opacity: 0.6 },
  signatureText: { ...type.caption, color: colors.textTertiary },
  empty: { alignItems: 'center', gap: 12, padding: spacing.xl },
  emptyTitle: { ...type.bodyL, color: colors.textPrimary, fontWeight: '700' },
  relatedEyebrow: { ...type.micro, color: colors.primary, textTransform: 'uppercase' },
  relCard: { width: 220, borderRadius: radii.card, overflow: 'hidden' },
  relImg: { height: 140, justifyContent: 'flex-end' },
  relCopy: { padding: spacing.s12, gap: 2 },
  relSub: { ...type.caption, color: colors.primary, fontWeight: '700' },
  relTitle: { ...type.bodyL, color: colors.textPrimary, fontWeight: '700' },
});
