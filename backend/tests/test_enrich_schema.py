"""Tests for /api/birds/enrich extended schema (iteration 7).

Validates ALL 7 new fields land in the JSON response from GPT-4o:
  behavior, sexDifferences, weight, lifespan, seasonality,
  populationTrend, confusedWith (>=3 items)
plus the pre-existing required fields.
"""
import pytest


class TestEnrichExtendedSchema:
    """The Richer Bird Detail upgrade."""

    def test_enrich_northern_cardinal_full_schema(self, api_client, base_url):
        payload = {
            "common_name": "Northern Cardinal",
            "scientific_name": "Cardinalis cardinalis",
            "family": "Cardinalidae",
            "order": "Passeriformes",
        }
        r = api_client.post(
            f"{base_url}/api/birds/enrich", json=payload, timeout=120
        )
        assert r.status_code == 200, r.text
        data = r.json()

        # New v2 fields (iteration 7)
        required_new = [
            "behavior",
            "sexDifferences",
            "weight",
            "lifespan",
            "seasonality",
            "populationTrend",
            "confusedWith",
        ]
        for k in required_new:
            assert k in data, f"NEW field missing: {k}"
            assert data[k] not in (None, "", []), f"NEW field {k} empty: {data[k]}"

        # confusedWith must be an array of >=3 with proper shape
        cw = data["confusedWith"]
        assert isinstance(cw, list), f"confusedWith not list: {type(cw)}"
        assert len(cw) >= 3, f"confusedWith too short: {len(cw)}"
        for item in cw:
            assert "commonName" in item and item["commonName"]
            assert "scientificName" in item and item["scientificName"]
            assert "distinguishing" in item and item["distinguishing"]

        # Pre-existing required fields still present
        for k in [
            "howToIdentify", "size", "wingspan", "diet", "habitat",
            "nestingBehavior", "rangeSummary", "conservationStatus",
            "funFacts",
        ]:
            assert k in data, f"existing field missing: {k}"
        assert isinstance(data["funFacts"], list) and len(data["funFacts"]) >= 1

    def test_enrich_returns_least_concern_for_cardinal(self, api_client, base_url):
        """Cardinal IUCN status sanity — should be Least Concern."""
        payload = {
            "common_name": "Northern Cardinal",
            "scientific_name": "Cardinalis cardinalis",
            "family": "Cardinalidae",
            "order": "Passeriformes",
        }
        r = api_client.post(
            f"{base_url}/api/birds/enrich", json=payload, timeout=120
        )
        assert r.status_code == 200
        data = r.json()
        assert "least concern" in data["conservationStatus"].lower()
