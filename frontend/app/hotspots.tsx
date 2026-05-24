import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

import { colors, type, spacing, radii } from '@/src/theme';
import { Sighting, getSightings } from '@/src/lib/state';
import { MapView, Marker } from '@/src/components/MapView';

export default function Hotspots() {
  const router = useRouter();
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const loadSightings = useCallback(async () => {
    setSightings(await getSightings());
  }, []);

  useEffect(() => {
    loadSightings();
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({});
        setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {}
    })();
  }, [loadSightings]);

  const region = coords
    ? { latitude: coords.lat, longitude: coords.lng, latitudeDelta: 0.08, longitudeDelta: 0.08 }
    : sightings[0]
      ? {
          latitude: sightings[0].latitude,
          longitude: sightings[0].longitude,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }
      : { latitude: 40.7128, longitude: -74.006, latitudeDelta: 0.4, longitudeDelta: 0.4 };

  return (
    <View style={styles.root} testID="hotspots-screen">
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="hotspots-back">
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Hotspots & Sightings</Text>
        <View style={{ width: 38 }} />
      </SafeAreaView>

      <View style={styles.mapWrap}>
        {MapView ? (
          <MapView
            style={{ flex: 1 }}
            initialRegion={region}
            userInterfaceStyle="dark"
            showsUserLocation
            testID="hotspots-map"
          >
            {sightings.map((s) => (
              <Marker
                key={s.id}
                coordinate={{ latitude: s.latitude, longitude: s.longitude }}
                title={s.commonName}
                description={new Date(s.createdAt).toLocaleDateString()}
                pinColor={colors.primary}
              />
            ))}
          </MapView>
        ) : (
          <View style={styles.mapFallback}>
            <Ionicons name="map-outline" size={36} color={colors.primary} />
            <Text style={styles.mapText}>Interactive map available on mobile preview</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={{ padding: spacing.lg, gap: 10, paddingBottom: 80 }}
      >
        <Text style={styles.listHeader}>Your Sightings ({sightings.length})</Text>
        {sightings.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No sightings yet. After identifying a bird, tap "Log Sighting" to pin it here.
            </Text>
          </View>
        )}
        {sightings.map((s) => (
          <View key={s.id} style={styles.row} testID={`sighting-${s.id}`}>
            {s.image ? (
              <Image source={{ uri: s.image }} style={styles.rowImg} />
            ) : (
              <View style={[styles.rowImg, { alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="location" size={20} color={colors.primary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName}>{s.commonName}</Text>
              <Text style={styles.rowMeta}>
                {new Date(s.createdAt).toLocaleString()}  ·  {s.latitude.toFixed(3)}, {s.longitude.toFixed(3)}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.hairline,
  },
  title: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700' },
  mapWrap: {
    height: 320, marginHorizontal: spacing.lg, borderRadius: radii.card, overflow: 'hidden',
    backgroundColor: colors.bgTertiary, borderWidth: 1, borderColor: colors.hairline,
  },
  mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  mapText: { ...type.body, color: colors.textSecondary, paddingHorizontal: spacing.xl, textAlign: 'center' },
  list: { flex: 1, marginTop: spacing.md },
  listHeader: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700' },
  empty: { padding: spacing.lg, backgroundColor: colors.card, borderRadius: radii.card, borderWidth: 1, borderColor: colors.hairline },
  emptyText: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: spacing.sm, backgroundColor: colors.card, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.hairline,
  },
  rowImg: { width: 50, height: 50, borderRadius: 10, backgroundColor: colors.bgTertiary },
  rowName: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '600' },
  rowMeta: { ...type.bodySm, color: colors.textTertiary },
});
