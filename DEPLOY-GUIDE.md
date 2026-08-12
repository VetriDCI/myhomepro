# Online la Deploy Panna - Step by Step (Render.com - FREE)

## Yean Render?
- Free ah start panlaam
- ffmpeg venum (video merge ku), athuku Docker support venum → Render la irukku
- Beginner friendly, GitHub connect pannina automatic deploy aagum

---

## Step 1: GitHub la code upload pannunga

1. https://github.com ku poyi account create pannunga (illa na login pannunga)
2. New repository create pannunga (example: `super-ai-studio`) — **Private** vachiko, key safe ah irukum
3. Idha unga computer la terminal open panni run pannunga (idha zip extract panna folder la):

```bash
git init
git add .
git commit -m "Super AI Studio v4"
git branch -M main
git remote add origin https://github.com/UNGA-USERNAME/super-ai-studio.git
git push -u origin main
```

(`UNGA-USERNAME` and `super-ai-studio` unga actual GitHub username/repo name ah maathunga)

**Important:** `.env` file ah GitHub la push pannadheenga — adhula real API key irukum. Idhu already `backend/.env` nu irundha, add pannadheenga (`.env.example` mattum push pannunga).

---

## Step 2: Render.com la account create pannunga

1. https://render.com ku poyi **"Get Started"** click pannunga
2. GitHub account use panni sign up pannunga (easy)

---

## Step 3: New Web Service create pannunga

1. Render dashboard la **"New +"** → **"Blueprint"** click pannunga
   (Idhu `render.yaml` file ah automatic ah detect pannidum)
2. Unga GitHub repo select pannunga (`super-ai-studio`)
3. Render automatic ah `render.yaml` padichi, service create pannidum

**Illa na manual ah pannanum na:**
1. **"New +"** → **"Web Service"**
2. GitHub repo connect pannunga
3. **Runtime:** Docker select pannunga
4. **Plan:** Free select pannunga

---

## Step 4: API Key set pannunga (IMPORTANT)

Render dashboard la, unga service open panni:
1. **Environment** tab ku poonga
2. **Add Environment Variable** click pannunga:
   - Key: `OPENAI_API_KEY`  →  Value: unga real OpenAI key
   - Key: `OPENAI_MODEL`  →  Value: `gpt-4o`

(`.env` file idha edukum, Render dashboard la direct set pannanum — server code la already adha automatic ah padikum)

---

## Step 5: Deploy

- **"Create Web Service"** / **"Apply"** click pannunga
- 2-5 minutes wait pannunga (Docker build aagum, ffmpeg install aagum)
- Deploy complete aana, oru URL kudukum:
  `https://super-ai-studio-xxxx.onrender.com`

Andha URL open pannina, unga app direct browser la work aagum — settings la backend URL edhuvum maatha venaam, automatic ah correct URL use pannidum.

---

## Free plan oru chinna note

Render free plan la, 15 mins traffic illana service "sleep" aagum. Adhu again first request vந்தum bodhu ~30-50 seconds wake-up time edukum. Idhu paid plan ($7/month) la illa.

---

## 5-min Video generation feature (Optional)

Idhu venumna, `VIDEO_GENERATION_URL`, `VIDEO_STATUS_URL`, `VIDEO_API_KEY` — moonrum oru external video-generation provider (example: Runway, Pika, Replicate) API la irundhu edukanum. Idhu illama chat mode full ah work aagum, video-generation mattum "Configure..." error tharum.
