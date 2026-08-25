---
name: troubleshooting
description: Known Bugs & Workarounds. Use this skill when you encounter strange errors or want to see past bugfixes.
---
# Known Bugs & Troubleshooting History

* **React Strict Mode WebSockets:** In development, React 18 mounts components twice. This causes the `GameRoom` WebSocket `useEffect` to connect, immediately disconnect, and connect again. The first disconnect triggered `ws.onclose`, which updated the error state to "Connection closed" and crashed the UI (destroying the valid second connection). **Fix:** Implemented an `isActive` boolean flag inside `useEffect` to ignore events from unmounted hook instances.
* **Fastify CORS Compatibility:** The Vite dev server and Fastify backend run on different ports. Fastify requires `@fastify/cors` to allow room creation via HTTP `fetch`. **Fix:** Installed `@fastify/cors@8` (specifically v8, as v10 crashes Fastify v4) and registered it.
* **TailwindCSS v4 Vite Integration:** Tailwind v4 changed its PostCSS plugin strategy, breaking Vite if configured using v3 syntax. **Fix:** Replaced `tailwindcss` with `@tailwindcss/postcss` in `postcss.config.js` and updated `index.css` to use `@import "tailwindcss";` instead of `@tailwind` directives.
* **Orphaned EADDRINUSE Processes:** If the Fastify backend crashes, it often leaves a ghost Node process holding port 3000. **Fix:** Use PowerShell `Get-NetTCPConnection -LocalPort 3000` to find and kill the owning process before restarting.

