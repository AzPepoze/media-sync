# Media Sync

<p align="center">
  <img src="assets/logo.png" alt="Media Sync Logo" width="180" />
</p>

A real-time video synchronization tool designed to watch HLS streams together with friends, featuring advanced bypass for CORS and Referer restrictions.

## Contents

1. [Features](#features)
2. [Prerequisites](#prerequisites)
3. [Environment Variables](#environment-variables)
4. [Installation](#installation)
5. [Usage](#usage)

## Features

- Real-time synchronization of playback state (Play, Pause, Seek).
- Advanced video resolver using yt-dlp and browser automation.
- Built-in proxy to bypass CORS, Referer, and Mixed Content blocks.
- Smart buffering sync that pauses for everyone if a participant lags.
- Segment-level caching for improved performance in synchronized rooms.

## Prerequisites

- Docker and Docker Compose (Recommended)
- Node.js (LTS version)
- pnpm

## Environment Variables

Copy the example configuration to create your environment file:

```bash
cp .env.example .env
```

Ensure the following variables are defined:
- BACKEND_URL: The internal or external address of the backend service.
- FRONTEND_URL: The address where the web interface is accessible.

## Installation

### Using Docker

The easiest way to deploy the application is using Docker Compose:

```bash
docker-compose up -d --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001

### Local Development

#### Backend
```bash
cd backend
pnpm install
pnpm dev
```

#### Frontend
```bash
cd frontend
pnpm install
pnpm dev
```

## Usage

1. Join a Room: Enter a nickname and a unique Room ID.
2. Load Media: Paste a direct stream link (.m3u8, .mp4) or a supported website URL.
3. Optional Referer: If the stream is protected, provide the source website URL to bypass 403 errors.
4. Watch Together: Control actions from any user will sync instantly across all participants.