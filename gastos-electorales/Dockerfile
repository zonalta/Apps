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

# Cloud Run recomienda no ejecutar como root.
COPY server.js package.json ./
COPY --from=compilacion /app/dist ./dist
USER node

# Cloud Run inyecta PORT; 8080 es su valor por defecto.
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
