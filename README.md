# SUPER AI STUDIO v4 — Full AI Chat UI + Backend

## Added in this version

- Chat-style interface
- Settings panel
- Backend URL setting
- AI model label setting
- Default mode setting
- Dark/light theme
- Send-on-Enter setting
- Auto-save chat history
- Recent chats
- New chat
- Clear saved chats
- Quick prompt buttons
- Multiple image selection
- Multiple video selection
- Image + video selection together
- Individual attachment removal
- Drag-and-drop media
- Chat mode
- Image → Video mode
- Text → Video mode
- Edit Media mode
- AI chat backend
- 5-minute long-form video orchestration
- Scene planning
- Video-provider integration
- FFmpeg scene merging
- Job status
- Cancel request

## Run

Install Node.js LTS and FFmpeg.

cd backend
npm install

Copy `.env.example` to `.env` and set your Groq API key (free — get one at https://console.groq.com/keys).

npm start

Open:
http://localhost:3000

## API

GET  /api/health
POST /api/ai/chat
POST /api/video/long
GET  /api/video/long/status/:id
POST /api/video/long/cancel/:id

## Important

The backend keeps API keys server-side. The browser does not contain provider secrets.

The 5-minute generator is an orchestration pipeline: AI creates scenes, your configured
video-generation provider generates scene clips, and FFmpeg merges them.

Different video providers have different API schemas. If needed, adapt only
`providerGenerate()` and `providerWait()` in `backend/server.js`.

## Chat + image understanding

- **Chat** is general-purpose: normal questions, explanations, writing, coding, Tamil/Tanglish, etc.
- Attach an image in Chat and the AI can inspect it, answer questions about it, read visible text, and generate accurate alt text.
- **Studio** is kept specialized for video scripts, scene plans, narration, shots, transitions, and editing directions.
- Image requests automatically use the configured `GROQ_VISION_MODEL` (default: `qwen/qwen3.6-27b`).
- The browser compresses oversized images before sending them, and sends at most 5 images to the vision model.

## Math Lab

SUPER AI STUDIO now includes a dedicated **Math** mode in addition to Chat and Studio.

Math mode can:
- solve equations and math problems
- read mathematical equations from uploaded images
- correct obvious OCR mistakes
- generate Presentation MathML
- generate LaTeX
- generate HTML + MathML
- generate Unicode/plain-text math
- generate AsciiMath
- generate SVG source when requested
- generate JSON expression data when requested

For a request such as **"convert this equation to all formats"**, Math mode is instructed to return the corrected equation followed by MathML, LaTeX, HTML/MathML, Unicode, AsciiMath, and SVG when useful.

The UI remains clean: the home screen keeps only **What can I create for you?** and the extra format controls are available only through the Math mode prompt.


## Code Doctor (Advanced)
The Code Doctor mode accepts individual source/config files and ZIP projects. It performs AI review for syntax, logic, integration, security, performance, and compatibility issues, plus a lightweight pre-scan for common path/JSON/secret mistakes. ZIP extraction is limited to common source/config extensions and ignores node_modules, build, dist, and .git folders.
