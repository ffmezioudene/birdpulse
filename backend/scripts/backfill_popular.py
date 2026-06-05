#!/usr/bin/env python3
"""
One-shot backfill: pre-populate the server-side enrichment + Wikipedia
caches for the most commonly-identified species so the first user opening
each species page sees instant content.

USAGE
    # Local dev (against the local backend at :8001)
    python scripts/backfill_popular.py

    # Production (against Railway)
    python scripts/backfill_popular.py --base https://birdpulse-api.up.railway.app

    # Subset (dry-run with the first 20)
    python scripts/backfill_popular.py --limit 20

COSTS
    ~500 species × ($0.005 GPT-4o + free Wikipedia) ≈ $2.50 one-time.
    Run once after deploy. Repeat only when you bump ENRICH_VERSION.

WHAT IT DOES
    For each species in COMMON_SPECIES:
      1. POST /api/birds/enrich  (warms ENRICH_CACHE in Mongo)
      2. GET  /api/wiki/summary  (warms WIKI_CACHE in Mongo)
    Both endpoints have write-through caches, so we just hit them as a
    normal client would. Successful 2nd calls return `_cached: true`.

    Sleeps 1.5s between species to avoid hammering the OpenAI rate limit
    and to be polite to Wikipedia.
"""

import argparse
import asyncio
import sys
import time
from typing import List, Tuple

import httpx


# (scientific_name, common_name, family, order) — same shape /api/birds/enrich expects.
# Curated to match the on-device catalog's POPULAR_SCIENTIFIC plus a broad
# global / NA / EU / Asia / Africa / Oceania spread of common species.
COMMON_SPECIES: List[Tuple[str, str, str, str]] = [
    # --- Cosmopolitan / synanthropic ---
    ("Passer domesticus",       "House Sparrow",         "Passeridae",     "Passeriformes"),
    ("Columba livia",           "Rock Pigeon",           "Columbidae",     "Columbiformes"),
    ("Hirundo rustica",         "Barn Swallow",          "Hirundinidae",   "Passeriformes"),
    ("Sturnus vulgaris",        "European Starling",     "Sturnidae",      "Passeriformes"),
    ("Anas platyrhynchos",      "Mallard",               "Anatidae",       "Anseriformes"),
    ("Bubulcus ibis",           "Cattle Egret",          "Ardeidae",       "Pelecaniformes"),
    ("Milvus migrans",          "Black Kite",            "Accipitridae",   "Accipitriformes"),
    ("Falco peregrinus",        "Peregrine Falcon",      "Falconidae",     "Falconiformes"),
    ("Apus apus",               "Common Swift",          "Apodidae",       "Apodiformes"),
    ("Tyto alba",               "Barn Owl",              "Tytonidae",      "Strigiformes"),

    # --- Europe / UK ---
    ("Turdus merula",           "Common Blackbird",      "Turdidae",       "Passeriformes"),
    ("Erithacus rubecula",      "European Robin",        "Muscicapidae",   "Passeriformes"),
    ("Parus major",             "Great Tit",             "Paridae",        "Passeriformes"),
    ("Cyanistes caeruleus",     "Eurasian Blue Tit",     "Paridae",        "Passeriformes"),
    ("Pica pica",               "Eurasian Magpie",       "Corvidae",       "Passeriformes"),
    ("Garrulus glandarius",     "Eurasian Jay",          "Corvidae",       "Passeriformes"),
    ("Fringilla coelebs",       "Common Chaffinch",      "Fringillidae",   "Passeriformes"),
    ("Carduelis carduelis",     "European Goldfinch",    "Fringillidae",   "Passeriformes"),
    ("Columba palumbus",        "Common Wood-Pigeon",    "Columbidae",     "Columbiformes"),
    ("Streptopelia decaocto",   "Eurasian Collared-Dove", "Columbidae",    "Columbiformes"),
    ("Buteo buteo",             "Common Buzzard",        "Accipitridae",   "Accipitriformes"),
    ("Alcedo atthis",           "Common Kingfisher",     "Alcedinidae",    "Coraciiformes"),
    ("Upupa epops",             "Eurasian Hoopoe",       "Upupidae",       "Bucerotiformes"),
    ("Cygnus olor",             "Mute Swan",             "Anatidae",       "Anseriformes"),
    ("Motacilla alba",          "White Wagtail",         "Motacillidae",   "Passeriformes"),
    ("Fulica atra",             "Eurasian Coot",         "Rallidae",       "Gruiformes"),
    ("Chroicocephalus ridibundus", "Black-headed Gull",  "Laridae",        "Charadriiformes"),
    ("Larus argentatus",        "European Herring Gull", "Laridae",        "Charadriiformes"),
    ("Corvus corone",           "Carrion Crow",          "Corvidae",       "Passeriformes"),
    ("Corvus monedula",         "Eurasian Jackdaw",      "Corvidae",       "Passeriformes"),
    ("Turdus philomelos",       "Song Thrush",           "Turdidae",       "Passeriformes"),
    ("Sylvia atricapilla",      "Eurasian Blackcap",     "Sylviidae",      "Passeriformes"),
    ("Phylloscopus collybita",  "Common Chiffchaff",     "Phylloscopidae", "Passeriformes"),
    ("Troglodytes troglodytes", "Eurasian Wren",         "Troglodytidae",  "Passeriformes"),

    # --- North America ---
    ("Cardinalis cardinalis",   "Northern Cardinal",     "Cardinalidae",   "Passeriformes"),
    ("Turdus migratorius",      "American Robin",        "Turdidae",       "Passeriformes"),
    ("Cyanocitta cristata",     "Blue Jay",              "Corvidae",       "Passeriformes"),
    ("Poecile atricapillus",    "Black-capped Chickadee", "Paridae",       "Passeriformes"),
    ("Zenaida macroura",        "Mourning Dove",         "Columbidae",     "Columbiformes"),
    ("Buteo jamaicensis",       "Red-tailed Hawk",       "Accipitridae",   "Accipitriformes"),
    ("Ardea herodias",          "Great Blue Heron",      "Ardeidae",       "Pelecaniformes"),
    ("Haliaeetus leucocephalus", "Bald Eagle",           "Accipitridae",   "Accipitriformes"),
    ("Spinus tristis",          "American Goldfinch",    "Fringillidae",   "Passeriformes"),
    ("Corvus brachyrhynchos",   "American Crow",         "Corvidae",       "Passeriformes"),
    ("Bubo virginianus",        "Great Horned Owl",      "Strigidae",      "Strigiformes"),
    ("Archilochus colubris",    "Ruby-throated Hummingbird", "Trochilidae", "Apodiformes"),
    ("Picoides pubescens",      "Downy Woodpecker",      "Picidae",        "Piciformes"),
    ("Melanerpes carolinus",    "Red-bellied Woodpecker", "Picidae",       "Piciformes"),
    ("Colaptes auratus",        "Northern Flicker",      "Picidae",        "Piciformes"),
    ("Sialia sialis",           "Eastern Bluebird",      "Turdidae",       "Passeriformes"),
    ("Sitta carolinensis",      "White-breasted Nuthatch", "Sittidae",     "Passeriformes"),
    ("Branta canadensis",       "Canada Goose",          "Anatidae",       "Anseriformes"),
    ("Pandion haliaetus",       "Osprey",                "Pandionidae",    "Accipitriformes"),
    ("Cathartes aura",          "Turkey Vulture",        "Cathartidae",    "Accipitriformes"),
    ("Mimus polyglottos",       "Northern Mockingbird",  "Mimidae",        "Passeriformes"),
    ("Agelaius phoeniceus",     "Red-winged Blackbird",  "Icteridae",      "Passeriformes"),
    ("Quiscalus quiscula",      "Common Grackle",        "Icteridae",      "Passeriformes"),
    ("Junco hyemalis",          "Dark-eyed Junco",       "Passerellidae",  "Passeriformes"),
    ("Melospiza melodia",       "Song Sparrow",          "Passerellidae",  "Passeriformes"),
    ("Setophaga coronata",      "Yellow-rumped Warbler", "Parulidae",      "Passeriformes"),
    ("Setophaga petechia",      "Yellow Warbler",        "Parulidae",      "Passeriformes"),
    ("Charadrius vociferus",    "Killdeer",              "Charadriidae",   "Charadriiformes"),
    ("Picoides villosus",       "Hairy Woodpecker",      "Picidae",        "Piciformes"),
    ("Falco sparverius",        "American Kestrel",      "Falconidae",     "Falconiformes"),
    ("Egretta thula",           "Snowy Egret",           "Ardeidae",       "Pelecaniformes"),
    ("Ardea alba",              "Great Egret",           "Ardeidae",       "Pelecaniformes"),
    ("Larus delawarensis",      "Ring-billed Gull",      "Laridae",        "Charadriiformes"),
    ("Strix varia",             "Barred Owl",            "Strigidae",      "Strigiformes"),
    ("Megaceryle alcyon",       "Belted Kingfisher",     "Alcedinidae",    "Coraciiformes"),
    ("Hirundo rustica",         "Barn Swallow",          "Hirundinidae",   "Passeriformes"),
    ("Passerina cyanea",        "Indigo Bunting",        "Cardinalidae",   "Passeriformes"),
    ("Piranga rubra",           "Summer Tanager",        "Cardinalidae",   "Passeriformes"),
    ("Selasphorus rufus",       "Rufous Hummingbird",    "Trochilidae",    "Apodiformes"),
    ("Calypte anna",            "Anna's Hummingbird",    "Trochilidae",    "Apodiformes"),
    ("Aphelocoma californica",  "California Scrub-Jay",  "Corvidae",       "Passeriformes"),
    ("Larus occidentalis",      "Western Gull",          "Laridae",        "Charadriiformes"),
    ("Pelecanus occidentalis",  "Brown Pelican",         "Pelecanidae",    "Pelecaniformes"),
    ("Phalacrocorax auritus",   "Double-crested Cormorant", "Phalacrocoracidae", "Suliformes"),

    # --- Asia ---
    ("Coracias benghalensis",   "Indian Roller",         "Coraciidae",     "Coraciiformes"),
    ("Acridotheres tristis",    "Common Myna",           "Sturnidae",      "Passeriformes"),
    ("Pycnonotus cafer",        "Red-vented Bulbul",     "Pycnonotidae",   "Passeriformes"),
    ("Pycnonotus jocosus",      "Red-whiskered Bulbul",  "Pycnonotidae",   "Passeriformes"),
    ("Eudynamys scolopaceus",   "Asian Koel",            "Cuculidae",      "Cuculiformes"),
    ("Psittacula krameri",      "Rose-ringed Parakeet",  "Psittaculidae",  "Psittaciformes"),
    ("Corvus splendens",        "House Crow",            "Corvidae",       "Passeriformes"),
    ("Halcyon smyrnensis",      "White-throated Kingfisher", "Alcedinidae", "Coraciiformes"),
    ("Copsychus saularis",      "Oriental Magpie-Robin", "Muscicapidae",   "Passeriformes"),
    ("Dicrurus macrocercus",    "Black Drongo",          "Dicruridae",     "Passeriformes"),
    ("Centropus sinensis",      "Greater Coucal",        "Cuculidae",      "Cuculiformes"),
    ("Pavo cristatus",          "Indian Peafowl",        "Phasianidae",    "Galliformes"),
    ("Threskiornis melanocephalus", "Black-headed Ibis", "Threskiornithidae", "Pelecaniformes"),
    ("Ardeola grayii",          "Indian Pond-Heron",     "Ardeidae",       "Pelecaniformes"),
    ("Vanellus indicus",        "Red-wattled Lapwing",   "Charadriidae",   "Charadriiformes"),
    ("Spilopelia chinensis",    "Spotted Dove",          "Columbidae",     "Columbiformes"),

    # --- Middle East / Africa ---
    ("Pycnonotus barbatus",     "Common Bulbul",         "Pycnonotidae",   "Passeriformes"),
    ("Corvus albus",            "Pied Crow",             "Corvidae",       "Passeriformes"),
    ("Bostrychia hagedash",     "Hadada Ibis",           "Threskiornithidae", "Pelecaniformes"),
    ("Coracias caudatus",       "Lilac-breasted Roller", "Coraciidae",     "Coraciiformes"),
    ("Lamprotornis superbus",   "Superb Starling",       "Sturnidae",      "Passeriformes"),
    ("Spilopelia senegalensis", "Laughing Dove",         "Columbidae",     "Columbiformes"),
    ("Phoeniconaias minor",     "Lesser Flamingo",       "Phoenicopteridae", "Phoenicopteriformes"),
    ("Struthio camelus",        "Common Ostrich",        "Struthionidae",  "Struthioniformes"),
    ("Bucorvus leadbeateri",    "Southern Ground-Hornbill", "Bucorvidae",  "Bucerotiformes"),
    ("Tockus erythrorhynchus",  "Red-billed Hornbill",   "Bucerotidae",   "Bucerotiformes"),
    ("Streptopelia semitorquata", "Red-eyed Dove",       "Columbidae",     "Columbiformes"),
    ("Aquila rapax",            "Tawny Eagle",           "Accipitridae",   "Accipitriformes"),
    ("Pterocles exustus",       "Chestnut-bellied Sandgrouse", "Pteroclidae", "Pterocliformes"),

    # --- Oceania ---
    ("Trichoglossus moluccanus", "Rainbow Lorikeet",     "Psittaculidae",  "Psittaciformes"),
    ("Dacelo novaeguineae",     "Laughing Kookaburra",   "Alcedinidae",    "Coraciiformes"),
    ("Cacatua galerita",        "Sulphur-crested Cockatoo", "Cacatuidae",  "Psittaciformes"),
    ("Gymnorhina tibicen",      "Australian Magpie",     "Artamidae",     "Passeriformes"),
    ("Eolophus roseicapilla",   "Galah",                 "Cacatuidae",     "Psittaciformes"),
    ("Cracticus tibicen",       "Australian Magpie",     "Artamidae",      "Passeriformes"),
    ("Manorina melanocephala",  "Noisy Miner",           "Meliphagidae",   "Passeriformes"),
    ("Anas superciliosa",       "Pacific Black Duck",    "Anatidae",       "Anseriformes"),

    # --- South America ---
    ("Coragyps atratus",        "Black Vulture",         "Cathartidae",    "Cathartiformes"),
    ("Pitangus sulphuratus",    "Great Kiskadee",        "Tyrannidae",     "Passeriformes"),
    ("Furnarius rufus",         "Rufous Hornero",        "Furnariidae",    "Passeriformes"),
    ("Sicalis flaveola",        "Saffron Finch",         "Thraupidae",     "Passeriformes"),
    ("Caracara plancus",        "Crested Caracara",      "Falconidae",     "Falconiformes"),
    ("Ramphastos toco",         "Toco Toucan",           "Ramphastidae",   "Piciformes"),
    ("Ara ararauna",            "Blue-and-yellow Macaw", "Psittacidae",    "Psittaciformes"),
]


def dedupe(items):
    seen = set()
    out = []
    for s in items:
        if s[0] in seen:
            continue
        seen.add(s[0])
        out.append(s)
    return out


async def warm_one(client: httpx.AsyncClient, base: str, sci: str, common: str, family: str, order: str) -> dict:
    """Hit /api/birds/enrich + /api/wiki/summary for one species."""
    out = {"sci": sci, "common": common, "enrich_ms": 0, "wiki_ms": 0, "enrich_cached": False, "wiki_cached": False, "ok": True, "errs": []}

    # 1) Enrich
    t0 = time.time()
    try:
        r = await client.post(
            f"{base}/api/birds/enrich",
            json={"common_name": common, "scientific_name": sci, "family": family, "order": order},
            timeout=60,
        )
        r.raise_for_status()
        body = r.json()
        out["enrich_cached"] = bool(body.get("_cached"))
    except Exception as e:
        out["ok"] = False
        out["errs"].append(f"enrich: {e}")
    out["enrich_ms"] = int((time.time() - t0) * 1000)

    # 2) Wiki
    t0 = time.time()
    try:
        title = f"{sci}|{common}"
        r = await client.get(f"{base}/api/wiki/summary", params={"title": title}, timeout=30)
        r.raise_for_status()
        body = r.json()
        out["wiki_cached"] = bool(body.get("_cached"))
    except Exception as e:
        out["ok"] = False
        out["errs"].append(f"wiki: {e}")
    out["wiki_ms"] = int((time.time() - t0) * 1000)

    return out


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8001", help="Backend base URL")
    ap.add_argument("--limit", type=int, default=0, help="Only process N species (0 = all)")
    ap.add_argument("--sleep-ms", type=int, default=1500, help="Pause between species")
    ap.add_argument("--start-at", type=int, default=0, help="Skip the first N (for resume)")
    args = ap.parse_args()

    items = dedupe(COMMON_SPECIES)
    if args.start_at:
        items = items[args.start_at:]
    if args.limit:
        items = items[: args.limit]

    print(f"Backfilling {len(items)} species against {args.base}")
    print(f"  Estimated time: ~{int(len(items) * (args.sleep_ms / 1000 + 5))} s")
    print(f"  Estimated cost: ~${len(items) * 0.005:.2f} GPT-4o\n")

    started = time.time()
    ok = 0
    skipped = 0
    failed = 0
    total_enrich_ms = 0
    total_wiki_ms = 0

    async with httpx.AsyncClient() as client:
        # Verify backend before starting
        try:
            r = await client.get(f"{args.base}/api/health", timeout=10)
            r.raise_for_status()
            h = r.json()
            print(f"  Backend health: {h.get('status')} (mongo={h.get('mongo')} llm={h.get('has_llm_key')})\n")
        except Exception as e:
            print(f"FATAL: backend unreachable at {args.base}: {e}", file=sys.stderr)
            sys.exit(1)

        for i, (sci, common, family, order) in enumerate(items, 1):
            result = await warm_one(client, args.base, sci, common, family, order)
            mark = "✓" if result["ok"] else "✗"
            cache_tag = " [cached]" if result["enrich_cached"] and result["wiki_cached"] else ""
            print(
                f"  [{i:3d}/{len(items)}] {mark} {common:32s} "
                f"enrich={result['enrich_ms']:5d}ms wiki={result['wiki_ms']:5d}ms{cache_tag}"
                + ("" if result["ok"] else f"  ERR: {'; '.join(result['errs'])}")
            )
            if result["ok"]:
                ok += 1
                if result["enrich_cached"]:
                    skipped += 1
            else:
                failed += 1
            total_enrich_ms += result["enrich_ms"]
            total_wiki_ms += result["wiki_ms"]

            if i < len(items):
                await asyncio.sleep(args.sleep_ms / 1000)

    elapsed = int(time.time() - started)
    print(f"\nDone in {elapsed}s.")
    print(f"  OK: {ok}  |  already-cached: {skipped}  |  failed: {failed}")
    print(f"  Avg enrich: {int(total_enrich_ms / max(ok, 1))}ms  |  avg wiki: {int(total_wiki_ms / max(ok, 1))}ms")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
