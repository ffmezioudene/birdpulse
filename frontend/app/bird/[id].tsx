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

export default function BirdDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bird = SEED_BIRDS.find((b) => b.id === id);
  const [tab, setTab] = useState<TabKey>('description');
  const [favs, setFavs] = useState<string[]>([]);
  const [recs, setRecs] = useState<XenoRecording[]>([]);
  const [loadingSound, setLoadingSound] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
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
            <Text style={styles.body}>{bird.shortDescription}</Text>
            <Row icon="home-outline" label="Habitat" value={bird.habitat} />
            <Row icon="restaurant-outline" label="Diet" value={bird.diet} />
            <Row icon="resize-outline" label="Size" value={bird.size} />
            <Row icon="shield-checkmark-outline" label="Conservation" value={bird.conservationStatus} />
            <Text style={styles.subHeader}>Fun facts</Text>
            {bird.funFacts.map((f, i) => (
              <View key={i} style={styles.factPill}>
                <View style={styles.factDot} />
                <Text style={styles.factText}>{f}</Text>
              </View>
            ))}
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
            <View style={styles.rangeCard}>
              <LinearGradient colors={['#1F2A1A', '#0E1410']} style={StyleSheet.absoluteFillObject} />
              <View style={styles.rangePin} />
              <View style={[styles.rangePin, { left: 80, top: 60 }]} />
              <View style={[styles.rangePin, { right: 60, bottom: 80 }]} />
              <Text style={styles.rangeText}>{bird.rangeSummary}</Text>
            </View>
            <Text style={[styles.body, { marginTop: spacing.md }]}>
              {Platform.OS === 'web'
                ? 'Open on mobile for the interactive map.'
                : 'A detailed interactive range map is available on Pro.'}
            </Text>
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
});
