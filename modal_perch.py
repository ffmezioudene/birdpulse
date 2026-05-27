"""BirdLens Perch 2.0 Sound ID service — runs on Modal.

What this does:
  • Loads Google's Perch 2.0 (CPU-optimised TF SavedModel from Kaggle)
  • Exposes one HTTPS POST endpoint that takes a recorded audio clip
    (base64) and returns top-K species with their model scores.
  • Pre-bakes the model into the container image so cold starts are fast.

Deploy:  modal deploy modal_perch.py
Auth:    Bearer header  `Authorization: Bearer $PERCH_SHARED_SECRET`
"""
from __future__ import annotations

import base64
import csv
import io
import os
import time
from typing import Optional

import modal

# ---------- Config ----------
APP_NAME = "birdlens-perch"
PERCH_HANDLE = "google/bird-vocalization-classifier/TensorFlow2/perch_v2_cpu/1"
SAMPLE_RATE = 32_000
WINDOW_SAMPLES = 160_000   # 5 sec @ 32kHz
HOP_SECS = 2.5             # 50% overlap between windows
MIN_SECS = 1.0             # ignore clips shorter than this
MAX_WINDOWS = 12           # cap per call (60 s of audio); plenty for any phone clip


# ---------- Image ----------
# Image bakes the Perch model in, so cold starts only pay for TF load (~3-5 s),
# not the 400 MB Kaggle download.
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libsndfile1")
    .pip_install(
        "tensorflow==2.21.0",        # matches Perch 2.0 SavedModel's XLA HLO version
        "kagglehub==0.3.4",
        "librosa==0.10.2",
        "soundfile==0.12.1",
        "numpy<2",
        "fastapi==0.115.0",
        "pydantic==2.9.0",
        "python-multipart==0.0.9",
    )
    .run_commands(
        # Pre-download the 388 MB model to the image's filesystem.
        f"python -c \"import kagglehub; "
        f"p = kagglehub.model_download('{PERCH_HANDLE}'); "
        f"print('baked perch into image at', p)\""
    )
)


app = modal.App(APP_NAME)

# Named secret holds the bearer auth value we share with the FastAPI backend.
# Create once with:   modal secret create birdlens-perch PERCH_SHARED_SECRET=<rand>
secret = modal.Secret.from_name("birdlens-perch")


@app.cls(
    image=image,
    cpu=4.0,
    memory=4096,
    timeout=120,
    scaledown_window=120,          # keep warm 2 min after last call
    secrets=[secret],
    min_containers=0,              # scale to zero when idle (free)
)
class Perch:
    """One container = one loaded model instance. `@modal.enter()` runs once
    per container start; predictions reuse the warm model."""

    @modal.enter()
    def load(self):
        import kagglehub
        import tensorflow as tf
        import numpy as np

        t0 = time.time()
        model_dir = kagglehub.model_download(PERCH_HANDLE)
        print(f"[perch] model dir: {model_dir}")
        self.model = tf.saved_model.load(model_dir)
        self.infer = self.model.signatures["serving_default"]

        # Load aligned label files (1 header row + 14795 entries each).
        # labels.csv → scientific name; perch_v2_ebird_classes.csv → eBird code.
        sci_path = os.path.join(model_dir, "assets", "labels.csv")
        code_path = os.path.join(model_dir, "assets", "perch_v2_ebird_classes.csv")

        def _read_col(path):
            with open(path) as f:
                r = list(csv.reader(f))
            # First row is a header tag; everything else is one value per row.
            return [row[0] for row in r[1:]]

        self.sci_names = _read_col(sci_path)
        self.ebird_codes = _read_col(code_path)
        assert len(self.sci_names) == len(self.ebird_codes), \
            f"label mismatch: {len(self.sci_names)} vs {len(self.ebird_codes)}"

        # Mask: index i is "bird-like" only if it has a real eBird code. Many
        # Perch 2.0 classes are non-bird (frog/insect/iNaturalist taxa) and
        # cluttered the top-K when we don't filter.
        self.bird_mask = np.array(
            [c != "no_ebird_code" and not c.startswith("inat") for c in self.ebird_codes],
            dtype=np.bool_,
        )

        # Warm-up call with zeros so the first real prediction isn't 10s slow.
        zeros = np.zeros((1, WINDOW_SAMPLES), dtype=np.float32)
        try:
            _ = self.infer(inputs=tf.constant(zeros))
        except Exception as e:
            print("[perch] warmup err:", e)

        print(
            f"[perch] ready in {time.time()-t0:.1f}s — {len(self.sci_names)} classes, "
            f"{int(self.bird_mask.sum())} bird-like"
        )

    # ----- Internal helpers -----

    def _decode_audio(self, raw: bytes, declared_mime: Optional[str]) -> "np.ndarray":
        """Decode any common phone audio format → mono float32 @ 32 kHz."""
        import librosa
        import soundfile as sf
        import numpy as np

        # librosa can read most formats via libsndfile/audioread/ffmpeg.
        # We try soundfile first (fast), fall back to librosa.load which uses
        # ffmpeg for m4a/aac.
        try:
            data, sr = sf.read(io.BytesIO(raw), always_2d=False, dtype="float32")
        except Exception:
            # librosa.load will write to a temp file & shell out to ffmpeg if needed.
            import tempfile
            suffix = {
                "audio/mp4": ".m4a",
                "audio/m4a": ".m4a",
                "audio/aac": ".aac",
                "audio/mp3": ".mp3",
                "audio/mpeg": ".mp3",
                "audio/wav": ".wav",
                "audio/ogg": ".ogg",
                "audio/flac": ".flac",
            }.get((declared_mime or "").lower(), ".m4a")
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tf:
                tf.write(raw)
                tmp_path = tf.name
            try:
                data, sr = librosa.load(tmp_path, sr=None, mono=True)
            finally:
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass

        # → mono
        if data.ndim == 2:
            data = data.mean(axis=1)
        data = data.astype(np.float32, copy=False)

        # → 32 kHz
        if sr != SAMPLE_RATE:
            data = librosa.resample(data, orig_sr=sr, target_sr=SAMPLE_RATE)

        return data

    def _windowize(self, audio: "np.ndarray") -> "np.ndarray":
        """Slice audio into overlapping 5-sec windows. Pads the last one with
        zeros so short clips still produce 1 valid window."""
        import numpy as np

        if audio.size < int(MIN_SECS * SAMPLE_RATE):
            return np.zeros((0, WINDOW_SAMPLES), dtype=np.float32)

        hop = int(HOP_SECS * SAMPLE_RATE)
        windows = []
        i = 0
        while i + 1 < audio.size and len(windows) < MAX_WINDOWS:
            chunk = audio[i:i + WINDOW_SAMPLES]
            if chunk.size < WINDOW_SAMPLES:
                pad = np.zeros(WINDOW_SAMPLES - chunk.size, dtype=np.float32)
                chunk = np.concatenate([chunk, pad])
            windows.append(chunk)
            if i + WINDOW_SAMPLES >= audio.size:
                break
            i += hop

        if not windows:
            return np.zeros((0, WINDOW_SAMPLES), dtype=np.float32)
        return np.stack(windows, axis=0).astype(np.float32)

    # ----- HTTP endpoint -----

    @modal.fastapi_endpoint(method="POST", docs=False)
    def predict(self, payload: dict):
        """POST JSON body:
          {
            "secret":       "<PERCH_SHARED_SECRET>",  # required, shared bearer
            "audio_base64": "...",        # required, m4a/aac/wav/mp3/ogg
            "mime_type":    "audio/mp4",  # optional, helps decoder
            "top_k":         5,           # optional
            "latitude":      40.7,        # optional, recorded for future biasing
            "longitude":    -74.0,
            "month":        "May"
          }
        """
        import numpy as np
        import tensorflow as tf
        from fastapi import HTTPException

        # ---- auth (shared-secret in body — survives any proxy / header stripping) ----
        expected = os.environ.get("PERCH_SHARED_SECRET", "")
        provided = (payload.get("secret") or "").strip()
        if not expected:
            raise HTTPException(500, "PERCH_SHARED_SECRET not configured on Modal")
        if provided != expected:
            raise HTTPException(401, f"bad shared secret (got len={len(provided)})")

        # ---- input ----
        b64 = (payload.get("audio_base64") or "").strip()
        if not b64:
            raise HTTPException(400, "audio_base64 is required")
        if b64.startswith("data:"):
            b64 = b64.split(",", 1)[-1]
        try:
            raw = base64.b64decode(b64)
        except Exception:
            raise HTTPException(400, "audio_base64 is not valid base64")
        if len(raw) < 200:
            raise HTTPException(400, "audio payload too small")

        top_k = int(payload.get("top_k") or 5)
        top_k = max(1, min(10, top_k))
        mime = payload.get("mime_type")
        lat = payload.get("latitude")
        lng = payload.get("longitude")
        month = payload.get("month")

        # ---- decode + window ----
        t_dec = time.time()
        try:
            audio = self._decode_audio(raw, mime)
        except Exception as e:
            raise HTTPException(400, f"could not decode audio: {e}")
        dec_secs = time.time() - t_dec

        duration_s = audio.size / SAMPLE_RATE
        windows = self._windowize(audio)
        if windows.shape[0] == 0:
            return {
                "ok": False,
                "reason": "audio_too_short",
                "duration_s": round(duration_s, 2),
                "results": [],
            }

        # ---- inference ----
        t_inf = time.time()
        out = self.infer(inputs=tf.constant(windows))
        logits = out["label"].numpy()  # shape (N, 14795)
        inf_secs = time.time() - t_inf

        # ---- per-window softmax → mean-pool over windows ----
        # We pool *probabilities* (not logits) so a single confident window
        # carries weight even if other windows were silence.
        ex = np.exp(logits - logits.max(axis=-1, keepdims=True))
        probs = ex / ex.sum(axis=-1, keepdims=True)
        clip_probs = probs.mean(axis=0)
        # also track the best per-class window prob — useful for short clips
        max_probs = probs.max(axis=0)

        # Mask non-bird (no_ebird_code / inat) classes; bird-only top-K.
        masked = np.where(self.bird_mask, clip_probs, -1.0)
        top_idx = np.argpartition(masked, -top_k)[-top_k:]
        top_idx = top_idx[np.argsort(masked[top_idx])[::-1]]

        results = []
        for i in top_idx:
            i = int(i)
            results.append({
                "scientificName": self.sci_names[i],
                "ebirdCode": self.ebird_codes[i],
                "score": float(clip_probs[i]),         # mean over windows
                "peakScore": float(max_probs[i]),      # best single window
            })

        # Confidence tiers — empirically tuned defaults; can adjust later.
        # Perch's mean-pooled probs are typically small (0.05-0.5 for good hits)
        # so we tier on *peak* score, which is more discriminating.
        peak = results[0]["peakScore"] if results else 0.0
        if peak >= 0.45:
            tier = "high"
        elif peak >= 0.18:
            tier = "medium"
        elif peak >= 0.05:
            tier = "low"
        else:
            tier = "uncertain"

        return {
            "ok": True,
            "duration_s": round(duration_s, 2),
            "num_windows": int(windows.shape[0]),
            "decode_ms": int(dec_secs * 1000),
            "inference_ms": int(inf_secs * 1000),
            "tier": tier,
            "results": results,
            "context": {"latitude": lat, "longitude": lng, "month": month},
            "model": "perch_v2_cpu/1",
        }


@app.local_entrypoint()
def health():
    """`modal run modal_perch.py` → quick local sanity ping that the model loads."""
    p = Perch()
    p.load.remote()
    print("OK — perch container started successfully")
