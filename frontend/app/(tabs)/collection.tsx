import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, type, spacing, radii } from '@/src/theme';
import {
  Collection,
  HistoryItem,
  getCollections,
  getFavorites,
  getHistory,
  saveCollections,
} from '@/src/lib/state';
import { SEED_BIRDS } from '@/src/lib/birds';

type TabKey = 'collections' | 'favorites' | 'history';

export default function CollectionScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('collections');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const load = useCallback(async () => {
    setCollections(await getCollections());
    setFavorites(await getFavorites());
    setHistory(await getHistory());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const addCollection = async () => {
    const next: Collection = {
      id: `c-${Date.now()}`,
      name: `My Collection ${collections.length + 1}`,
      birdIds: [],
      createdAt: new Date().toISOString(),
    };
    const list = [next, ...collections];
    setCollections(list);
    await saveCollections(list);
  };

  return (
    <View style={styles.root} testID="collection-screen">
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your Birds</Text>
          <Text style={styles.headerSubtitle}>Collect every sighting, build your nature journal.</Text>
        </View>

        <View style={styles.segmentRow}>
          {(['collections', 'favorites', 'history'] as TabKey[]).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.segment, tab === t && styles.segmentActive]}
              testID={`collection-tab-${t}`}
            >
              <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'collections' && (
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 }}>
            <TouchableOpacity style={styles.addCard} onPress={addCollection} testID="add-collection-button">
              <View style={styles.addIcon}>
                <Ionicons name="add" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addTitle}>New Collection</Text>
                <Text style={styles.addSub}>Group sightings: backyard, migration…</Text>
              </View>
            </TouchableOpacity>
            {collections.length === 0 ? (
              <EmptyState
                title="No collections yet"
                subtitle="Start identifying to build your journal."
              />
            ) : (
              collections.map((c) => (
                <View key={c.id} style={styles.collCard} testID={`collection-${c.id}`}>
                  <Ionicons name="bookmark" size={18} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.collName}>{c.name}</Text>
                    <Text style={styles.collMeta}>{c.birdIds.length} birds</Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}

        {tab === 'favorites' && (
          <FlatList
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 }}
            data={favorites
              .map((id) => SEED_BIRDS.find((b) => b.id === id))
              .filter(Boolean)}
            keyExtractor={(item: any) => item.id}
            ListEmptyComponent={
              <EmptyState title="No favorites yet" subtitle="Tap the heart on a bird to save it." />
            }
            renderItem={({ item }: any) => (
              <TouchableOpacity
                style={styles.row}
                onPress={() => router.push(`/bird/${item.id}` as any)}
                testID={`favorite-${item.id}`}
              >
                <Image source={{ uri: item.image }} style={styles.rowImg} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{item.commonName}</Text>
                  <Text style={styles.rowLatin}>{item.scientificName}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          />
        )}

        {tab === 'history' && (
          <FlatList
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 }}
            data={history}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <EmptyState
                title="No identifications yet"
                subtitle="Tap the Identify button to make your first."
              />
            }
            renderItem={({ item }) => (
              <View style={styles.row} testID={`history-${item.id}`}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.rowImg} />
                ) : (
                  <View style={[styles.rowImg, { alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="leaf" size={20} color={colors.primary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{item.commonName}</Text>
                  <Text style={styles.rowLatin}>
                    {new Date(item.createdAt).toLocaleString()}  ·  {item.confidence}% match
                  </Text>
                </View>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.empty} testID="empty-state">
      <View style={styles.emptyIcon}>
        <Ionicons name="leaf-outline" size={32} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
  headerTitle: { ...type.h1, color: colors.textPrimary, fontSize: 34 },
  headerSubtitle: { ...type.body, color: colors.textSecondary, marginTop: 4 },
  segmentRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  segmentActive: { backgroundColor: 'rgba(123,160,91,0.18)' },
  segmentText: { ...type.bodySm, color: colors.textTertiary, fontWeight: '600' },
  segmentTextActive: { color: colors.primary },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'rgba(123,160,91,0.08)',
    marginBottom: spacing.md,
  },
  addIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(123,160,91,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTitle: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700' },
  addSub: { ...type.bodySm, color: colors.textTertiary },
  collCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    borderRadius: radii.card,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginBottom: 10,
  },
  collName: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700' },
  collMeta: { ...type.bodySm, color: colors.textTertiary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.sm,
    borderRadius: radii.card,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginBottom: 10,
  },
  rowImg: { width: 56, height: 56, borderRadius: 12, backgroundColor: colors.bgTertiary },
  rowName: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '600' },
  rowLatin: { ...type.bodySm, color: colors.textTertiary },
  empty: { alignItems: 'center', padding: spacing.xl, gap: 8, marginTop: spacing.xl },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(123,160,91,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700' },
  emptySub: { ...type.body, color: colors.textTertiary, textAlign: 'center' },
});
