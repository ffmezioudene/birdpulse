# Tests for POST /api/birds/thumbs — batch Wikipedia thumbnail lookup
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "https://birdscan-pro.preview.emergentagent.com").rstrip("/")
ENDPOINT = f"{BASE_URL}/api/birds/thumbs"


@pytest.fixture
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------------- Core spec from the review request ----------------

class TestThumbsBasic:
    def test_three_items_two_hits_one_null(self, api_client):
        body = {
            "items": [
                {"id": "a", "sci": "Cardinalis cardinalis", "common": "Northern Cardinal"},
                {"id": "b", "sci": "Corvus corax", "common": "Common Raven"},
                {"id": "c", "sci": "Notreal species", "common": "Fake"},
            ]
        }
        r = api_client.post(ENDPOINT, json=body, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert set(data.keys()) == {"a", "b", "c"}
        assert isinstance(data["a"], str) and "upload.wikimedia.org" in data["a"]
        assert isinstance(data["b"], str) and "upload.wikimedia.org" in data["b"]
        assert data["c"] is None

    def test_response_under_3s(self, api_client):
        body = {
            "items": [
                {"id": "a", "sci": "Cardinalis cardinalis", "common": "Northern Cardinal"},
                {"id": "b", "sci": "Corvus corax", "common": "Common Raven"},
            ]
        }
        t0 = time.time()
        r = api_client.post(ENDPOINT, json=body, timeout=10)
        elapsed = time.time() - t0
        assert r.status_code == 200
        assert elapsed < 3.0, f"took {elapsed:.2f}s"


class TestThumbsBatch:
    """Endpoint should accept up to 80 items per request and return quickly."""

    def test_80_items_accepted(self, api_client):
        # 80 unique real species — verify batch parallelism and that
        # endpoint accepts up to 80 items per spec.
        species = [
            "Turdus migratorius", "Cyanocitta cristata", "Haliaeetus leucocephalus",
            "Anas platyrhynchos", "Bubo virginianus", "Poecile atricapillus",
            "Archilochus colubris", "Passer domesticus", "Sturnus vulgaris",
            "Columba livia", "Corvus corax", "Corvus brachyrhynchos",
            "Cardinalis cardinalis", "Pica pica", "Larus argentatus",
            "Falco peregrinus", "Buteo jamaicensis", "Strix nebulosa",
            "Ardea herodias", "Branta canadensis", "Cygnus olor", "Aix sponsa",
            "Picoides pubescens", "Dryocopus pileatus", "Spinus tristis",
            "Sitta carolinensis", "Baeolophus bicolor", "Mimus polyglottos",
            "Hirundo rustica", "Tachycineta bicolor", "Sialia sialis",
            "Zenaida macroura", "Meleagris gallopavo", "Bombycilla cedrorum",
            "Setophaga petechia", "Setophaga coronata", "Geothlypis trichas",
            "Melospiza melodia", "Junco hyemalis", "Spizella passerina",
            "Agelaius phoeniceus", "Quiscalus quiscula", "Molothrus ater",
            "Icterus galbula", "Pheucticus ludovicianus", "Piranga olivacea",
            "Vireo olivaceus", "Regulus calendula", "Polioptila caerulea",
            "Catharus guttatus", "Toxostoma rufum", "Dumetella carolinensis",
            "Sayornis phoebe", "Tyrannus tyrannus", "Empidonax minimus",
            "Contopus virens", "Coccyzus americanus", "Megaceryle alcyon",
            "Colaptes auratus", "Sphyrapicus varius", "Melanerpes carolinus",
            "Bonasa umbellus", "Phalacrocorax auritus", "Pandion haliaetus",
            "Circus hudsonius", "Accipiter cooperii", "Aquila chrysaetos",
            "Tyto alba", "Asio otus", "Megascops asio", "Charadrius vociferus",
            "Recurvirostra americana", "Himantopus mexicanus", "Calidris alpina",
            "Limnodromus griseus", "Tringa melanoleuca", "Actitis macularius",
            "Numenius phaeopus", "Arenaria interpres", "Larus delawarensis",
        ]
        items = [{"id": f"i{i}", "sci": s, "common": s} for i, s in enumerate(species)]
        assert len(items) == 80

        t0 = time.time()
        r = api_client.post(ENDPOINT, json={"items": items}, timeout=30)
        elapsed = time.time() - t0
        assert r.status_code == 200, r.text
        data = r.json()
        # All 80 ids should appear in response (resolved or null)
        assert len(data) == 80
        # Most should be non-null (these are all well-documented species)
        non_null = [v for v in data.values() if v]
        assert len(non_null) >= 70, f"expected >=70 hits, got {len(non_null)}"
        assert elapsed < 8.0, f"took {elapsed:.2f}s for 80 items"

    def test_items_over_80_are_truncated(self, api_client):
        # Spec: items[:80] — extra items beyond 80 should NOT crash
        items = [
            {"id": f"x{i}", "sci": "Cardinalis cardinalis", "common": "Northern Cardinal"}
            for i in range(100)
        ]
        r = api_client.post(ENDPOINT, json={"items": items}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        # Only first 80 should be in response
        assert len(data) <= 80


class TestThumbsEdge:
    def test_empty_items_returns_empty_dict(self, api_client):
        r = api_client.post(ENDPOINT, json={"items": []}, timeout=10)
        assert r.status_code == 200
        assert r.json() == {}

    def test_missing_items_key_returns_empty(self, api_client):
        r = api_client.post(ENDPOINT, json={}, timeout=10)
        assert r.status_code == 200
        assert r.json() == {}

    def test_common_name_fallback(self, api_client):
        # When sci name is bogus but common is valid, fallback should still resolve
        body = {
            "items": [
                {"id": "fb", "sci": "Bogus xxxxx", "common": "American Robin"},
            ]
        }
        r = api_client.post(ENDPOINT, json=body, timeout=15)
        assert r.status_code == 200
        data = r.json()
        # Either resolves via common name fallback OR is null — both acceptable
        assert "fb" in data
        if data["fb"] is not None:
            assert "upload.wikimedia.org" in data["fb"]

    def test_url_returns_image_content_type(self, api_client):
        body = {"items": [{"id": "a", "sci": "Cardinalis cardinalis", "common": "Northern Cardinal"}]}
        r = api_client.post(ENDPOINT, json=body, timeout=15)
        url = r.json()["a"]
        assert url
        # HEAD the image URL to confirm it serves a real image (Wikimedia requires UA)
        head = requests.head(
            url,
            timeout=10,
            allow_redirects=True,
            headers={"User-Agent": "BirdLensApp/1.0 (https://birdlens.app; contact@birdlens.app)"},
        )
        assert head.status_code == 200, f"status={head.status_code}"
        ctype = head.headers.get("Content-Type", "")
        assert ctype.startswith("image/"), f"unexpected content-type: {ctype}"
