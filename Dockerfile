# Штатив: multi-stage сборка Next.js.
# Итоговый образ — только standalone-сервер (см. output: "standalone" в next.config.mjs).

# ---------- deps: полные node_modules (нужны для сборки) ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- build: сборка Next.js ----------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- runtime: минимальный образ для запуска ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# su-exec — понизить права с root до nextjs после чинения прав на data
RUN apk add --no-cache su-exec \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY docker/app-entrypoint.sh /usr/local/bin/app-entrypoint
# sed — страховка от CRLF, если репозиторий чекаутится на Windows
RUN sed -i 's/\r$//' /usr/local/bin/app-entrypoint && chmod +x /usr/local/bin/app-entrypoint

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# нативные бинарники sharp не всегда попадают в трассировку standalone — кладём явно
COPY --from=deps /app/node_modules/@img ./node_modules/@img

RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/app-entrypoint"]
CMD ["node", "server.js"]
