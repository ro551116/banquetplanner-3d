# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx vite build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
# The server imports shared code at runtime: SVG diagrams from components/, scene normalization from services/,
# and planning, truss and hall preset rules from the repo root.
COPY --from=build /app/components ./components
COPY --from=build /app/services ./services
COPY --from=build /app/*.ts ./
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
ENV DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 3000
CMD ["npx", "tsx", "server/index.ts"]
