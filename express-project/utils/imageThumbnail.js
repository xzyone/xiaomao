const fs = require('fs');
const path = require('path');
const config = require('../config/config');

const ORIGINAL_IMAGE_ROUTE = '/api/files/images/';
const THUMBNAIL_ROUTE = '/api/files/thumbnails/';
const THUMBNAIL_WIDTH = 720;
const THUMBNAIL_HEIGHT = 1280;
const THUMBNAIL_QUALITY = 78;

let sharpInstance = null;
const generationTasks = new Map();

function getSharp() {
  if (!sharpInstance) {
    // Sharp is installed explicitly in the production Docker image.
    // Lazy loading keeps non-media startup paths usable and makes failures clearer.
    sharpInstance = require('sharp');
  }
  return sharpInstance;
}

function getUploadDir() {
  return path.join(process.cwd(), config.upload.image.local.uploadDir);
}

function isSafeFilename(filename) {
  return typeof filename === 'string'
    && filename.length > 0
    && filename.length <= 255
    && path.basename(filename) === filename
    && /^[a-zA-Z0-9._-]+$/.test(filename);
}

function getLocalImageFilename(imageUrl) {
  if (typeof imageUrl !== 'string') return null;

  const cleanUrl = imageUrl.split('#')[0].split('?')[0];
  const routeIndex = cleanUrl.indexOf(ORIGINAL_IMAGE_ROUTE);
  if (routeIndex < 0) return null;

  const encodedFilename = cleanUrl.slice(routeIndex + ORIGINAL_IMAGE_ROUTE.length);
  if (!encodedFilename || encodedFilename.includes('/')) return null;

  let filename;
  try {
    filename = decodeURIComponent(encodedFilename);
  } catch (error) {
    return null;
  }

  return isSafeFilename(filename) ? filename : null;
}

function buildThumbnailUrl(imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl.includes(ORIGINAL_IMAGE_ROUTE)) {
    return imageUrl;
  }
  return imageUrl.replace(ORIGINAL_IMAGE_ROUTE, THUMBNAIL_ROUTE);
}

function getThumbnailPath(filename) {
  if (!isSafeFilename(filename)) return null;
  const thumbnailDir = path.join(getUploadDir(), 'thumbnails');
  const outputName = `${path.parse(filename).name}.webp`;
  return path.join(thumbnailDir, outputName);
}

async function renderThumbnail(input) {
  return getSharp()(input, { failOn: 'none', limitInputPixels: 100000000 })
    .rotate()
    .resize({
      width: THUMBNAIL_WIDTH,
      height: THUMBNAIL_HEIGHT,
      fit: 'inside',
      withoutEnlargement: true,
      fastShrinkOnLoad: true
    })
    .webp({ quality: THUMBNAIL_QUALITY, effort: 4 })
    .toBuffer();
}

async function writeThumbnail(filename, source) {
  const thumbnailPath = getThumbnailPath(filename);
  if (!thumbnailPath) return null;

  if (fs.existsSync(thumbnailPath)) {
    return thumbnailPath;
  }

  if (generationTasks.has(thumbnailPath)) {
    return generationTasks.get(thumbnailPath);
  }

  const task = (async () => {
    const thumbnailDir = path.dirname(thumbnailPath);
    await fs.promises.mkdir(thumbnailDir, { recursive: true });

    if (fs.existsSync(thumbnailPath)) return thumbnailPath;

    const thumbnailBuffer = await renderThumbnail(source);
    const tempPath = `${thumbnailPath}.${process.pid}.${Date.now()}.tmp`;

    try {
      await fs.promises.writeFile(tempPath, thumbnailBuffer);
      try {
        await fs.promises.rename(tempPath, thumbnailPath);
      } catch (error) {
        if (error.code === 'EEXIST' || error.code === 'EPERM') {
          await fs.promises.unlink(tempPath).catch(() => {});
        } else {
          throw error;
        }
      }
    } finally {
      if (fs.existsSync(tempPath)) {
        await fs.promises.unlink(tempPath).catch(() => {});
      }
    }

    return thumbnailPath;
  })();

  generationTasks.set(thumbnailPath, task);
  try {
    return await task;
  } finally {
    generationTasks.delete(thumbnailPath);
  }
}

async function createLocalThumbnailFromBuffer(fileBuffer, imageUrl) {
  const filename = getLocalImageFilename(imageUrl);
  if (!filename || !Buffer.isBuffer(fileBuffer)) return null;

  await writeThumbnail(filename, fileBuffer);
  return buildThumbnailUrl(imageUrl);
}

async function ensureLocalThumbnail(filename, originalFilePath) {
  if (!isSafeFilename(filename) || !originalFilePath) return null;
  return writeThumbnail(filename, originalFilePath);
}

module.exports = {
  ORIGINAL_IMAGE_ROUTE,
  THUMBNAIL_ROUTE,
  THUMBNAIL_WIDTH,
  THUMBNAIL_HEIGHT,
  THUMBNAIL_QUALITY,
  buildThumbnailUrl,
  getLocalImageFilename,
  getThumbnailPath,
  createLocalThumbnailFromBuffer,
  ensureLocalThumbnail
};
