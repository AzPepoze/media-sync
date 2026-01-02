# Media Sync

A real-time video watch party application that lets you watch HLS streams together with friends in perfect sync.

## What it is?

This app allows multiple users to watch a video at the exact same time. It synchronizes Play, Pause, and Seeking actions across all participants.

**Key Strength:** It includes a smart proxy to bypass CORS, Mixed Content, and Referer protection, allowing you to play streams that are normally blocked (like `.txt` HLS manifests or hotlink-protected videos).

## 🚀 How to use?

### 1. Setup & Run

You need to start both the server and the client:

**Backend (Server):**

```bash
cd backend
pnpm install
pnpm dev
```

**Frontend (Client):**

```bash
cd frontend
pnpm install
pnpm dev
```

### 2. Join a Room

- Open the app in your browser (usually `http://localhost:5173`).
- Enter your **Nickname** and a **Room ID**.
- Click **Join Room**.

### 3. Load a Video

- **Video URL:** Paste your `.m3u8` or `.txt` HLS link.
- **Referer URL (Optional):** If the video doesn't load or shows 403, paste the URL of the website where the video came from here.
- Click **Load**.

### 4. Watch Together

- Everyone in the same room will see the same video.
- If someone pauses or seeks, it changes for everyone.
- If a user's connection is slow (buffering), the video will automatically pause for everyone else until they are ready.
