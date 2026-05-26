// Category drill-in — lists species in a category with audio playback.
import { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, type, radii } from '@/src/theme';
import { SEED_BIRDS } from '@/src/lib/birds';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { PressableScale } from '@/src/components/PressableScale';
import { BirdCallPlayer } from '@/src/components/BirdCallPlayer';
import { FeatherWave } from '@/src/components/FeatherWave';

export default function CategoryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const category = decodeURIComponent(String(id ?? ''));

  const birds = useMemo(
    () => SEED_BIRDS.filter((b) => b.category.toLowerCase() === category.toLowerCase()),
    [category]
  );

  return (
    <View style={styles.root} testID="category-screen">
      <ScreenHeader title={category || 'Category'} eyebrow="BIRDS IN" />

      <FlatList
        data={birds}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 80 }}
        ListHeaderComponent={
          <Text style={styles.summary}>
            {birds.length} {birds.length === 1 ? 'species' : 'species'} in this group.
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <FeatherWave size={60} mode="static" glow />
            <Text style={styles.emptyTitle}>No species listed yet</Text>
            <Text style={styles.emptySub}>We're expanding the field guide constantly. Check back soon.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <PressableScale
              onPress={() => router.push(`/bird/${item.id}` as any)}
              testID={`category-bird-${item.id}`}
              pressedScale={0.98}
              style={styles.rowMain}
            >
              <Image source={{ uri: item.image }} style={styles.img} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.name} numberOfLines={1}>{item.commonName}</Text>
                <Text style={styles.latin} numberOfLines={1}>{item.scientificName}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </PressableScale>
            <View style={styles.rowFooter}>
              <BirdCallPlayer
                scientificName={item.scientificName}
                label="Call"
                testID={`category-bird-${item.id}-play`}
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
  summary: { ...type.caption, color: colors.textTertiary, marginBottom: spacing.sm },
  row: {
    backgroundColor: colors.card, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.hairline,
    overflow: 'hidden',
  },
  rowMain: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12,
  },
  rowFooter: { paddingHorizontal: 12, paddingBottom: 12 },
  img: { width: 78, height: 78, borderRadius: 14 },
  name: { ...type.bodyL, color: colors.textPrimary, fontWeight: '700' },
  latin: { ...type.caption, color: colors.textTertiary, fontStyle: 'italic' },
  empty: { alignItems: 'center', gap: 10, padding: spacing.xl },
  emptyTitle: { ...type.bodyL, color: colors.textPrimary, fontWeight: '700', textAlign: 'center' },
  emptySub: { ...type.body, color: colors.textTertiary, textAlign: 'center' },
});
