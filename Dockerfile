FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:20-alpine AS server
ENV NODE_ENV=production
ENV PORT=10000
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/src ./src
COPY --from=client-build /app/client/dist ./client-dist
ENV CLIENT_DIST=/app/server/client-dist
EXPOSE 10000
CMD ["npm", "start"]
