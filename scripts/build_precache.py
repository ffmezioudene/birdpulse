#!/usr/bin/env python3
"""Build the BirdLens pre-cached bird detail bundle (~500 most common species).

For each bird:
  1. Wikipedia REST /api/rest_v1/page/summary/{title} → description + thumb + image
  2. GBIF /species/match → IUCN status etc (optional)

Strategy for picking the 500:
  - Start with a curated "famous birds" list (~150 worldwide household names)
  - Add the top X by species_group from common groups (cardinals, jays, hummingbirds,
    owls, eagles, hawks, ducks, songbirds, etc.) from the eBird index.

Output: /app/frontend/src/data/precached-birds.json
Shape:
  { "<species-id>": {
      "summary": "...",
      "habitat": "...",
      "thumb": "https://...",
      "image": "https://...",
      "wikiTitle": "...",
      "wikiUrl": "..."
  }, ... }

Uses requests with thread-pool to speed up.
"""
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import quote
import requests

INDEX = "/app/frontend/src/data/species-index.json"
OUT = "/app/frontend/src/data/precached-birds.json"
TARGET = int(os.environ.get("PRECACHE_TARGET", "500"))

WP_BASE = "https://en.wikipedia.org/api/rest_v1/page/summary/"
WP_EXTRACT = "https://en.wikipedia.org/w/api.php"
UA = "BirdLensApp/1.0 (https://birdlens.app; contact@birdlens.app) python-requests"

# Curated "famous worldwide" species — guaranteed to be precached
FAMOUS = [
    "Northern Cardinal", "American Robin", "Blue Jay", "Bald Eagle", "Mallard",
    "Black-capped Chickadee", "Great Horned Owl", "Ruby-throated Hummingbird",
    "House Sparrow", "European Starling", "Mourning Dove", "Rock Pigeon",
    "American Goldfinch", "Northern Mockingbird", "Red-tailed Hawk", "Osprey",
    "Belted Kingfisher", "Pileated Woodpecker", "Downy Woodpecker", "Hairy Woodpecker",
    "Red-bellied Woodpecker", "Northern Flicker", "Barn Owl", "Snowy Owl",
    "Barred Owl", "Eastern Screech-Owl", "Cooper's Hawk", "Sharp-shinned Hawk",
    "Peregrine Falcon", "American Kestrel", "Turkey Vulture", "Black Vulture",
    "Wild Turkey", "Ring-necked Pheasant", "Northern Bobwhite", "Gray Catbird",
    "Brown Thrasher", "Cedar Waxwing", "Eastern Bluebird", "House Wren",
    "Carolina Wren", "Tufted Titmouse", "White-breasted Nuthatch",
    "Red-breasted Nuthatch", "Brown Creeper", "Eastern Towhee", "Song Sparrow",
    "White-throated Sparrow", "Dark-eyed Junco", "Chipping Sparrow",
    "American Tree Sparrow", "Fox Sparrow", "Eastern Phoebe", "Eastern Kingbird",
    "Great Crested Flycatcher", "Tree Swallow", "Barn Swallow", "Purple Martin",
    "Chimney Swift", "Common Loon", "Pied-billed Grebe", "Double-crested Cormorant",
    "Great Blue Heron", "Great Egret", "Snowy Egret", "Green Heron",
    "Black-crowned Night Heron", "American White Pelican", "Brown Pelican",
    "Canada Goose", "Snow Goose", "Wood Duck", "Northern Pintail",
    "American Wigeon", "Northern Shoveler", "Blue-winged Teal", "Green-winged Teal",
    "Hooded Merganser", "Common Merganser", "Bufflehead", "Common Goldeneye",
    "Ruddy Duck", "Sandhill Crane", "Whooping Crane", "American Coot",
    "Killdeer", "American Avocet", "Black-necked Stilt", "Spotted Sandpiper",
    "Greater Yellowlegs", "Lesser Yellowlegs", "Sanderling", "Dunlin",
    "Wilson's Snipe", "American Woodcock", "Ring-billed Gull", "Herring Gull",
    "Great Black-backed Gull", "Caspian Tern", "Common Tern", "Forster's Tern",
    "Black Tern", "Bohemian Waxwing", "Common Yellowthroat", "Yellow Warbler",
    "Yellow-rumped Warbler", "American Redstart", "Black-and-white Warbler",
    "Magnolia Warbler", "Cape May Warbler", "Blackpoll Warbler", "Ovenbird",
    "Northern Waterthrush", "Hooded Warbler", "Wilson's Warbler",
    "Common Grackle", "Brown-headed Cowbird", "Red-winged Blackbird",
    "Baltimore Oriole", "Orchard Oriole", "Scarlet Tanager", "Summer Tanager",
    "Rose-breasted Grosbeak", "Indigo Bunting", "Painted Bunting",
    "Black-headed Grosbeak", "Western Tanager", "Bullock's Oriole",
    "Lazuli Bunting", "Black-billed Magpie", "American Crow", "Common Raven",
    "Fish Crow", "Northern Goshawk", "Golden Eagle", "Mississippi Kite",
    "Swainson's Hawk", "Rough-legged Hawk", "Northern Harrier",
    "Long-eared Owl", "Short-eared Owl", "Boreal Owl", "Northern Saw-whet Owl",
    "Common Nighthawk", "Eastern Whip-poor-will", "Whip-poor-will",
    # Worldwide / European / Tropical favorites
    "European Robin", "Common Chaffinch", "European Goldfinch", "Eurasian Magpie",
    "Common Blackbird", "Common Cuckoo", "European Greenfinch", "Common Kingfisher",
    "Eurasian Blue Tit", "Great Tit", "Common Chiffchaff", "Eurasian Bullfinch",
    "Eurasian Skylark", "Common Swift", "House Martin", "Common Wood Pigeon",
    "Eurasian Wren", "Long-tailed Tit", "Coal Tit", "Eurasian Jay",
    "Eurasian Sparrowhawk", "Common Buzzard", "Tawny Owl", "Eurasian Eagle-Owl",
    "Greater Flamingo", "Lesser Flamingo", "Andean Condor", "Resplendent Quetzal",
    "Toco Toucan", "Keel-billed Toucan", "Scarlet Macaw", "Hyacinth Macaw",
    "Blue-and-yellow Macaw", "Sulphur-crested Cockatoo", "Galah", "Budgerigar",
    "Cockatiel", "Rainbow Lorikeet", "Laughing Kookaburra", "Emu",
    "Common Ostrich", "Greater Rhea", "Southern Cassowary", "Kiwi",
    "Atlantic Puffin", "Tufted Puffin", "Common Murre", "Razorbill",
    "King Penguin", "Emperor Penguin", "Gentoo Penguin", "Adelie Penguin",
    "African Grey Parrot", "Indian Peafowl", "Lyrebird", "Bird-of-paradise",
    "Hoopoe", "Eurasian Hoopoe", "Bee-eater", "European Bee-eater",
    "Pink Flamingo", "Wandering Albatross", "Black-browed Albatross",
    "Frigatebird", "Magnificent Frigatebird", "Greater Roadrunner",
    "Anna's Hummingbird", "Rufous Hummingbird", "Allen's Hummingbird",
    "Black-chinned Hummingbird", "Calliope Hummingbird", "Costa's Hummingbird",
    "Broad-tailed Hummingbird", "Violet-crowned Hummingbird",
    "Black Skimmer", "Reddish Egret", "Roseate Spoonbill", "Wood Stork",
    "Glossy Ibis", "White Ibis", "American Bittern", "Least Bittern",
    "Bonaparte's Gull", "Laughing Gull", "Franklin's Gull",
    "Burrowing Owl", "Northern Pygmy-Owl", "Spotted Owl", "Flammulated Owl",
    "Western Screech-Owl", "Great Gray Owl", "Black Phoebe", "Say's Phoebe",
    "Western Wood-Pewee", "Eastern Wood-Pewee", "Olive-sided Flycatcher",
    "Vermilion Flycatcher", "Western Kingbird", "Cassin's Kingbird",
    "Ash-throated Flycatcher", "Brown-crested Flycatcher",
    "Anhinga", "Neotropic Cormorant", "Pelagic Cormorant", "Brandt's Cormorant",
    "American Dipper", "Varied Thrush", "Hermit Thrush", "Swainson's Thrush",
    "Veery", "Wood Thrush", "Gray-cheeked Thrush", "Bicknell's Thrush",
    "Townsend's Solitaire", "Mountain Bluebird", "Western Bluebird",
    "Brown Pelican", "American Flamingo", "Boat-billed Heron",
    "Yellow-crowned Night-Heron", "Tricolored Heron", "Little Blue Heron",
    "Cattle Egret", "Reddish Egret", "Great White Heron",
    "Black Oystercatcher", "American Oystercatcher", "Long-billed Curlew",
    "Whimbrel", "Marbled Godwit", "Hudsonian Godwit", "Black-bellied Plover",
    "American Golden-Plover", "Pacific Golden-Plover", "Snowy Plover",
    "Piping Plover", "Wilson's Plover", "Semipalmated Plover",
    "Red Crossbill", "White-winged Crossbill", "Pine Grosbeak", "Evening Grosbeak",
    "Common Redpoll", "Hoary Redpoll", "Pine Siskin", "Lesser Goldfinch",
    "Lawrence's Goldfinch", "Cassin's Finch", "Purple Finch", "House Finch",
    "Bohemian Waxwing", "Northern Shrike", "Loggerhead Shrike",
    "Bell's Vireo", "Yellow-throated Vireo", "Blue-headed Vireo", "Warbling Vireo",
    "Red-eyed Vireo", "White-eyed Vireo", "Philadelphia Vireo",
    "Black-throated Blue Warbler", "Black-throated Green Warbler",
    "Black-throated Gray Warbler", "Townsend's Warbler", "Hermit Warbler",
    "Yellow-throated Warbler", "Pine Warbler", "Prairie Warbler",
    "Bay-breasted Warbler", "Chestnut-sided Warbler", "Nashville Warbler",
    "Tennessee Warbler", "Orange-crowned Warbler", "Lucy's Warbler",
    "Virginia's Warbler", "MacGillivray's Warbler", "Mourning Warbler",
    "Kentucky Warbler", "Connecticut Warbler", "Canada Warbler",
    "Yellow-breasted Chat", "Painted Redstart", "Slate-throated Redstart",
    "Lincoln's Sparrow", "Swamp Sparrow", "Vesper Sparrow", "Lark Sparrow",
    "Savannah Sparrow", "Grasshopper Sparrow", "Henslow's Sparrow",
    "Field Sparrow", "Brewer's Sparrow", "Clay-colored Sparrow",
    "Black-throated Sparrow", "Sage Sparrow", "Bell's Sparrow",
    "Five-striped Sparrow", "Rufous-crowned Sparrow", "Canyon Towhee",
    "California Towhee", "Spotted Towhee", "Green-tailed Towhee",
    "Abert's Towhee",
]


def slugify(name: str) -> str:
    s = name.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def fetch_wikipedia(title: str, session: requests.Session) -> dict | None:
    try:
        # Wikipedia summary endpoint follows redirects automatically.
        url = WP_BASE + quote(title.replace(" ", "_"))
        r = session.get(url, timeout=10, headers={"User-Agent": UA, "Accept": "application/json"},
                        allow_redirects=True)
        if r.status_code == 404:
            return None
        r.raise_for_status()
        j = r.json()
        if j.get("type") == "disambiguation":
            return None
        extract = j.get("extract", "") or ""
        # Discard tiny stubs and disambig-like results.
        if len(extract) < 80:
            return None
        return {
            "summary": extract,
            "thumb": (j.get("thumbnail") or {}).get("source", ""),
            "image": (j.get("originalimage") or {}).get("source", "")
                     or (j.get("thumbnail") or {}).get("source", ""),
            "wikiTitle": j.get("title", title),
            "wikiUrl": (j.get("content_urls") or {}).get("desktop", {}).get("page", ""),
        }
    except Exception:
        return None


def title_variants(common: str, sci: str) -> list[str]:
    """Generate Wikipedia title candidates ordered most→least likely to hit.

    Wikipedia tends to host bird articles at lowercase common-name pages,
    e.g. /wiki/Northern_cardinal . Scientific names are redirects but always
    resolve. We try scientific first (highest hit rate), then common name
    casing variants.
    """
    out = []
    # Scientific binomial — Wikipedia keeps these as redirects to common-name pages.
    if sci:
        out.append(sci)
        out.append(sci.replace(" ", "_"))
    # Common name as-is (Wikipedia accepts mixed case in URL via redirects).
    if common:
        out.append(common)
        # Try lowercase except first letter — common Wikipedia style.
        words = common.split()
        if words:
            normalized = words[0][0].upper() + words[0][1:].lower() + " " + " ".join(w.lower() for w in words[1:])
            out.append(normalized.strip())
    return out


def main():
    with open(INDEX, encoding="utf-8") as f:
        species = json.load(f)
    by_common = {s["c"]: s for s in species}
    print(f"Loaded index: {len(species)} species")

    # Build target list: famous first, then top species from each major family
    targets: list[dict] = []
    seen_ids = set()

    for name in FAMOUS:
        entry = by_common.get(name)
        if entry and entry["id"] not in seen_ids:
            targets.append(entry)
            seen_ids.add(entry["id"])

    print(f"Famous list: {len(targets)} seeded")

    # Fill up to TARGET with one species per family (broad coverage)
    by_family: dict[str, list[dict]] = {}
    for s in species:
        by_family.setdefault(s["f"], []).append(s)

    families_sorted = sorted(by_family.items(), key=lambda kv: -len(kv[1]))
    for fam, members in families_sorted:
        if len(targets) >= TARGET:
            break
        for m in members[:3]:  # up to 3 from each family
            if m["id"] in seen_ids:
                continue
            targets.append(m)
            seen_ids.add(m["id"])
            if len(targets) >= TARGET:
                break

    print(f"Final target count: {len(targets)}")

    session = requests.Session()
    results: dict[str, dict] = {}

    def task(entry):
        # Try scientific binomial first (Wikipedia keeps these as redirects),
        # then common-name variants.
        for title in title_variants(entry["c"], entry["s"]):
            data = fetch_wikipedia(title, session)
            if data:
                return entry["id"], data
        return entry["id"], None

    started = time.time()
    with ThreadPoolExecutor(max_workers=12) as ex:
        futures = [ex.submit(task, e) for e in targets]
        done = 0
        for fut in as_completed(futures):
            sid, data = fut.result()
            done += 1
            if data:
                results[sid] = data
            if done % 25 == 0:
                print(f"  {done}/{len(targets)} ({len(results)} hits) "
                      f"in {time.time()-started:.1f}s")

    elapsed = time.time() - started
    print(f"Done in {elapsed:.1f}s. {len(results)} usable entries / {len(targets)} attempted")

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, separators=(",", ":"))
    size_kb = os.path.getsize(OUT) / 1024
    print(f"Wrote → {OUT} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
