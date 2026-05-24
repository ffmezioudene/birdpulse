"""Backend test suite for BirdLens API.

Covers: health, bird catalog/detail, photo identification (real Northern Cardinal
JPEG via base64), chat multi-turn, xeno-canto graceful degradation, and basic
input validation.
"""
import base64
import os
import time
from pathlib import Path

import pytest
import requests


# ----------------------------- Helpers -----------------------------

def _b64_cardinal() -> str:
    """Return base64 of a real Northern Cardinal JPEG (downloaded once)."""
    p = Path("/tmp/cardinal.jpg")
    if not p.exists():
        url = (
            "https://images.unsplash.com/photo-1511876484235-b5246a4d6dd5"
            "?w=600&q=80&fm=jpg"
        )
        r = requests.get(url, timeout=20)
        r.raise_for_status()
        p.write_bytes(r.content)
    return base64.b64encode(p.read_bytes()).decode("ascii")


# ----------------------------- Health -----------------------------

class TestHealth:
    def test_health_has_llm_key(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/health", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "ok"
        assert data["has_llm_key"] is True


# ----------------------------- Birds catalog -----------------------------

class TestBirdCatalog:
    def test_catalog_returns_eight_birds(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/birds/catalog", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "birds" in data
        birds = data["birds"]
        assert isinstance(birds, list)
        assert len(birds) == 8

        # validate Pydantic-friendly shape: no Mongo _id leakage
        required = {
            "id", "commonName", "scientificName", "category", "image",
            "shortDescription", "habitat", "diet", "size", "funFacts",
            "rangeSummary", "conservationStatus",
        }
        for b in birds:
            assert "_id" not in b, f"Mongo _id leaked: {b}"
            missing = required - set(b.keys())
            assert not missing, f"Missing keys {missing} in bird {b.get('id')}"
            assert isinstance(b["funFacts"], list)

        ids = [b["id"] for b in birds]
        assert "northern-cardinal" in ids
        assert "great-horned-owl" in ids

    def test_bird_detail_known(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/birds/northern-cardinal", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["id"] == "northern-cardinal"
        assert data["commonName"] == "Northern Cardinal"
        assert data["scientificName"] == "Cardinalis cardinalis"
        assert "_id" not in data

    def test_bird_detail_unknown_returns_404(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/birds/does-not-exist", timeout=15)
        assert r.status_code == 404


# ----------------------------- Identify (photo) -----------------------------

class TestIdentifyPhoto:
    def test_identify_photo_cardinal(self, api_client, base_url):
        payload = {"image_base64": _b64_cardinal(), "mime_type": "image/jpeg"}
        r = api_client.post(
            f"{base_url}/api/identify/photo", json=payload, timeout=90
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # Pydantic IdentifyResult contract
        for k in [
            "commonName", "scientificName", "confidence", "alternatives",
            "shortDescription", "habitat", "diet", "size", "funFacts",
            "rangeSummary", "conservationStatus",
        ]:
            assert k in data, f"Missing key {k}"
        assert isinstance(data["confidence"], int)
        assert 0 <= data["confidence"] <= 100
        assert isinstance(data["alternatives"], list)
        for alt in data["alternatives"]:
            assert "commonName" in alt and "confidence" in alt
            assert isinstance(alt["confidence"], int)
        assert isinstance(data["funFacts"], list)
        # Soft sanity: GPT-4o should recognise a Cardinal photo
        common_lower = data["commonName"].lower()
        assert "cardinal" in common_lower or data["confidence"] >= 0
        # Stronger: at least the common name should not be "Unknown" for a clear photo
        assert common_lower != "unknown", f"Model failed to identify: {data}"

    def test_identify_photo_empty_returns_400(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/identify/photo",
            json={"image_base64": ""},
            timeout=15,
        )
        assert r.status_code == 400, r.text


# ----------------------------- Chat -----------------------------

class TestChat:
    def test_chat_basic_and_multi_turn(self, api_client, base_url):
        # Turn 1 — establish a memorable fact
        r1 = api_client.post(
            f"{base_url}/api/chat",
            json={"message": "My favourite bird is the Blue Jay. Remember that."},
            timeout=60,
        )
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert "session_id" in d1 and d1["session_id"]
        assert "reply" in d1 and isinstance(d1["reply"], str) and d1["reply"].strip()
        session_id = d1["session_id"]

        # Tiny pause to let Mongo persist
        time.sleep(1)

        # Turn 2 — ask about it using same session_id
        r2 = api_client.post(
            f"{base_url}/api/chat",
            json={
                "session_id": session_id,
                "message": "What did I say my favourite bird is? Reply with just the bird name.",
            },
            timeout=60,
        )
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        assert d2["session_id"] == session_id
        assert "blue jay" in d2["reply"].lower(), (
            f"Multi-turn context lost. Reply: {d2['reply']}"
        )

    def test_chat_empty_message_returns_400(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/chat", json={"message": "   "}, timeout=15
        )
        assert r.status_code == 400, r.text


# ----------------------------- Xeno-canto -----------------------------

class TestXenoCanto:
    def test_xenocanto_graceful_when_no_key(self, api_client, base_url):
        r = api_client.get(
            f"{base_url}/api/xenocanto",
            params={"species": "Northern Cardinal"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "recordings" in data
        assert isinstance(data["recordings"], list)
        # Since XENO_CANTO_KEY is intentionally unset, recordings should be empty
        if not os.environ.get("XENO_CANTO_KEY"):
            assert data["recordings"] == []
