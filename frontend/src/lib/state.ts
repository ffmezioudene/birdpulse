// Local app state utilities (free uses, history, favorites, sightings, collections, onboarding/paywall flags)
import { storage } from '@/src/utils/storage';
import { FREE_USES_INITIAL as DEV_FREE_USES_INITIAL, getDevProUnlocked } from '@/src/lib/devmode';

export const KEYS = {
  onboardingDone: 'birdlens.onboarding.done',
  paywallSeen: 'birdlens.paywall.seen',
  freeUsesRemaining: 'birdlens.free.uses',
  isPro: 'birdlens.is.pro',
  history: 'birdlens.history',
  favorites: 'birdlens.favorites',
  sightings: 'birdlens.sightings',
  collections: 'birdlens.collections',
  chatSession: 'birdlens.chat.session',
  hasRated: 'birdlens.has.rated',
};

export const FREE_USES_INITIAL = DEV_FREE_USES_INITIAL;

export type HistoryItem = {
  id: string;
  type: 'photo' | 'sound';
  commonName: string;
  scientificName: string;
  confidence: number;
  image?: string;
  createdAt: string;
  result?: any;
};

export type Sighting = {
  id: string;
  birdId?: string;
  commonName: string;
  image?: string;
  latitude: number;
  longitude: number;
  createdAt: string;
};

export type CollectionBird = {
  id: string;                  // stable id (SEED slug OR sci-name slug)
  commonName: string;
  scientificName: string;
  image?: string;              // url or data: uri — snapshot at save time
  addedAt: string;
};

export type Collection = {
  id: string;
  name: string;
  /**
   * v1 → v2 migration: we used to store just bird IDs. The reader below
   * silently upgrades old shape to the new `birds: CollectionBird[]`.
   * Old `birdIds` field is kept readable for backward-compat.
   */
  birds: CollectionBird[];
  birdIds?: string[];          // legacy — no longer written, only read
  createdAt: string;
};

export async function getFreeUses(): Promise<number> {
  const v = await storage.getItem<number>(KEYS.freeUsesRemaining, FREE_USES_INITIAL);
  return v ?? FREE_USES_INITIAL;
}

export async function consumeFreeUse(): Promise<number> {
  const cur = await getFreeUses();
  const next = Math.max(0, cur - 1);
  await storage.setItem(KEYS.freeUsesRemaining, next);
  return next;
}

export async function isPro(): Promise<boolean> {
  return !!(await storage.getItem<boolean>(KEYS.isPro, false));
}

/** Effective pro = real pro OR dev "Unlock Pro" toggle. Use this everywhere
 *  to decide if the user can bypass the paywall. */
export async function isProEffective(): Promise<boolean> {
  if (await isPro()) return true;
  if (await getDevProUnlocked()) return true;
  return false;
}

export async function setPro(v: boolean): Promise<void> {
  await storage.setItem(KEYS.isPro, v);
}

/** Reset the free-use counter back to the initial value. */
export async function resetFreeUses(): Promise<number> {
  await storage.setItem(KEYS.freeUsesRemaining, FREE_USES_INITIAL);
  return FREE_USES_INITIAL;
}

export async function getHistory(): Promise<HistoryItem[]> {
  const raw = await storage.getItem<string>('birdlens.history.json', '');
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function addHistory(item: HistoryItem): Promise<void> {
  const list = await getHistory();
  list.unshift(item);
  await storage.setItem('birdlens.history.json', JSON.stringify(list.slice(0, 200)));
}

export async function getFavorites(): Promise<string[]> {
  const raw = await storage.getItem<string>('birdlens.favorites.json', '');
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function toggleFavorite(birdId: string): Promise<string[]> {
  const list = await getFavorites();
  const idx = list.indexOf(birdId);
  if (idx >= 0) list.splice(idx, 1);
  else list.unshift(birdId);
  await storage.setItem('birdlens.favorites.json', JSON.stringify(list));
  return list;
}

export async function getSightings(): Promise<Sighting[]> {
  const raw = await storage.getItem<string>('birdlens.sightings.json', '');
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function addSighting(s: Sighting): Promise<void> {
  const list = await getSightings();
  list.unshift(s);
  await storage.setItem('birdlens.sightings.json', JSON.stringify(list.slice(0, 500)));
}

export async function getCollections(): Promise<Collection[]> {
  const raw = await storage.getItem<string>('birdlens.collections.json', '');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Collection[];
    // Forward-compat / legacy migration: older versions stored only `birdIds`.
    // Rewrap so the caller always sees the new `birds` field.
    return parsed.map((c) => ({
      ...c,
      birds: Array.isArray(c.birds)
        ? c.birds
        : (c.birdIds || []).map((id) => ({
            id,
            commonName: id,
            scientificName: '',
            addedAt: c.createdAt,
          })),
    }));
  } catch {
    return [];
  }
}

export async function saveCollections(list: Collection[]): Promise<void> {
  // Strip legacy `birdIds` on write — `birds` is the source of truth now.
  const stripped = list.map(({ birdIds: _legacy, ...c }) => c);
  await storage.setItem('birdlens.collections.json', JSON.stringify(stripped));
}

/** Slug from a scientific name: "Erithacus rubecula" → "erithacus-rubecula".
 *  Used as the stable bird ID for non-SEED species (most of them). */
export function slugFromScientific(sci: string): string {
  return (sci || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export async function createCollection(name: string): Promise<Collection> {
  const list = await getCollections();
  const next: Collection = {
    id: `c-${Date.now()}`,
    name: name.trim() || `My Collection ${list.length + 1}`,
    birds: [],
    createdAt: new Date().toISOString(),
  };
  await saveCollections([next, ...list]);
  return next;
}

export async function renameCollection(id: string, name: string): Promise<void> {
  const list = await getCollections();
  const next = list.map((c) => (c.id === id ? { ...c, name: name.trim() || c.name } : c));
  await saveCollections(next);
}

export async function deleteCollection(id: string): Promise<void> {
  const list = await getCollections();
  await saveCollections(list.filter((c) => c.id !== id));
}

/** Add a bird snapshot to one of the user's collections. Idempotent — if
 *  the bird id is already in that collection, this is a no-op. */
export async function addBirdToCollection(
  collectionId: string,
  bird: Omit<CollectionBird, 'addedAt'>,
): Promise<void> {
  const list = await getCollections();
  const next = list.map((c) => {
    if (c.id !== collectionId) return c;
    if (c.birds.some((b) => b.id === bird.id)) return c;
    return {
      ...c,
      birds: [{ ...bird, addedAt: new Date().toISOString() }, ...c.birds],
    };
  });
  await saveCollections(next);
}

export async function removeBirdFromCollection(collectionId: string, birdId: string): Promise<void> {
  const list = await getCollections();
  const next = list.map((c) =>
    c.id === collectionId ? { ...c, birds: c.birds.filter((b) => b.id !== birdId) } : c,
  );
  await saveCollections(next);
}
