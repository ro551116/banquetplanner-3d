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
# server-side SVG rendering imports these from the repo root
COPY --from=build /app/components ./components
COPY --from=build /app/types.ts /app/trussConfig.ts /app/constants.ts ./
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
ENV DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 3000
CMD ["npx", "tsx", "server/index.ts"]
