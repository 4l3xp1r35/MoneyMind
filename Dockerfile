FROM node:20-alpine

# Native module dependencies (bcrypt needs python/make/g++)
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# Enable pnpm
RUN corepack enable pnpm

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js (production)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

# Run DB migrations then start
CMD ["sh", "-c", "npx prisma migrate deploy && pnpm start"]
