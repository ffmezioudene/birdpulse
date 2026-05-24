import os
import pytest
import requests

# Use the public external URL (what the user-facing app calls)
BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
    or "https://birdscan-pro.preview.emergentagent.com"
).rstrip("/")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture()
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s
