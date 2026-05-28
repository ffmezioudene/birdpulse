#!/usr/bin/env python3
"""Build the BirdPulse species index from the eBird/Clements 2024 taxonomy.

Output: /app/frontend/src/data/species-index.json
Shape: [{"id":"northern-cardinal","c":"Northern Cardinal","s":"Cardinalis cardinalis","f":"Cardinalidae","o":"Passeriformes","g":"Cardinals & Allies"}]

We use single-letter keys to keep the bundled file small (~700KB-1MB
minified for 11k species).
"""
import csv
import json
import os
import re
import sys

SRC = sys.argv[1] if len(sys.argv) > 1 else "/tmp/ebird.csv"
OUT = "/app/frontend/src/data/species-index.json"
SLUG_OUT = "/app/frontend/src/data/species-slugs.json"


def slugify(name: str) -> str:
    s = name.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def clean_family(family: str) -> str:
    # "Cardinalidae (Cardinals and Allies)" -> "Cardinalidae"
    return family.split(" (")[0].strip()


def family_english(family: str) -> str:
    m = re.search(r"\(([^)]+)\)", family)
    return m.group(1).strip() if m else ""


def main():
    rows = []
    seen = set()
    with open(SRC, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row["CATEGORY"] != "species":
                continue
            common = row["PRIMARY_COM_NAME"].strip()
            sci = row["SCI_NAME"].strip()
            order = row["ORDER"].strip()
            family_full = row["FAMILY"].strip()
            family = clean_family(family_full)
            family_en = family_english(family_full)
            group = row.get("SPECIES_GROUP", "").strip()

            base_id = slugify(common)
            sid = base_id
            n = 2
            while sid in seen:
                sid = f"{base_id}-{n}"
                n += 1
            seen.add(sid)

            entry = {
                "id": sid,
                "c": common,
                "s": sci,
                "f": family,
                "o": order,
            }
            if family_en:
                entry["fe"] = family_en
            if group:
                entry["g"] = group
            rows.append(entry)

    # Sort by common name for nicer default listing
    rows.sort(key=lambda r: r["c"].lower())

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, separators=(",", ":"))

    # Also emit a slug-only lookup file (id → c) for tiny references
    slugs = {r["id"]: r["c"] for r in rows}
    with open(SLUG_OUT, "w", encoding="utf-8") as f:
        json.dump(slugs, f, ensure_ascii=False, separators=(",", ":"))

    size_kb = os.path.getsize(OUT) / 1024
    slug_kb = os.path.getsize(SLUG_OUT) / 1024
    print(f"Wrote {len(rows)} species → {OUT} ({size_kb:.1f} KB)")
    print(f"Slug file → {SLUG_OUT} ({slug_kb:.1f} KB)")

    # Quick stats
    families = sorted({r["f"] for r in rows})
    orders = sorted({r["o"] for r in rows})
    print(f"  {len(orders)} orders, {len(families)} families")


if __name__ == "__main__":
    main()
