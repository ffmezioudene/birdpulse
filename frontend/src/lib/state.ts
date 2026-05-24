// Local app state utilities (free uses, history, favorites, sightings, collections, onboarding/paywall flags)
import { storage } from '@/src/utils/storage';

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

export const FREE_USES_INITIAL = 2;

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

export type Collection = {
  id: string;
  name: string;
  birdIds: string[];
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

export async function setPro(v: boolean): Promise<void> {
  await storage.setItem(KEYS.isPro, v);
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
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveCollections(list: Collection[]): Promise<void> {
  await storage.setItem('birdlens.collections.json', JSON.stringify(list));
}
