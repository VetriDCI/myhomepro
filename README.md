# SUPER AI STUDIO v10 — Render Root Route Fix

This version fixes the Render deployment error:

`Cannot GET /`

## What was fixed
- Express now serves `frontend/index.html` at `/`.
- Frontend static assets are served from `/frontend`.
- Render binds the Node server to `0.0.0.0`.
- Express JSON body parsing is enabled for large attachment payloads.
- CORS is enabled.
- Uploaded files can be served from `/api/files/:name`.
- Render's injected `PORT` is used automatically.

## Render settings
Use **Docker** runtime and the included `Dockerfile`.
Set:
- `GROQ_API_KEY` = your Groq API key
- `GROQ_MODEL` = `llama-3.3-70b-versatile`
- Optional `GROQ_VISION_MODEL` = your supported vision model

Do not hard-code `PORT`; Render supplies it.
