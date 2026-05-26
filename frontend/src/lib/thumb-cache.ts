// On-demand thumbnail cache for the 11k-species catalog.
//
// Three layers, in order of precedence:
//   1) Pre-cached birds (already bundled with the app — instant, offline).
//   2) In-memory + AsyncStorage URL cache. Persisted so repeat opens are free.
//   3) Lazy batch fetch from `/api/birds/thumbs` (Wikipedia MediaWiki API,
//      40 species per request) for whatever's visible on screen.
//
// Components use the `useThumb` hook, which:
//   • returns an instant URL when already known
//   • queues the species into a debounced batch otherwise
//   • re-renders the row when the batch resolves
import { useEffect, useState } from 'react';
import { storage } from '@/src/utils/storage';
import { getPrecachedDetail, type Species } from './catalog';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const STORAGE_KEY = 'thumbs:v1';
const BATCH_SIZE = 40;
const BATCH_FLUSH_MS = 80;
const MAX_CACHE_ENTRIES = 4000; // bound disk usage

// Sentinel for "we looked this up and there genuinely is no image".
const NO_IMAGE = '__none__';

type Status = 'unknown' | 'loading' | 'ready' | 'none';

const memory = new Map<string, string>(); // id -> url or NO_IMAGE
const queued = new Map<string, Species>(); // id -> species awaiting batch
const listeners = new Map<string, Set<() => void>>(); // id -> subscribers
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let hydrated = false;
let hydrationPromise: Promise<void> | null = null;

function notify(id: string) {
  const set = listeners.get(id);
  if (set) set.forEach((fn) => fn());
}

async function hydrate() {
  if (hydrated) return;
  if (!hydrationPromise) {
    hydrationPromise = (async () => {
      try {
        const raw = (await storage.getItem(STORAGE_KEY as any, '' as any)) as
          | Record<string, string>
          | string
          | null;
        if (raw && typeof raw === 'object') {
          for (const [k, v] of Object.entries(raw)) {
            if (typeof v === 'string') memory.set(k, v);
          }
        }
      } catch {
        // Storage is best-effort.
      }
      hydrated = true;
    })();
  }
  return hydrationPromise;
}

async function persist() {
  // Snapshot only most-recent entries to bound storage size.
  const entries = Array.from(memory.entries()).slice(-MAX_CACHE_ENTRIES);
  const obj: Record<string, string> = Object.fromEntries(entries);
  try {
    await (storage.setItem as any)(STORAGE_KEY, obj);
  } catch {
    // best-effort
  }
}

async function flush() {
  flushTimer = null;
  if (queued.size === 0) return;
  // Drain the queue into batches of BATCH_SIZE
  const items = Array.from(queued.values());
  queued.clear();
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    // Fire and forget — each batch updates memory and notifies.
    void runBatch(chunk);
  }
}

async function runBatch(chunk: Species[]) {
  const payload = chunk.map((s) => ({ id: s.id, sci: s.s, common: s.c }));
  try {
    const r = await fetch(`${BASE}/api/birds/thumbs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: payload }),
    });
    if (!r.ok) throw new Error(`thumbs ${r.status}`);
    const map = (await r.json()) as Record<string, string | null>;
    for (const s of chunk) {
      const v = map[s.id];
      memory.set(s.id, v ? v : NO_IMAGE);
      notify(s.id);
    }
    void persist();
  } catch {
    // On failure, leave the entries unknown so future scrolls can retry.
    for (const s of chunk) {
      const cur = memory.get(s.id);
      if (cur === undefined) {
        // do nothing — keep unknown so we try again later
      }
    }
  }
}

function enqueue(species: Species) {
  if (queued.has(species.id)) return;
  queued.set(species.id, species);
  if (!flushTimer) flushTimer = setTimeout(flush, BATCH_FLUSH_MS);
}

/** Returns whatever we have right now (or undefined for "fire a fetch please"). */
export function getThumbSync(species: Species): { url?: string; status: Status } {
  // Precache hit — always best.
  const pre = getPrecachedDetail(species.id);
  if (pre?.thumb) return { url: pre.thumb, status: 'ready' };

  const cached = memory.get(species.id);
  if (cached === NO_IMAGE) return { status: 'none' };
  if (cached) return { url: cached, status: 'ready' };
  return { status: 'unknown' };
}

/** Subscribe to thumbnail updates for one species. Triggers a lazy fetch. */
export function useThumb(species: Species | null | undefined): {
  url?: string;
  status: Status;
} {
  const [, force] = useState(0);
  const [state, setState] = useState<{ url?: string; status: Status }>(() =>
    species ? getThumbSync(species) : { status: 'unknown' },
  );

  useEffect(() => {
    if (!species) return;
    let active = true;

    void hydrate().then(() => {
      if (!active) return;
      const cur = getThumbSync(species);
      setState(cur);
      if (cur.status === 'unknown') {
        // Subscribe + enqueue for batch fetch.
        let set = listeners.get(species.id);
        if (!set) {
          set = new Set();
          listeners.set(species.id, set);
        }
        const fn = () => {
          if (!active) return;
          setState(getThumbSync(species));
          force((n) => n + 1);
        };
        set.add(fn);
        // mark "loading" optimistically
        setState({ status: 'loading' });
        enqueue(species);

        return () => {
          set?.delete(fn);
          active = false;
        };
      }
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [species?.id]);

  return state;
}

/** Pre-warm the cache for a list of species (call from list mounts). */
export function primeThumbs(species: Species[]) {
  void hydrate().then(() => {
    for (const s of species) {
      const cur = getThumbSync(s);
      if (cur.status === 'unknown') enqueue(s);
    }
  });
}

export async function clearThumbCache() {
  memory.clear();
  await storage.removeItem(STORAGE_KEY);
}
