# Base Stage: Install common dependencies and tools
FROM node:24-slim AS base
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
	python3 \
	python3-pip \
	python3-certifi \
	python3-full \
	wget \
	ca-certificates \
	libnss3 \
	libnspr4 \
	libatk1.0-0 \
	libatk-bridge2.0-0 \
	libcups2 \
	libdrm2 \
	libxkbcommon0 \
	libxcomposite1 \
	libxdamage1 \
	libxext6 \
	libxfixes3 \
	libxrandr2 \
	libgbm1 \
	libasound2 \
	libpango-1.0-0 \
	libcairo2 \
	&& wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp \
	&& chmod a+rx /usr/local/bin/yt-dlp \
	# Create a virtual environment for python packages to avoid PEP 668 issues
	&& python3 -m venv /opt/venv \
	&& /opt/venv/bin/pip install --no-cache-dir brotli \
	&& apt-get clean && rm -rf /var/lib/apt/lists/*

# Add venv to PATH so yt-dlp can find brotli
ENV PATH="/opt/venv/bin:$PATH"

USER node
# Install Playwright Chromium browser
RUN npx playwright install chromium
USER root

# Build Stage: Build the application
FROM base AS build
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./ 
RUN pnpm install
COPY . .
RUN pnpm build

# Run Stage: Final image for running the application
FROM base
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules

USER node
EXPOSE 3001
CMD ["node", "dist/index.js"]
