# Frontend Setup

This frontend uses Vite 7 and requires Node `20.19.0` or newer.

## Local setup

1. Use the project Node version:
   - `nvm use`
2. Install dependencies:
   - `npm install`
3. Copy envs:
   - `cp .env.example .env`
4. Start the dev server:
   - `npm run dev`

## Environment variables

- `VITE_API_BASE_URL`
  - Base URL for REST APIs
- `VITE_WS_BASE_URL`
  - Base URL for WebSocket/SockJS connections

Example:

```env
VITE_API_BASE_URL=http://localhost:8081
VITE_WS_BASE_URL=http://localhost:8081
```

## Build

```bash
npm run build
```

If you see a Node version error, upgrade to the version in [.nvmrc](/Users/manojkumarsawant/Documents/workspace-spring-tools-for-eclipse-4.30.0.RELEASE/whatsapp-sass-techoceanhub/frontend/whatsappcrm/.nvmrc) first.
