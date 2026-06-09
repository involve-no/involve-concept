# Stage 1: Build the Next.js application
FROM node:20-alpine AS builder

# Install system build tools required for compiling native modules like better-sqlite3
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Setup the production runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Install system dependencies required for native modules at runtime
RUN apk add --no-cache python3 make g++

COPY package*.json ./

# Install only production dependencies (re-compiles better-sqlite3 for production Alpine environment)
RUN npm ci --only=production

# Copy compilation output and assets
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/FIFA2026_schedule.json ./FIFA2026_schedule.json
COPY --from=builder /app/src/scripts ./src/scripts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/src/lib ./src/lib
COPY --from=builder /app/WCup_2026_4.2.6_en.xlsx ./WCup_2026_4.2.6_en.xlsx

# Create directory for SQLite persistence
RUN mkdir -p /app/data

# Expose Next.js server port
EXPOSE 3000

# Run database migrations/seeding/teams update, then start production Next.js app
CMD ["sh", "-c", "npm run db:init && npm run start"]
