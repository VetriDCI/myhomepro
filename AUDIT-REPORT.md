# SUPER AI STUDIO v29 Audit Report

## Verified
- Backend JavaScript syntax checked with `node --check`.
- Frontend inline JavaScript extracted and syntax checked with `node --check`.
- Groq model IDs checked against current Groq documentation: `openai/gpt-oss-120b` and `qwen/qwen3.6-27b` are supported.
- GPT-OSS 120B is used for text; Qwen 3.6 27B is used automatically for vision.
- Math calculations use the server-side MathJS BigNumber route instead of asking the LLM to calculate simple arithmetic.

## Fixed in v29
- Duplicate desktop Enter event path removed.
- Shift+Enter newline preserved.
- Theme selection normalized and persisted.
- Saving settings no longer silently resets a custom backend URL.
- Added UUID fallback.
- Added request-too-large JSON error handling.
- Health endpoint now exposes model/configuration status only, never the API key.
- Active requests are aborted during page unload.

## Configuration note
Create `backend/.env` from `.env.example` and set `GROQ_API_KEY`. The key remains server-side; it is not embedded in the frontend.
