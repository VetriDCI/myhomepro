FROM node:22-slim

# ffmpeg is required for the long-form video merging feature
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install backend dependencies
COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm install --omit=dev

# Copy the rest of the project (backend serves /frontend as static files)
COPY backend ./backend
COPY frontend ./frontend

WORKDIR /app/backend

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
