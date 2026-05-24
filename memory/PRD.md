# BirdLens — Premium Bird Identifier App

## Overview
BirdLens is a premium iOS-style bird identification app built with React Native + Expo (frontend) and FastAPI + MongoDB (backend). It pairs cinematic dark UI with real nature photography and AI-powered identification to deliver an Apple Design Award–quality experience.

## Tech Stack
- Frontend: React Native, Expo Router, Expo SDK 54, expo-camera, expo-image-picker, expo-audio, expo-location, react-native-maps, expo-blur, expo-linear-gradient, @expo/vector-icons, expo-haptics
- Backend: FastAPI, MongoDB (motor), emergentintegrations (Emergent LLM Key)
- AI: GPT-4o Vision (photo ID + spectrogram-based sound ID), GPT-4o text (Wise owl chatbot)
- Audio: xeno-canto v3 (requires XENO_CANTO_KEY; gracefully empty when unset)
- Maps: react-native-maps (native), web stub
- Subscriptions: RevenueCat — STUBBED. Paywall UI + local free-use gating (2 free IDs → hard gate) is live; replace `setPro()` with `Purchases.purchasePackage(...)` when integrating.

## Key Features Implemented
- Cinematic 5-page onboarding (full-bleed bird photography, page indicators, smooth CTA)
- Premium paywall (skippable X while free-uses remain, yearly default with SAVE 83% badge + 7-day trial, weekly anchor, 4 benefit bullets, glowing plan cards)
- Tabbed Home with hero ID card, Birds Near You categories, Popular Birds w/ inline waveform players, Explore feed, floating Wise owl chat button
- Identify flow: photo (camera + gallery + GPT-4o Vision) and sound (GPT-4o on spectrogram fallback) with premium scanning animation
- Result reveal: confidence score, top alternatives bars, save/log-sighting/play actions, full details
- Bird detail page: full-bleed hero with tabs (Photos / Description / Sounds via xeno-canto / Range)
- Collection tab: Collections, Favorites, History (local-first, persisted in AsyncStorage)
- Hotspots & Sightings map (react-native-maps on native, fallback on web)
- Owl AI chatbot with multi-turn context persisted in MongoDB
- Settings (premium status, autosave, language, hotspots, rating, legal)

## Backend Endpoints
- `GET /api/health` — service status + LLM key presence
- `GET /api/birds/catalog` — 8 seed birds
- `GET /api/birds/{id}` — detail
- `POST /api/identify/photo` — base64 JPEG → GPT-4o Vision → structured IdentifyResult
- `POST /api/identify/sound` — base64 spectrogram → GPT-4o Vision (sound-ID fallback)
- `POST /api/chat` — multi-turn owl assistant (sessions stored in `chat_messages`)
- `GET /api/xenocanto?species=...` — bird call recordings (v3, optional key)

## Environment
- `/app/backend/.env`: `MONGO_URL`, `DB_NAME`, `EMERGENT_LLM_KEY`. Optional: `OPENAI_API_KEY` (overrides Emergent key), `XENO_CANTO_KEY` (enables real recordings)
- `/app/frontend/.env`: `EXPO_PUBLIC_BACKEND_URL` (protected)

## Free-use Gating
- New user → onboarding → paywall (skippable). 2 free IDs across photo + sound combined. After 2nd use, paywall becomes a hard gate (the X disappears). Persisted in AsyncStorage under `birdlens.free.uses`.

## To Productionize
1. Add `OPENAI_API_KEY` and/or `XENO_CANTO_KEY` to `/app/backend/.env`.
2. Wire RevenueCat: replace `setPro()` in `/app/frontend/app/paywall.tsx` with `react-native-purchases` calls.
3. Replace spectrogram fallback for sound ID with a BirdNET-Pi service or a real BirdNET inference endpoint.
4. Build a dev/production client via Expo (camera + audio + maps require a native build to test fully).
