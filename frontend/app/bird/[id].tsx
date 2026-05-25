import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';

import { colors, type, spacing, radii, shadows } from '@/src/theme';
import { SEED_BIRDS } from '@/src/lib/birds';
import { fetchXenoCanto, XenoRecording } from '@/src/lib/api';
import { getFavorites, toggleFavorite } from '@/src/lib/state';

type TabKey = 'photos' | 'description' | 'sounds' | 'range';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function BirdDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bird = SEED_BIRDS.find((b) => b.id === id);
  const [tab, setTab] = useState<TabKey>('description');
  const [favs, setFavs] = useState<string[]>([]);
  const [recs, setRecs] = useState<XenoRecording[]>([]);
  const [loadingSound, setLoadingSound] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [activeMonth, setActiveMonth] = useState<number>(new Date().getMonth());
  const player = useAudioPlayer(null);

  useEffect(() => {
    getFavorites().then(setFavs);
  }, []);

  useEffect(() => {
    if (tab === 'sounds' && bird && recs.length === 0) {
      setLoadingSound(true);
      fetchXenoCanto(bird.commonName, 5)
        .then((r) => setRecs(r.recordings))
        .catch(() => {})
        .finally(() => setLoadingSound(false));
    }
  }, [tab, bird, recs.length]);

  if (!bird) {
    return (
      <View style={styles.root}>
        <Text style={{ color: '#fff', padding: 24 }}>Bird not found.</Text>
      </View>
    );
  }

  const isFav = favs.includes(bird.id);

  const toggleFav = async () => {
    Haptics.selectionAsync();
    const next = await toggleFavorite(bird.id);
    setFavs(next);
  };

  const onShare = async () => {
    Haptics.selectionAsync();
    try {
      await Share.share({
        message: `${bird.commonName} (${bird.scientificName}) — ${bird.shortDescription}`,
      });
    } catch {}
  };

  const playRec = async (rec: XenoRecording) => {
    Haptics.selectionAsync();
    try {
      if (playingId === rec.id) {
        player.pause();
        setPlayingId(null);
      } else {
        player.replace({ uri: rec.audio_url });
        player.play();
        setPlayingId(rec.id);
      }
    } catch {}
  };

  return (
    <View style={styles.root} testID="bird-detail-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          <Image source={{ uri: bird.image }} style={styles.heroImg} />
          <LinearGradient
            colors={['rgba(14,15,13,0.3)', 'transparent', 'rgba(14,15,13,0.92)', '#0E0F0D']}
            locations={[0, 0.3, 0.85, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <SafeAreaView edges={['top']} style={styles.heroHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="bird-back">
              <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={onShare} style={styles.iconBtn} testID="bird-share">
                <Ionicons name="share-outline" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleFav} style={styles.iconBtn} testID="bird-favorite">
                <Ionicons
                  name={isFav ? 'heart' : 'heart-outline'}
                  size={20}
                  color={isFav ? '#E25C5C' : colors.textPrimary}
                />
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>{bird.category.toUpperCase()}</Text>
            <Text style={styles.name}>{bird.commonName}</Text>
            <Text style={styles.latin}>{bird.scientificName}</Text>
          </View>
        </View>

        <View style={styles.tabs}>
          {(['photos', 'description', 'sounds', 'range'] as TabKey[]).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && styles.tabActive]}
              testID={`bird-tab-${t}`}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'description' && (
          <View style={styles.section}>
            {/* Headline + did-you-know highlight */}
            <Text style={styles.body}>{bird.shortDescription}</Text>

            {bird.funFacts?.[0] && (
              <View style={styles.didYouKnow}>
                <View style={styles.didYouKnowIcon}>
                  <Ionicons name="sparkles" size={14} color={colors.secondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.didYouKnowLabel}>DID YOU KNOW</Text>
                  <Text style={styles.didYouKnowText}>{bird.funFacts[0]}</Text>
                </View>
              </View>
            )}

            {/* Scientific Classification */}
            {(bird.genus || bird.family || bird.order) && (
              <View style={{ gap: 10 }}>
                <SectionHeading icon="school-outline" label="Scientific Classification" />
                <View style={styles.classRow}>
                  <ClassPill label="Genus" value={bird.genus || '—'} />
                  <ClassPill label="Family" value={bird.family || '—'} />
                  <ClassPill label="Order" value={bird.order || '—'} />
                </View>
              </View>
            )}

            {/* Key Facts grid */}
            <View style={{ gap: 10 }}>
              <SectionHeading icon="key-outline" label="Key Facts" />
              <View style={styles.factsGrid}>
                <FactCell icon="resize-outline" label="Size" value={bird.size || '—'} />
                <FactCell icon="swap-horizontal-outline" label="Wingspan" value={bird.wingspan || '—'} />
                <FactCell icon="airplane-outline" label="Wing Shape" value={bird.wingShape || '—'} />
                <FactCell icon="shield-checkmark-outline" label="Conservation" value={bird.conservationStatus || '—'} />
              </View>
            </View>

            {/* Collapsible content blocks */}
            <Collapsible icon="search-outline" title="How to Identify It" body={bird.howToIdentify || ''} defaultOpen />
            <Collapsible icon="restaurant-outline" title="Diet" body={bird.diet || ''} />
            <Collapsible icon="leaf-outline" title="Habitat" body={bird.habitat || ''} />
            <Collapsible icon="egg-outline" title="Nesting Behavior" body={bird.nestingBehavior || ''} />

            {/* Remaining fun facts */}
            {bird.funFacts && bird.funFacts.length > 1 && (
              <View style={{ gap: 8, marginTop: 4 }}>
                <SectionHeading icon="bulb-outline" label="More Fun Facts" />
                {bird.funFacts.slice(1).map((f, i) => (
                  <View key={i} style={styles.factPill}>
                    <View style={styles.factDot} />
                    <Text style={styles.factText}>{f}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {tab === 'photos' && (
          <View style={[styles.section, { gap: 12 }]}>
            <Image source={{ uri: bird.image }} style={styles.gallery} />
            <View style={styles.galleryRow}>
              <Image source={{ uri: bird.image }} style={[styles.galleryHalf, { marginRight: 6 }]} />
              <Image source={{ uri: bird.image }} style={[styles.galleryHalf, { marginLeft: 6 }]} />
            </View>
          </View>
        )}

        {tab === 'sounds' && (
          <View style={styles.section}>
            <Text style={styles.subHeader}>Recordings from xeno-canto</Text>
            {loadingSound && <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />}
            {!loadingSound && recs.length === 0 && (
              <Text style={styles.body}>No recordings available right now.</Text>
            )}
            {recs.map((rec) => (
              <View key={rec.id} style={styles.recRow} testID={`recording-${rec.id}`}>
                <TouchableOpacity style={styles.playBtn} onPress={() => playRec(rec)} testID={`play-${rec.id}`}>
                  <Ionicons
                    name={playingId === rec.id ? 'pause' : 'play'}
                    size={18}
                    color="#0E0F0D"
                  />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recName}>{rec.common_name || rec.species}</Text>
                  <Text style={styles.recMeta}>
                    {rec.location || 'Unknown'} · {rec.country} · {rec.length}
                  </Text>
                </View>
                <View style={styles.qBadge}><Text style={styles.qText}>{rec.quality || '–'}</Text></View>
              </View>
            ))}
          </View>
        )}

        {tab === 'range' && (
          <View style={styles.section}>
            {/* Migration status banner */}
            <View style={styles.migrationBanner}>
              <View style={styles.migrationDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.migrationLabel}>MIGRATION STATUS</Text>
                <Text style={styles.migrationText}>{bird.migrationStatus || 'Status unknown'}</Text>
              </View>
            </View>

            {/* Range visual */}
            <View style={styles.rangeCard}>
              <LinearGradient colors={['#1F2A1A', '#0E1410']} style={StyleSheet.absoluteFillObject} />
              <View style={styles.rangePin} />
              <View style={[styles.rangePin, { left: 80, top: 60 }]} />
              <View style={[styles.rangePin, { right: 60, bottom: 80 }]} />
              <Text style={styles.rangeText}>{bird.rangeSummary}</Text>
            </View>

            {/* Month slider */}
            <View style={{ gap: 10 }}>
              <SectionHeading icon="calendar-outline" label="Where they are by month" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.monthRow}
              >
                {MONTHS.map((m, i) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setActiveMonth(i)}
                    style={[styles.monthChip, activeMonth === i && styles.monthChipActive]}
                    testID={`month-${m.toLowerCase()}`}
                  >
                    <Text style={[styles.monthText, activeMonth === i && styles.monthTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.body}>
                {`Currently viewing ${MONTHS_FULL[activeMonth]} — ${bird.rangeSummary}`}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Row({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

function SectionHeading({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionHeadingIcon}>
        <Ionicons name={icon} size={14} color={colors.primary} />
      </View>
      <Text style={styles.sectionHeadingText}>{label}</Text>
    </View>
  );
}

function ClassPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.classPill}>
      <Text style={styles.classPillLabel}>{label}</Text>
      <Text style={styles.classPillValue}>{value}</Text>
    </View>
  );
}

function FactCell({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.factCell}>
      <View style={styles.factCellIcon}>
        <Ionicons name={icon} size={14} color={colors.primary} />
      </View>
      <Text style={styles.factCellLabel}>{label}</Text>
      <Text style={styles.factCellValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function Collapsible({
  icon, title, body, defaultOpen = false,
}: { icon: any; title: string; body: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!body) return null;
  return (
    <View style={styles.collapsible}>
      <TouchableOpacity
        style={styles.collapsibleHeader}
        activeOpacity={0.8}
        onPress={() => setOpen(!open)}
        testID={`collapsible-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <View style={styles.collapsibleHeaderLeft}>
          <View style={styles.collapsibleIcon}>
            <Ionicons name={icon} size={16} color={colors.primary} />
          </View>
          <Text style={styles.collapsibleTitle}>{title}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
      </TouchableOpacity>
      {open && <Text style={styles.collapsibleBody}>{body}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  heroWrap: { height: 440, position: 'relative' },
  heroImg: { width: '100%', height: '100%' },
  heroHeader: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  heroCopy: { position: 'absolute', bottom: spacing.lg, left: spacing.lg, right: spacing.lg },
  eyebrow: { ...type.caption, color: colors.primary, marginBottom: 6 },
  name: { ...type.h1, color: colors.textPrimary, fontSize: 34 },
  latin: { ...type.bodyLg, color: colors.textSecondary, fontStyle: 'italic', marginTop: 4 },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: -spacing.lg,
    padding: 4,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...shadows.glowPrimary,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  tabActive: { backgroundColor: 'rgba(123,160,91,0.18)' },
  tabText: { ...type.bodySm, color: colors.textTertiary, fontWeight: '600' },
  tabTextActive: { color: colors.primary },
  section: { padding: spacing.lg, gap: 14 },
  body: { ...type.body, color: colors.textSecondary, lineHeight: 24 },
  subHeader: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700', marginTop: spacing.md },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: spacing.md, backgroundColor: colors.card, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.hairline,
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(123,160,91,0.16)', alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { ...type.caption, color: colors.primary, marginBottom: 2 },
  rowValue: { ...type.bodySm, color: colors.textPrimary, lineHeight: 20 },
  factPill: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: spacing.md, backgroundColor: 'rgba(123,160,91,0.08)',
    borderRadius: radii.card, borderWidth: 1, borderColor: 'rgba(123,160,91,0.3)',
  },
  factDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 8 },
  factText: { ...type.bodySm, color: colors.textPrimary, flex: 1, lineHeight: 20 },
  gallery: { width: '100%', height: 240, borderRadius: radii.card },
  galleryRow: { flexDirection: 'row' },
  galleryHalf: { flex: 1, height: 160, borderRadius: radii.card },
  recRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: spacing.md, backgroundColor: colors.card, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.hairline,
  },
  playBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    ...shadows.glowPrimary,
  },
  recName: { ...type.bodySm, color: colors.textPrimary, fontWeight: '700' },
  recMeta: { ...type.caption, color: colors.textTertiary },
  qBadge: {
    paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: 'rgba(224,164,88,0.18)', borderRadius: 8,
  },
  qText: { ...type.caption, color: colors.secondary, fontWeight: '700' },
  rangeCard: {
    height: 220, borderRadius: radii.card, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.hairline,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  rangePin: {
    position: 'absolute', top: 80, left: 140, width: 14, height: 14,
    borderRadius: 7, backgroundColor: colors.primary,
    shadowColor: colors.primary, shadowOpacity: 0.8, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
  },
  rangeText: { ...type.body, color: colors.textPrimary, textAlign: 'center', paddingHorizontal: spacing.lg, zIndex: 2 },
  // --- Description tab additions ---
  didYouKnow: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    padding: spacing.md, borderRadius: radii.card,
    backgroundColor: 'rgba(224,164,88,0.10)',
    borderWidth: 1, borderColor: 'rgba(224,164,88,0.35)',
  },
  didYouKnowIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(224,164,88,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  didYouKnowLabel: { ...type.caption, color: colors.secondary, marginBottom: 4 },
  didYouKnowText: { ...type.body, color: colors.textPrimary, lineHeight: 22 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  sectionHeadingIcon: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(123,160,91,0.16)',
    alignItems: 'center', justifyContent: 'center',
  },
  sectionHeadingText: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700', letterSpacing: -0.2 },
  classRow: { flexDirection: 'row', gap: 8 },
  classPill: {
    flex: 1, padding: spacing.md,
    backgroundColor: colors.card, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.hairline,
    alignItems: 'flex-start', gap: 4,
  },
  classPillLabel: { ...type.caption, color: colors.primary },
  classPillValue: { ...type.bodySm, color: colors.textPrimary, fontWeight: '700' },
  factsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  factCell: {
    width: '47.5%',
    padding: spacing.md,
    backgroundColor: colors.card, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.hairline,
    gap: 6,
  },
  factCellIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(123,160,91,0.16)',
    alignItems: 'center', justifyContent: 'center',
  },
  factCellLabel: { ...type.caption, color: colors.primary },
  factCellValue: { ...type.bodySm, color: colors.textPrimary, fontWeight: '600', lineHeight: 18 },
  collapsible: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.hairline,
    overflow: 'hidden',
  },
  collapsibleHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md,
  },
  collapsibleHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  collapsibleIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(123,160,91,0.16)',
    alignItems: 'center', justifyContent: 'center',
  },
  collapsibleTitle: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700' },
  collapsibleBody: {
    ...type.body, color: colors.textSecondary, lineHeight: 22,
    paddingHorizontal: spacing.md, paddingBottom: spacing.md, paddingTop: 0,
  },
  // --- Range tab additions ---
  migrationBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: spacing.md, borderRadius: radii.card,
    backgroundColor: 'rgba(123,160,91,0.10)',
    borderWidth: 1, borderColor: 'rgba(123,160,91,0.35)',
  },
  migrationDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary,
    shadowColor: colors.primary, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  migrationLabel: { ...type.caption, color: colors.primary, marginBottom: 4 },
  migrationText: { ...type.bodySm, color: colors.textPrimary, fontWeight: '600' },
  monthRow: { gap: 8, paddingVertical: 4, paddingRight: spacing.lg },
  monthChip: {
    paddingHorizontal: 14, height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: colors.hairline,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 8,
  },
  monthChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  monthText: { ...type.bodySm, color: colors.textSecondary, fontWeight: '600' },
  monthTextActive: { color: '#0E0F0D', fontWeight: '800' },
});
