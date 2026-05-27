// API client for BirdLens backend
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export type IdentifyResult = {
  commonName: string;
  scientificName: string;
  confidence: number;
  alternatives: { commonName: string; scientificName?: string; confidence: number }[];
  shortDescription: string;
  habitat: string;
  diet: string;
  size: string;
  funFacts: string[];
  rangeSummary: string;
  conservationStatus: string;
  genus?: string;
  family?: string;
  order?: string;
  wingspan?: string;
  wingShape?: string;
  howToIdentify?: string;
  nestingBehavior?: string;
  migrationStatus?: string;
  /** "high" | "medium" | "low" | "uncertain" — populated for Perch Sound ID */
  tier?: 'high' | 'medium' | 'low' | 'uncertain';
  /** "perch_v2" | "gpt4o_spectrogram" — populated for Sound ID */
  source?: 'perch_v2' | 'gpt4o_spectrogram' | 'photo_vision';
};

export type XenoRecording = {
  id: string;
  species: string;
  common_name: string;
  location: string;
  country: string;
  quality: string;
  length: string;
  audio_url: string;
};

export type CatalogBird = {
  id: string;
  commonName: string;
  scientificName: string;
  category: string;
  image: string;
  shortDescription: string;
  habitat: string;
  diet: string;
  size: string;
  funFacts: string[];
  rangeSummary: string;
  conservationStatus: string;
  genus?: string;
  family?: string;
  order?: string;
  wingspan?: string;
  wingShape?: string;
  howToIdentify?: string;
  nestingBehavior?: string;
  migrationStatus?: string;
};

async function jsonFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function identifyPhoto(imageBase64: string, mimeType = 'image/jpeg'): Promise<IdentifyResult> {
  return jsonFetch<IdentifyResult>('/api/identify/photo', {
    method: 'POST',
    body: JSON.stringify({ image_base64: imageBase64, mime_type: mimeType }),
  });
}

export async function identifySound(spectrogramBase64: string): Promise<IdentifyResult> {
  return jsonFetch<IdentifyResult>('/api/identify/sound', {
    method: 'POST',
    body: JSON.stringify({ image_base64: spectrogramBase64 }),
  });
}

/* ---------- Perch 2.0 Sound ID ---------- */

export type PerchPrediction = {
  scientificName: string;
  ebirdCode: string;
  score: number;       // mean of softmax probs across windows
  peakScore: number;   // best single-window prob
};

export type PerchResponse = {
  ok: boolean;
  reason?: string;
  duration_s?: number;
  num_windows?: number;
  decode_ms?: number;
  inference_ms?: number;
  tier?: 'high' | 'medium' | 'low' | 'uncertain';
  results: PerchPrediction[];
  model?: string;
};

export async function identifySoundPerch(
  audioBase64: string,
  mimeType: string = 'audio/mp4',
  context?: { latitude?: number; longitude?: number; month?: string; topK?: number },
): Promise<PerchResponse> {
  return jsonFetch<PerchResponse>('/api/identify/sound-perch', {
    method: 'POST',
    body: JSON.stringify({
      audio_base64: audioBase64,
      mime_type: mimeType,
      latitude: context?.latitude,
      longitude: context?.longitude,
      month: context?.month,
      top_k: context?.topK ?? 5,
    }),
  });
}

/** Map a Perch response into our existing IdentifyResult shape using the
 * local species catalog (no extra round-trip needed). */
import { lookupByScientific } from './catalog';

const TIER_DESCRIPTIONS: Record<NonNullable<PerchResponse['tier']>, string> = {
  high: 'Confident match from Google Perch 2.0 — listening to the call directly.',
  medium: 'Best guess from Perch 2.0. The call is plausible but not crystal clear.',
  low: 'Unclear recording — these are the closest matches Perch could find.',
  uncertain: 'The audio is too quiet or noisy to identify confidently. Try again closer to the bird.',
};

export function perchToIdentifyResult(p: PerchResponse): IdentifyResult {
  if (!p.ok || !p.results?.length) {
    return {
      commonName: 'Unknown',
      scientificName: '',
      confidence: 0,
      alternatives: [],
      shortDescription:
        p.reason === 'audio_too_short'
          ? 'Recording too short to identify. Hold for at least 2-3 seconds.'
          : 'Could not identify the bird from this clip. Try again with a clearer recording.',
      habitat: '',
      diet: '',
      size: '',
      funFacts: [],
      rangeSummary: '',
      conservationStatus: '',
      tier: p.tier ?? 'uncertain',
      source: 'perch_v2',
    };
  }

  const top = p.results[0];
  const topSp = lookupByScientific(top.scientificName);
  const alts = p.results.slice(1).map((r) => {
    const sp = lookupByScientific(r.scientificName);
    return {
      commonName: sp?.c || r.scientificName,
      scientificName: r.scientificName,
      confidence: Math.round((r.peakScore || r.score) * 100),
    };
  });

  return {
    commonName: topSp?.c || top.scientificName,
    scientificName: top.scientificName,
    confidence: Math.round((top.peakScore || top.score) * 100),
    alternatives: alts,
    shortDescription: TIER_DESCRIPTIONS[p.tier ?? 'medium'],
    habitat: '',
    diet: '',
    size: '',
    funFacts: [],
    rangeSummary: '',
    conservationStatus: '',
    family: topSp?.f,
    order: topSp?.o,
    tier: p.tier,
    source: 'perch_v2',
  };
}

export async function chat(
  message: string,
  sessionId?: string,
  context?: {
    latitude?: number;
    longitude?: number;
    month?: string;
    recent_finds?: string[];
  },
) {
  return jsonFetch<{ session_id: string; reply: string }>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message, session_id: sessionId, ...(context || {}) }),
  });
}

export async function fetchXenoCanto(species: string, limit = 3) {
  const u = `/api/xenocanto?species=${encodeURIComponent(species)}&limit=${limit}`;
  return jsonFetch<{ recordings: XenoRecording[] }>(u);
}

export async function fetchCatalog() {
  return jsonFetch<{ birds: CatalogBird[] }>('/api/birds/catalog');
}

export async function fetchBird(id: string) {
  return jsonFetch<CatalogBird>(`/api/birds/${id}`);
}
