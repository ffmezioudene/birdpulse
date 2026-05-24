import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { colors, type, spacing, radii, shadows } from '@/src/theme';
import { IdentifyResult } from '@/src/lib/api';
import { addHistory, addSighting, toggleFavorite } from '@/src/lib/state';
import { SEED_BIRDS } from '@/src/lib/birds';

export default function Result() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string; imageBase64?: string; payload?: string }>();
  const [data, setData] = useState<IdentifyResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [logged, setLogged] = useState(false);

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

  if (!data) {
    return (
      <View style={styles.root} testID="result-loading">
        <Text style={{ color: '#fff' }}>Loading…</Text>
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

  return (
    <View style={styles.root} testID="result-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          <Image source={{ uri: heroImage }} style={styles.heroImg} />
          <LinearGradient
            colors={['transparent', 'rgba(14,15,13,0.9)', '#0E0F0D']}
            locations={[0.3, 0.85, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <SafeAreaView edges={['top']} style={styles.heroHeader}>
            <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.iconBtn} testID="result-close">
              <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.badge}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
              <Text style={styles.badgeText}>Identified</Text>
            </View>
          </SafeAreaView>

          <View style={styles.heroCopy}>
            <Text style={styles.confidence}>{data.confidence}% match</Text>
            <Text style={styles.name}>{data.commonName}</Text>
            <Text style={styles.latin}>{data.scientificName}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <ActionButton
            icon={saved ? 'heart' : 'heart-outline'}
            label={saved ? 'Saved' : 'Save'}
            active={saved}
            onPress={onSave}
            testID="result-save"
          />
          <ActionButton
            icon={logged ? 'location' : 'location-outline'}
            label={logged ? 'Logged' : 'Log Sighting'}
            active={logged}
            onPress={onLogSighting}
            testID="result-log"
          />
          <ActionButton
            icon="volume-medium-outline"
            label="Play Call"
            onPress={() => {
              if (match) router.push(`/bird/${match.id}` as any);
            }}
            testID="result-play"
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.body}>{data.shortDescription}</Text>
        </View>

        {/* Alternatives */}
        {!!data.alternatives?.length && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top alternatives</Text>
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

        <View style={styles.facts}>
          <Fact label="Habitat" value={data.habitat} />
          <Fact label="Diet" value={data.diet} />
          <Fact label="Size" value={data.size} />
          <Fact label="Conservation" value={data.conservationStatus} />
        </View>

        {match && (
          <TouchableOpacity
            style={styles.detailBtn}
            onPress={() => router.push(`/bird/${match.id}` as any)}
            testID="result-view-detail"
          >
            <Text style={styles.detailBtnText}>View full details</Text>
            <Ionicons name="arrow-forward" size={18} color="#0E0F0D" />
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  active,
  testID,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  active?: boolean;
  testID: string;
}) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} testID={testID}>
      <View style={[styles.actionIcon, active && { backgroundColor: 'rgba(123,160,91,0.25)' }]}>
        <Ionicons name={icon} size={20} color={active ? colors.primary : colors.textPrimary} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue} numberOfLines={3}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  heroWrap: { height: 460, position: 'relative' },
  heroImg: { width: '100%', height: '100%' },
  heroHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
  },
  badgeText: { ...type.bodySm, color: colors.textPrimary, fontWeight: '600' },
  heroCopy: { position: 'absolute', bottom: spacing.lg, left: spacing.lg, right: spacing.lg },
  confidence: { ...type.caption, color: colors.primary, marginBottom: 6 },
  name: { ...type.h1, color: colors.textPrimary, fontSize: 36 },
  latin: { ...type.bodyLg, color: colors.textSecondary, fontStyle: 'italic', marginTop: 4 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginTop: -spacing.xl,
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
  facts: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.lg, gap: 12 },
  fact: {
    flexBasis: '47%',
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.hairline,
    padding: spacing.md,
  },
  factLabel: { ...type.caption, color: colors.primary, marginBottom: 4 },
  factValue: { ...type.bodySm, color: colors.textPrimary, lineHeight: 18 },
  detailBtn: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: radii.button,
    ...shadows.glowPrimary,
  },
  detailBtnText: { ...type.bodyLg, color: '#0E0F0D', fontWeight: '800' },
});
