// Popular Birds — virtualized grid from the catalog. Pre-cached birds shown first.
import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TextInput, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, type, radii } from '@/src/theme';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { PressableScale } from '@/src/components/PressableScale';
import { BirdCallPlayer } from '@/src/components/BirdCallPlayer';
import { FeatherWave } from '@/src/components/FeatherWave';
import { SpeciesThumb } from '@/src/components/SpeciesThumb';
import { popularSpecies, allSpecies, getPrecachedDetail, CATEGORIES as CATALOG_CATEGORIES, precacheSize } from '@/src/lib/catalog';

const FILTERS = [{ id: 'all', title: 'All' }, ...CATALOG_CATEGORIES.map((c) => ({ id: c.id, title: c.title }))];

export default function PopularBirds() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const popular = useMemo(() => {
    // Surface every precached species (the "popular" set), sorted alphabetically.
    return allSpecies()
      .filter((s) => !!getPrecachedDetail(s.id))
      .sort((a, b) => a.c.localeCompare(b.c));
  }, []);

  const data = useMemo(() => {
    const term = q.trim().toLowerCase();
    const cat = CATALOG_CATEGORIES.find((c) => c.id === filter);
    return popular.filter((b) => {
      if (cat && !cat.match(b)) return false;
      if (!term) return true;
      return (
        b.c.toLowerCase().includes(term) ||
        b.s.toLowerCase().includes(term) ||
        (b.fe || '').toLowerCase().includes(term)
      );
    });
  }, [q, filter, popular]);

  return (
    <View style={styles.root} testID="popular-birds-screen">
      <ScreenHeader
        title="Popular Birds"
        eyebrow={`${precacheSize()} INSTANT • OFFLINE READY`}
      />

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={colors.textTertiary} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search popular birds…"
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
            const active = f.id === filter;
            return (
              <PressableScale
                key={f.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(f.id)}
                pressedScale={0.94}
                testID={`popular-filter-${f.id}`}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.title}</Text>
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
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={6}
        removeClippedSubviews
        ListEmptyComponent={
          <View style={styles.empty}>
            <FeatherWave size={60} mode="static" glow />
            <Text style={styles.emptyTitle}>No birds match</Text>
            <Text style={styles.emptySub}>Try a broader search or category.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const pre = getPrecachedDetail(item.id);
          return (
            <View style={styles.card}>
              <PressableScale
                onPress={() => router.push(`/bird/${item.id}` as any)}
                testID={`popular-${item.id}`}
              >
                {pre?.thumb ? (
                  <SpeciesThumb species={item} fullWidth height={130} radius={0} />
                ) : (
                  <SpeciesThumb species={item} fullWidth height={130} radius={0} />
                )}
                <View style={styles.body}>
                  <Text style={styles.name} numberOfLines={1}>{item.c}</Text>
                  <Text style={styles.latin} numberOfLines={1}>{item.s}</Text>
                </View>
              </PressableScale>
              <View style={styles.footer}>
                <BirdCallPlayer
                  scientificName={item.s}
                  testID={`popular-${item.id}-play`}
                />
              </View>
            </View>
          );
        }}
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
  imgPlaceholder: { backgroundColor: colors.bgTertiary, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: spacing.s12, paddingTop: spacing.s12, paddingBottom: spacing.sm, gap: 4 },
  footer: { paddingHorizontal: spacing.s12, paddingBottom: spacing.s12 },
  name: { ...type.bodyL, color: colors.textPrimary, fontWeight: '700' },
  latin: { ...type.caption, color: colors.textTertiary, fontStyle: 'italic' },
  empty: { alignItems: 'center', gap: 10, padding: spacing.xl, marginTop: spacing.lg },
  emptyTitle: { ...type.bodyL, color: colors.textPrimary, fontWeight: '700' },
  emptySub: { ...type.body, color: colors.textTertiary, textAlign: 'center' },
});
