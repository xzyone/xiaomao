const express = require('express');
const router = express.Router();
const fs = require('fs');
const { validateImageFile, validateVideoFile } = require('../utils/fileHelpers');
const { HTTP_STATUS, RESPONSE_CODES } = require('../constants');
const { ensureLocalThumbnail } = require('../utils/imageThumbnail');

const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

function pipeFile(res, filePath, options = {}) {
  const fileStream = fs.createReadStream(filePath, options);
  fileStream.pipe(res);

  fileStream.on('error', (err) => {
    console.error('文件读取错误:', err);
    if (!res.headersSent) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        code: RESPONSE_CODES.ERROR,
        message: '文件读取失败'
      });
    } else {
      res.destroy(err);
    }
    fileStream.destroy();
  });

  fileStream.on('close', () => {
    fileStream.destroy();
  });

  res.on('close', () => {
    fileStream.destroy();
  });
}

function parseByteRange(rangeHeader, fileSize) {
  if (!rangeHeader || !Number.isFinite(fileSize) || fileSize <= 0) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader).trim());
  if (!match) return null;

  const startText = match[1];
  const endText = match[2];
  let start;
  let end;

  if (!startText && endText) {
    const suffixLength = Number(endText);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else {
    start = Number(startText);
    end = endText ? Number(endText) : fileSize - 1;
  }

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= fileSize) {
    return null;
  }

  return { start, end: Math.min(end, fileSize - 1) };
}

router.get('/thumbnails/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const original = await validateImageFile(filename);

    if (!original.valid) {
      return res.status(original.statusCode).json({
        code: original.statusCode,
        message: '文件访问失败'
      });
    }

    try {
      const thumbnailPath = await ensureLocalThumbnail(filename, original.filePath);
      if (thumbnailPath && fs.existsSync(thumbnailPath)) {
        const stat = await fs.promises.stat(thumbnailPath);
        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Cache-Control', IMMUTABLE_CACHE);
        pipeFile(res, thumbnailPath);
        return;
      }
    } catch (error) {
      // 缩略图生成失败时退回原图，避免首页出现破图。
      console.warn(`缩略图生成失败，回退原图 ${filename}:`, error.message);
    }

    res.setHeader('Content-Type', original.contentType);
    res.setHeader('Content-Length', original.fileSize);
    res.setHeader('Cache-Control', 'public, max-age=300');
    pipeFile(res, original.filePath);
  } catch (error) {
    console.error('缩略图访问错误:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: '服务器错误'
    });
  }
});

router.get('/images/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const result = await validateImageFile(filename);

    if (!result.valid) {
      return res.status(result.statusCode).json({
        code: result.statusCode,
        message: '文件访问失败'
      });
    }

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Length', result.fileSize);
    res.setHeader('Cache-Control', IMMUTABLE_CACHE);

    pipeFile(res, result.filePath);
  } catch (error) {
    console.error('图片访问错误:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: '服务器错误'
    });
  }
});

router.get('/videos/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const result = await validateVideoFile(filename);

    if (!result.valid) {
      return res.status(result.statusCode).json({
        code: result.statusCode,
        message: '文件访问失败'
      });
    }

    const fileSize = Number(result.fileSize);
    const rangeHeader = req.headers.range;

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', IMMUTABLE_CACHE);

    if (!rangeHeader) {
      res.setHeader('Content-Length', fileSize);
      pipeFile(res, result.filePath);
      return;
    }

    const range = parseByteRange(rangeHeader, fileSize);
    if (!range) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      return res.status(416).end();
    }

    const chunkSize = range.end - range.start + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${fileSize}`);
    res.setHeader('Content-Length', chunkSize);

    pipeFile(res, result.filePath, { start: range.start, end: range.end });
  } catch (error) {
    console.error('视频访问错误:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: '服务器错误'
    });
  }
});

module.exports = router;
