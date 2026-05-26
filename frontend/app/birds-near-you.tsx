// Birds Near You — category browser + species list pulled from the local 11k index.
import { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Image, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, type, radii } from '@/src/theme';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { PressableScale } from '@/src/components/PressableScale';
import { BirdCallPlayer } from '@/src/components/BirdCallPlayer';
import { FeatherWave } from '@/src/components/FeatherWave';
import {
  CATEGORIES as CATALOG_CATEGORIES,
  popularSpecies,
  getPrecachedDetail,
  allSpecies,
} from '@/src/lib/catalog';

export default function BirdsNearYou() {
  const router = useRouter();
  const monthName = new Date().toLocaleString('en-US', { month: 'long' });

  // Show the popular set (precached, instant), then a handful more from index.
  const items = useMemo(() => {
    const pop = popularSpecies(40);
    if (pop.length >= 24) return pop;
    // Fallback if precache is small — top precached + first songbirds.
    const others = allSpecies().filter((s) => s.o === 'Passeriformes').slice(0, 24);
    return [...pop, ...others].slice(0, 32);
  }, []);

  return (
    <View style={styles.root} testID="birds-near-you-screen">
      <ScreenHeader title="Birds Near You" eyebrow={`ACTIVE IN ${monthName.toUpperCase()}`} />

      <FlatList
        data={items}
        keyExtractor={(b) => b.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 80 }}
        initialNumToRender={6}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: spacing.md }}>
            <Text style={styles.sectionEyebrow}>BROWSE BY CATEGORY</Text>
            <View style={styles.catRow}>
              {CATALOG_CATEGORIES.map((c) => (
                <PressableScale
                  key={c.id}
                  style={styles.catCard}
                  onPress={() => router.push(`/category/${encodeURIComponent(c.id)}` as any)}
                  testID={`category-link-${c.id}`}
                >
                  <ImageBackground source={{ uri: c.image }} style={styles.catImg} imageStyle={{ borderRadius: radii.card }}>
                    <LinearGradient
                      colors={['transparent', 'rgba(10,11,10,0.92)']}
                      locations={[0.4, 1]}
                      style={[StyleSheet.absoluteFillObject, { borderRadius: radii.card }]}
                    />
                    <Text style={styles.catLabel}>{c.title}</Text>
                  </ImageBackground>
                </PressableScale>
              ))}
            </View>
            <Text style={[styles.sectionEyebrow, { marginTop: spacing.lg }]}>SPECIES ACTIVE NOW</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <FeatherWave size={60} mode="static" glow />
            <Text style={styles.emptyTitle}>No birds for your area yet</Text>
            <Text style={styles.emptySub}>Enable location to see what's flying near you.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const pre = getPrecachedDetail(item.id);
          return (
            <View style={styles.birdCard}>
              <PressableScale
                onPress={() => router.push(`/bird/${item.id}` as any)}
                testID={`near-bird-${item.id}`}
              >
                {pre?.thumb ? (
                  <Image source={{ uri: pre.thumb }} style={styles.birdImg} />
                ) : (
                  <View style={[styles.birdImg, styles.birdImgPlaceholder]}>
                    <Ionicons name="leaf-outline" size={28} color={colors.primary} />
                  </View>
                )}
                <View style={styles.birdBody}>
                  <Text style={styles.birdName} numberOfLines={1}>{item.c}</Text>
                  <Text style={styles.birdMeta} numberOfLines={1}>{item.fe || item.f}</Text>
                </View>
              </PressableScale>
              <View style={styles.birdFooter}>
                <BirdCallPlayer
                  scientificName={item.s}
                  label="Call"
                  testID={`near-bird-${item.id}-play`}
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
  sectionEyebrow: { ...type.micro, color: colors.primary, textTransform: 'uppercase' },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  catCard: { width: '47.7%', marginBottom: 4 },
  catImg: { height: 120, borderRadius: radii.card, overflow: 'hidden', justifyContent: 'flex-end', padding: 14 },
  catLabel: { ...type.bodyL, color: colors.textPrimary, fontWeight: '700' },
  birdCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden',
  },
  birdImg: { width: '100%', height: 130 },
  birdImgPlaceholder: { backgroundColor: colors.bgTertiary, alignItems: 'center', justifyContent: 'center' },
  birdBody: { paddingHorizontal: spacing.s12, paddingTop: spacing.s12, paddingBottom: spacing.sm, gap: 4 },
  birdFooter: { paddingHorizontal: spacing.s12, paddingBottom: spacing.s12 },
  birdName: { ...type.bodyL, color: colors.textPrimary, fontWeight: '700' },
  birdMeta: { ...type.caption, color: colors.textTertiary },
  empty: { alignItems: 'center', gap: 10, padding: spacing.xl },
  emptyTitle: { ...type.bodyL, color: colors.textPrimary, fontWeight: '700' },
  emptySub: { ...type.body, color: colors.textTertiary, textAlign: 'center' },
});
