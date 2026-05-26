// Full-screen species search — instant filter over the 11k-species local index.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, Image, Keyboard, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';

import { colors, spacing, type, radii } from '@/src/theme';
import { PressableScale } from '@/src/components/PressableScale';
import { FeatherWave } from '@/src/components/FeatherWave';
import { searchSpecies, hasPrecachedDetail, indexSize, getPrecachedDetail, type Species } from '@/src/lib/catalog';
import { SpeciesThumb } from '@/src/components/SpeciesThumb';

export default function SearchScreen() {
  const router = useRouter();
  const { q: initialQ } = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(String(initialQ ?? ''));
  const [results, setResults] = useState<Species[]>([]);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Initial autofocus.
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setPending(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setResults(searchSpecies(query, 120));
      setPending(false);
    }, 120);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const emptyState = query.trim().length === 0;

  return (
    <View style={styles.root} testID="search-screen">
      <SafeAreaView edges={['top']}>
        <View style={styles.headerRow}>
          <PressableScale onPress={() => router.back()} style={styles.backBtn} pressedScale={0.9} hitSlop={8} testID="search-back">
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </PressableScale>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.textTertiary} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              placeholder={`Search ${indexSize().toLocaleString()} species…`}
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="words"
              autoFocus
              testID="search-input"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
            {query.length > 0 && (
              <PressableScale onPress={() => setQuery('')} pressedScale={0.85} hitSlop={8} testID="search-clear">
                <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
              </PressableScale>
            )}
          </View>
        </View>
      </SafeAreaView>

      {emptyState ? (
        <View style={styles.empty}>
          <FeatherWave size={64} mode="static" glow />
          <Text style={styles.emptyTitle}>Find any bird</Text>
          <Text style={styles.emptySub}>
            Search {indexSize().toLocaleString()} species — type a common name like “cardinal”
            or a scientific name like “Turdus migratorius”.
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(s) => s.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 80 }}
          ListHeaderComponent={
            <View style={styles.headerLine}>
              {pending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.headerLineText}>
                  {results.length === 0
                    ? 'No matches — try a different word'
                    : `${results.length} result${results.length === 1 ? '' : 's'}`}
                </Text>
              )}
            </View>
          }
          ListEmptyComponent={
            !pending ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No matches found</Text>
                <Text style={styles.emptySub}>Try a broader term or check spelling.</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const pre = getPrecachedDetail(item.id);
            const instant = !!pre;
            return (
              <PressableScale
                style={styles.row}
                onPress={() => router.push(`/bird/${item.id}` as any)}
                pressedScale={0.985}
                testID={`search-result-${item.id}`}
              >
                <View style={styles.thumbWrap}>
                  <SpeciesThumb species={item} size={56} radius={12} />
                  {instant && <View style={styles.boltBadge} testID="instant-badge"><Ionicons name="flash" size={9} color="#0A0B0A" /></View>}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>{item.c}</Text>
                  <Text style={styles.latin} numberOfLines={1}>{item.s}</Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {item.g || item.fe || item.f}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </PressableScale>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          removeClippedSubviews
          initialNumToRender={14}
          windowSize={7}
          maxToRenderPerBatch={12}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingTop: spacing.sm, paddingBottom: spacing.s12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: colors.hairline,
    alignItems: 'center', justifyContent: 'center',
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.card, borderRadius: radii.pill,
    borderWidth: 1, borderColor: colors.hairline,
    paddingHorizontal: 14, height: 44,
  },
  input: { flex: 1, ...type.body, color: colors.textPrimary, paddingVertical: 0 },
  empty: { alignItems: 'center', gap: 12, padding: spacing.xl, marginTop: spacing.lg },
  emptyTitle: { ...type.heading, color: colors.textPrimary, textAlign: 'center' },
  emptySub: { ...type.body, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.lg },
  headerLine: { paddingVertical: spacing.s12, alignItems: 'flex-start' },
  headerLineText: { ...type.caption, color: colors.textTertiary },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 10, backgroundColor: colors.card, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.hairline,
  },
  thumbWrap: { width: 56, height: 56 },
  thumb: { width: 56, height: 56, borderRadius: 12 },
  thumbPlaceholder: {
    backgroundColor: colors.bgTertiary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.hairline,
  },
  boltBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.bg,
  },
  name: { ...type.bodyL, color: colors.textPrimary, fontWeight: '700' },
  latin: { ...type.caption, color: colors.textTertiary, fontStyle: 'italic' },
  meta: { ...type.caption, color: colors.textSecondary, marginTop: 2 },
});
