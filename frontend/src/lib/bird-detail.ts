// Hybrid bird-detail loader — instant first paint + progressive enrichment.
//
//   1. Precached species → return rich content immediately, no network.
//   2. Otherwise: try AsyncStorage cache; if missing, fan out:
//        a) Wikipedia REST (via backend proxy) for description + image
//        b) Backend AI enrichment for "How to Identify / Diet / Nesting / …"
//   3. Persist the assembled detail to AsyncStorage so the next open is instant.
//
import { storage } from '@/src/utils/storage';
import { getSpecies, getPrecachedDetail, type Species } from './catalog';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const VERSION = 'v1';

const cacheKey = (id: string) => `bird:detail:${VERSION}:${id}`;
const aiCacheKey = (id: string) => `bird:ai:${VERSION}:${id}`;

export type RichBirdDetail = {
  id: string;
  commonName: string;
  scientificName: string;
  family: string;
  familyEnglish?: string;
  order: string;
  // Wikipedia
  summary: string;
  habitat?: string;
  thumb?: string;
  image?: string;
  wikiUrl?: string;
  // AI enrichment
  howToIdentify?: string;
  size?: string;
  wingspan?: string;
  wingShape?: string;
  diet?: string;
  nestingBehavior?: string;
  migrationStatus?: string;
  rangeSummary?: string;
  conservationStatus?: string;
  funFacts?: string[];
  // Meta
  source: 'precached' | 'cache' | 'live' | 'partial';
  fetchedAt: number;
};

type WikiResult = {
  title?: string;
  summary?: string;
  thumb?: string;
  image?: string;
  wikiUrl?: string;
};

type AiEnrichment = Partial<
  Pick<
    RichBirdDetail,
    | 'howToIdentify' | 'size' | 'wingspan' | 'wingShape' | 'diet'
    | 'habitat' | 'nestingBehavior' | 'migrationStatus' | 'rangeSummary'
    | 'conservationStatus' | 'funFacts'
  >
> & { shortDescription?: string };

function buildBase(species: Species): RichBirdDetail {
  return {
    id: species.id,
    commonName: species.c,
    scientificName: species.s,
    family: species.f,
    familyEnglish: species.fe,
    order: species.o,
    summary: '',
    source: 'partial',
    fetchedAt: Date.now(),
  };
}

async function fetchWiki(species: Species): Promise<WikiResult> {
  const url = `${BASE}/api/wiki/summary?title=${encodeURIComponent(species.s + '|' + species.c)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`wiki ${r.status}`);
  return r.json();
}

async function fetchAi(species: Species): Promise<AiEnrichment> {
  const url = `${BASE}/api/birds/enrich`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      common_name: species.c,
      scientific_name: species.s,
      family: species.f,
      order: species.o,
    }),
  });
  if (!r.ok) throw new Error(`enrich ${r.status}`);
  return r.json();
}

/** Synchronous "instant" first paint — uses only on-device data. */
export function getInstantDetail(id: string): RichBirdDetail | null {
  const species = getSpecies(id);
  if (!species) return null;
  const base = buildBase(species);
  const pc = getPrecachedDetail(id);
  if (pc) {
    base.summary = pc.summary;
    base.thumb = pc.thumb;
    base.image = pc.image;
    base.wikiUrl = pc.wikiUrl;
    base.source = 'precached';
  }
  return base;
}

/**
 * Live loader: enriches the instant detail with Wikipedia + AI in parallel
 * and persists the result. Caller passes an `onUpdate` callback so the UI
 * can re-render as each piece lands.
 */
export async function loadFullDetail(
  id: string,
  onUpdate: (d: RichBirdDetail) => void,
): Promise<RichBirdDetail | null> {
  const species = getSpecies(id);
  if (!species) return null;

  // 1) Persisted cache fast-path.
  const cached = (await storage.getItem(cacheKey(id) as any, null as any)) as RichBirdDetail | null;
  if (
    cached &&
    cached.fetchedAt &&
    Date.now() - cached.fetchedAt < CACHE_TTL_MS &&
    (cached.howToIdentify || cached.funFacts?.length)
  ) {
    cached.source = 'cache';
    onUpdate(cached);
    return cached;
  }

  // 2) Build base from precache (if any) and push it for instant paint.
  const detail: RichBirdDetail = getInstantDetail(id) ?? buildBase(species);
  onUpdate(detail);

  // 3) Kick Wikipedia + AI in parallel.
  const promises: Promise<void>[] = [];

  if (!detail.summary || !detail.image) {
    promises.push(
      fetchWiki(species).then((w) => {
        if (w.summary && !detail.summary) detail.summary = w.summary;
        if (w.thumb && !detail.thumb) detail.thumb = w.thumb;
        if (w.image && !detail.image) detail.image = w.image;
        if (w.wikiUrl && !detail.wikiUrl) detail.wikiUrl = w.wikiUrl;
        onUpdate({ ...detail });
      }).catch(() => undefined),
    );
  }

  promises.push(
    (async () => {
      const aiCached = (await storage.getItem(aiCacheKey(id) as any, null as any)) as AiEnrichment | null;
      let ai: AiEnrichment | null = aiCached || null;
      if (!ai) {
        try {
          ai = await fetchAi(species);
          if (ai) await (storage.setItem as any)(aiCacheKey(id), ai);
        } catch {
          ai = null;
        }
      }
      if (ai) {
        if (!detail.summary && ai.shortDescription) detail.summary = ai.shortDescription;
        detail.howToIdentify ||= ai.howToIdentify;
        detail.size ||= ai.size;
        detail.wingspan ||= ai.wingspan;
        detail.wingShape ||= ai.wingShape;
        detail.diet ||= ai.diet;
        detail.habitat ||= ai.habitat;
        detail.nestingBehavior ||= ai.nestingBehavior;
        detail.migrationStatus ||= ai.migrationStatus;
        detail.rangeSummary ||= ai.rangeSummary;
        detail.conservationStatus ||= ai.conservationStatus;
        if (ai.funFacts?.length) detail.funFacts = ai.funFacts;
        onUpdate({ ...detail });
      }
    })(),
  );

  await Promise.allSettled(promises);

  detail.source = detail.howToIdentify ? 'live' : 'partial';
  detail.fetchedAt = Date.now();
  await (storage.setItem as any)(cacheKey(id), detail);
  onUpdate({ ...detail });
  return detail;
}

export async function clearDetailCache(id: string) {
  await storage.removeItem(cacheKey(id));
  await storage.removeItem(aiCacheKey(id));
}
