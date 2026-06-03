// Birds Near You — region-aware species list. Tries eBird via the backend
// using the user's location; gracefully falls back to the bundled catalog if
// the user has declined location or eBird is unconfigured.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ImageBackground,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, type, radii } from '@/src/theme';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { PressableScale } from '@/src/components/PressableScale';
import { BirdCallPlayer } from '@/src/components/BirdCallPlayer';
import { FeatherWave } from '@/src/components/FeatherWave';
import { SpeciesThumb } from '@/src/components/SpeciesThumb';
import {
  CATEGORIES as CATALOG_CATEGORIES,
  popularSpecies,
  getPrecachedDetail,
  allSpecies,
  lookupByScientific,
  lookupByCommon,
  type Species as CatalogSpecies,
} from '@/src/lib/catalog';
import {
  COMMON_LOCATIONS,
  getUserLocation,
  setPickedLocation,
  type Coords,
} from '@/src/lib/location';
import { fetchBirdsNearby, type NearbySpecies } from '@/src/lib/api';

export default function BirdsNearYou() {
  const router = useRouter();
  const monthName = new Date().toLocaleString('en-US', { month: 'long' });

  const [coords, setCoords] = useState<Coords | null>(null);
  const [loadingLoc, setLoadingLoc] = useState(true);
  const [nearby, setNearby] = useState<NearbySpecies[] | null>(null);
  const [picker, setPicker] = useState(false);
  const [fetching, setFetching] = useState(false);

  const loadLocation = useCallback(async (interactive: boolean) => {
    setLoadingLoc(true);
    const c = await getUserLocation({ interactive });
    setCoords(c);
    setLoadingLoc(false);
  }, []);

  // First mount: try non-interactive (don't prompt). If denied / unknown,
  // we'll surface the soft pre-ask via the "Use my location" button below
  // so the user is the one initiating the prompt.
  useEffect(() => {
    loadLocation(false);
  }, [loadLocation]);

  // Whenever we have coords, fetch eBird nearby.
  useEffect(() => {
    if (!coords) {
      setNearby(null);
      return;
    }
    let cancelled = false;
    setFetching(true);
    (async () => {
      try {
        const res = await fetchBirdsNearby(coords.lat, coords.lng, { radiusKm: 25, daysBack: 14, limit: 30 });
        if (!cancelled) setNearby(res.species || []);
      } catch {
        if (!cancelled) setNearby([]);
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coords?.lat, coords?.lng]);

  // Resolve eBird species (which only has common + scientific names) to our
  // local catalog entries (which carry image / order / family). Keep the
  // observation `count` and `last_seen` for the meta line.
  type Row = { species: CatalogSpecies; count: number; lastSeen: string };
  const liveRows: Row[] = useMemo(() => {
    if (!nearby) return [];
    const out: Row[] = [];
    const seen = new Set<string>();
    for (const n of nearby) {
      const sp = lookupByScientific(n.scientific_name) || lookupByCommon(n.common_name);
      if (!sp || seen.has(sp.id)) continue;
      seen.add(sp.id);
      out.push({ species: sp, count: n.count, lastSeen: n.last_seen });
    }
    return out;
  }, [nearby]);

  // Fallback list when we have NO coordinates yet (or eBird is empty / off):
  // use the bundled popular set so the screen never sits empty.
  const fallbackItems: CatalogSpecies[] = useMemo(() => {
    const pop = popularSpecies(40);
    if (pop.length >= 24) return pop;
    const others = allSpecies().filter((s) => s.o === 'Passeriformes').slice(0, 24);
    return [...pop, ...others].slice(0, 32);
  }, []);

  const showLive = liveRows.length > 0;
  const items: CatalogSpecies[] = showLive ? liveRows.map((r) => r.species) : fallbackItems;
  const liveMeta = useMemo(() => {
    const m: Record<string, Row> = {};
    for (const r of liveRows) m[r.species.id] = r;
    return m;
  }, [liveRows]);

  const eyebrowRegion =
    coords?.label ||
    (coords ? `LAT ${coords.lat.toFixed(2)}, LNG ${coords.lng.toFixed(2)}` : `ACTIVE IN ${monthName.toUpperCase()}`);

  return (
    <View style={styles.root} testID="birds-near-you-screen">
      <ScreenHeader title="Birds Near You" eyebrow={eyebrowRegion.toUpperCase()} />

      <FlatList
        data={items}
        keyExtractor={(b) => b.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 80 }}
        initialNumToRender={6}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: spacing.md }}>
            {/* Location chip — shows current source + actions */}
            <View style={styles.locChip}>
              <Ionicons
                name={coords ? 'location' : 'location-outline'}
                size={16}
                color={coords ? colors.primary : colors.textTertiary}
              />
              <Text style={styles.locText} numberOfLines={1}>
                {loadingLoc
                  ? 'Finding your location…'
                  : coords
                    ? coords.label || `Using your current location`
                    : 'Location off — showing popular birds worldwide'}
              </Text>
              <TouchableOpacity
                onPress={() => (coords ? setPicker(true) : loadLocation(true))}
                style={styles.locBtn}
                testID="loc-action"
              >
                <Text style={styles.locBtnText}>{coords ? 'Change' : 'Use my location'}</Text>
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
            <Text style={[styles.sectionEyebrow, { marginTop: spacing.lg }]}>
              {showLive ? `SEEN NEARBY · LAST 14 DAYS` : 'POPULAR SPECIES'}
            </Text>
            {fetching && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.birdMeta]}>Loading nearby sightings…</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <FeatherWave size={60} mode="static" glow />
            <Text style={styles.emptyTitle}>No birds for your area yet</Text>
            <Text style={styles.emptySub}>
              {coords
                ? 'No recent eBird sightings within 25 km. Try changing your location.'
                : 'Enable location to see species spotted near you.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const meta = liveMeta[item.id];
          return (
            <View style={styles.birdCard}>
              <PressableScale
                onPress={() => router.push(`/bird/${item.id}` as any)}
                testID={`near-bird-${item.id}`}
              >
                <SpeciesThumb species={item} fullWidth height={130} radius={0} />
                <View style={styles.birdBody}>
                  <Text style={styles.birdName} numberOfLines={1}>{item.c}</Text>
                  <Text style={styles.birdMeta} numberOfLines={1}>
                    {meta
                      ? `${meta.count} seen nearby · ${formatRelative(meta.lastSeen)}`
                      : item.fe || item.f}
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
          );
        }}
      />

      {/* Location picker modal — used when the user denied permission or
          wants to change their region without enabling GPS. */}
      {picker && (
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Choose a location</Text>
            <Text style={styles.pickerSub}>Pick anywhere in the world to see what birds are active there.</Text>
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

function formatRelative(iso: string): string {
  if (!iso) return 'recently';
  const d = new Date(iso.replace(' ', 'T'));
  if (isNaN(d.getTime())) return 'recently';
  const diffH = (Date.now() - d.getTime()) / 36e5;
  if (diffH < 24) return 'today';
  if (diffH < 48) return 'yesterday';
  if (diffH < 24 * 14) return `${Math.round(diffH / 24)}d ago`;
  return 'this month';
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
  locText: { ...type.bodySm, color: colors.textPrimary, flex: 1 },
  locBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  locBtnText: { ...type.caption, color: '#0E0F0D', fontWeight: '800' },
  // Picker modal
  pickerBackdrop: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
    padding: spacing.lg,
  },
  pickerCard: {
    width: '100%', maxWidth: 420,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: 6,
    borderWidth: 1, borderColor: colors.hairline,
  },
  pickerTitle: { ...type.bodyL, color: colors.textPrimary, fontWeight: '700' },
  pickerSub: { ...type.bodySm, color: colors.textTertiary, marginBottom: 4 },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 12,
    borderRadius: radii.button,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: colors.hairline,
  },
  pickerRowText: { ...type.body, color: colors.textPrimary, fontWeight: '600' },
  pickerClose: {
    marginTop: 10, alignSelf: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: 10,
    borderRadius: radii.button,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: colors.hairline,
  },
  pickerCloseText: { ...type.bodySm, color: colors.textPrimary, fontWeight: '600' },
});
