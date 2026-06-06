# light-2d-game-hub

a two player light weight game hub built to enhance online gaming and relaxation.

## Features

- Lobby and room system
- Chat and multiplayer game selection
- Avatar support
- Theme picker with dark, warm, earth, and water themes

## Setup

1. Install dependencies: `npm install`
2. Run the app: `npm run dev`

## Notes

This repo was updated with a theme picker and responsive room/lobby UI enhancements.

## Deploying to Vercel + Backend Service

1. Deploy the frontend to Vercel using the default Vite static build.
2. Deploy the backend websocket server separately to a Node-capable host such as Railway, Render, or Fly.io.
3. Configure `VITE_WS_SERVER_URL` in Vercel to point to your backend websocket endpoint, for example:
   - `wss://your-backend-host.example.com/ws`
4. In development, the app will continue using `localhost:3001` unless `VITE_WS_SERVER_URL` is defined.

### Recommended backend deployment

- Use the `server/ws-server.js` server file.
- Host it on a Node process platform that supports persistent websocket connections.
- Make sure the backend is accessible via `wss://` when the front end is served over HTTPS.

### Vercel configuration

The repo includes `vercel.json` for a static build deploy. Set the environment variable `VITE_WS_SERVER_URL` in your Vercel project settings.
