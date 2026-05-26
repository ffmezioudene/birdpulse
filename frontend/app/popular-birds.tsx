// Popular Birds — full grid with search, sort, real audio playback.
import { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TextInput, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, type, radii } from '@/src/theme';
import { SEED_BIRDS, CATEGORIES } from '@/src/lib/birds';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { PressableScale } from '@/src/components/PressableScale';
import { BirdCallPlayer } from '@/src/components/BirdCallPlayer';
import { FeatherWave } from '@/src/components/FeatherWave';

const FILTERS = ['All', ...Array.from(new Set(CATEGORIES.map((c) => c.id)))];

export default function PopularBirds() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<string>('All');

  const data = useMemo(() => {
    const term = q.trim().toLowerCase();
    return SEED_BIRDS.filter((b) => {
      const passCat = filter === 'All' || b.category === filter;
      if (!passCat) return false;
      if (!term) return true;
      return (
        b.commonName.toLowerCase().includes(term) ||
        b.scientificName.toLowerCase().includes(term) ||
        b.category.toLowerCase().includes(term)
      );
    });
  }, [q, filter]);

  return (
    <View style={styles.root} testID="popular-birds-screen">
      <ScreenHeader title="Popular Birds" eyebrow="MOST LOVED" />

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={colors.textTertiary} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search birds…"
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
            returnKeyType="search"
            testID="popular-search-input"
          />
          {q.length > 0 && (
            <PressableScale onPress={() => setQ('')} pressedScale={0.85} hitSlop={8} testID="popular-search-clear">
              <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
            </PressableScale>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = f === filter;
            return (
              <PressableScale
                key={f}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(f)}
                pressedScale={0.94}
                testID={`popular-filter-${f}`}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f}</Text>
              </PressableScale>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={data}
        keyExtractor={(b) => b.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 80 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <FeatherWave size={60} mode="static" glow />
            <Text style={styles.emptyTitle}>No birds match that search</Text>
            <Text style={styles.emptySub}>Try a broader term or pick a different category.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <PressableScale
              onPress={() => router.push(`/bird/${item.id}` as any)}
              testID={`popular-${item.id}`}
            >
              <Image source={{ uri: item.image }} style={styles.img} />
              <View style={styles.body}>
                <Text style={styles.name} numberOfLines={1}>{item.commonName}</Text>
                <Text style={styles.latin} numberOfLines={1}>{item.scientificName}</Text>
              </View>
            </PressableScale>
            <View style={styles.footer}>
              <BirdCallPlayer
                scientificName={item.scientificName}
                testID={`popular-${item.id}-play`}
              />
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  searchWrap: { paddingHorizontal: 20, gap: spacing.s12, marginBottom: spacing.sm },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.card, borderRadius: radii.pill,
    borderWidth: 1, borderColor: colors.hairline,
    paddingHorizontal: 14, height: 44,
  },
  searchInput: { flex: 1, ...type.body, color: colors.textPrimary, paddingVertical: 0 },
  filterRow: { gap: 8, paddingRight: 8 },
  chip: {
    paddingHorizontal: 14, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: colors.hairline,
    alignItems: 'center', justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...type.bodySm, color: colors.textPrimary, fontWeight: '600' },
  chipTextActive: { color: '#0A0B0A', fontWeight: '800' },
  card: {
    flex: 1, backgroundColor: colors.card, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden',
  },
  img: { width: '100%', height: 130 },
  body: { paddingHorizontal: spacing.s12, paddingTop: spacing.s12, paddingBottom: spacing.sm, gap: 4 },
  footer: { paddingHorizontal: spacing.s12, paddingBottom: spacing.s12 },
  name: { ...type.bodyL, color: colors.textPrimary, fontWeight: '700' },
  latin: { ...type.caption, color: colors.textTertiary, fontStyle: 'italic' },
  empty: { alignItems: 'center', gap: 10, padding: spacing.xl, marginTop: spacing.lg },
  emptyTitle: { ...type.bodyL, color: colors.textPrimary, fontWeight: '700' },
  emptySub: { ...type.body, color: colors.textTertiary, textAlign: 'center' },
});
