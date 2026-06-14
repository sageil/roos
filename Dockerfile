FROM node:25-bookworm-slim AS deps

WORKDIR /app
RUN npm install -g pnpm@11.6.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY index.html tsconfig.json tsconfig.server.json vite.config.ts ./
COPY src ./src
COPY sql ./sql
RUN pnpm build
RUN pnpm prune --prod

FROM node:25-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8787

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/sql ./sql

EXPOSE 8787
CMD ["node", "dist/server/index.js"]
