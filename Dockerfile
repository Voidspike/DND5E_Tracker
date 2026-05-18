# ── Stage 1: Build ──
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for all workspaces
COPY package*.json ./
COPY shared/package.json shared/
COPY client/package.json client/
COPY server/package.json server/

# Install all dependencies
RUN npm install

# Copy source code
COPY shared/ shared/
COPY client/ client/
COPY server/ server/

# Build shared types
RUN npx tsc -p shared/tsconfig.json --outDir shared/dist 2>/dev/null || true

# Build server
RUN npx tsc -p server/tsconfig.json

# Compile seed script to JS (so it runs without tsx in production)
RUN npx tsc server/prisma/seed.ts --outDir server/dist --module commonjs --target ES2020 --esModuleInterop --resolveJsonModule --skipLibCheck --moduleResolution node

# Build client
RUN npx vite build --outDir dist client/

# ── Stage 2: Production ──
FROM node:20-alpine

# Prisma requires OpenSSL on Alpine
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files for production install
COPY package*.json ./
COPY shared/package.json shared/
COPY server/package.json server/

# Install only production dependencies
RUN npm install --omit=dev

# Copy built artifacts from builder
COPY --from=builder /app/server/dist /app/server/dist
COPY --from=builder /app/server/prisma /app/server/prisma
COPY --from=builder /app/client/dist /app/client/dist

# Generate Prisma client
RUN cd server && npx prisma generate

# Copy entrypoint
COPY docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["/app/docker-entrypoint.sh"]
