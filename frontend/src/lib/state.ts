// Local app state utilities (free counters, history, favorites, sightings, collections, onboarding/paywall flags)
import { storage } from '@/src/utils/storage';
import {
  FREE_IDENTIFICATIONS_INITIAL as DEV_FREE_IDS,
  FREE_CHATS_INITIAL as DEV_FREE_CHATS,
  getDevProUnlocked,
} from '@/src/lib/devmode';

export const KEYS = {
  onboardingDone: 'birdlens.onboarding.done',
  paywallSeen: 'birdlens.paywall.seen',
  // freemium v2 — separate ID & chat counters (never shown to user)
  freeIdsRemaining: 'birdlens.free.ids',
  freeChatsRemaining: 'birdlens.free.chats',
  // legacy v1 counter — read only, migrated on first launch then ignored
  freeUsesRemainingLegacy: 'birdlens.free.uses',
  isPro: 'birdlens.is.pro',
  history: 'birdlens.history',
  favorites: 'birdlens.favorites',
  sightings: 'birdlens.sightings',
  collections: 'birdlens.collections',
  chatSession: 'birdlens.chat.session',
  hasRated: 'birdlens.has.rated',
  // Review-prompt v1: cumulative count of successful IDs across all time.
  // The native StoreKit review sheet is shown ONCE, after the 2nd success
  // (lifetime), and `hasRated` is flipped to true so we never ask again.
  successfulIdCount: 'birdlens.success.id.count',
};

/* ---------- Review-prompt helpers (Change 2) ---------- */

/** Increment the lifetime successful-identification counter and return
 *  the new value. Safe to call from any thread; storage is async. */
export async function recordSuccessfulIdentification(): Promise<number> {
  const cur = (await storage.getItem<number>(KEYS.successfulIdCount, 0)) ?? 0;
  const next = cur + 1;
  await storage.setItem(KEYS.successfulIdCount, next);
  return next;
}

/** Decide if we should request a native review prompt right now. True only
 *  on exactly the 2nd successful ID, and only if we haven't asked before. */
export async function shouldRequestReview(count: number): Promise<boolean> {
  if (count !== 2) return false;
  const already = await storage.getItem<boolean>(KEYS.hasRated, false);
  return !already;
}

/** Mark that we've asked for a review so we never ask again. */
export async function markReviewRequested(): Promise<void> {
  await storage.setItem(KEYS.hasRated, true);
}

export const FREE_IDENTIFICATIONS_INITIAL = DEV_FREE_IDS;
export const FREE_CHATS_INITIAL = DEV_FREE_CHATS;

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

/**
 * One-time migration from legacy single `freeUsesRemaining` counter to the
 * split (IDs + chats) counters. Runs idempotently on every helper call —
 * once the legacy key is cleared, this is a no-op.
 */
async function migrateLegacyCounter(): Promise<void> {
  const legacy = await storage.getItem<number>(KEYS.freeUsesRemainingLegacy, -1);
  if (legacy === undefined || legacy === null || legacy === -1) return;
  // Erase the legacy key — we don't use it any more.
  await storage.setItem(KEYS.freeUsesRemainingLegacy, -1);
}

export async function getFreeIdentifications(): Promise<number> {
  await migrateLegacyCounter();
  const v = await storage.getItem<number>(KEYS.freeIdsRemaining, FREE_IDENTIFICATIONS_INITIAL);
  return v ?? FREE_IDENTIFICATIONS_INITIAL;
}

export async function consumeFreeIdentification(): Promise<number> {
  const cur = await getFreeIdentifications();
  const next = Math.max(0, cur - 1);
  await storage.setItem(KEYS.freeIdsRemaining, next);
  return next;
}

export async function getFreeChats(): Promise<number> {
  await migrateLegacyCounter();
  const v = await storage.getItem<number>(KEYS.freeChatsRemaining, FREE_CHATS_INITIAL);
  return v ?? FREE_CHATS_INITIAL;
}

export async function consumeFreeChat(): Promise<number> {
  const cur = await getFreeChats();
  const next = Math.max(0, cur - 1);
  await storage.setItem(KEYS.freeChatsRemaining, next);
  return next;
}

// --- Back-compat shims so existing call-sites keep working ---------------
// The identify flow used `getFreeUses` / `consumeFreeUse` referring to IDs.
export const getFreeUses = getFreeIdentifications;
export const consumeFreeUse = consumeFreeIdentification;

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

/** Reset both free-counter buckets back to their initial values. */
export async function resetFreeLimits(): Promise<{ ids: number; chats: number }> {
  await storage.setItem(KEYS.freeIdsRemaining, FREE_IDENTIFICATIONS_INITIAL);
  await storage.setItem(KEYS.freeChatsRemaining, FREE_CHATS_INITIAL);
  return { ids: FREE_IDENTIFICATIONS_INITIAL, chats: FREE_CHATS_INITIAL };
}
// Back-compat alias
export const resetFreeUses = async () => {
  const r = await resetFreeLimits();
  return r.ids;
};

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
