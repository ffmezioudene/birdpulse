// BirdPulse catalog — wraps the 11,145-species index for instant in-memory search
// and category filtering. Loaded lazily on first use, then kept in memory.
import speciesIndex from '@/src/data/species-index.json';
import precachedBirds from '@/src/data/precached-birds.json';

export type Species = {
  /** url-safe slug, e.g. "northern-cardinal" */
  id: string;
  /** Common name */
  c: string;
  /** Scientific name */
  s: string;
  /** Family (Latin) */
  f: string;
  /** Family English (e.g. "Cardinals & Allies") — may be empty */
  fe?: string;
  /** Order, e.g. "Passeriformes" */
  o: string;
  /** eBird species group, e.g. "Hummingbirds" */
  g?: string;
};

export type PrecachedDetail = {
  summary: string;
  thumb: string;
  image: string;
  wikiTitle: string;
  wikiUrl: string;
};

const INDEX = speciesIndex as Species[];
const PRECACHE = precachedBirds as Record<string, PrecachedDetail>;

const byId = new Map<string, Species>(INDEX.map((s) => [s.id, s]));
const bySci = new Map<string, Species>(INDEX.map((s) => [s.s.toLowerCase(), s]));
const byCommon = new Map<string, Species>(INDEX.map((s) => [s.c.toLowerCase(), s]));

export function getSpecies(id: string): Species | undefined {
  return byId.get(id);
}

export function lookupByScientific(name: string): Species | undefined {
  return bySci.get(name.trim().toLowerCase());
}

export function lookupByCommon(name: string): Species | undefined {
  return byCommon.get(name.trim().toLowerCase());
}

export function getPrecachedDetail(id: string): PrecachedDetail | undefined {
  return PRECACHE[id];
}

export function hasPrecachedDetail(id: string): boolean {
  return id in PRECACHE;
}

export function allSpecies(): Species[] {
  return INDEX;
}

export function indexSize() {
  return INDEX.length;
}

export function precacheSize() {
  return Object.keys(PRECACHE).length;
}

// ---------------------------- SEARCH ----------------------------

/**
 * Instant fuzzy search over the local 11k-species index.
 * Matches on common name + scientific name + family.
 * Prefix matches score higher than substring matches.
 */
export function searchSpecies(query: string, limit = 60): Species[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: { species: Species; score: number }[] = [];
  for (let i = 0; i < INDEX.length; i++) {
    const s = INDEX[i];
    const c = s.c.toLowerCase();
    const sc = s.s.toLowerCase();
    const f = s.f.toLowerCase();
    const fe = (s.fe || '').toLowerCase();
    const g = (s.g || '').toLowerCase();

    let score = 0;
    if (c.startsWith(q)) score = 100;
    else if (sc.startsWith(q)) score = 95;
    else if (c.includes(q)) score = 80;
    else if (sc.includes(q)) score = 70;
    else if (g.startsWith(q)) score = 55;
    else if (fe.includes(q) || f.includes(q)) score = 45;

    if (score > 0) {
      // Prefer precached and shorter names slightly.
      if (PRECACHE[s.id]) score += 5;
      score -= Math.min(8, c.length / 10);
      results.push({ species: s, score });
      if (results.length > limit * 4) {
        // Avoid keeping every match in memory while filtering early.
        results.sort((a, b) => b.score - a.score);
        results.length = limit * 2;
      }
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit).map((r) => r.species);
}

// ---------------------------- CATEGORIES -----------------------------
//
// Top-level "categories" surfaced in the UI. Each one maps to one or more
// eBird species_group or order/family filters.

export type Category = {
  id: string;
  title: string;
  /** Heuristic match against species.g (group) or order/family. */
  match: (s: Species) => boolean;
  image: string;
};

export const CATEGORIES: Category[] = [
  {
    id: 'songbirds',
    title: 'Songbirds',
    image: 'https://images.unsplash.com/photo-1612095395498-5e2f3ae4d9a9?crop=entropy&cs=srgb&fm=jpg&q=85',
    match: (s) => s.o === 'Passeriformes',
  },
  {
    id: 'birds-of-prey',
    title: 'Birds of Prey',
    image: 'https://images.pexels.com/photos/33349105/pexels-photo-33349105.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
    match: (s) =>
      s.o === 'Accipitriformes' || s.o === 'Falconiformes' || s.o === 'Strigiformes' || s.o === 'Cathartiformes',
  },
  {
    id: 'hummingbirds',
    title: 'Hummingbirds',
    image: 'https://images.unsplash.com/photo-1596386447478-d71f5f8fea87?crop=entropy&cs=srgb&fm=jpg&q=85',
    match: (s) => s.f === 'Trochilidae',
  },
  {
    id: 'waterfowl',
    title: 'Waterfowl',
    image: 'https://images.unsplash.com/photo-1715560016731-65dd8dba2819?crop=entropy&cs=srgb&fm=jpg&q=85',
    match: (s) => s.o === 'Anseriformes',
  },
  {
    id: 'shorebirds',
    title: 'Shorebirds',
    image: 'https://images.unsplash.com/photo-1520638023360-6def43369781?crop=entropy&cs=srgb&fm=jpg&q=85',
    match: (s) => s.o === 'Charadriiformes',
  },
  {
    id: 'owls',
    title: 'Owls',
    image: 'https://images.unsplash.com/photo-1744959055063-b217124d3429?crop=entropy&cs=srgb&fm=jpg&q=85',
    match: (s) => s.o === 'Strigiformes',
  },
  {
    id: 'parrots',
    title: 'Parrots & Allies',
    image: 'https://images.unsplash.com/photo-1606214174585-fe31582cd5b8?crop=entropy&cs=srgb&fm=jpg&q=85',
    match: (s) => s.o === 'Psittaciformes',
  },
  {
    id: 'woodpeckers',
    title: 'Woodpeckers',
    image: 'https://images.unsplash.com/photo-1604326531570-2689ea7ec73f?crop=entropy&cs=srgb&fm=jpg&q=85',
    match: (s) => s.f === 'Picidae',
  },
];

export function categoryById(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

export function speciesInCategory(catId: string, limit = 200): Species[] {
  const cat = categoryById(catId);
  if (!cat) return [];
  const out: Species[] = [];
  for (let i = 0; i < INDEX.length && out.length < limit; i++) {
    const s = INDEX[i];
    if (cat.match(s)) out.push(s);
  }
  // Surface precached members first so users see rich content right away.
  out.sort((a, b) => {
    const ap = PRECACHE[a.id] ? 1 : 0;
    const bp = PRECACHE[b.id] ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return a.c.localeCompare(b.c);
  });
  return out;
}

// ---------------------------- POPULAR --------------------------------
//
// Curated "Popular Birds" — pulled from the precached set so they always
// open instantly with rich content.

const POPULAR_IDS = [
  'northern-cardinal', 'blue-jay', 'american-robin', 'bald-eagle', 'mallard',
  'ruby-throated-hummingbird', 'great-horned-owl', 'black-capped-chickadee',
  'house-sparrow', 'european-starling', 'mourning-dove', 'red-tailed-hawk',
  'barn-owl', 'snowy-owl', 'pileated-woodpeckers', 'pileated-woodpecker',
  'american-goldfinch', 'european-robin', 'common-blackbird', 'rock-pigeon',
  'osprey', 'cedar-waxwing', 'wild-turkey', 'peregrine-falcon',
];

export function popularSpecies(limit = 12): Species[] {
  const out: Species[] = [];
  for (const id of POPULAR_IDS) {
    const s = byId.get(id);
    if (s && PRECACHE[id]) out.push(s);
    if (out.length >= limit) break;
  }
  // Fall back to any precached entry until we hit `limit`.
  if (out.length < limit) {
    for (const id of Object.keys(PRECACHE)) {
      if (out.find((x) => x.id === id)) continue;
      const s = byId.get(id);
      if (s) out.push(s);
      if (out.length >= limit) break;
    }
  }
  return out;
}
