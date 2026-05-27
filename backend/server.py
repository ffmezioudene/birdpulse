from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import re
import tempfile
import base64
import uuid
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

from emergentintegrations.llm.chat import (
    LlmChat,
    UserMessage,
    ImageContent,
    FileContentWithMimeType,
)


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
LLM_KEY = OPENAI_API_KEY or EMERGENT_LLM_KEY

# Gemini-specific key resolver. User's own Google AI Studio key takes precedence
# if set; otherwise we use the Emergent Universal Key (which supports Gemini).
# An OpenAI key here would obviously not work on Gemini, so we never fall back to it.
GEMINI_KEY = GEMINI_API_KEY or EMERGENT_LLM_KEY

# Perch 2.0 Sound ID — Modal-hosted service.
PERCH_MODAL_URL = os.environ.get("PERCH_MODAL_URL", "")
PERCH_SHARED_SECRET = os.environ.get("PERCH_SHARED_SECRET", "")

VISION_MODEL_PROVIDER = "openai"
VISION_MODEL_NAME = "gpt-4o"
CHAT_MODEL_PROVIDER = "openai"
CHAT_MODEL_NAME = "gpt-4o"

app = FastAPI(title="BirdLens API")
api_router = APIRouter(prefix="/api")


# ---------------------------- Models ----------------------------

class IdentifyPhotoRequest(BaseModel):
    image_base64: str  # raw base64 (no data URI prefix expected, but tolerated)
    mime_type: Optional[str] = "image/jpeg"


class IdentifyAlternative(BaseModel):
    commonName: str
    confidence: int


class IdentifyResult(BaseModel):
    commonName: str
    scientificName: str
    confidence: int
    alternatives: List[IdentifyAlternative] = []
    shortDescription: str = ""
    habitat: str = ""
    diet: str = ""
    size: str = ""
    funFacts: List[str] = []
    rangeSummary: str = ""
    conservationStatus: str = ""
    # Extended depth fields (added in v1.1)
    genus: str = ""
    family: str = ""
    order: str = ""
    wingspan: str = ""
    wingShape: str = ""
    howToIdentify: str = ""
    nestingBehavior: str = ""
    migrationStatus: str = ""


class GeminiSoundRequest(BaseModel):
    audio_base64: str                       # raw base64, no data: prefix needed
    mime_type: str = "audio/mp4"            # m4a/aac default from expo-audio
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    month: Optional[str] = None             # e.g. "May"
    model: Optional[str] = "gemini-2.5-flash"


class GeminiSoundFromUrlRequest(BaseModel):
    """Test-only helper: server fetches the audio URL itself (e.g. Xeno-canto)
    so we can run accuracy benchmarks against known recordings without round-
    tripping a base64 payload through curl."""
    audio_url: str
    mime_type: Optional[str] = None         # inferred from URL extension if omitted
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    month: Optional[str] = None
    model: Optional[str] = "gemini-2.5-flash"


class SoundAlternative(BaseModel):
    commonName: str
    scientificName: str = ""
    confidence: int = 0


class GeminiSoundResult(BaseModel):
    commonName: str
    scientificName: str
    confidence: int
    alternatives: List[SoundAlternative] = []
    shortDescription: str = ""
    uncertain: bool = False
    model: str = ""
    # Round-out so the frontend's existing IdentifyResult renderer keeps working.
    habitat: str = ""
    diet: str = ""
    size: str = ""
    funFacts: List[str] = []
    rangeSummary: str = ""
    conservationStatus: str = ""
    genus: str = ""
    family: str = ""
    order: str = ""
    wingspan: str = ""
    wingShape: str = ""
    howToIdentify: str = ""
    nestingBehavior: str = ""
    migrationStatus: str = ""


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str
    # Optional context from the client to make the owl genuinely smart.
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    month: Optional[str] = None              # e.g. "May"
    recent_finds: Optional[List[str]] = None # last few common names


class ChatResponse(BaseModel):
    session_id: str
    reply: str


class XenoCantoRecording(BaseModel):
    id: str
    species: str
    location: str
    quality: str
    audio_url: str


# ---------------------------- Helpers ----------------------------

IDENTIFY_SYSTEM_PROMPT = (
    "You are an expert ornithologist. Identify the bird in the provided image. "
    "Return ONLY valid JSON matching this exact schema, with NO markdown fences, NO preamble, NO trailing text:\n"
    "{\n"
    '  "commonName": str,\n'
    '  "scientificName": str,\n'
    '  "confidence": int (0-100),\n'
    '  "alternatives": [{"commonName": str, "confidence": int}, ...] (0-3 entries),\n'
    '  "shortDescription": str (2-3 sentences),\n'
    '  "habitat": str (1-2 sentences),\n'
    '  "diet": str (1-2 sentences),\n'
    '  "size": str (e.g. "21-23 cm"),\n'
    '  "wingspan": str (e.g. "25-31 cm"),\n'
    '  "wingShape": str (1 short phrase, e.g. "Rounded, short and broad"),\n'
    '  "genus": str (e.g. "Cardinalis"),\n'
    '  "family": str (e.g. "Cardinalidae"),\n'
    '  "order": str (e.g. "Passeriformes"),\n'
    '  "howToIdentify": str (2-3 sentences focused on distinctive visual marks),\n'
    '  "nestingBehavior": str (2-3 sentences on nest, eggs, brooding),\n'
    '  "migrationStatus": str (one of: "Year-round resident", "Migratory - currently breeding", "Migratory - currently wintering", "Migratory - currently migrating", or a short specific phrase),\n'
    '  "funFacts": [str, str, str],\n'
    '  "rangeSummary": str,\n'
    '  "conservationStatus": str\n'
    "}\n"
    "If you cannot detect a bird, return commonName 'Unknown' with confidence 0 and a brief description explaining no bird was detected. "
    "If uncertain between species, lower the confidence and add alternatives. NEVER include backticks or markdown."
)

OWL_SYSTEM_PROMPT = (
    "You are BirdLens's expert birding companion — a warm, knowledgeable ornithologist. "
    "Help users identify birds from descriptions, explain bird behavior and calls, advise how to attract specific birds, "
    "suggest the best times and places to birdwatch, and answer any nature question. "
    "Be concise (under 130 words unless asked for depth), friendly, and genuinely helpful. "
    "When the user's location, current month, or recent finds are provided, weave them into your answer naturally — "
    "reference birds active in their area and season, and call back to species they've recently spotted. "
    "Never invent finds the user hasn't actually made. Avoid emojis unless the user uses them first."
)


def _strip_b64_prefix(s: str) -> str:
    if s.startswith("data:"):
        return s.split(",", 1)[-1]
    return s


def _extract_json(text: str) -> Dict[str, Any]:
    """Extract the first JSON object from a string (handles accidental fences)."""
    cleaned = text.strip()
    # Strip fenced code blocks
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3].strip()
    # Find first { ... last }
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object found in model response")
    return json.loads(cleaned[start : end + 1])


# ---------------------------- Routes ----------------------------

@api_router.get("/")
async def root():
    return {"status": "ok", "service": "BirdLens API"}


@api_router.get("/health")
async def health():
    return {
        "status": "ok",
        "has_llm_key": bool(LLM_KEY),
        "uses_emergent_key": bool(EMERGENT_LLM_KEY and not OPENAI_API_KEY),
    }


@api_router.post("/identify/photo", response_model=IdentifyResult)
async def identify_photo(req: IdentifyPhotoRequest):
    if not LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    b64 = _strip_b64_prefix(req.image_base64)
    if not b64:
        raise HTTPException(status_code=400, detail="image_base64 is required")

    session_id = f"identify-{uuid.uuid4()}"
    chat = LlmChat(
        api_key=LLM_KEY,
        session_id=session_id,
        system_message=IDENTIFY_SYSTEM_PROMPT,
    ).with_model(VISION_MODEL_PROVIDER, VISION_MODEL_NAME)

    image_content = ImageContent(image_base64=b64)
    user_message = UserMessage(
        text="Identify the bird in this photo. Return ONLY the JSON object as specified.",
        file_contents=[image_content],
    )

    try:
        raw = await chat.send_message(user_message)
    except Exception as e:
        logger.exception("Vision call failed")
        raise HTTPException(status_code=502, detail=f"Vision model error: {e}")

    try:
        data = _extract_json(raw)
    except Exception:
        logger.warning("Failed to parse JSON. Raw: %s", raw[:400])
        raise HTTPException(status_code=502, detail="Model did not return valid JSON")

    # Normalize confidence to int
    try:
        data["confidence"] = int(round(float(data.get("confidence", 0))))
    except Exception:
        data["confidence"] = 0
    data.setdefault("alternatives", [])
    for alt in data["alternatives"]:
        try:
            alt["confidence"] = int(round(float(alt.get("confidence", 0))))
        except Exception:
            alt["confidence"] = 0

    # Persist history entry (no _id leakage)
    history_doc = {
        "id": str(uuid.uuid4()),
        "type": "photo",
        "result": data,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.identifications.insert_one(history_doc)
    except Exception:
        pass

    return IdentifyResult(**data)


@api_router.post("/identify/sound", response_model=IdentifyResult)
async def identify_sound(req: IdentifyPhotoRequest):
    """Sound ID fallback: client sends a spectrogram image (base64) of the audio.
    Uses GPT-4o Vision on the spectrogram as a stand-in for BirdNET."""
    if not LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    b64 = _strip_b64_prefix(req.image_base64)
    if not b64:
        raise HTTPException(status_code=400, detail="image_base64 (spectrogram) is required")

    sound_prompt = (
        IDENTIFY_SYSTEM_PROMPT
        + "\nThe image is a SPECTROGRAM of a bird call recording. Identify the most likely species from the "
        "spectrogram patterns (frequency, duration, syllable structure). Lower confidence accordingly."
    )
    session_id = f"sound-{uuid.uuid4()}"
    chat = LlmChat(
        api_key=LLM_KEY,
        session_id=session_id,
        system_message=sound_prompt,
    ).with_model(VISION_MODEL_PROVIDER, VISION_MODEL_NAME)

    image_content = ImageContent(image_base64=b64)
    user_message = UserMessage(
        text="Identify the bird from this spectrogram. Return ONLY the JSON object.",
        file_contents=[image_content],
    )

    try:
        raw = await chat.send_message(user_message)
        data = _extract_json(raw)
    except Exception as e:
        logger.exception("Sound ID failed")
        raise HTTPException(status_code=502, detail=f"Sound ID error: {e}")

    try:
        data["confidence"] = int(round(float(data.get("confidence", 0))))
    except Exception:
        data["confidence"] = 0
    data.setdefault("alternatives", [])

    return IdentifyResult(**data)


# ---------------------------- Gemini native audio Sound ID ----------------

GEMINI_SOUND_SYSTEM_PROMPT = (
    "You are an expert ornithologist with decades of experience identifying bird "
    "vocalizations by ear. You will be given an audio recording of a wild bird. "
    "Listen carefully to the audio's full content: the song or call, its pitch "
    "pattern, rhythm, timbre, duration, and any background ambience. Identify the "
    "single most likely species. If multiple species are plausible, give the best "
    "guess first and 2-3 alternatives. When location and month are provided, "
    "STRONGLY weight your answer toward species that are realistically present at "
    "that latitude/longitude in that month — eBird-style. Never invent a species. "
    "Respond with valid JSON ONLY, no markdown, exactly matching the schema in the "
    "user message."
)

GEMINI_SOUND_USER_PROMPT = (
    "Identify the bird in this audio clip. {context_line}"
    "Respond ONLY with valid JSON (no markdown fences, no prose) in this exact "
    "shape:\n"
    "{{\n"
    '  "primary": {{ "commonName": "...", "scientificName": "...", "confidence": 0-100 }},\n'
    '  "alternatives": [\n'
    '    {{ "commonName": "...", "scientificName": "...", "confidence": 0-100 }},\n'
    '    {{ "commonName": "...", "scientificName": "...", "confidence": 0-100 }}\n'
    "  ],\n"
    '  "description": "one or two sentences about this call/song and the bird",\n'
    '  "uncertain": true/false\n'
    "}}\n"
    "Always provide best-guess alternatives even when uncertain — never an empty "
    "list. If the clip contains no identifiable bird (silence, human speech, "
    "machine noise), set commonName='Unknown', confidence=0, uncertain=true, and "
    "explain briefly in description."
)


_AUDIO_MIME_BY_EXT = {
    ".mp3": "audio/mp3",
    ".m4a": "audio/mp4",
    ".mp4": "audio/mp4",
    ".aac": "audio/aac",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
    ".oga": "audio/ogg",
}

_EXT_BY_MIME = {v: k for k, v in _AUDIO_MIME_BY_EXT.items()}


def _build_sound_context_line(lat: Optional[float], lng: Optional[float], month: Optional[str]) -> str:
    bits = []
    if lat is not None and lng is not None:
        bits.append(f"The recording was made near latitude {lat:.3f}, longitude {lng:.3f}.")
    if month:
        bits.append(f"The recording was made in {month}.")
    if not bits:
        return ""
    return " ".join(bits) + " Favor species realistically present at that location and season. "


async def _gemini_identify_audio(
    audio_path: str,
    mime_type: str,
    model: str,
    latitude: Optional[float],
    longitude: Optional[float],
    month: Optional[str],
) -> Dict[str, Any]:
    """Send a local audio file to Gemini and return parsed JSON."""
    if not GEMINI_KEY:
        raise HTTPException(status_code=500, detail="Gemini key not configured")

    session_id = f"sound-gemini-{uuid.uuid4()}"
    chat = (
        LlmChat(
            api_key=GEMINI_KEY,
            session_id=session_id,
            system_message=GEMINI_SOUND_SYSTEM_PROMPT,
        )
        .with_model("gemini", model)
    )

    audio_attachment = FileContentWithMimeType(
        file_path=audio_path,
        mime_type=mime_type,
    )
    context_line = _build_sound_context_line(latitude, longitude, month)
    user_text = GEMINI_SOUND_USER_PROMPT.format(context_line=context_line)
    user_message = UserMessage(text=user_text, file_contents=[audio_attachment])

    try:
        raw = await chat.send_message(user_message)
    except Exception as e:
        logger.exception("Gemini sound ID failed")
        raise HTTPException(status_code=502, detail=f"Gemini error: {e}")

    try:
        return _extract_json(raw)
    except Exception:
        logger.warning("Gemini returned non-JSON. Raw=%s", (raw or "")[:400])
        raise HTTPException(status_code=502, detail="Gemini did not return valid JSON")


def _normalize_gemini_payload(data: Dict[str, Any], model_used: str) -> GeminiSoundResult:
    primary = data.get("primary") or {}
    alts_raw = data.get("alternatives") or []
    alts: List[SoundAlternative] = []
    for a in alts_raw:
        if not isinstance(a, dict):
            continue
        try:
            conf = int(round(float(a.get("confidence", 0))))
        except Exception:
            conf = 0
        alts.append(
            SoundAlternative(
                commonName=str(a.get("commonName") or "").strip(),
                scientificName=str(a.get("scientificName") or "").strip(),
                confidence=max(0, min(100, conf)),
            )
        )

    try:
        primary_conf = int(round(float(primary.get("confidence", 0))))
    except Exception:
        primary_conf = 0

    return GeminiSoundResult(
        commonName=str(primary.get("commonName") or "Unknown").strip(),
        scientificName=str(primary.get("scientificName") or "").strip(),
        confidence=max(0, min(100, primary_conf)),
        alternatives=alts,
        shortDescription=str(data.get("description") or "").strip(),
        uncertain=bool(data.get("uncertain", False)),
        model=model_used,
    )


@api_router.post("/identify/sound-gemini", response_model=GeminiSoundResult)
async def identify_sound_gemini(req: GeminiSoundRequest):
    """Native-audio Sound ID via Gemini. Accepts base64 audio (m4a/mp3/wav/aac).

    Sends the actual audio file to Gemini (no spectrogram intermediate), with
    optional lat/lng/month context for season-aware species ranking.
    """
    b64 = _strip_b64_prefix(req.audio_base64)
    if not b64:
        raise HTTPException(status_code=400, detail="audio_base64 is required")

    try:
        audio_bytes = base64.b64decode(b64)
    except Exception:
        raise HTTPException(status_code=400, detail="audio_base64 is not valid base64")

    if len(audio_bytes) < 200:
        raise HTTPException(status_code=400, detail="audio payload too small")

    mime = (req.mime_type or "audio/mp4").strip().lower()
    ext = _EXT_BY_MIME.get(mime, ".m4a")
    model = (req.model or "gemini-2.5-flash").strip()

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tf:
        tf.write(audio_bytes)
        tmp_path = tf.name

    try:
        data = await _gemini_identify_audio(
            tmp_path, mime, model, req.latitude, req.longitude, req.month
        )
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass

    result = _normalize_gemini_payload(data, model)

    # Log to history for debugging.
    try:
        await db.identifications.insert_one(
            {
                "id": str(uuid.uuid4()),
                "type": "sound-gemini",
                "model": model,
                "context": {"lat": req.latitude, "lng": req.longitude, "month": req.month},
                "result": result.model_dump(),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
    except Exception:
        pass

    return result


@api_router.post("/identify/sound-gemini-from-url", response_model=GeminiSoundResult)
async def identify_sound_gemini_from_url(req: GeminiSoundFromUrlRequest):
    """Test-only helper. Downloads the audio URL (e.g. Xeno-canto), then runs
    the same Gemini pipeline as `/identify/sound-gemini`. Used for accuracy
    benchmarks; safe to leave enabled — it's just a server-side fetch + the
    normal LLM call."""
    if not req.audio_url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="audio_url must be http(s)")

    # Guess mime/extension from URL if not supplied.
    url_lower = req.audio_url.lower().split("?")[0]
    guessed_ext = ".mp3"
    for e in _AUDIO_MIME_BY_EXT:
        if url_lower.endswith(e):
            guessed_ext = e
            break
    mime = (req.mime_type or _AUDIO_MIME_BY_EXT.get(guessed_ext, "audio/mp3")).lower()

    headers = {
        "User-Agent": "BirdLensApp/1.0 (https://birdlens.app; contact@birdlens.app)",
    }
    try:
        async with httpx.AsyncClient(timeout=30, headers=headers, follow_redirects=True) as http:
            r = await http.get(req.audio_url)
            r.raise_for_status()
            audio_bytes = r.content
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not fetch audio: {e}")

    if len(audio_bytes) < 200:
        raise HTTPException(status_code=502, detail="downloaded audio too small")

    model = (req.model or "gemini-2.5-flash").strip()
    with tempfile.NamedTemporaryFile(suffix=guessed_ext, delete=False) as tf:
        tf.write(audio_bytes)
        tmp_path = tf.name
    try:
        data = await _gemini_identify_audio(
            tmp_path, mime, model, req.latitude, req.longitude, req.month
        )
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass

    return _normalize_gemini_payload(data, model)


# ---------------------------- Perch 2.0 Sound ID (Modal-hosted) -----------

class PerchSoundRequest(BaseModel):
    audio_base64: str
    mime_type: Optional[str] = "audio/mp4"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    month: Optional[str] = None
    top_k: int = 5


class PerchSoundFromUrlRequest(BaseModel):
    """Test-only — server downloads the audio URL and sends to Perch."""
    audio_url: str
    mime_type: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    month: Optional[str] = None
    top_k: int = 5


async def _call_perch(audio_b64: str, mime: str, top_k: int,
                       lat: Optional[float], lng: Optional[float],
                       month: Optional[str]) -> Dict[str, Any]:
    if not PERCH_MODAL_URL or not PERCH_SHARED_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Perch service not configured (PERCH_MODAL_URL / PERCH_SHARED_SECRET).",
        )
    body = {
        "secret": PERCH_SHARED_SECRET,
        "audio_base64": audio_b64,
        "mime_type": mime,
        "top_k": top_k,
        "latitude": lat,
        "longitude": lng,
        "month": month,
    }
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(PERCH_MODAL_URL, json=body)
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Perch service unreachable: {e}")
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Perch {r.status_code}: {r.text[:200]}")
    return r.json()


def _perch_warmup_url() -> str:
    """Modal deploys the warmup endpoint at the same prefix but ending in
    `-warmup.modal.run` instead of `-predict.modal.run`."""
    return PERCH_MODAL_URL.replace("-predict.modal.run", "-warmup.modal.run")


@api_router.get("/identify/sound-perch/warmup")
async def warmup_perch():
    """Lightweight ping that wakes the Modal Perch container. The mobile app
    fires this as soon as the user enters Sound ID mode so the container is
    warm by the time they finish recording. No-op if Perch isn't configured.
    """
    if not PERCH_MODAL_URL:
        return {"ok": False, "configured": False}
    url = _perch_warmup_url()
    try:
        # Long-ish client timeout — first wake can be 20-40s — but caller can
        # close the request early if they don't care to wait for the 200.
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.get(url)
        return {"ok": r.status_code == 200, "status": r.status_code, "body": r.text[:200]}
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}


@api_router.post("/identify/sound-perch")
async def identify_sound_perch(req: PerchSoundRequest):
    """Real bird-sound ID via Google Perch 2.0 on Modal.

    Returns the Perch service payload as-is. The client maps each result's
    `scientificName` to our local species index for tappable detail pages.
    """
    b64 = _strip_b64_prefix(req.audio_base64)
    if not b64:
        raise HTTPException(status_code=400, detail="audio_base64 is required")
    data = await _call_perch(
        b64, req.mime_type or "audio/mp4", req.top_k,
        req.latitude, req.longitude, req.month,
    )
    # Log to history for debugging.
    try:
        await db.identifications.insert_one(
            {
                "id": str(uuid.uuid4()),
                "type": "sound-perch",
                "context": {"lat": req.latitude, "lng": req.longitude, "month": req.month},
                "result": data,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
    except Exception:
        pass
    return data


@api_router.post("/identify/sound-perch-from-url")
async def identify_sound_perch_from_url(req: PerchSoundFromUrlRequest):
    """Server-side accuracy benchmark — fetch a Xeno-canto URL and call Perch."""
    if not req.audio_url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="audio_url must be http(s)")

    headers = {"User-Agent": "BirdLensApp/1.0 (https://birdlens.app)"}
    try:
        async with httpx.AsyncClient(timeout=30, headers=headers, follow_redirects=True) as http:
            r = await http.get(req.audio_url)
            r.raise_for_status()
            raw = r.content
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"download failed: {e}")

    url_lower = req.audio_url.lower().split("?")[0]
    guessed_mime = "audio/mp3"
    for e, m in _AUDIO_MIME_BY_EXT.items():
        if url_lower.endswith(e):
            guessed_mime = m
            break
    mime = (req.mime_type or guessed_mime).lower()

    return await _call_perch(
        base64.b64encode(raw).decode("ascii"), mime, req.top_k,
        req.latitude, req.longitude, req.month,
    )


@api_router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    if not LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="message is required")

    session_id = req.session_id or str(uuid.uuid4())

    # Pull prior turns for this session for multi-turn context
    prior = (
        await db.chat_messages.find(
            {"session_id": session_id}, {"_id": 0}
        )
        .sort("created_at", 1)
        .to_list(50)
    )

    # Build context-aware system prompt with history + user context
    history_text = ""
    if prior:
        history_text = "\n\nPrior conversation:\n" + "\n".join(
            f"{m['role'].upper()}: {m['content']}" for m in prior[-10:]
        )

    context_bits: List[str] = []
    if req.latitude is not None and req.longitude is not None:
        context_bits.append(f"User location: lat {req.latitude:.3f}, lng {req.longitude:.3f}.")
    if req.month:
        context_bits.append(f"Current month: {req.month}.")
    if req.recent_finds:
        finds = ", ".join(req.recent_finds[:5])
        context_bits.append(f"User's recent identifications: {finds}.")
    context_text = ("\n\nUser context:\n" + "\n".join(context_bits)) if context_bits else ""

    chat = LlmChat(
        api_key=LLM_KEY,
        session_id=session_id,
        system_message=OWL_SYSTEM_PROMPT + context_text + history_text,
    ).with_model(CHAT_MODEL_PROVIDER, CHAT_MODEL_NAME)

    try:
        reply = await chat.send_message(UserMessage(text=req.message))
    except Exception as e:
        logger.exception("Chat call failed")
        raise HTTPException(status_code=502, detail=f"Chat error: {e}")

    now = datetime.now(timezone.utc).isoformat()
    await db.chat_messages.insert_one(
        {"session_id": session_id, "role": "user", "content": req.message, "created_at": now}
    )
    await db.chat_messages.insert_one(
        {"session_id": session_id, "role": "assistant", "content": reply, "created_at": now}
    )

    return ChatResponse(session_id=session_id, reply=reply)


@api_router.get("/xenocanto")
async def xenocanto(species: str, limit: int = 3):
    """Proxy Xeno-canto API for bird call recordings.

    Xeno-canto v3 requires an API key (free, from xeno-canto.org/explore/api).
    Set XENO_CANTO_KEY in backend/.env to enable audio playback. Without it
    we return an empty list so the UI degrades gracefully.
    """
    if not species:
        raise HTTPException(status_code=400, detail="species query is required")

    key = os.environ.get("XENO_CANTO_KEY", "")
    if not key:
        return {
            "recordings": [],
            "note": "Add a free XENO_CANTO_KEY to backend/.env to enable bird call playback.",
        }

    url = "https://xeno-canto.org/api/3/recordings"
    # v3 ONLY accepts tagged queries. Parse "Genus species" → "gen:Genus sp:species".
    # If we got a single token or English name, use en:"..." tag instead.
    s = species.strip()
    is_latin = bool(re.match(r"^[A-Z][a-z]+\s+[a-z\-]+$", s))
    if is_latin:
        gen, sp = s.split(None, 1)
        query = f"gen:{gen} sp:{sp}"
    else:
        query = f'en:"{s}"'
    params = {"query": query, "key": key, "per_page": limit}
    try:
        async with httpx.AsyncClient(timeout=15) as http:
            r = await http.get(url, params=params)
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        logger.warning("xeno-canto v3 failed: %s", e)
        return {"recordings": []}

    recs = data.get("recordings", [])[:limit]
    out = []
    for rec in recs:
        audio = rec.get("file") or ""
        if audio and not audio.startswith("http"):
            audio = "https:" + audio
        out.append(
            {
                "id": str(rec.get("id", "")),
                "species": f"{rec.get('gen','')} {rec.get('sp','')}".strip(),
                "common_name": rec.get("en", ""),
                "location": rec.get("loc", ""),
                "country": rec.get("cnt", ""),
                "quality": rec.get("q", ""),
                "length": rec.get("length", ""),
                "audio_url": audio,
            }
        )
    return {"recordings": out}


@api_router.get("/birds/catalog")
async def birds_catalog():
    """Static seed catalog of popular birds for Home/Detail."""
    return {"birds": SEED_BIRDS}


@api_router.get("/birds/{bird_id}")
async def bird_detail(bird_id: str):
    for b in SEED_BIRDS:
        if b["id"] == bird_id:
            return b
    raise HTTPException(status_code=404, detail="Bird not found")


# ---------------------------- Wikipedia proxy -----------------------------

@api_router.post("/birds/thumbs")
async def bulk_thumbs(payload: dict):
    """Batch thumbnail lookup for species rows.

    Body: { "items": [{ "id": "...", "sci": "Cardinalis cardinalis", "common": "Northern Cardinal" }, ...] }
    Response: { "<id>": "<https-image-url>|null", ... }

    Uses Wikipedia's MediaWiki API which accepts up to 50 titles per request
    (with `redirects=1`, scientific binomials resolve to the common-name page).
    We try scientific name first; if the page has no image we retry once with
    the common name. Confirmed-empty species are returned as null so the
    client can cache the fact and not re-ask.
    """
    items = payload.get("items") or []
    if not isinstance(items, list) or not items:
        return {}

    items = items[:80]
    out: dict[str, Optional[str]] = {}

    # Build two lookup waves: scientific first, then common-name fallback.
    sci_map = {it.get("sci", "").strip(): it.get("id") for it in items if it.get("sci")}
    common_map = {it.get("common", "").strip(): it.get("id") for it in items if it.get("common")}

    headers = {
        "User-Agent": "BirdLensApp/1.0 (https://birdlens.app; contact@birdlens.app)",
        "Accept": "application/json",
    }

    async def batch_lookup(titles: list[str]) -> dict[str, str]:
        if not titles:
            return {}
        url = "https://en.wikipedia.org/w/api.php"
        params = {
            "action": "query",
            "format": "json",
            "prop": "pageimages",
            "pithumbsize": "240",
            "redirects": "1",
            "titles": "|".join(titles),
        }
        try:
            async with httpx.AsyncClient(timeout=15, headers=headers) as http:
                r = await http.get(url, params=params)
                r.raise_for_status()
                data = r.json()
        except Exception as e:
            logger.warning("bulk thumbs failed: %s", e)
            return {}

        q = data.get("query") or {}
        # Build maps from the response.
        # normalized: list of {from, to}; redirects: list of {from, to}
        forwards: dict[str, str] = {}
        for n in q.get("normalized", []) or []:
            forwards[n.get("from", "")] = n.get("to", "")
        for n in q.get("redirects", []) or []:
            forwards[n.get("from", "")] = n.get("to", "")

        # Final title (after all redirects) → thumb URL
        title_to_thumb: dict[str, str] = {}
        for page in (q.get("pages") or {}).values():
            t = page.get("title", "")
            thumb = (page.get("thumbnail") or {}).get("source", "")
            if t and thumb:
                title_to_thumb[t] = thumb

        # Walk redirects to find the final title for each input title.
        def resolve(title: str) -> str:
            seen = set()
            cur = title
            while cur in forwards and cur not in seen:
                seen.add(cur)
                cur = forwards[cur]
            return cur

        result: dict[str, str] = {}
        for original in titles:
            final = resolve(original)
            url = title_to_thumb.get(final) or title_to_thumb.get(original)
            if url:
                result[original] = url
        return result

    # 1) Batch scientific names (Wikipedia keeps redirects from binomials).
    sci_titles = list(sci_map.keys())
    for i in range(0, len(sci_titles), 50):
        chunk = sci_titles[i:i + 50]
        hits = await batch_lookup(chunk)
        for title, url in hits.items():
            sid = sci_map.get(title)
            if sid and sid not in out:
                out[sid] = url

    # 2) For ids that didn't resolve, fall back to common name (single-page lookups).
    missing_common: list[str] = []
    for it in items:
        sid = it.get("id")
        if sid and sid not in out and it.get("common"):
            missing_common.append(it["common"])

    if missing_common:
        for i in range(0, len(missing_common), 50):
            chunk = missing_common[i:i + 50]
            hits = await batch_lookup(chunk)
            for title, url in hits.items():
                sid = common_map.get(title)
                if sid and sid not in out:
                    out[sid] = url

    # 3) Confirm null for everything that still has no hit (so clients can cache).
    for it in items:
        sid = it.get("id")
        if sid and sid not in out:
            out[sid] = None  # explicit "looked up, no image"

    return out


@api_router.get("/wiki/summary")
async def wiki_summary(title: str):
    """Server-side Wikipedia REST proxy with simple in-memory caching.

    Tries the scientific binomial first (Wikipedia keeps these as redirects
    that almost always resolve), then falls back to the common-name title.
    The shape exposed to the frontend is intentionally compact.
    """
    if not title:
        raise HTTPException(status_code=400, detail="title is required")

    candidates = [title.strip()]
    # If caller sent "Common Name | Scientific name" we try both.
    if "|" in title:
        parts = [p.strip() for p in title.split("|") if p.strip()]
        candidates = parts

    headers = {
        "User-Agent": "BirdLensApp/1.0 (https://birdlens.app; contact@birdlens.app) python-httpx",
        "Accept": "application/json",
        "Api-User-Agent": "BirdLensApp/1.0 (contact@birdlens.app)",
    }
    async with httpx.AsyncClient(timeout=12, headers=headers, follow_redirects=True) as http:
        for t in candidates:
            slug = t.replace(" ", "_")
            url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{slug}"
            try:
                r = await http.get(url)
                if r.status_code != 200:
                    continue
                j = r.json()
                if j.get("type") == "disambiguation":
                    continue
                extract = (j.get("extract") or "").strip()
                if len(extract) < 60:
                    continue
                return {
                    "title": j.get("title", t),
                    "summary": extract,
                    "thumb": (j.get("thumbnail") or {}).get("source", ""),
                    "image": (j.get("originalimage") or {}).get("source", "")
                            or (j.get("thumbnail") or {}).get("source", ""),
                    "wikiUrl": ((j.get("content_urls") or {}).get("desktop") or {}).get("page", ""),
                }
            except Exception as e:
                logger.warning("wiki fetch failed for %s: %s", t, e)
                continue
    return {"title": title, "summary": "", "thumb": "", "image": "", "wikiUrl": ""}


# ---------------------------- AI enrichment ------------------------------

class EnrichRequest(BaseModel):
    common_name: str
    scientific_name: str
    family: Optional[str] = ""
    order: Optional[str] = ""


@api_router.post("/birds/enrich")
async def enrich_bird(req: EnrichRequest):
    """Generate the premium "How to Identify / Key Facts / Nesting / Fun Facts"
    fields for any species via GPT-4o, returning structured JSON.

    Cached client-side after first call so we only pay once per bird per device.
    """
    api_key = LLM_KEY  # user's OPENAI_API_KEY when present, else EMERGENT_LLM_KEY
    if not api_key:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    prompt = (
        f"Return strict JSON describing the bird species below for a premium field "
        f"guide. Use real, verified knowledge — never invent facts.\n\n"
        f"Common name: {req.common_name}\n"
        f"Scientific name: {req.scientific_name}\n"
        f"Family: {req.family or '?'}\n"
        f"Order: {req.order or '?'}\n\n"
        "Respond ONLY with valid JSON of shape:\n"
        "{\n"
        '  "shortDescription": "1-2 sentence vivid id",\n'
        '  "howToIdentify": "field-mark paragraph",\n'
        '  "size": "length in cm",\n'
        '  "wingspan": "wingspan in cm or m",\n'
        '  "weight": "typical adult weight (g or kg)",\n'
        '  "lifespan": "typical lifespan in the wild (e.g. 3-5 years)",\n'
        '  "wingShape": "short description",\n'
        '  "diet": "what they eat",\n'
        '  "habitat": "where they live",\n'
        '  "nestingBehavior": "nest type, eggs (count/color), incubation, fledging — concise",\n'
        '  "behavior": "flight pattern, foraging style, social/solitary, when most vocal (dawn/dusk)",\n'
        '  "sexDifferences": "how to tell male vs female; breeding vs non-breeding plumage if relevant",\n'
        '  "migrationStatus": "resident or migrant summary",\n'
        '  "rangeSummary": "where in the world",\n'
        '  "seasonality": "when (months) and where they are most often seen",\n'
        '  "conservationStatus": "IUCN status word(s), e.g. Least Concern",\n'
        '  "populationTrend": "Increasing | Stable | Decreasing | Unknown",\n'
        '  "confusedWith": [\n'
        '    { "commonName": "...", "scientificName": "...", "distinguishing": "one-line how to tell them apart" }\n'
        "  ],\n"
        '  "funFacts": ["3 short bullet facts"]\n'
        "}\n"
        "Provide 3-4 entries in confusedWith for visually similar species in the same family/region. "
        "If a value is genuinely unknown for this species, return an empty string (or empty array). "
        "Keep paragraphs concise (under ~200 chars each)."
    )

    session_id = f"enrich-{uuid.uuid4()}"
    chat = (
        LlmChat(api_key=api_key, session_id=session_id,
                system_message="You are an ornithology field-guide author.")
        .with_model(VISION_MODEL_PROVIDER, VISION_MODEL_NAME)
    )
    try:
        reply = await chat.send_message(UserMessage(text=prompt))
    except Exception as e:
        logger.exception("enrich failed: %s", e)
        raise HTTPException(status_code=502, detail="LLM error")

    raw = (reply or "").strip()
    # Strip ```json fences if present
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.S).strip()
    try:
        return json.loads(raw)
    except Exception:
        # Try to recover an outer { ... } block
        m = re.search(r"\{[\s\S]*\}", raw)
        if not m:
            raise HTTPException(status_code=502, detail="LLM returned non-JSON")
        return json.loads(m.group(0))



# ---------------------------- Seed catalog ----------------------------

SEED_BIRDS = [
    {
        "id": "northern-cardinal",
        "commonName": "Northern Cardinal",
        "scientificName": "Cardinalis cardinalis",
        "category": "Songbirds",
        "image": "https://images.unsplash.com/photo-1511876484235-b5246a4d6dd5?crop=entropy&cs=srgb&fm=jpg&q=85",
        "shortDescription": "A vivid red songbird with a prominent crest and black face mask. Males are brilliant red; females warm tawny brown with red accents.",
        "habitat": "Woodland edges, gardens, shrublands across eastern and central North America.",
        "diet": "Seeds, grains, fruits, and insects.",
        "size": "21–23 cm",
        "wingspan": "25–31 cm",
        "wingShape": "Rounded, short and broad",
        "genus": "Cardinalis",
        "family": "Cardinalidae",
        "order": "Passeriformes",
        "howToIdentify": "Look for the bold crest, thick orange-red conical bill, and black face mask. Males are entirely brilliant red; females are warm buff-brown with red highlights on the crest, wings, and tail.",
        "nestingBehavior": "Builds a loose cup-shaped nest of twigs, grasses, and bark in dense shrubs 1–4 m off the ground. Lays 2–5 pale greenish eggs. Female incubates while the male feeds her; both feed the chicks.",
        "migrationStatus": "Year-round resident",
        "funFacts": [
            "Both males and females sing — uncommon among North American songbirds.",
            "Cardinals mate for life and stay together year-round.",
            "Their crest raises when alarmed or excited.",
        ],
        "rangeSummary": "Eastern and central United States, Mexico, year-round resident.",
        "conservationStatus": "Least Concern",
    },
    {
        "id": "blue-jay",
        "commonName": "Blue Jay",
        "scientificName": "Cyanocitta cristata",
        "category": "Songbirds",
        "image": "https://images.pexels.com/photos/32715552/pexels-photo-32715552.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "shortDescription": "Striking blue, white, and black corvid known for its intelligence and bold personality.",
        "habitat": "Forests, parks, and suburban yards across eastern and central North America.",
        "diet": "Nuts, seeds, insects, and occasionally small vertebrates.",
        "size": "25–30 cm",
        "wingspan": "34–43 cm",
        "wingShape": "Broad and rounded",
        "genus": "Cyanocitta",
        "family": "Corvidae",
        "order": "Passeriformes",
        "howToIdentify": "Bright blue upperparts barred with black, white wing patches, a tall crest, and a bold black necklace across a white throat.",
        "nestingBehavior": "Both sexes build a bulky stick nest in a tree fork 3–10 m up. Lays 4–5 olive-buff eggs. Pairs are monogamous and may reuse the territory year after year.",
        "migrationStatus": "Partial migrant — many populations are year-round residents",
        "funFacts": [
            "Blue Jays can mimic hawk calls to scare off other birds.",
            "Their blue color comes from light refraction, not pigment.",
            "They cache acorns and help oak forests regenerate.",
        ],
        "rangeSummary": "Eastern and central US and Canada, year-round resident.",
        "conservationStatus": "Least Concern",
    },
    {
        "id": "bald-eagle",
        "commonName": "Bald Eagle",
        "scientificName": "Haliaeetus leucocephalus",
        "category": "Birds of Prey",
        "image": "https://images.unsplash.com/photo-1747107187735-06e1d2d92b87?crop=entropy&cs=srgb&fm=jpg&q=85",
        "shortDescription": "America's national bird — a massive raptor with a white head, dark brown body, and powerful yellow beak.",
        "habitat": "Near large bodies of water across North America.",
        "diet": "Primarily fish, but also waterfowl and carrion.",
        "size": "70–102 cm",
        "wingspan": "1.8–2.3 m",
        "wingShape": "Long, broad, plank-like with finger-tipped primaries",
        "genus": "Haliaeetus",
        "family": "Accipitridae",
        "order": "Accipitriformes",
        "howToIdentify": "Adults are unmistakable — white head and tail contrasting with a dark chocolate-brown body and a massive yellow hooked beak. Juveniles are mottled brown and white for ~5 years.",
        "nestingBehavior": "Builds enormous stick nests near water, often reused and added to for decades — some weigh over a ton. Lays 1–3 white eggs; both parents incubate ~35 days.",
        "migrationStatus": "Partial migrant — northern birds move south in winter",
        "funFacts": [
            "Bald Eagles can dive at speeds up to 100 mph.",
            "Nests can weigh over a ton and be reused for decades.",
            "Removed from the US endangered list in 2007 after dramatic recovery.",
        ],
        "rangeSummary": "Across most of North America; coastal and inland waterways.",
        "conservationStatus": "Least Concern",
    },
    {
        "id": "mallard-duck",
        "commonName": "Mallard",
        "scientificName": "Anas platyrhynchos",
        "category": "Waterfowl",
        "image": "https://images.unsplash.com/photo-1585533530535-2f4236949d08?crop=entropy&cs=srgb&fm=jpg&q=85",
        "shortDescription": "The most familiar dabbling duck — males display an iridescent green head and white neck ring.",
        "habitat": "Ponds, lakes, rivers, and wetlands worldwide.",
        "diet": "Aquatic plants, seeds, insects, and small crustaceans.",
        "size": "50–65 cm",
        "wingspan": "81–98 cm",
        "wingShape": "Pointed, falcate — built for fast, direct flight",
        "genus": "Anas",
        "family": "Anatidae",
        "order": "Anseriformes",
        "howToIdentify": "Males in breeding plumage show a glossy green head, white neck ring, chestnut breast, and curled black tail feathers. Females are mottled brown with a blue speculum bordered in white.",
        "nestingBehavior": "Female builds a down-lined nest on the ground near water. Lays 7–13 pale greenish-buff eggs and incubates alone for ~28 days. Ducklings are precocial and follow her to water within a day.",
        "migrationStatus": "Migratory — currently following seasonal water",
        "funFacts": [
            "Almost all domestic ducks descend from Mallards.",
            "They can fly up to 55 mph during migration.",
            "Female Mallards say 'quack'; males make a softer, raspier call.",
        ],
        "rangeSummary": "Throughout North America, Europe, and Asia.",
        "conservationStatus": "Least Concern",
    },
    {
        "id": "ruby-throated-hummingbird",
        "commonName": "Ruby-throated Hummingbird",
        "scientificName": "Archilochus colubris",
        "category": "Hummingbirds",
        "image": "https://images.unsplash.com/photo-1596117803277-6142bb2ae8ef?crop=entropy&cs=srgb&fm=jpg&q=85",
        "shortDescription": "A tiny, dazzling hummingbird — males flash a brilliant ruby throat in sunlight.",
        "habitat": "Gardens, woodland edges, and parks across eastern North America.",
        "diet": "Flower nectar, tree sap, and small insects.",
        "size": "7–9 cm",
        "wingspan": "8–11 cm",
        "wingShape": "Narrow, pointed, capable of hovering and reverse flight",
        "genus": "Archilochus",
        "family": "Trochilidae",
        "order": "Apodiformes",
        "howToIdentify": "Emerald-green back, white underparts. Males show a brilliant iridescent red gorget that flashes in direct light; females have a plain white throat and rounded tail with white tips.",
        "nestingBehavior": "Female builds a thimble-sized cup of plant down bound with spider silk, decorated with lichen, on a downward-sloping branch. Lays 2 pea-sized white eggs; she raises chicks alone.",
        "migrationStatus": "Long-distance migrant — currently breeding in the east (Apr–Sep) or wintering in Central America",
        "funFacts": [
            "They beat their wings 53 times per second.",
            "Some cross the Gulf of Mexico nonstop — 800 km in 18–22 hours.",
            "Their hearts can beat over 1,200 times per minute.",
        ],
        "rangeSummary": "Eastern North America in summer; Central America in winter.",
        "conservationStatus": "Least Concern",
    },
    {
        "id": "american-robin",
        "commonName": "American Robin",
        "scientificName": "Turdus migratorius",
        "category": "Songbirds",
        "image": "https://images.unsplash.com/photo-1592333281587-d57aaeacdc55?crop=entropy&cs=srgb&fm=jpg&q=85",
        "shortDescription": "A familiar large thrush with a warm orange breast and gray-brown back — herald of spring.",
        "habitat": "Lawns, gardens, woodlands, and parks across North America.",
        "diet": "Earthworms, insects, and fruit.",
        "size": "23–28 cm",
        "wingspan": "31–41 cm",
        "wingShape": "Rounded, fairly long for a thrush",
        "genus": "Turdus",
        "family": "Turdidae",
        "order": "Passeriformes",
        "howToIdentify": "Warm orange-red breast and belly, slate-gray back and head, white throat streaked with black, and a yellow bill. Females are slightly paler.",
        "nestingBehavior": "Female builds a sturdy cup of mud and grass on a branch or ledge. Lays 3–5 sky-blue eggs and incubates ~14 days. Up to three broods per year.",
        "migrationStatus": "Short-distance migrant — flocks shift south for winter",
        "funFacts": [
            "Robins often run, stop, and tilt their heads to spot worms.",
            "They can produce up to three broods per year.",
            "Their distinctive song is one of the earliest at dawn chorus.",
        ],
        "rangeSummary": "Across North America; northern populations migrate.",
        "conservationStatus": "Least Concern",
    },
    {
        "id": "black-capped-chickadee",
        "commonName": "Black-capped Chickadee",
        "scientificName": "Poecile atricapillus",
        "category": "Songbirds",
        "image": "https://images.unsplash.com/photo-1604326531570-2689ea7ec73f?crop=entropy&cs=srgb&fm=jpg&q=85",
        "shortDescription": "A tiny, curious bird with a black cap and bib, white cheeks, and a buffy belly.",
        "habitat": "Mixed and deciduous forests, parks, and feeders in northern North America.",
        "diet": "Insects, seeds, and berries.",
        "size": "12–15 cm",
        "wingspan": "16–21 cm",
        "wingShape": "Short and rounded",
        "genus": "Poecile",
        "family": "Paridae",
        "order": "Passeriformes",
        "howToIdentify": "Sharp black cap and bib, bright white cheeks, gray back, and warm buff sides. Compare to the Carolina Chickadee, which has a cleaner edge to the bib and less white in the wing.",
        "nestingBehavior": "Excavates or uses cavities in rotten wood. Female lines the cavity with moss and fur. Lays 6–8 white eggs spotted reddish-brown; incubates ~12 days.",
        "migrationStatus": "Year-round resident",
        "funFacts": [
            "Their 'chick-a-dee' call adds 'dee' notes based on threat level.",
            "They can remember thousands of food cache locations.",
            "They lower their body temperature at night to conserve energy.",
        ],
        "rangeSummary": "Northern US and Canada, year-round.",
        "conservationStatus": "Least Concern",
    },
    {
        "id": "great-horned-owl",
        "commonName": "Great Horned Owl",
        "scientificName": "Bubo virginianus",
        "category": "Birds of Prey",
        "image": "https://images.unsplash.com/photo-1744959055063-b217124d3429?crop=entropy&cs=srgb&fm=jpg&q=85",
        "shortDescription": "A powerful nocturnal raptor with prominent ear tufts and piercing yellow eyes.",
        "habitat": "Forests, deserts, swamps, and city parks across the Americas.",
        "diet": "Mammals, birds, reptiles — even skunks and porcupines.",
        "size": "46–63 cm",
        "wingspan": "1.0–1.5 m",
        "wingShape": "Broad and rounded, silent in flight",
        "genus": "Bubo",
        "family": "Strigidae",
        "order": "Strigiformes",
        "howToIdentify": "Massive, stocky owl with widely spaced ear tufts, a white throat patch, mottled gray-brown plumage, and intense yellow eyes. The deep 'hoo-hoo hooo hoo-hoo' is unmistakable.",
        "nestingBehavior": "Does not build its own nest — takes over old hawk, crow, or squirrel nests. Lays 1–4 dull white eggs in late winter. Incubation ~33 days; chicks fledge at 6–7 weeks.",
        "migrationStatus": "Year-round resident",
        "funFacts": [
            "Their grip strength is roughly 500 psi — far stronger than a human hand.",
            "They have asymmetrical ear openings to pinpoint prey in the dark.",
            "They are one of the earliest nesting birds, often starting in January.",
        ],
        "rangeSummary": "Throughout the Americas, year-round.",
        "conservationStatus": "Least Concern",
    },
]


# ---------------------------- App wiring ----------------------------

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
