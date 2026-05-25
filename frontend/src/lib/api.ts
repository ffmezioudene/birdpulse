// API client for BirdLens backend
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export type IdentifyResult = {
  commonName: string;
  scientificName: string;
  confidence: number;
  alternatives: { commonName: string; confidence: number }[];
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
