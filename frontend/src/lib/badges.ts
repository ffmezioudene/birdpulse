// Badges + streaks logic, all computed from local history + sightings.
import { HistoryItem, Sighting } from './state';

export type Badge = {
  id: string;
  title: string;
  description: string;
  icon: string;          // Ionicons name
  earned: boolean;
};

export function uniqueSpecies(history: HistoryItem[]): string[] {
  const set = new Set<string>();
  history.forEach((h) => {
    if (h.commonName && h.commonName.toLowerCase() !== 'unknown') set.add(h.commonName);
  });
  return [...set];
}

export function currentStreakDays(history: HistoryItem[]): number {
  if (history.length === 0) return 0;
  const dayKeys = new Set(history.map((h) => new Date(h.createdAt).toISOString().slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const k = cursor.toISOString().slice(0, 10);
    if (dayKeys.has(k)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return streak;
}

export function computeBadges(history: HistoryItem[], sightings: Sighting[]): Badge[] {
  const species = uniqueSpecies(history);
  const dawn = history.some((h) => new Date(h.createdAt).getHours() < 7);
  const migration = history.some((h) =>
    (h.result?.migrationStatus || '').toLowerCase().includes('migrant') ||
    (h.result?.migrationStatus || '').toLowerCase().includes('migratory')
  );
  // "Backyard regular" — 3+ sightings within ~1km of the first
  let backyard = false;
  if (sightings.length >= 3) {
    const first = sightings[sightings.length - 1];
    const close = sightings.filter(
      (s) => Math.abs(s.latitude - first.latitude) < 0.01 && Math.abs(s.longitude - first.longitude) < 0.01
    );
    backyard = close.length >= 3;
  }

  return [
    { id: 'first-find', title: 'First Find', description: 'Your first identification', icon: 'ribbon-outline', earned: history.length >= 1 },
    { id: 'five-species', title: '5 Species', description: 'Five unique birds identified', icon: 'leaf-outline', earned: species.length >= 5 },
    { id: 'ten-species', title: '10 Species', description: 'Double digits — true birder', icon: 'medal-outline', earned: species.length >= 10 },
    { id: 'dawn-chorus', title: 'Dawn Chorus', description: 'Identified a bird before 7am', icon: 'sunny-outline', earned: dawn },
    { id: 'migration-watcher', title: 'Migration Watcher', description: 'Logged a migrating species', icon: 'navigate-outline', earned: migration },
    { id: 'backyard-regular', title: 'Backyard Regular', description: 'Three sightings in the same spot', icon: 'home-outline', earned: backyard },
    { id: 'week-streak', title: 'Week Streak', description: 'Identify on 7 consecutive days', icon: 'flame-outline', earned: currentStreakDays(history) >= 7 },
  ];
}
