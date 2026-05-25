import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  Share,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';

import { colors, type, spacing, radii, shadows } from '@/src/theme';
import { IdentifyResult, fetchXenoCanto } from '@/src/lib/api';
import { addHistory, addSighting, toggleFavorite } from '@/src/lib/state';
import { SEED_BIRDS } from '@/src/lib/birds';
import { FeatherWave } from '@/src/components/FeatherWave';
import { PolaroidCard } from '@/src/components/PolaroidCard';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function Result() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string; imageBase64?: string; payload?: string }>();
  const [data, setData] = useState<IdentifyResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [logged, setLogged] = useState(false);
  const [displayedConf, setDisplayedConf] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [dropped, setDropped] = useState(false);
  const player = useAudioPlayer(null);

  // Animations
  const polaroidScale = useRef(new Animated.Value(1)).current;
  const polaroidTranslateX = useRef(new Animated.Value(0)).current;
  const polaroidTranslateY = useRef(new Animated.Value(0)).current;
  const polaroidOpacity = useRef(new Animated.Value(1)).current;
  const detailOpacity = useRef(new Animated.Value(0)).current;
  const detailTranslateY = useRef(new Animated.Value(20)).current;

  // Parse payload + log history once on mount
  useEffect(() => {
    try {
      if (params.payload) {
        const parsed = JSON.parse(params.payload as string);
        setData(parsed);
        const imageUri = params.imageBase64 ? `data:image/jpeg;base64,${params.imageBase64}` : undefined;
        addHistory({
          id: `h-${Date.now()}`,
          type: (params.type as any) || 'photo',
          commonName: parsed.commonName,
          scientificName: parsed.scientificName,
          confidence: parsed.confidence,
          image: imageUri,
          createdAt: new Date().toISOString(),
          result: parsed,
        });
      }
    } catch {}
  }, [params.payload, params.imageBase64, params.type]);

  // Confidence count-up + reveal sequence
  useEffect(() => {
    if (!data) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Count-up animation
    const target = data.confidence || 0;
    const steps = 24;
    let step = 0;
    const t = setInterval(() => {
      step += 1;
      const next = Math.round((step / steps) * target);
      setDisplayedConf(next);
      if (step % 4 === 0) Haptics.selectionAsync();
      if (step >= steps) {
        setDisplayedConf(target);
        clearInterval(t);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, 35);

    // Slide-in details
    Animated.parallel([
      Animated.timing(detailOpacity, { toValue: 1, duration: 600, delay: 600, useNativeDriver: true }),
      Animated.timing(detailTranslateY, { toValue: 0, duration: 600, delay: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    return () => clearInterval(t);
  }, [data, detailOpacity, detailTranslateY]);

  // Fetch bird call from xeno-canto and auto-play softly
  useEffect(() => {
    if (!data) return;
    (async () => {
      try {
        const res = await fetchXenoCanto(data.commonName, 1);
        const url = res.recordings?.[0]?.audio_url;
        if (url) {
          setAudioUrl(url);
          // Auto-play softly after the develop lands
          setTimeout(() => {
            try {
              player.replace({ uri: url });
              player.volume = 0.6;
              player.play();
              setPlaying(true);
            } catch {}
          }, 1400);
        }
      } catch {}
    })();
    return () => {
      try { player.pause(); } catch {}
    };
  }, [data, player]);

  if (!data) {
    return (
      <View style={styles.root} testID="result-loading">
        <FeatherWave size={80} mode="loading" glow />
      </View>
    );
  }

  const heroImage = params.imageBase64
    ? `data:image/jpeg;base64,${params.imageBase64}`
    : SEED_BIRDS.find((b) => b.commonName.toLowerCase() === data.commonName.toLowerCase())?.image
      || SEED_BIRDS[0].image;

  const match = SEED_BIRDS.find(
    (b) => b.commonName.toLowerCase() === data.commonName.toLowerCase()
  );

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const onSave = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (match) await toggleFavorite(match.id);
    setSaved(true);
  };

  const onLogSighting = async () => {
    Haptics.selectionAsync();
    await addSighting({
      id: `s-${Date.now()}`,
      birdId: match?.id,
      commonName: data.commonName,
      image: heroImage,
      latitude: 40.7128 + (Math.random() - 0.5) * 0.05,
      longitude: -74.006 + (Math.random() - 0.5) * 0.05,
      createdAt: new Date().toISOString(),
    });
    setLogged(true);
  };

  const togglePlay = () => {
    Haptics.selectionAsync();
    try {
      if (playing) { player.pause(); setPlaying(false); }
      else { if (audioUrl) { player.replace({ uri: audioUrl }); } player.play(); setPlaying(true); }
    } catch {}
  };

  const onShare = async () => {
    Haptics.selectionAsync();
    try {
      await Share.share({ message: `I just spotted a ${data.commonName} (${data.scientificName}) on BirdLens.` });
    } catch {}
  };

  // The DROP — Polaroid shrinks and tucks toward the Collection tab (bottom-right of screen)
  const dropToJournal = () => {
    if (dropped) return;
    setDropped(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.timing(polaroidScale, { toValue: 0.18, duration: 600, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(polaroidTranslateX, { toValue: SCREEN_W * 0.32, duration: 600, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(polaroidTranslateY, { toValue: SCREEN_H * 0.42, duration: 600, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(polaroidOpacity, { toValue: 0, duration: 600, delay: 200, useNativeDriver: true }),
    ]).start(() => {
      router.replace('/(tabs)/collection');
    });
  };

  return (
    <View style={styles.root} testID="result-screen">
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.iconBtn} testID="result-close">
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.identifiedBadge}>
            <FeatherWave size={14} mode="static" />
            <Text style={styles.identifiedText}>Identified</Text>
          </View>
          <TouchableOpacity onPress={onShare} style={styles.iconBtn} testID="result-share">
            <Ionicons name="share-outline" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
          {/* THE DEVELOP — Polaroid */}
          <Animated.View
            style={{
              alignItems: 'center',
              marginTop: spacing.lg,
              opacity: polaroidOpacity,
              transform: [
                { translateX: polaroidTranslateX },
                { translateY: polaroidTranslateY },
                { scale: polaroidScale },
              ],
            }}
          >
            <PolaroidCard
              imageUri={heroImage}
              commonName={data.commonName}
              scientificName={data.scientificName}
              date={today}
              developing
              testID="polaroid-card"
            />
          </Animated.View>

          {/* Confidence count-up */}
          <Animated.View
            style={{
              opacity: detailOpacity,
              transform: [{ translateY: detailTranslateY }],
              alignItems: 'center',
              marginTop: spacing.xl,
              gap: 4,
            }}
          >
            <Text style={styles.confidence}>{displayedConf}% match</Text>
            <Text style={styles.eyebrow}>{data.migrationStatus || (match ? match.category : 'Bird')}</Text>
          </Animated.View>

          {/* Play call control + actions */}
          <Animated.View style={{ opacity: detailOpacity, transform: [{ translateY: detailTranslateY }] }}>
            {audioUrl && (
              <TouchableOpacity onPress={togglePlay} style={styles.playPill} activeOpacity={0.85} testID="result-toggle-call">
                <View style={styles.playPillIcon}>
                  <Ionicons name={playing ? 'pause' : 'play'} size={14} color="#0E0F0D" />
                </View>
                <Text style={styles.playPillText}>{playing ? 'Pause call' : 'Play call'}</Text>
                <FeatherWave size={18} mode={playing ? 'loading' : 'static'} />
              </TouchableOpacity>
            )}

            <View style={styles.actions}>
              <ActionButton icon={saved ? 'heart' : 'heart-outline'} label={saved ? 'Saved' : 'Save'} active={saved} onPress={onSave} testID="result-save" />
              <ActionButton icon={logged ? 'location' : 'location-outline'} label={logged ? 'Logged' : 'Log Sighting'} active={logged} onPress={onLogSighting} testID="result-log" />
              <ActionButton icon="albums-outline" label="To Journal" onPress={dropToJournal} testID="result-to-journal" />
            </View>

            {/* About */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.body}>{data.shortDescription}</Text>
            </View>

            {/* Alternatives */}
            {!!data.alternatives?.length && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Also possible</Text>
                {data.alternatives.map((a, i) => (
                  <View key={i} style={styles.altRow}>
                    <Text style={styles.altName}>{a.commonName}</Text>
                    <View style={styles.altBarWrap}>
                      <View style={[styles.altBar, { width: `${Math.max(2, a.confidence)}%` }]} />
                    </View>
                    <Text style={styles.altPct}>{a.confidence}%</Text>
                  </View>
                ))}
              </View>
            )}

            {match && (
              <TouchableOpacity style={styles.detailBtn} onPress={() => router.push(`/bird/${match.id}` as any)} testID="result-view-detail">
                <Text style={styles.detailBtnText}>View full details</Text>
                <Ionicons name="arrow-forward" size={18} color="#0E0F0D" />
              </TouchableOpacity>
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ActionButton({ icon, label, onPress, active, testID }: {
  icon: any; label: string; onPress: () => void; active?: boolean; testID: string;
}) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} testID={testID}>
      <View style={[styles.actionIcon, active && { backgroundColor: 'rgba(123,160,91,0.25)', borderColor: colors.primary }]}>
        <Ionicons name={icon} size={20} color={active ? colors.primary : colors.textPrimary} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  safe: { flex: 1, width: '100%' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.hairline,
  },
  identifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(123,160,91,0.14)',
    borderWidth: 1, borderColor: 'rgba(123,160,91,0.45)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
  },
  identifiedText: { ...type.caption, color: colors.primary, fontWeight: '700' },
  confidence: { ...type.h1, color: colors.textPrimary, fontSize: 48, letterSpacing: -2 },
  eyebrow: { ...type.caption, color: colors.primary, letterSpacing: 1 },
  playPill: {
    alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22,
    backgroundColor: 'rgba(123,160,91,0.14)', borderWidth: 1, borderColor: 'rgba(123,160,91,0.4)',
    marginTop: spacing.lg,
  },
  playPillIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  playPillText: { ...type.bodySm, color: colors.textPrimary, fontWeight: '700' },
  actions: {
    flexDirection: 'row', justifyContent: 'space-around',
    marginHorizontal: spacing.lg,
    padding: spacing.md, marginTop: spacing.lg,
    backgroundColor: colors.card, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.hairline,
  },
  actionBtn: { alignItems: 'center', gap: 6 },
  actionIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.hairline,
  },
  actionLabel: { ...type.caption, color: colors.textSecondary },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.sm },
  sectionTitle: { ...type.h3, color: colors.textPrimary, fontSize: 20 },
  body: { ...type.body, color: colors.textSecondary, lineHeight: 24 },
  altRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  altName: { ...type.bodySm, color: colors.textPrimary, width: 140 },
  altBarWrap: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)' },
  altBar: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  altPct: { ...type.bodySm, color: colors.textTertiary, width: 38, textAlign: 'right' },
  detailBtn: {
    marginHorizontal: spacing.lg, marginTop: spacing.lg,
    backgroundColor: colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: radii.button,
    ...shadows.glowPrimary,
  },
  detailBtnText: { ...type.bodyLg, color: '#0E0F0D', fontWeight: '800' },
});
