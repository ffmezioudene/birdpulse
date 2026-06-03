// Centralised foreground-location helper.
//
//   • Soft pre-ask first: a polite explainer Alert that improves grant rate.
//   • Then the real `Location.requestForegroundPermissionsAsync()`.
//   • Caches the user's last-known coordinates in AsyncStorage so we never
//     fall back to a hardcoded city like New York.
//   • A "picked location" override (city/country chosen manually by users
//     who declined permission) is supported through `setPickedLocation()`.
//
// All UI is centralised here so every screen that needs location (Birds
// Near You, Hotspots, range maps, eBird queries) uses the same flow.

import { Alert, Platform, Linking } from 'react-native';
import * as Location from 'expo-location';
import { storage } from '@/src/utils/storage';

const KEY_LAST_COORDS = 'birdpulse.location.last';
const KEY_PICKED = 'birdpulse.location.picked';
const KEY_EXPLAINER_SHOWN = 'birdpulse.location.explainer.shown';

export type Coords = { lat: number; lng: number; label?: string };

/** A short list of friendly fallbacks — used ONLY in the "pick a location"
 *  UI for users who declined permission. NOT silently chosen as a default. */
export const COMMON_LOCATIONS: Coords[] = [
  { lat: 25.276987, lng: 55.296249, label: 'Dubai, UAE' },
  { lat: 24.453884, lng: 54.377343, label: 'Abu Dhabi, UAE' },
  { lat: 51.5074, lng: -0.1278, label: 'London, UK' },
  { lat: 48.8566, lng: 2.3522, label: 'Paris, France' },
  { lat: 40.7128, lng: -74.006, label: 'New York, USA' },
  { lat: 37.7749, lng: -122.4194, label: 'San Francisco, USA' },
  { lat: 1.3521, lng: 103.8198, label: 'Singapore' },
  { lat: 35.6762, lng: 139.6503, label: 'Tokyo, Japan' },
  { lat: -33.8688, lng: 151.2093, label: 'Sydney, Australia' },
  { lat: -1.2921, lng: 36.8219, label: 'Nairobi, Kenya' },
];

/** Show a polite pre-ask explaining WHY we want location. Returns true if
 *  the user agreed to proceed to the system prompt. */
async function showSoftExplainer(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Find birds near you',
      'BirdPulse uses your location to show species you can spot in your area and to draw accurate range maps. Your location stays on this device and is never shared.',
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continue', style: 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/** Try to get a real coordinate from the device:
 *  1) honour any user-picked override
 *  2) ask the OS (with explainer if first time)
 *  3) return cached last-known coordinates
 *  4) return `null` — caller must show a "Pick a location" UI. NEVER a hardcoded city.
 */
async function readCachedCoords(): Promise<Coords | null> {
  const raw = await storage.getItem<string>(KEY_LAST_COORDS, '');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Coords;
  } catch {
    return null;
  }
}

async function readPickedCoords(): Promise<Coords | null> {
  const raw = await storage.getItem<string>(KEY_PICKED, '');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Coords;
  } catch {
    return null;
  }
}

export async function getUserLocation(opts: { interactive?: boolean } = {}): Promise<Coords | null> {
  // 1. Manual override wins.
  const picked = await readPickedCoords();
  if (picked) return picked;

  try {
    const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
    if (status === 'granted') {
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const coords: Coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        storage.setItem(KEY_LAST_COORDS, JSON.stringify(coords));
        return coords;
      } catch {
        return await readCachedCoords();
      }
    }

    // Permission not yet granted. Only prompt when the call site says it's
    // OK to interrupt the user (e.g. the user just tapped "Birds Near You").
    if (status === 'undetermined' && opts.interactive) {
      const shown = await storage.getItem<boolean>(KEY_EXPLAINER_SHOWN, false);
      if (!shown) {
        const ok = await showSoftExplainer();
        await storage.setItem(KEY_EXPLAINER_SHOWN, true);
        if (!ok) return await readCachedCoords();
      }
      const sysResult = await Location.requestForegroundPermissionsAsync();
      if (sysResult.status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const coords: Coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        storage.setItem(KEY_LAST_COORDS, JSON.stringify(coords));
        return coords;
      }
    }

    // Denied / permanently denied — offer Settings deep-link, but only when interactive.
    if (status === 'denied' && opts.interactive && !canAskAgain) {
      Alert.alert(
        'Location is off',
        'Allow BirdPulse access to your location in Settings to see birds near you.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
        ],
      );
    }
  } catch {}

  return await readCachedCoords();
}

/** Manually set the location used by every map/region query. */
export async function setPickedLocation(coords: Coords): Promise<void> {
  await storage.setItem(KEY_PICKED, JSON.stringify(coords));
  await storage.setItem(KEY_LAST_COORDS, JSON.stringify(coords));
}

/** Clear the manual override so the device's GPS takes over again. */
export async function clearPickedLocation(): Promise<void> {
  await storage.setItem(KEY_PICKED, '');
}

/** Fast async permission status read (no UI). */
export async function getLocationPermissionStatus(): Promise<
  'granted' | 'denied' | 'undetermined' | 'unknown'
> {
  try {
    const r = await Location.getForegroundPermissionsAsync();
    return r.status;
  } catch {
    return 'unknown';
  }
}

// Re-export so call sites don't need to import expo-location directly.
export { Location, Platform };
