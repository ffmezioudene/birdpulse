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
import { getInstantDetail, loadFullDetail, RichBirdDetail, ConfusedWith } from '@/src/lib/bird-detail';
import { lookupByScientific, lookupByCommon, hasPrecachedDetail, type Species } from '@/src/lib/catalog';
import { PressableScale } from '@/src/components/PressableScale';
import { FeatherWave } from '@/src/components/FeatherWave';
import { SpeciesThumb } from '@/src/components/SpeciesThumb';

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
            {hasPrecachedDetail(detail.id) && (
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
            <DescriptionTab
              detail={detail}
              enriching={enriching}
              onAskOwl={() => {
                router.push({
                  pathname: '/chat',
                  params: {
                    birdId: detail.id,
                    birdName: detail.commonName,
                    birdSci: detail.scientificName,
                  },
                } as any);
              }}
              onTapConfused={(cw) => {
                const target = lookupByScientific(cw.scientificName) || lookupByCommon(cw.commonName);
                if (target) router.push(`/bird/${target.id}` as any);
              }}
            />
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
            <View style={{ gap: spacing.md }}>
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Where to find it</Text>
                <Text style={styles.body}>
                  {detail.rangeSummary || detail.habitat || 'Distribution data loading…'}
                </Text>
                {detail.seasonality ? (
                  <Text style={[styles.body, { marginTop: 8 }]}>
                    <Text style={styles.bodyStrong}>Seasonality: </Text>
                    {detail.seasonality}
                  </Text>
                ) : null}
              </View>

              <View style={styles.sectionCard}>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>Activity by month</Text>
                  <View style={styles.todayPill}>
                    <Text style={styles.todayPillText}>{MONTHS[new Date().getMonth()]} today</Text>
                  </View>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, marginTop: spacing.sm }}
                >
                  {MONTHS.map((m, i) => {
                    const isCurrent = i === new Date().getMonth();
                    const active = activeMonth === i;
                    return (
                      <PressableScale
                        key={m}
                        onPress={() => setActiveMonth(i)}
                        style={[
                          styles.monthPill,
                          active && styles.monthPillActive,
                          !active && isCurrent && styles.monthPillToday,
                        ]}
                        pressedScale={0.92}
                        testID={`bird-month-${m.toLowerCase()}`}
                      >
                        <Text style={[styles.monthText, active && styles.monthTextActive]}>{m}</Text>
                      </PressableScale>
                    );
                  })}
                </ScrollView>
                <Text style={styles.monthHint}>
                  {activeMonth === new Date().getMonth()
                    ? `Most likely seen this month.`
                    : `Switch months to see how the range shifts.`}
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/* ----------------------------- Description Tab ---------------------------- */

const IUCN_COLORS: Record<string, string> = {
  'least concern': '#7BA05B',
  'near threatened': '#C9A227',
  'vulnerable': '#E0A458',
  'endangered': '#D9774A',
  'critically endangered': '#D94A4A',
  'extinct in the wild': '#9A4AD9',
  'extinct': '#6B6B6B',
};

function iucnColor(status?: string): string {
  if (!status) return colors.textTertiary;
  return IUCN_COLORS[status.trim().toLowerCase()] || colors.primary;
}

function DescriptionTab({
  detail,
  enriching,
  onAskOwl,
  onTapConfused,
}: {
  detail: RichBirdDetail;
  enriching: boolean;
  onAskOwl: () => void;
  onTapConfused: (cw: ConfusedWith) => void;
}) {
  const keyFacts: string[] = useMemo(() => {
    const f: string[] = [];
    if (detail.size) f.push(`Length: ${detail.size}`);
    if (detail.wingspan) f.push(`Wingspan: ${detail.wingspan}`);
    if (detail.weight) f.push(`Weight: ${detail.weight}`);
    if (detail.lifespan) f.push(`Lifespan: ${detail.lifespan}`);
    if (detail.wingShape) f.push(`Wing shape: ${detail.wingShape}`);
    if (detail.migrationStatus) f.push(`Migration: ${detail.migrationStatus}`);
    return f;
  }, [detail]);

  const hasAny =
    detail.summary ||
    detail.howToIdentify ||
    detail.diet ||
    detail.habitat ||
    detail.nestingBehavior ||
    detail.behavior ||
    detail.sexDifferences ||
    detail.funFacts?.length ||
    detail.confusedWith?.length;

  if (!hasAny) {
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
      {detail.summary ? <ExpandableCard title="Overview" body={detail.summary} initiallyOpen /> : null}
      {detail.howToIdentify ? <ExpandableCard title="How to identify" body={detail.howToIdentify} initiallyOpen /> : null}
      {keyFacts.length ? <ExpandableCard title="Key facts" bullets={keyFacts} /> : null}
      {detail.diet ? <ExpandableCard title="Diet" body={detail.diet} /> : null}
      {detail.habitat ? <ExpandableCard title="Habitat" body={detail.habitat} /> : null}
      {detail.behavior ? <ExpandableCard title="Behavior & personality" body={detail.behavior} /> : null}
      {detail.sexDifferences ? <ExpandableCard title="Male vs female" body={detail.sexDifferences} /> : null}
      {detail.nestingBehavior ? <ExpandableCard title="Nesting" body={detail.nestingBehavior} /> : null}
      {detail.seasonality ? <ExpandableCard title="When to look" body={detail.seasonality} /> : null}

      {/* Conservation status with colored indicator */}
      {detail.conservationStatus ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Conservation</Text>
          <View style={styles.iucnRow}>
            <View style={[styles.iucnDot, { backgroundColor: iucnColor(detail.conservationStatus) }]} />
            <Text style={styles.iucnStatus}>{detail.conservationStatus}</Text>
            {detail.populationTrend ? (
              <View style={styles.trendChip}>
                <Ionicons
                  name={
                    /increas/i.test(detail.populationTrend) ? 'trending-up'
                    : /decreas/i.test(detail.populationTrend) ? 'trending-down'
                    : 'remove'
                  }
                  size={12}
                  color={colors.primary}
                />
                <Text style={styles.trendText}>{detail.populationTrend}</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Scientific classification */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Scientific classification</Text>
        <ClassificationRow label="Order" value={detail.order} />
        <ClassificationRow label="Family" value={detail.familyEnglish ? `${detail.family} (${detail.familyEnglish})` : detail.family} />
        <ClassificationRow label="Genus" value={detail.scientificName.split(' ')[0] || '—'} />
        <ClassificationRow label="Species" value={detail.scientificName} italic />
      </View>

      {/* Often Confused With */}
      {detail.confusedWith && detail.confusedWith.length > 0 ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Often confused with</Text>
          <Text style={[styles.body, { marginBottom: spacing.sm }]}>Tap a species to compare side-by-side.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 12 }}>
            {detail.confusedWith.map((cw, i) => (
              <ConfusedCard key={`${cw.scientificName}-${i}`} cw={cw} onPress={onTapConfused} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Fun fact / Did you know */}
      {detail.funFacts?.length ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Did you know?</Text>
          {detail.funFacts.map((f, i) => (
            <View key={i} style={styles.bulletRow}>
              <Ionicons name="sparkles" size={12} color={colors.secondary} style={{ marginTop: 5 }} />
              <Text style={[styles.body, { flex: 1 }]}>{f}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* "Ask about this bird" — the killer differentiator */}
      <AskOwlCard birdName={detail.commonName} onPress={onAskOwl} />

      {enriching && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 }}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.skeletonHint}>Enriching with AI…</Text>
        </View>
      )}
    </View>
  );
}

function ExpandableCard({
  title,
  body,
  bullets,
  initiallyOpen,
}: {
  title: string;
  body?: string;
  bullets?: string[];
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!initiallyOpen);
  return (
    <View style={styles.sectionCard}>
      <PressableScale onPress={() => setOpen((o) => !o)} pressedScale={0.99} style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textTertiary}
        />
      </PressableScale>
      {open ? (
        <View style={{ marginTop: 8, gap: 6 }}>
          {body && <Text style={styles.body}>{body}</Text>}
          {bullets &&
            bullets.map((b, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={[styles.body, { flex: 1 }]}>{b}</Text>
              </View>
            ))}
        </View>
      ) : null}
    </View>
  );
}

function ClassificationRow({ label, value, italic }: { label: string; value?: string; italic?: boolean }) {
  return (
    <View style={styles.classifyRow}>
      <Text style={styles.classifyLabel}>{label}</Text>
      <Text style={[styles.classifyValue, italic && { fontStyle: 'italic' }]} numberOfLines={1}>
        {value || '—'}
      </Text>
    </View>
  );
}

function ConfusedCard({ cw, onPress }: { cw: ConfusedWith; onPress: (cw: ConfusedWith) => void }) {
  const species: Species | undefined = useMemo(() => {
    return lookupByScientific(cw.scientificName) || lookupByCommon(cw.commonName);
  }, [cw.scientificName, cw.commonName]);
  return (
    <PressableScale
      style={styles.confusedCard}
      onPress={() => onPress(cw)}
      pressedScale={0.97}
      testID={`confused-${cw.scientificName.replace(/\s+/g, '-').toLowerCase()}`}
    >
      {species ? (
        <SpeciesThumb species={species} fullWidth height={90} radius={12} />
      ) : (
        <View style={styles.confusedThumbFallback}>
          <Ionicons name="leaf-outline" size={20} color={colors.primary} />
        </View>
      )}
      <View style={{ padding: 10, gap: 4 }}>
        <Text style={styles.confusedName} numberOfLines={1}>{cw.commonName}</Text>
        <Text style={styles.confusedTip} numberOfLines={3}>{cw.distinguishing}</Text>
      </View>
    </PressableScale>
  );
}

function AskOwlCard({ birdName, onPress }: { birdName: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={styles.askOwlCard} pressedScale={0.98} testID="bird-ask-owl">
      <View style={styles.askOwlIcon}>
        <Ionicons name="sparkles" size={18} color="#0A0B0A" />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.askOwlTitle}>Curious about this bird?</Text>
        <Text style={styles.askOwlSub}>Ask our expert anything about the {birdName}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.primary} />
    </PressableScale>
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
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  },
  sectionTitle: { ...type.heading, color: colors.textPrimary },
  body: { ...type.body, color: colors.textSecondary },
  bodyStrong: { ...type.body, color: colors.textPrimary, fontWeight: '700' },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bulletDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary, marginTop: 9 },
  skeletonHint: { ...type.caption, color: colors.textTertiary, marginTop: 8 },

  // IUCN conservation row
  iucnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  iucnDot: { width: 12, height: 12, borderRadius: 6 },
  iucnStatus: { ...type.bodyL, color: colors.textPrimary, fontWeight: '700' },
  trendChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(123,160,91,0.16)',
    borderWidth: 1, borderColor: 'rgba(123,160,91,0.36)',
  },
  trendText: { ...type.caption, color: colors.primary, fontWeight: '700' },

  // Scientific classification
  classifyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6,
  },
  classifyLabel: { ...type.caption, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8 },
  classifyValue: { ...type.body, color: colors.textPrimary, fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 12 },

  // Confused-with
  confusedCard: {
    width: 180,
    backgroundColor: colors.bgTertiary,
    borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.hairline,
    overflow: 'hidden',
  },
  confusedThumbFallback: {
    width: '100%', height: 90,
    backgroundColor: colors.bgTertiary,
    alignItems: 'center', justifyContent: 'center',
  },
  confusedName: { ...type.bodyL, color: colors.textPrimary, fontWeight: '700' },
  confusedTip: { ...type.caption, color: colors.textSecondary, lineHeight: 16 },

  // Ask Owl
  askOwlCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(123,160,91,0.12)',
    borderWidth: 1, borderColor: 'rgba(123,160,91,0.36)',
    borderRadius: radii.card, padding: spacing.md,
  },
  askOwlIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  askOwlTitle: { ...type.bodyL, color: colors.textPrimary, fontWeight: '700' },
  askOwlSub: { ...type.caption, color: colors.textSecondary },

  // Month scrubber
  todayPill: {
    paddingHorizontal: 10, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(123,160,91,0.16)',
    alignItems: 'center', justifyContent: 'center',
  },
  todayPillText: { ...type.caption, color: colors.primary, fontWeight: '700' },
  monthHint: { ...type.caption, color: colors.textTertiary, marginTop: spacing.sm },

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

  monthPill: { paddingHorizontal: 14, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.hairline, alignItems: 'center', justifyContent: 'center' },
  monthPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  monthPillToday: { borderColor: colors.primary, backgroundColor: 'rgba(123,160,91,0.12)' },
  monthText: { ...type.caption, color: colors.textPrimary, fontWeight: '700' },
  monthTextActive: { color: '#0A0B0A', fontWeight: '800' },
});
