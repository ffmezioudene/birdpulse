// Bird detail — hybrid loader. Instant first paint from precache, then enriched
// progressively with Wikipedia + GPT-4o. Persisted to AsyncStorage on first load.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, Share, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';

import { colors, type, spacing, radii } from '@/src/theme';
import { fetchXenoCanto, XenoRecording } from '@/src/lib/api';
import { getFavorites, toggleFavorite } from '@/src/lib/state';
import { getInstantDetail, loadFullDetail, RichBirdDetail } from '@/src/lib/bird-detail';
import { PressableScale } from '@/src/components/PressableScale';
import { FeatherWave } from '@/src/components/FeatherWave';

type TabKey = 'photos' | 'description' | 'sounds' | 'range';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function BirdDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const birdId = String(id ?? '');

  // Hybrid load: synchronous instant snapshot from precache + index.
  const [detail, setDetail] = useState<RichBirdDetail | null>(() => getInstantDetail(birdId));
  const [enriching, setEnriching] = useState(false);

  const [tab, setTab] = useState<TabKey>('description');
  const [favs, setFavs] = useState<string[]>([]);
  const [recs, setRecs] = useState<XenoRecording[]>([]);
  const [loadingSound, setLoadingSound] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [activeMonth, setActiveMonth] = useState<number>(new Date().getMonth());
  const player = useAudioPlayer(null);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);
  useEffect(() => { getFavorites().then(setFavs); }, []);

  // Kick the hybrid enrichment on mount.
  useEffect(() => {
    if (!birdId) return;
    setEnriching(true);
    loadFullDetail(birdId, (d) => {
      if (mountedRef.current) setDetail({ ...d });
    }).finally(() => {
      if (mountedRef.current) setEnriching(false);
    });
  }, [birdId]);

  useEffect(() => {
    if (tab === 'sounds' && detail && recs.length === 0) {
      setLoadingSound(true);
      fetchXenoCanto(detail.commonName, 5)
        .then((r) => setRecs(r.recordings))
        .catch(() => setRecs([]))
        .finally(() => setLoadingSound(false));
    }
  }, [tab, detail, recs.length]);

  if (!detail) {
    return (
      <View style={styles.notFoundRoot}>
        <Text style={styles.notFoundText}>Bird not found</Text>
        <PressableScale onPress={() => router.back()} style={styles.notFoundBtn} testID="bird-back">
          <Text style={styles.notFoundBtnText}>Go back</Text>
        </PressableScale>
      </View>
    );
  }

  const isFav = favs.includes(detail.id);
  const heroImage = detail.image || detail.thumb || '';

  const onFav = async () => {
    Haptics.selectionAsync();
    const updated = await toggleFavorite(detail.id);
    setFavs(updated);
  };

  const onShare = () => {
    Share.share({
      title: detail.commonName,
      message: `Check out the ${detail.commonName} (${detail.scientificName}) on BirdLens`,
    });
  };

  return (
    <View style={styles.root} testID="bird-detail-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.heroWrap}>
          {heroImage ? (
            <Image source={{ uri: heroImage }} style={styles.heroImg} />
          ) : (
            <View style={[styles.heroImg, styles.heroPlaceholder]}>
              <FeatherWave size={64} mode="static" glow />
            </View>
          )}
          <LinearGradient
            colors={['rgba(10,11,10,0.3)', 'rgba(10,11,10,0.95)']}
            locations={[0.3, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <SafeAreaView edges={['top']} style={styles.heroBar}>
            <PressableScale onPress={() => router.back()} style={styles.iconBtn} pressedScale={0.9} testID="bird-detail-back">
              <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
            </PressableScale>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <PressableScale onPress={onShare} style={styles.iconBtn} pressedScale={0.9} testID="bird-detail-share">
                <Ionicons name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'} size={20} color={colors.textPrimary} />
              </PressableScale>
              <PressableScale onPress={onFav} style={styles.iconBtn} pressedScale={0.9} testID="bird-detail-fav">
                <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={20} color={isFav ? colors.secondary : colors.textPrimary} />
              </PressableScale>
            </View>
          </SafeAreaView>

          <View style={styles.heroTitleWrap}>
            {detail.source === 'precached' && (
              <View style={styles.instantBadge}>
                <Ionicons name="flash" size={10} color="#0A0B0A" />
                <Text style={styles.instantBadgeText}>Offline ready</Text>
              </View>
            )}
            <Text style={styles.heroName}>{detail.commonName}</Text>
            <Text style={styles.heroLatin}>{detail.scientificName}</Text>
            <Text style={styles.heroMeta}>
              {detail.familyEnglish || detail.family} · {detail.order}
            </Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['photos', 'description', 'sounds', 'range'] as TabKey[]).map((k) => (
            <PressableScale
              key={k}
              onPress={() => setTab(k)}
              style={[styles.tab, tab === k && styles.tabActive]}
              pressedScale={0.96}
              testID={`bird-tab-${k}`}
            >
              <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>
                {k[0].toUpperCase() + k.slice(1)}
              </Text>
            </PressableScale>
          ))}
        </View>

        <View style={styles.tabBody}>
          {tab === 'description' && (
            <DescriptionTab detail={detail} enriching={enriching} />
          )}
          {tab === 'photos' && (
            <View>
              {heroImage ? (
                <Image source={{ uri: heroImage }} style={styles.bigPhoto} />
              ) : (
                <SkeletonCard height={260} />
              )}
              {detail.wikiUrl ? (
                <Text style={styles.attribution}>Photo via Wikimedia Commons</Text>
              ) : null}
            </View>
          )}
          {tab === 'sounds' && (
            <View>
              {loadingSound ? (
                <View style={{ alignItems: 'center', padding: spacing.xl }}>
                  <FeatherWave size={56} mode="static" glow />
                  <Text style={styles.skeletonHint}>Loading recordings…</Text>
                </View>
              ) : recs.length === 0 ? (
                <Text style={styles.emptyText}>
                  No recordings yet — add a XENO_CANTO_KEY to backend/.env to enable Xeno-canto playback.
                </Text>
              ) : (
                recs.map((rec) => (
                  <View key={rec.id} style={styles.recRow}>
                    <PressableScale
                      onPress={() => {
                        if (playingId === rec.id) {
                          player.pause();
                          setPlayingId(null);
                        } else {
                          player.replace(rec.audio_url);
                          player.play();
                          setPlayingId(rec.id);
                        }
                      }}
                      style={styles.recPlayBtn}
                      pressedScale={0.88}
                      testID={`bird-sound-${rec.id}`}
                    >
                      <Ionicons name={playingId === rec.id ? 'pause' : 'play'} size={16} color="#0A0B0A" />
                    </PressableScale>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.recTitle} numberOfLines={1}>
                        {rec.location || 'Field recording'} · {rec.country}
                      </Text>
                      <Text style={styles.recMeta}>Quality {rec.quality || '—'} · {rec.length || '0:00'}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
          {tab === 'range' && (
            <View>
              <Text style={styles.sectionTitle}>Range</Text>
              <Text style={styles.body}>
                {detail.rangeSummary || detail.habitat || 'Distribution data loading…'}
              </Text>
              <Text style={styles.sectionTitle}>Active month</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: spacing.sm }}>
                {MONTHS.map((m, i) => (
                  <PressableScale
                    key={m}
                    onPress={() => setActiveMonth(i)}
                    style={[styles.monthPill, activeMonth === i && styles.monthPillActive]}
                    pressedScale={0.92}
                  >
                    <Text style={[styles.monthText, activeMonth === i && styles.monthTextActive]}>{m}</Text>
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

/* ----------------------------- Description Tab ---------------------------- */

function DescriptionTab({ detail, enriching }: { detail: RichBirdDetail; enriching: boolean }) {
  const sections: { title: string; body?: string; bullets?: string[] }[] = useMemo(() => {
    const out: { title: string; body?: string; bullets?: string[] }[] = [];
    if (detail.summary) out.push({ title: 'Overview', body: detail.summary });
    if (detail.howToIdentify) out.push({ title: 'How to identify', body: detail.howToIdentify });
    const keyFacts: string[] = [];
    if (detail.size) keyFacts.push(`Length: ${detail.size}`);
    if (detail.wingspan) keyFacts.push(`Wingspan: ${detail.wingspan}`);
    if (detail.wingShape) keyFacts.push(`Wing shape: ${detail.wingShape}`);
    if (detail.diet) keyFacts.push(`Diet: ${detail.diet}`);
    if (detail.habitat) keyFacts.push(`Habitat: ${detail.habitat}`);
    if (detail.migrationStatus) keyFacts.push(`Migration: ${detail.migrationStatus}`);
    if (detail.conservationStatus) keyFacts.push(`Conservation: ${detail.conservationStatus}`);
    if (keyFacts.length) out.push({ title: 'Key facts', bullets: keyFacts });
    if (detail.nestingBehavior) out.push({ title: 'Nesting & behavior', body: detail.nestingBehavior });
    if (detail.funFacts?.length) out.push({ title: 'Fun facts', bullets: detail.funFacts });
    return out;
  }, [detail]);

  if (sections.length === 0) {
    return (
      <View>
        <SkeletonCard height={120} />
        <View style={{ height: 12 }} />
        <SkeletonCard height={80} />
        <View style={{ height: 12 }} />
        <SkeletonCard height={140} />
        <View style={{ alignItems: 'center', marginTop: spacing.lg }}>
          <FeatherWave size={48} mode="static" glow />
          <Text style={styles.skeletonHint}>Loading rich detail…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      {sections.map((s, idx) => (
        <View key={`${s.title}-${idx}`} style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{s.title}</Text>
          {s.body && <Text style={styles.body}>{s.body}</Text>}
          {s.bullets && s.bullets.map((b, i) => (
            <View key={i} style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <Text style={[styles.body, { flex: 1 }]}>{b}</Text>
            </View>
          ))}
        </View>
      ))}
      {enriching && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 }}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.skeletonHint}>Enriching with AI…</Text>
        </View>
      )}
    </View>
  );
}

function SkeletonCard({ height = 100 }: { height?: number }) {
  return (
    <View
      style={{
        height,
        backgroundColor: colors.card,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.hairline,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <FeatherWave size={36} mode="static" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  notFoundRoot: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 20 },
  notFoundText: { ...type.heading, color: colors.textPrimary },
  notFoundBtn: { paddingHorizontal: 20, height: 44, justifyContent: 'center', backgroundColor: colors.primary, borderRadius: radii.pill },
  notFoundBtnText: { ...type.bodyStrong, color: '#0A0B0A' },

  heroWrap: { height: 360, position: 'relative' },
  heroImg: { width: '100%', height: '100%' },
  heroPlaceholder: { backgroundColor: colors.bgTertiary, alignItems: 'center', justifyContent: 'center' },
  heroBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: spacing.sm,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1, borderColor: colors.hairline,
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitleWrap: { position: 'absolute', bottom: 20, left: 20, right: 20, gap: 4 },
  instantBadge: {
    flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, height: 22, borderRadius: 11,
    backgroundColor: colors.primary, marginBottom: 6,
  },
  instantBadgeText: { ...type.micro, color: '#0A0B0A', fontWeight: '800' },
  heroName: { ...type.title, color: colors.textPrimary, fontSize: 28, lineHeight: 32 },
  heroLatin: { ...type.body, color: colors.textSecondary, fontStyle: 'italic' },
  heroMeta: { ...type.caption, color: colors.textTertiary, marginTop: 2 },

  tabs: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  tab: { flex: 1, height: 36, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.hairline, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { ...type.bodySm, color: colors.textPrimary, fontWeight: '600' },
  tabTextActive: { color: '#0A0B0A', fontWeight: '800' },
  tabBody: { paddingHorizontal: 20, paddingTop: spacing.sm },

  sectionCard: {
    backgroundColor: colors.card, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.hairline, padding: spacing.md, gap: 8,
  },
  sectionTitle: { ...type.heading, color: colors.textPrimary },
  body: { ...type.body, color: colors.textSecondary },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bulletDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary, marginTop: 9 },
  skeletonHint: { ...type.caption, color: colors.textTertiary, marginTop: 8 },

  bigPhoto: { width: '100%', height: 260, borderRadius: radii.card, marginBottom: 12 },
  attribution: { ...type.caption, color: colors.textTertiary, textAlign: 'center' },

  recRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.card, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.hairline,
    padding: 12, marginBottom: 8,
  },
  recPlayBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  recTitle: { ...type.bodyL, color: colors.textPrimary, fontWeight: '600' },
  recMeta: { ...type.caption, color: colors.textTertiary, marginTop: 2 },
  emptyText: { ...type.body, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.lg },

  monthPill: { paddingHorizontal: 12, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.hairline, alignItems: 'center', justifyContent: 'center' },
  monthPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  monthText: { ...type.caption, color: colors.textPrimary, fontWeight: '600' },
  monthTextActive: { color: '#0A0B0A', fontWeight: '800' },
});
