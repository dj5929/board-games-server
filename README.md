# BoardGameServer

A multi-game platform using TypeScript, React, and Fastify.

## Note on TypeScript Versions
This project uses different TypeScript versions in different packages intentionally:
- The root project and engine packages use `typescript@^5.3.3`.
- The `web-client` package uses `typescript@~6.0.2`. This is required for Vite 8 compatibility.
