# Intelligent Bistro

A monorepo containing:
- `apps/mobile`: React Native (Expo) app with menu browsing, cart UI, and AI chat ordering
- `apps/backend`: Node.js + Express API for menu and natural-language cart parsing
- `packages/shared`: Shared menu data, types, and cart action logic

## Features
- Polished mobile UI with category filtering and rich menu cards
- Cart state management with `zustand`
- AI-driven cart updates from natural language (`/ai/parse-order`)
- Voice ordering (record -> transcribe -> cart actions -> spoken assistant reply)
- Deterministic fallback parser when OpenAI key is not configured
- Shared cart action engine used by both frontend and backend

## Prerequisites
- Node.js `>=20.19.4`
- npm `>=10`
- Xcode + iOS Simulator (for iOS testing)
- Expo Go (optional, for physical device)

## Setup
```bash
npm install
cp apps/backend/.env.example apps/backend/.env
```

Set your backend env values in `apps/backend/.env`:
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default: `gpt-4.1-mini`)
- `OPENAI_TRANSCRIBE_MODEL` (default: `gpt-4o-mini-transcribe`)
- `PORT` (default: `4000`)

For physical iPhone testing, create `apps/mobile/.env` from example and set:
```bash
EXPO_PUBLIC_API_BASE_URL=http://<YOUR_MAC_LOCAL_IP>:4000
```

## Run
```bash
npm run dev
```

This starts both backend and mobile app.

## Typecheck / Build
```bash
npm run typecheck
npm run build
```

## API Endpoints
- `GET /health`
- `GET /menu`
- `POST /cart/apply-actions`
- `POST /ai/parse-order`
- `POST /ai/voice-order` (multipart form-data with `audio` file and optional `cart` JSON string)

Example `POST /ai/parse-order` body:
```json
{
  "message": "Add two spicy chicken sandwiches and a large water",
  "cart": []
}
```

## Demo Prompts
- `Add two spicy chicken sandwiches and a large water`
- `Remove one spicy chicken sandwich`
- `Set large water to 3`
- `Clear cart`
- Tap `Voice` in assistant, speak an order, tap `Stop`

## Loom Checklist (5 minutes)
1. Show menu browsing and category filtering
2. Add/remove/update cart via UI buttons
3. Add/remove/update cart via assistant chat
4. Briefly show backend endpoint logic and shared types
5. Mention AI tools used and where they accelerated delivery
