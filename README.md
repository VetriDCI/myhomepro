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


## v18 baseline update
This build intentionally keeps the **v18 frontend structure, visual layout, colors, sidebar, composer, settings and desktop behavior**. New functionality is added without replacing the v18 UI.

Added:
- Accurate math endpoint using mathjs BigNumber (64-digit precision).
- Calculation requests are routed away from the LLM.
- Mobile chat-history drawer instead of hiding history permanently.
- Mobile up/down chat navigation buttons.
- Safer wrapping for long answers and code.
- Message output font set to 16px.
- Existing v18 English-default/Tanglish understanding, attachments, copy/paste, themes, code review, MathML, vision, Studio and download behavior preserved.
- No application-level 30 chats/day or 5 requests/minute restriction.

## LLM models added
The v18 UI now supports selectable Groq LLMs without changing the v18 layout: Llama 3.3 70B, OpenAI GPT-OSS 120B, OpenAI GPT-OSS 20B, and Llama 3.1 8B. Image requests continue to use the configured Qwen vision model. The selected text LLM is sent securely to the backend, which allowlists the model IDs.

## API key security
- The Groq secret is server-side only: `GROQ_API_KEY` is read from the backend environment.
- The frontend does not contain or send a Groq secret.
- Never commit `backend/.env`; commit only `backend/.env.example`.
- On Render, set `GROQ_API_KEY` under Environment Variables; do not put the secret in source code.
