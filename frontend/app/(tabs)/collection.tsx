import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, FlatList, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { colors, type, spacing, radii } from '@/src/theme';
import {
  Collection, HistoryItem, Sighting,
  getCollections, getFavorites, getHistory, getSightings,
} from '@/src/lib/state';
import { computeBadges, currentStreakDays, uniqueSpecies } from '@/src/lib/badges';
import { SEED_BIRDS } from '@/src/lib/birds';
import { FeatherWave } from '@/src/components/FeatherWave';
import { CollectionPickerModal } from '@/src/components/CollectionPickerModal';

type ViewKey = 'timeline' | 'badges' | 'collections' | 'favorites';

export default function NatureJournal() {
  const router = useRouter();
  const [view, setView] = useState<ViewKey>('timeline');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setCollections(await getCollections());
    setFavorites(await getFavorites());
    setHistory(await getHistory());
    setSightings(await getSightings());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const species = uniqueSpecies(history);
  const streak = currentStreakDays(history);
  const badges = computeBadges(history, sightings);
  const earnedCount = badges.filter((b) => b.earned).length;

  const onNewCollection = () => {
    Haptics.selectionAsync().catch(() => {});
    setCreateOpen(true);
  };

  const onCollectionCreated = async () => {
    await load();
  };

  return (
    <View style={styles.root} testID="journal-screen">
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>YOUR</Text>
            <Text style={styles.title}>Nature Journal</Text>
          </View>
          <FeatherWave size={40} mode="static" />
        </View>

        {/* Stats strip */}
        <View style={styles.stats}>
          <Stat label="Species" value={String(species.length)} />
          <View style={styles.statDivider} />
          <Stat label="Sightings" value={String(sightings.length)} />
          <View style={styles.statDivider} />
          <Stat label="Streak" value={`${streak}d`} />
          <View style={styles.statDivider} />
          <Stat label="Badges" value={`${earnedCount}/${badges.length}`} />
        </View>

        {/* View segments */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.segmentRow}
        >
          {(['timeline','badges','collections','favorites'] as ViewKey[]).map((k) => (
            <TouchableOpacity
              key={k}
              onPress={() => { Haptics.selectionAsync(); setView(k); }}
              style={[styles.segment, view === k && styles.segmentActive]}
              testID={`journal-tab-${k}`}
            >
              <Text style={[styles.segmentText, view === k && styles.segmentTextActive]}>
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Content */}
        {view === 'timeline' && (
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160, gap: 12 }}>
            {history.length === 0 ? (
              <EmptyState
                title="Your journey starts with your first bird."
                subtitle="Tap Identify, point your camera at a bird, and watch the Polaroid land in your journal."
              />
            ) : (
              groupByBucket(history).map(([bucket, items]) => (
                <View key={bucket} style={{ gap: 10 }}>
                  <Text style={styles.bucketLabel}>{bucket}</Text>
                  {items.map((h) => (
                    <View key={h.id} style={styles.timelineRow} testID={`timeline-${h.id}`}>
                      {h.image ? (
                        <Image source={{ uri: h.image }} style={styles.tImg} />
                      ) : (
                        <View style={[styles.tImg, { alignItems: 'center', justifyContent: 'center' }]}>
                          <FeatherWave size={22} mode="static" />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tName}>{h.commonName}</Text>
                        <Text style={styles.tMeta}>
                          {new Date(h.createdAt).toLocaleString()}  ·  {h.confidence}% match
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                    </View>
                  ))}
                </View>
              ))
            )}
          </ScrollView>
        )}

        {view === 'badges' && (
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160, gap: 12 }}>
            <View style={styles.badgeGrid}>
              {badges.map((b) => (
                <View
                  key={b.id}
                  style={[styles.badgeCard, b.earned && styles.badgeCardEarned]}
                  testID={`badge-${b.id}`}
                >
                  <View style={[styles.badgeIcon, b.earned && { backgroundColor: 'rgba(123,160,91,0.22)', borderColor: colors.primary }]}>
                    <Ionicons name={b.icon as any} size={20} color={b.earned ? colors.primary : colors.textTertiary} />
                  </View>
                  <Text style={[styles.badgeTitle, b.earned && { color: colors.textPrimary }]}>{b.title}</Text>
                  <Text style={styles.badgeDesc} numberOfLines={2}>{b.description}</Text>
                  {b.earned ? (
                    <View style={styles.earnedPill}>
                      <Ionicons name="checkmark" size={10} color="#0E0F0D" />
                      <Text style={styles.earnedText}>Earned</Text>
                    </View>
                  ) : (
                    <Text style={styles.lockedText}>Locked</Text>
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        {view === 'collections' && (
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160, gap: 10 }}>
            <TouchableOpacity style={styles.addCard} onPress={onNewCollection} testID="add-collection-button">
              <View style={styles.addIcon}><Ionicons name="add" size={22} color={colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addTitle}>New Collection</Text>
                <Text style={styles.addSub}>Group sightings: backyard, migration…</Text>
              </View>
            </TouchableOpacity>
            {collections.length === 0 ? (
              <EmptyState title="No collections yet" subtitle="Group your finds into named collections." />
            ) : collections.map((c) => (
              <TouchableOpacity
                key={c.id}
                activeOpacity={0.85}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  router.push(`/collection/${c.id}` as any);
                }}
                style={styles.collCard}
                testID={`collection-${c.id}`}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Ionicons name="bookmark" size={18} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tName}>{c.name}</Text>
                    <Text style={styles.tMeta}>{c.birds.length} {c.birds.length === 1 ? 'bird' : 'birds'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </View>
                {c.birds.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingTop: 10 }}
                  >
                    {c.birds.slice(0, 8).map((b) => (
                      <View key={b.id} style={styles.collBird}>
                        {b.image ? (
                          <Image source={{ uri: b.image }} style={styles.collBirdImg} />
                        ) : (
                          <View style={[styles.collBirdImg, { alignItems: 'center', justifyContent: 'center' }]}>
                            <Ionicons name="leaf-outline" size={16} color={colors.textTertiary} />
                          </View>
                        )}
                        <Text style={styles.collBirdName} numberOfLines={1}>{b.commonName}</Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {view === 'favorites' && (
          <FlatList
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 }}
            data={favorites.map((id) => SEED_BIRDS.find((b) => b.id === id)).filter(Boolean) as any[]}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<EmptyState title="No favorites yet" subtitle="Tap the heart on a bird to save it." />}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.timelineRow}
                onPress={() => router.push(`/bird/${item.id}` as any)}
                testID={`favorite-${item.id}`}
              >
                <Image source={{ uri: item.image }} style={styles.tImg} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.tName}>{item.commonName}</Text>
                  <Text style={styles.tMeta}>{item.scientificName}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>

      <CollectionPickerModal
        mode="create"
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={onCollectionCreated}
      />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.empty}>
      <FeatherWave size={60} mode="static" glow />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{subtitle}</Text>
    </View>
  );
}

function groupByBucket(history: HistoryItem[]): [string, HistoryItem[]][] {
  const buckets: Record<string, HistoryItem[]> = {};
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = startOfToday - 6 * 86400_000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  history.forEach((h) => {
    const ts = new Date(h.createdAt).getTime();
    let label: string;
    if (ts >= startOfToday) label = 'Today';
    else if (ts >= startOfWeek) label = 'This week';
    else if (ts >= startOfMonth) label = 'This month';
    else label = new Date(h.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!buckets[label]) buckets[label] = [];
    buckets[label].push(h);
  });
  return Object.entries(buckets);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: 12,
  },
  kicker: { ...type.caption, color: colors.primary, marginBottom: 2 },
  title: { ...type.h1, color: colors.textPrimary, fontSize: 30 },
  stats: {
    marginHorizontal: 20, marginBottom: spacing.md,
    flexDirection: 'row', alignItems: 'stretch',
    paddingVertical: 14, paddingHorizontal: 8,
    backgroundColor: colors.card, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.hairline,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { ...type.bodyLg, color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  statLabel: { ...type.caption, color: colors.textTertiary },
  statDivider: { width: 1, backgroundColor: colors.hairline, marginVertical: 4 },
  segmentRow: { gap: 8, paddingHorizontal: 20, paddingBottom: spacing.md },
  segment: {
    paddingHorizontal: 14, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: colors.hairline,
    alignItems: 'center', justifyContent: 'center', marginRight: 6,
  },
  segmentActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segmentText: { ...type.bodySm, color: colors.textSecondary, fontWeight: '600' },
  segmentTextActive: { color: '#0E0F0D', fontWeight: '800' },
  bucketLabel: { ...type.caption, color: colors.primary, letterSpacing: 1, marginTop: 4 },
  timelineRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: spacing.sm, backgroundColor: colors.card, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.hairline,
  },
  tImg: { width: 56, height: 56, borderRadius: 12, backgroundColor: colors.bgTertiary, alignItems: 'center', justifyContent: 'center' },
  tName: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700' },
  tMeta: { ...type.bodySm, color: colors.textTertiary },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeCard: {
    width: '48.5%',
    padding: spacing.md, gap: 6,
    backgroundColor: colors.card, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.hairline,
    opacity: 0.65,
  },
  badgeCardEarned: { opacity: 1, borderColor: 'rgba(123,160,91,0.45)' },
  badgeIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.hairline,
  },
  badgeTitle: { ...type.bodyLg, color: colors.textSecondary, fontWeight: '700', fontSize: 15 },
  badgeDesc: { ...type.bodySm, color: colors.textTertiary, fontSize: 12, lineHeight: 16 },
  earnedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    backgroundColor: colors.primary, marginTop: 4,
  },
  earnedText: { ...type.caption, color: '#0E0F0D', fontWeight: '800', fontSize: 10 },
  lockedText: { ...type.caption, color: colors.textTertiary, marginTop: 4 },
  addCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: spacing.md, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.primary,
    backgroundColor: 'rgba(123,160,91,0.08)',
  },
  addIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(123,160,91,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  addTitle: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700' },
  addSub: { ...type.bodySm, color: colors.textTertiary },
  collCard: {
    flexDirection: 'column',
    padding: spacing.md, borderRadius: radii.card,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline,
  },
  collBird: {
    width: 78, alignItems: 'center', gap: 4,
  },
  collBirdImg: {
    width: 70, height: 70, borderRadius: 10, backgroundColor: colors.bgTertiary,
  },
  collBirdName: {
    ...type.caption, color: colors.textSecondary, textAlign: 'center', maxWidth: 78,
  },
  empty: { alignItems: 'center', padding: spacing.xl, gap: 10, marginTop: spacing.xl },
  emptyTitle: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700', textAlign: 'center' },
  emptySub: { ...type.body, color: colors.textTertiary, textAlign: 'center', maxWidth: 320 },
});
