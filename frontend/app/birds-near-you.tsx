// Birds Near You — v1: curated, globally widespread "Popular Species" list.
//
// ⚠️  eBird live integration is intentionally OFF for v1. Commercial use of
//     the eBird API requires prior written permission from the Cornell Lab
//     of Ornithology, which we have not yet obtained. The backend endpoint
//     (`/api/birds/nearby`) and the client helper (`fetchBirdsNearby`) are
//     preserved as-is behind the `ENABLE_LIVE_NEARBY` feature flag below
//     so we can re-enable in v1.1 once licensing is sorted.
//
// For v1 we render a hand-curated list of well-known species balanced
// across continents (NA, EU, Asia, ME, Africa, Oceania). The list is
// resolved against the bundled local catalog by scientific name, so the
// data source is the offline taxonomy — no cached eBird data is used.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ImageBackground,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, type as typography, radii } from '@/src/theme';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { PressableScale } from '@/src/components/PressableScale';
import { BirdCallPlayer } from '@/src/components/BirdCallPlayer';
import { FeatherWave } from '@/src/components/FeatherWave';
import { SpeciesThumb } from '@/src/components/SpeciesThumb';
import {
  CATEGORIES as CATALOG_CATEGORIES,
  popularSpecies,
  allSpecies,
  lookupByScientific,
} from '@/src/lib/catalog';
import type { Species as CatalogSpecies } from '@/src/lib/catalog';
import {
  COMMON_LOCATIONS,
  getUserLocation,
  setPickedLocation,
} from '@/src/lib/location';
import type { Coords } from '@/src/lib/location';
// Live nearby — preserved for v1.1 behind ENABLE_LIVE_NEARBY:
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { fetchBirdsNearby } from '@/src/lib/api';

/** v1 feature flag — flip to `true` only after Cornell Lab licensing is in
 *  place. When false, no /api/birds/nearby request is made. */
const ENABLE_LIVE_NEARBY = false;

/**
 * Hand-curated list of globally widespread, well-known species. Balanced
 * across continents (North America, Europe, Asia, Middle East, Africa,
 * Oceania, South America). Scientific names only — looked up in the
 * bundled local catalog at render time. Entries that don't match are
 * skipped silently, so this stays resilient to taxonomy drift.
 */
const POPULAR_SCIENTIFIC: string[] = [
  // Cosmopolitan / synanthropic
  'Passer domesticus',          // House Sparrow
  'Columba livia',              // Rock Pigeon
  'Hirundo rustica',            // Barn Swallow
  'Sturnus vulgaris',           // European Starling
  'Anas platyrhynchos',         // Mallard
  'Bubulcus ibis',              // Cattle Egret
  'Milvus migrans',             // Black Kite

  // Europe / UK
  'Turdus merula',              // Common Blackbird
  'Erithacus rubecula',         // European Robin
  'Parus major',                // Great Tit
  'Cyanistes caeruleus',        // Eurasian Blue Tit
  'Pica pica',                  // Eurasian Magpie
  'Garrulus glandarius',        // Eurasian Jay
  'Fringilla coelebs',          // Common Chaffinch
  'Columba palumbus',           // Common Wood-Pigeon
  'Streptopelia decaocto',      // Eurasian Collared-Dove
  'Buteo buteo',                // Common Buzzard
  'Alcedo atthis',              // Common Kingfisher
  'Upupa epops',                // Eurasian Hoopoe
  'Cygnus olor',                // Mute Swan
  'Motacilla alba',             // White Wagtail
  'Fulica atra',                // Eurasian Coot
  'Chroicocephalus ridibundus', // Black-headed Gull
  'Carduelis carduelis',        // European Goldfinch

  // North America
  'Cardinalis cardinalis',      // Northern Cardinal
  'Turdus migratorius',         // American Robin
  'Cyanocitta cristata',        // Blue Jay
  'Poecile atricapillus',       // Black-capped Chickadee
  'Zenaida macroura',           // Mourning Dove
  'Buteo jamaicensis',          // Red-tailed Hawk
  'Ardea herodias',             // Great Blue Heron
  'Haliaeetus leucocephalus',   // Bald Eagle
  'Spinus tristis',             // American Goldfinch
  'Corvus brachyrhynchos',      // American Crow

  // Asia
  'Coracias benghalensis',      // Indian Roller
  'Acridotheres tristis',       // Common Myna
  'Pycnonotus cafer',           // Red-vented Bulbul
  'Eudynamys scolopaceus',      // Asian Koel
  'Psittacula krameri',         // Rose-ringed Parakeet
  'Corvus splendens',           // House Crow
  'Halcyon smyrnensis',         // White-throated Kingfisher
  'Copsychus saularis',         // Oriental Magpie-Robin

  // Middle East & Africa
  'Pycnonotus barbatus',        // Common Bulbul
  'Corvus albus',               // Pied Crow
  'Bostrychia hagedash',        // Hadada Ibis
  'Coracias caudatus',          // Lilac-breasted Roller
  'Lamprotornis superbus',      // Superb Starling
  'Spilopelia senegalensis',    // Laughing Dove
  'Phoeniconaias minor',        // Lesser Flamingo

  // Oceania
  'Trichoglossus moluccanus',   // Rainbow Lorikeet
  'Dacelo novaeguineae',        // Laughing Kookaburra
  'Cacatua galerita',           // Sulphur-crested Cockatoo
  'Gymnorhina tibicen',         // Australian Magpie

  // South America
  'Coragyps atratus',           // Black Vulture
  'Pitangus sulphuratus',       // Great Kiskadee
];

/** Resolve curated scientific names against the local catalog. Falls back
 *  to popularSpecies()/Passeriformes if too few resolve (e.g. taxonomy
 *  mismatch). De-duplicates by species id. */
function buildPopularList(): CatalogSpecies[] {
  const out: CatalogSpecies[] = [];
  const seen = new Set<string>();
  for (const sci of POPULAR_SCIENTIFIC) {
    const sp = lookupByScientific(sci);
    if (sp && !seen.has(sp.id)) {
      out.push(sp);
      seen.add(sp.id);
    }
  }
  if (out.length >= 24) return out;
  // Safety net — should rarely trigger because the catalog has 10k+ species.
  for (const sp of popularSpecies(40)) {
    if (!seen.has(sp.id)) {
      out.push(sp);
      seen.add(sp.id);
    }
  }
  if (out.length >= 24) return out;
  for (const sp of allSpecies().filter((s) => s.o === 'Passeriformes')) {
    if (!seen.has(sp.id)) {
      out.push(sp);
      seen.add(sp.id);
      if (out.length >= 40) break;
    }
  }
  return out;
}

export default function BirdsNearYou() {
  const router = useRouter();

  const [coords, setCoords] = useState<Coords | null>(null);
  const [loadingLoc, setLoadingLoc] = useState(true);
  const [picker, setPicker] = useState(false);

  const loadLocation = useCallback(async (interactive: boolean) => {
    setLoadingLoc(true);
    const c = await getUserLocation({ interactive });
    setCoords(c);
    setLoadingLoc(false);
  }, []);

  // First mount: try non-interactive (don't prompt). The "Use my location"
  // button is the user's opt-in for the soft pre-ask + system prompt.
  useEffect(() => {
    loadLocation(false);
  }, [loadLocation]);

  // v1: the popular list is curated and does NOT change with location.
  // Location is still captured (for Photo/Sound ID context elsewhere) but
  // does not gate or alter what's shown here.
  const items: CatalogSpecies[] = useMemo(buildPopularList, []);

  const locText = loadingLoc
    ? 'Finding your location…'
    : coords
      ? `Location: ${coords.label || `${coords.lat.toFixed(2)}, ${coords.lng.toFixed(2)}`}`
      : 'Showing globally popular species';

  return (
    <View style={styles.root} testID="birds-near-you-screen">
      <ScreenHeader title="Birds Near You" eyebrow="POPULAR WORLDWIDE" />

      <FlatList
        data={items}
        keyExtractor={(b) => b.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 80 }}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={6}
        removeClippedSubviews
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: spacing.md }}>
            {/* Location chip — captured for elsewhere in the app
                (Photo/Sound ID context). It does NOT filter this list. */}
            <View style={styles.locChip}>
              <Ionicons
                name={coords ? 'location' : 'location-outline'}
                size={16}
                color={coords ? colors.primary : colors.textTertiary}
              />
              <Text style={styles.locText} numberOfLines={1}>
                {locText}
              </Text>
              <TouchableOpacity
                onPress={() => (coords ? setPicker(true) : loadLocation(true))}
                style={styles.locBtn}
                testID="loc-action"
              >
                <Text style={styles.locBtnText}>
                  {coords ? 'Change' : 'Use my location'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionEyebrow}>BROWSE BY CATEGORY</Text>
            <View style={styles.catRow}>
              {CATALOG_CATEGORIES.map((c) => (
                <PressableScale
                  key={c.id}
                  style={styles.catCard}
                  onPress={() => router.push(`/category/${encodeURIComponent(c.id)}` as any)}
                  testID={`category-link-${c.id}`}
                >
                  <ImageBackground
                    source={{ uri: c.image }}
                    style={styles.catImg}
                    imageStyle={{ borderRadius: radii.card }}
                  >
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

            <Text style={[styles.sectionEyebrow, { marginTop: spacing.lg }]}>
              POPULAR SPECIES
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <FeatherWave size={60} mode="static" glow />
            <Text style={styles.emptyTitle}>No species to show</Text>
            <Text style={styles.emptySub}>
              The bundled catalog couldn't be loaded. Try restarting the app.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.birdCard}>
            <PressableScale
              onPress={() => router.push(`/bird/${item.id}` as any)}
              testID={`near-bird-${item.id}`}
            >
              <SpeciesThumb species={item} fullWidth height={130} radius={0} />
              <View style={styles.birdBody}>
                <Text style={styles.birdName} numberOfLines={1}>
                  {item.c}
                </Text>
                <Text style={styles.birdMeta} numberOfLines={1}>
                  {item.fe || item.f}
                </Text>
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
        )}
      />

      {/* Location picker modal — used when the user wants to change their
          captured location or originally declined the system prompt. */}
      {picker && (
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Choose a location</Text>
            <Text style={styles.pickerSub}>
              Pick anywhere in the world. (Used to personalize Photo &amp; Sound ID context.)
            </Text>
            <View style={{ gap: 8, marginTop: 8 }}>
              {COMMON_LOCATIONS.map((c) => (
                <TouchableOpacity
                  key={c.label}
                  style={styles.pickerRow}
                  onPress={async () => {
                    await setPickedLocation(c);
                    setCoords(c);
                    setPicker(false);
                  }}
                  testID={`pick-${c.label}`}
                >
                  <Ionicons name="location-outline" size={16} color={colors.primary} />
                  <Text style={styles.pickerRowText}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.pickerClose}
              onPress={() => setPicker(false)}
              testID="picker-close"
            >
              <Text style={styles.pickerCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// Keep the symbol referenced so the live import doesn't get tree-shaken
// out of bundles where v1.1 might re-enable it via the feature flag.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _ENABLE_LIVE_NEARBY_REF = ENABLE_LIVE_NEARBY ? fetchBirdsNearby : null;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  sectionEyebrow: { ...typography.micro, color: colors.primary, textTransform: 'uppercase' },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  catCard: { width: '47.7%', marginBottom: 4 },
  catImg: {
    height: 120,
    borderRadius: radii.card,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 14,
  },
  catLabel: { ...typography.bodyL, color: colors.textPrimary, fontWeight: '700' },
  birdCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  birdBody: {
    paddingHorizontal: spacing.s12,
    paddingTop: spacing.s12,
    paddingBottom: spacing.sm,
    gap: 4,
  },
  birdFooter: { paddingHorizontal: spacing.s12, paddingBottom: spacing.s12 },
  birdName: { ...typography.bodyL, color: colors.textPrimary, fontWeight: '700' },
  birdMeta: { ...typography.caption, color: colors.textTertiary },
  empty: { alignItems: 'center', gap: 10, padding: spacing.xl },
  emptyTitle: { ...typography.bodyL, color: colors.textPrimary, fontWeight: '700' },
  emptySub: { ...typography.body, color: colors.textTertiary, textAlign: 'center' },
  // Location chip
  locChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  locText: { ...typography.bodySm, color: colors.textPrimary, flex: 1 },
  locBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  locBtnText: { ...typography.caption, color: '#0E0F0D', fontWeight: '800' },
  // Picker modal
  pickerBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  pickerTitle: { ...typography.bodyL, color: colors.textPrimary, fontWeight: '700' },
  pickerSub: { ...typography.bodySm, color: colors.textTertiary, marginBottom: 4 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radii.button,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  pickerRowText: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
  pickerClose: {
    marginTop: 10,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radii.button,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  pickerCloseText: { ...typography.bodySm, color: colors.textPrimary, fontWeight: '600' },
});
