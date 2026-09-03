FROM node:22-alpine

WORKDIR /app

# Copy application source first. node_modules is excluded by .dockerignore.
# Install all production dependencies, including Sharp, in one npm pass. This
# avoids a second dependency-resolution/download step that is slow on NAS builds.
COPY --chown=node:node . .

RUN npm config set registry https://registry.npmmirror.com \
    && npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 10000 \
    && npm config set fetch-retry-maxtimeout 60000 \
    && npm config set fetch-timeout 120000 \
    && npm install --omit=dev --include=optional --no-audit --no-fund sharp@0.34.4 \
    && test -f /app/node_modules/express/package.json \
    && node -e "console.log('Node:', process.version, 'Express:', require.resolve('express'))" \
    && node -e "const sharp=require('sharp'); console.log('Sharp:', sharp.versions.sharp, 'libvips:', sharp.versions.vips)" \
    && npm cache clean --force

ENV NODE_ENV=production

USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

CMD ["npm", "start"]
