"""Backend tests for the BirdPulse Species Data Backbone upgrade.

New endpoints:
  - GET  /api/wiki/summary?title=<binomial_or_common>
  - POST /api/birds/enrich  (GPT-4o structured JSON)
"""
import pytest


# ----------------------------- Wiki summary -----------------------------

class TestWikiSummary:
    def test_wiki_summary_scientific_binomial(self, api_client, base_url):
        r = api_client.get(
            f"{base_url}/api/wiki/summary",
            params={"title": "Turdus migratorius"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d.get("summary"), str)
        assert len(d["summary"]) > 60, f"summary too short: {d}"
        # American Robin wiki page has a thumbnail
        assert d.get("thumb", "").startswith("http"), f"thumb missing: {d}"
        assert "robin" in d.get("title", "").lower()

    def test_wiki_summary_common_name_fallback(self, api_client, base_url):
        r = api_client.get(
            f"{base_url}/api/wiki/summary",
            params={"title": "Northern Cardinal"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d.get("summary", "")) > 60

    def test_wiki_summary_pipe_separated_tries_both(self, api_client, base_url):
        # First candidate is intentionally junk; second should succeed.
        r = api_client.get(
            f"{base_url}/api/wiki/summary",
            params={"title": "Zzzzz Notabird | Cardinalis cardinalis"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d.get("summary", "")) > 60

    def test_wiki_summary_missing_title_returns_400(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/wiki/summary", params={"title": ""}, timeout=10)
        assert r.status_code == 400, r.text

    def test_wiki_summary_unknown_returns_empty_payload(self, api_client, base_url):
        r = api_client.get(
            f"{base_url}/api/wiki/summary",
            params={"title": "Zzzqqqxxx Notarealbird"},
            timeout=20,
        )
        # Graceful: 200 with empty fields, NOT 500
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("summary") == ""
        assert d.get("thumb") == ""


# ----------------------------- AI enrichment -----------------------------

class TestEnrich:
    def test_enrich_northern_cardinal(self, api_client, base_url):
        payload = {
            "common_name": "Northern Cardinal",
            "scientific_name": "Cardinalis cardinalis",
            "family": "Cardinalidae",
            "order": "Passeriformes",
        }
        r = api_client.post(
            f"{base_url}/api/birds/enrich", json=payload, timeout=60
        )
        assert r.status_code == 200, r.text
        d = r.json()
        required = {
            "shortDescription", "howToIdentify", "size", "wingspan",
            "wingShape", "diet", "habitat", "nestingBehavior",
            "migrationStatus", "rangeSummary", "conservationStatus", "funFacts",
        }
        missing = required - set(d.keys())
        assert not missing, f"Missing enrichment keys: {missing}"
        # Substantive content
        assert len(d["howToIdentify"]) > 30, f"howToIdentify too short: {d['howToIdentify']!r}"
        assert isinstance(d["funFacts"], list)
        assert len(d["funFacts"]) >= 2, f"funFacts too few: {d['funFacts']}"
        # All funFacts should be strings
        for f in d["funFacts"]:
            assert isinstance(f, str) and len(f) > 5

    def test_enrich_european_starling_non_na(self, api_client, base_url):
        # Proves enrichment isn't North-America-only
        payload = {
            "common_name": "European Starling",
            "scientific_name": "Sturnus vulgaris",
            "family": "Sturnidae",
            "order": "Passeriformes",
        }
        r = api_client.post(
            f"{base_url}/api/birds/enrich", json=payload, timeout=60
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d.get("howToIdentify", "")) > 30
        assert isinstance(d.get("funFacts"), list) and len(d["funFacts"]) >= 1

    def test_enrich_missing_required_field_returns_422(self, api_client, base_url):
        # Pydantic should reject (common_name + scientific_name are required)
        r = api_client.post(
            f"{base_url}/api/birds/enrich",
            json={"common_name": "Just Common"},
            timeout=15,
        )
        assert r.status_code in (400, 422), r.text
