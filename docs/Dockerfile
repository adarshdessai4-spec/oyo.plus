# Simple production image for OYO.plus site
FROM node:18-alpine
WORKDIR /app
# Only copy the minimal runtime assets (no dev deps)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm i --omit=dev
COPY . .
ENV HOST=0.0.0.0 PORT=8080 NODE_ENV=production
EXPOSE 8080
CMD ["node","server.js"]
