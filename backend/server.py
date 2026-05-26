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
LLM_KEY = OPENAI_API_KEY or EMERGENT_LLM_KEY

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
    # Accept either common name (en:"...") or scientific name (raw token).
    is_latin = bool(re.match(r"^[A-Z][a-z]+ [a-z]+$", species.strip()))
    query = species.strip() if is_latin else f'en:"{species}"'
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
