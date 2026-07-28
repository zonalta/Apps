# Etapa 1: compilar dist/ a partir de src/
FROM node:22-alpine AS compilacion
WORKDIR /app
COPY build.js ./
COPY src ./src
RUN node build.js

# Etapa 2: sólo lo necesario para servir
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

# Las dependencias van antes que el código para aprovechar la caché de capas.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js ./
COPY servidor ./servidor
COPY --from=compilacion /app/dist ./dist

# Cloud Run recomienda no ejecutar como root.
USER node

ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
