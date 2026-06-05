# BirdPulse — Production Deployment Guide

Stand up the FastAPI backend on Railway + MongoDB Atlas, point the iOS app
at it via EAS Cloud env vars, run the one-time content backfill, and ship.

Once this is done the Emergent preview URL stops being load-bearing. Your
TestFlight users hit Railway, Railway never sleeps, and the Modal Perch
keep-warm cron in the backend keeps Sound ID instant.

---

## 0. What you already have (no action needed)

These were added to the repo this round — they ship with your next push:

- `backend/Dockerfile` — Railway/Render build target
- `backend/railway.toml` — Railway service config (health check, restart policy)
- `Procfile` — Render/Heroku-style start command (fallback)
- `backend/scripts/backfill_popular.py` — one-shot content pre-generation
- `backend/server.py` changes:
  - **Persistent Mongo cache** on `/api/birds/enrich` + `/api/wiki/summary` (90-day TTL)
  - **`/api/health`** — beefed up: pings Mongo, reports LLM key, cache sizes, latency
  - **`/api/diag/latencies`** — last 20 API call timings (mobile Diagnostics screen reads this)
  - **`/api/diag/cache-stats`** — cache hit-rate observability
  - **Perch keep-warm task** — pings Modal warmup every 5 minutes so Sound ID is instant for users
- `frontend/app/diagnostics.tsx` — surfaces backend health + last 5 API calls + cache sizes

---

## 1. Provision MongoDB Atlas (free tier, ~5 min)

1. Go to https://cloud.mongodb.com/ → sign up or sign in.
2. Create project → "BirdPulse Production".
3. Build a database → **M0 (FREE, 512 MB shared)**. Pick region close to where most users are (e.g. `AWS / eu-west-1` or `AWS / us-east-1`).
4. Database Access → Add user:
   - Username: `birdpulse`
   - Password: generate a strong one — **save it now**
   - Built-in role: `Atlas admin` (or `readWrite` on the `birdpulse` DB if you prefer least-privilege).
5. Network Access → Add IP Address → **Allow Access From Anywhere** (`0.0.0.0/0`). This is fine because access is gated by username + password. Railway IPs aren't static.
6. Database → Connect → **Drivers** → Python → copy the URI. It looks like:
   ```
   mongodb+srv://birdpulse:<PASSWORD>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```
   Replace `<PASSWORD>` with the password from step 4. Save this URL — it becomes `MONGO_URL`.

> **Sizing check:** Content cache for 10k species ≈ 50 MB. You will not outgrow M0 for many months. M10 paid is ~$57/mo when you eventually do.

---

## 2. Deploy the backend on Railway (~10 min)

1. Go to https://railway.com/ → sign up with GitHub.
2. **New Project** → **Deploy from GitHub repo** → pick your BirdPulse repo → grant access.
3. Railway detects `backend/Dockerfile` automatically via `railway.toml`. Let the first build run — it'll fail because env vars aren't set yet. That's fine.
4. **Settings → Service → Root Directory** = leave blank (Dockerfile lives at `backend/Dockerfile` and `railway.toml` already points to it).
5. **Settings → Networking → Generate Domain**. Railway gives you something like:
   ```
   https://birdpulse-api-production.up.railway.app
   ```
   Save this — it becomes `EXPO_PUBLIC_BACKEND_URL`. (You can also add your own custom domain later, e.g. `api.birdpulse.app`.)
6. **Variables tab** → add these one by one (paste from your existing `backend/.env`):

   | Key | Value | Notes |
   |---|---|---|
   | `MONGO_URL` | the Atlas connection string from §1.6 | required |
   | `DB_NAME` | `birdpulse_prod` | any name; Atlas creates it on first write |
   | `OPENAI_API_KEY` | your OpenAI key (the one you already have in `backend/.env`) | **required** — the production backend uses the official `openai` SDK directly (no Emergent router in prod) |
   | `PERCH_MODAL_URL` | your Modal Perch endpoint URL | required for Sound ID |
   | `PERCH_SHARED_SECRET` | the shared secret you set in Modal | required for Sound ID |
   | `XENO_CANTO_KEY` | (your existing value, if any) | optional |
   | `CORS_ORIGINS` | `*` | safe — backend has no cookie auth |
   | `PERCH_KEEPWARM_INTERVAL_S` | `300` | optional override (default 5 min) |
   | `EMERGENT_LLM_KEY` | *(omit from Railway)* | unused in production. The shim hits OpenAI directly. Only the local dev backend in the Emergent IDE uses this. |

   **Do NOT set `PORT`** — Railway injects it automatically.
7. Trigger a redeploy (push a commit, or **Deploy → Redeploy**). Wait ~2 min.
8. Verify: open `https://birdpulse-api-production.up.railway.app/api/health` in a browser. You should see:
   ```json
   {
     "status": "ok",
     "service": "BirdPulse API",
     "has_llm_key": true,
     "uses_emergent_key": false,
     "perch_configured": true,
     "mongo": "ok",
     "enrich_cache_size": 0,
     "wiki_cache_size": 0,
     "check_ms": 12
   }
   ```
9. **Set up auto-deploys** (already on by default). Every push to `main` triggers a new deploy. Settings → Service → Deploy → Branch = `main` to confirm.

> **Plan choice:** Railway's Hobby plan ($5/mo base + ~$5-10 usage at your traffic) is what keeps the service always-on (no scale-to-zero). The free Trial plan WILL sleep. Make sure billing is set up before launch.

---

## 3. Point the iOS app at the new backend via EAS Cloud env vars (~3 min)

Production builds read env vars from **EAS Cloud**, not your local `.env`. Set the prod URL in EAS:

```bash
# Replace with your actual Railway URL.
eas env:create production \
  --name EXPO_PUBLIC_BACKEND_URL \
  --value https://birdpulse-api-production.up.railway.app

# If you already have a value there, update instead:
eas env:update production \
  --name EXPO_PUBLIC_BACKEND_URL \
  --value https://birdpulse-api-production.up.railway.app
```

Verify:
```bash
eas env:list production
```

You should see `EXPO_PUBLIC_BACKEND_URL = https://birdpulse-api-production.up.railway.app`.

Your next `eas build --platform ios --profile production` will bake this URL into the .ipa. The Diagnostics screen in the app will show the URL under "Backend URL" so you can confirm post-build.

> **Note:** Do NOT delete `EXPO_PUBLIC_BACKEND_URL` from your local `frontend/.env` — that one is for dev/preview builds. The two env scopes are independent.

---

## 4. Run the one-time content backfill (~25 min, ~$2.50)

This pre-populates the Mongo enrichment + wiki caches for ~120 globally-common species. After this runs, the first user opening any of these species sees instant content (no GPT-4o latency).

From your local machine (Python 3.11+ with `httpx` installed):

```bash
cd /path/to/birdpulse-repo
pip install httpx

# Dry run against the first 5 species first to sanity-check
python backend/scripts/backfill_popular.py \
  --base https://birdpulse-api-production.up.railway.app \
  --limit 5

# If that looks good, run the full set
python backend/scripts/backfill_popular.py \
  --base https://birdpulse-api-production.up.railway.app
```

Expected output:
```
Backfilling 120 species against https://birdpulse-api-production.up.railway.app
  Estimated time: ~720 s
  Estimated cost: ~$0.60 GPT-4o

  Backend health: ok (mongo=ok llm=true)

  [  1/120] ✓ House Sparrow                    enrich= 4321ms wiki=  287ms
  [  2/120] ✓ Rock Pigeon                      enrich= 3895ms wiki=  198ms
  ...
  [120/120] ✓ Blue-and-yellow Macaw            enrich= 4102ms wiki=  254ms

Done in 712s.
  OK: 120  |  already-cached: 0  |  failed: 0
  Avg enrich: 4012ms  |  avg wiki: 233ms
```

After it finishes, open `https://birdpulse-api-production.up.railway.app/api/health` and you should see:
```json
"enrich_cache_size": 120,
"wiki_cache_size": 120
```

Verify a cached call is fast:
```bash
time curl -s "https://birdpulse-api-production.up.railway.app/api/wiki/summary?title=Cardinalis%20cardinalis%7CNorthern%20Cardinal" | jq '._cached, .summary | length'
# → true, 645   ← _cached:true means served from Mongo
```

---

## 5. Smoke-test the production stack (~5 min)

1. **Health:** `curl https://birdpulse-api-production.up.railway.app/api/health` → `status: ok`
2. **Cache stats:** `curl https://birdpulse-api-production.up.railway.app/api/diag/cache-stats` → enrich_cache > 0
3. **Photo ID:** From the app (dev build pointed at the new URL, or TestFlight build), take a photo of a bird → it should return name + cached content in <2 s for common species
4. **Sound ID:** Record a 5-second clip → result should appear in <5 s (no Modal cold start because keep-warm is running)
5. **Diagnostics screen in the app:** Settings → 7-tap version → Diagnostics → confirm "Backend health" shows `status: ok` and "Last 5 API calls" populates

---

## 6. Ship to TestFlight

```bash
eas build --platform ios --profile production
# Wait ~15 min for cloud build
eas submit --platform ios --latest
```

In App Store Connect → TestFlight, your new build appears for testing. After Apple review (1-2 days), promote to public.

---

## Honest expected outcomes

| Metric | Before | After (cached) | After (first user) |
|---|---|---|---|
| `/api/health` | unreachable when Emergent idle | 20-80 ms always | 20-80 ms always |
| `/api/wiki/summary` for common bird | 300-800 ms | **5-20 ms** | 300-800 ms |
| `/api/birds/enrich` for common bird | 3-8 s every time | **20-50 ms** | 3-8 s (one user pays) |
| Sound ID first call after idle | 20-40 s (Modal cold) | **2-5 s** (keep-warm) | 2-5 s |
| First-paint of bird detail (cached) | 4-9 s | **<500 ms** | 2-3 s |

---

## Tradeoffs / things to be aware of

1. **Atlas free tier is shared infra.** If your app gets featured and traffic spikes 100x in an hour, M0 may throttle. Upgrade to M10 (~$57/mo) at that point — one click, no downtime.
2. **Railway Hobby has a soft monthly cap of $5 + usage.** At a few hundred MAU your bill is ~$10-15/mo. Set a usage alert in Railway settings (Settings → Usage → Alert at $30) so a runaway loop doesn't surprise you.
3. **Modal keep-warm costs are pennies/month.** The warmup endpoint is a lightweight ping (~50 ms), not GPU inference. Modal bills GPU seconds, not pings.
4. **Cache invalidation:** if you want to regenerate content (e.g. you tweak the GPT-4o prompt to produce richer text), bump `ENRICH_VERSION` in `backend/server.py` from `"v1"` to `"v2"` and re-run the backfill. Old rows are filtered out by version.
5. **The Emergent preview URL still works** for your dev/preview builds — those keep hitting `EXPO_PUBLIC_BACKEND_URL` from local `frontend/.env`. Only the production build (EAS env) flips to Railway. Both can coexist forever.
6. **Wiki licensing:** Wikipedia content is CC-BY-SA. We display it with attribution via the linked `wikiUrl`. Caching the API response is explicitly allowed.

---

## Quick reference

| Thing | Where |
|---|---|
| Backend URL (prod) | `https://birdpulse-api-production.up.railway.app` |
| Health | `GET /api/health` |
| Cache stats | `GET /api/diag/cache-stats` |
| Latency log | `GET /api/diag/latencies` |
| Modal keep-warm interval | `PERCH_KEEPWARM_INTERVAL_S` env (default 300 s) |
| EAS prod URL | `eas env:list production` |
| Mongo console | https://cloud.mongodb.com/ |
| Railway dashboard | https://railway.com/ |
| Backfill | `python backend/scripts/backfill_popular.py --base <prod-url>` |
| Re-enable v1.1 eBird | flip `ENABLE_LIVE_NEARBY = true` in `app/birds-near-you.tsx` |
