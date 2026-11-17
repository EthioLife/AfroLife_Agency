FROM node:22-alpine AS build
WORKDIR /app/afrolife
COPY package.json package-lock.json ./
RUN npm ci
COPY src ./src
COPY public/accounting-operations.js ./public/accounting-operations.js
COPY services/accounting ./services/accounting
COPY scripts/copy-accounting-assets.mjs ./scripts/copy-accounting-assets.mjs
RUN npm run build:accounting

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app/afrolife
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/afrolife/dist ./dist
COPY services/accounting/001_accounting.sql ./dist/services/accounting/001_accounting.sql
COPY services/accounting/002_accounting_workflows.sql ./dist/services/accounting/002_accounting_workflows.sql
COPY services/accounting/003_accounting_entity_access.sql ./dist/services/accounting/003_accounting_entity_access.sql
COPY services/accounting/004_accounting_transaction_controls.sql ./dist/services/accounting/004_accounting_transaction_controls.sql
COPY services/accounting/005_accounting_subscriber_ownership.sql ./dist/services/accounting/005_accounting_subscriber_ownership.sql
COPY services/accounting/web ./dist/services/accounting/web
EXPOSE 3301
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3301)+'/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/services/accounting/server.js"]
