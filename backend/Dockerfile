# BirdPulse FastAPI backend image — used by Railway / Render / Fly / any
# container host.
#
# Build context: the `backend/` folder (NOT the repo root).
# This matches Railway when "Root Directory" is set to `backend`.
#
# Build locally (from inside backend/):
#     docker build -t birdpulse-api .
# Run locally:
#     docker run -p 8001:8001 --env-file .env birdpulse-api

FROM python:3.11-slim

# System deps for httpx + pydantic-core wheels (build-essential is needed for
# the rare wheel that has to compile on slim images).
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install python deps first (better Docker layer caching when only code changes).
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r /app/requirements.txt

# Copy backend source (current directory == backend/).
COPY . /app

# Railway / Render inject $PORT; default to 8001 for local docker run.
ENV PORT=8001
EXPOSE 8001

CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8001} --proxy-headers --forwarded-allow-ips=*"]
