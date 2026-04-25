# syntax=docker/dockerfile:1

# ---------- builder ----------
FROM node:20-slim AS builder
WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc -p tsconfig.json

# Drop dev deps so the runtime stage gets a slim node_modules.
RUN npm prune --omit=dev


# ---------- runtime ----------
FROM node:20-slim AS runtime
WORKDIR /app

# Stockfish 18 — official AVX2 build. NNUE network is embedded in the binary.
# Cloud Run instances support AVX2; if you ever target a CPU without it, swap
# the URL for stockfish-ubuntu-x86-64-modern.tar (slower but broader compat).
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && curl -fsSL https://github.com/official-stockfish/Stockfish/releases/download/sf_18/stockfish-ubuntu-x86-64-avx2.tar \
    -o /tmp/stockfish.tar \
 && tar -xf /tmp/stockfish.tar -C /tmp \
 && mv /tmp/stockfish/stockfish-ubuntu-x86-64-avx2 /usr/local/bin/stockfish \
 && chmod +x /usr/local/bin/stockfish \
 && apt-get purge -y curl \
 && apt-get autoremove -y \
 && rm -rf /tmp/stockfish /tmp/stockfish.tar /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

ENV NODE_ENV=production
ENV PORT=8080
ENV STOCKFISH_PATH=/usr/local/bin/stockfish

EXPOSE 8080
CMD ["node", "dist/index.js"]
