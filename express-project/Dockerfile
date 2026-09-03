FROM node:20-alpine

WORKDIR /app

# Copy application source first. node_modules is excluded by .dockerignore.
# Installing dependencies after the final COPY prevents a later COPY layer from
# replacing or emptying files created by npm ci on some NAS/overlay setups.
COPY --chown=node:node . .

RUN npm ci --omit=dev \
    && npm install --omit=dev --no-save --package-lock=false --include=optional sharp@0.34.4 \
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
