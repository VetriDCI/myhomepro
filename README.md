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

Copy `.env.example` to `.env` and set your API keys.

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
