FROM node:22-alpine AS build
WORKDIR /app/afrolife
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./tsconfig.json
COPY migrations ./migrations
COPY scripts/copy-migrations.mjs ./scripts/copy-migrations.mjs
COPY src ./src
COPY services/agency-domain/runtime.ts ./services/agency-domain/runtime.ts
COPY services/workforce-management ./services/workforce-management
COPY services/staffing ./services/staffing
COPY services/property-management ./services/property-management
COPY services/marketplace ./services/marketplace
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3010
WORKDIR /app/afrolife
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build --chown=node:node /app/afrolife/dist ./dist
COPY --chown=node:node migrations ./dist/migrations
COPY --chown=node:node public ./public
RUN mkdir -p data/private-files && chown -R node:node data
USER node
EXPOSE 3010
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3010)+'/readyz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/src/server.js"]
