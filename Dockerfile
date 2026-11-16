FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY public ./public
COPY server ./server
COPY db ./db
COPY scripts/database.mjs ./scripts/database.mjs
ENV NODE_ENV=production LISTEN_HOST=0.0.0.0 PORT=3000 DATA_DIR=/app/data
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["node", "server/local.mjs"]
