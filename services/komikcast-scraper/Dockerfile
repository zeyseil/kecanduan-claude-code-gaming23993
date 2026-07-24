# Playwright's official base image ships all Chromium system libraries, so
# patchright's patched Chromium build runs without extra apt installs.
FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app

# Install deps first (better layer caching).
COPY package.json ./
RUN npm install --omit=dev

# Download patchright's patched Chromium into the image.
RUN npx patchright install chromium

COPY src ./src

ENV NODE_ENV=production
# Render injects $PORT; default matches server.js fallback for local runs.
ENV PORT=10000
EXPOSE 10000

CMD ["node", "src/server.js"]
