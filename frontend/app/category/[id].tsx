// Category drill-in — pulls real species from the local 11k index by family/order.
import { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, type, radii } from '@/src/theme';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { PressableScale } from '@/src/components/PressableScale';
import { BirdCallPlayer } from '@/src/components/BirdCallPlayer';
import { FeatherWave } from '@/src/components/FeatherWave';
import { SpeciesThumb } from '@/src/components/SpeciesThumb';
import {
  categoryById,
  speciesInCategory,
  getPrecachedDetail,
} from '@/src/lib/catalog';

export default function CategoryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const catId = decodeURIComponent(String(id ?? ''));

  const category = categoryById(catId);
  const species = useMemo(() => speciesInCategory(catId, 500), [catId]);

  return (
    <View style={styles.root} testID="category-screen">
      <ScreenHeader
        title={category?.title || 'Category'}
        eyebrow="BIRDS IN"
      />

      <FlatList
        data={species}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 80 }}
        ListHeaderComponent={
          <Text style={styles.summary}>
            {species.length.toLocaleString()} species in this group
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <FeatherWave size={60} mode="static" glow />
            <Text style={styles.emptyTitle}>No species in this group yet</Text>
            <Text style={styles.emptySub}>
              We're constantly expanding the field guide.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const pre = getPrecachedDetail(item.id);
          return (
            <View style={styles.row}>
              <PressableScale
                onPress={() => router.push(`/bird/${item.id}` as any)}
                testID={`category-bird-${item.id}`}
                pressedScale={0.985}
                style={styles.rowMain}
              >
                <SpeciesThumb species={item} size={64} radius={12} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={styles.name} numberOfLines={1}>{item.c}</Text>
                  <Text style={styles.latin} numberOfLines={1}>{item.s}</Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {pre ? 'Instant' : item.fe || item.f}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </PressableScale>
              <View style={styles.rowFooter}>
                <BirdCallPlayer
                  scientificName={item.s}
                  label="Call"
                  testID={`category-bird-${item.id}-play`}
                />
              </View>
            </View>
          );
        }}
        initialNumToRender={12}
        windowSize={7}
        maxToRenderPerBatch={10}
        removeClippedSubviews
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  summary: { ...type.caption, color: colors.textTertiary, marginBottom: spacing.sm },
  row: {
    backgroundColor: colors.card, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden',
  },
  rowMain: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
  },
  rowFooter: { paddingHorizontal: 12, paddingBottom: 12 },
  img: { width: 64, height: 64, borderRadius: 12 },
  imgPlaceholder: {
    backgroundColor: colors.bgTertiary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.hairline,
  },
  name: { ...type.bodyL, color: colors.textPrimary, fontWeight: '700' },
  latin: { ...type.caption, color: colors.textTertiary, fontStyle: 'italic' },
  meta: { ...type.caption, color: colors.textSecondary },
  empty: { alignItems: 'center', gap: 10, padding: spacing.xl },
  emptyTitle: { ...type.bodyL, color: colors.textPrimary, fontWeight: '700', textAlign: 'center' },
  emptySub: { ...type.body, color: colors.textTertiary, textAlign: 'center' },
});
