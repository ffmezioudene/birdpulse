// Hotspots — v1: personal sightings list only.
//
// ⚠️  Map view intentionally hidden for v1 (symmetry with Birds Near You).
//     Empty maps look unfinished. We'll bring it back in v1.1 once we have
//     real sighting data to populate it with — at that point it'll be a
//     meaningful visual feature rather than a decorative anchor.
//
// No eBird / Cornell API calls anywhere on this screen. Sightings are
// drawn entirely from local AsyncStorage (logged by the user after a
// Photo or Sound ID match).

import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, type, spacing, radii } from '@/src/theme';
import { Sighting, getSightings } from '@/src/lib/state';

export default function Hotspots() {
  const router = useRouter();
  const [sightings, setSightings] = useState<Sighting[]>([]);

  const loadSightings = useCallback(async () => {
    setSightings(await getSightings());
  }, []);

  useEffect(() => {
    loadSightings();
  }, [loadSightings]);

  return (
    <View style={styles.root} testID="hotspots-screen">
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="hotspots-back">
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Sightings</Text>
        <View style={{ width: 38 }} />
      </SafeAreaView>

      <ScrollView
        style={styles.list}
        contentContainerStyle={{ padding: spacing.lg, gap: 10, paddingBottom: 80 }}
      >
        <Text style={styles.listHeader}>
          Your Sightings ({sightings.length})
        </Text>

        {sightings.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="location-outline" size={36} color={colors.primary} />
            <Text style={styles.emptyTitle}>No sightings yet</Text>
            <Text style={styles.emptyText}>
              After identifying a bird, tap "Log Sighting" on the result page
              to pin it here.
            </Text>
          </View>
        ) : (
          sightings.map((s) => (
            <View key={s.id} style={styles.row} testID={`sighting-${s.id}`}>
              {s.image ? (
                <Image source={{ uri: s.image }} style={styles.rowImg} />
              ) : (
                <View style={[styles.rowImg, styles.rowImgPlaceholder]}>
                  <Ionicons name="location" size={20} color={colors.primary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {s.commonName}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {new Date(s.createdAt).toLocaleString()}
                  {'  ·  '}
                  {s.latitude.toFixed(3)}, {s.longitude.toFixed(3)}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  title: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700' },
  list: { flex: 1 },
  listHeader: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700' },
  empty: {
    alignItems: 'center',
    gap: 10,
    padding: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginTop: spacing.sm,
  },
  emptyTitle: { ...type.bodyL, color: colors.textPrimary, fontWeight: '700' },
  emptyText: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  rowImg: { width: 50, height: 50, borderRadius: 10, backgroundColor: colors.bgTertiary },
  rowImgPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  rowName: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '600' },
  rowMeta: { ...type.bodySm, color: colors.textTertiary },
});
