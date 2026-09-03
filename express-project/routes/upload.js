const express = require('express');
const router = express.Router();
const { HTTP_STATUS, RESPONSE_CODES } = require('../constants');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const { uploadFile, uploadVideo } = require('../utils/uploadHelper');
const { parseSize } = require('../utils/fileHelpers');
const { createLocalThumbnailFromBuffer, buildThumbnailUrl } = require('../utils/imageThumbnail');
const config = require('../config/config');

const storage = multer.memoryStorage();

const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传图片文件'), false);
  }
};

const videoFileFilter = (req, file, cb) => {
  const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传视频文件'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: parseSize(config.upload.image.maxSize)
  }
});

const mixedFileFilter = (req, file, cb) => {
  if (file.fieldname === 'file') {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('只支持视频文件'), false);
    }
  } else if (file.fieldname === 'thumbnail') {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('缩略图只支持图片文件'), false);
    }
  } else {
    cb(new Error('不支持的文件字段'), false);
  }
};

const videoUpload = multer({
  storage: storage,
  fileFilter: mixedFileFilter,
  limits: {
    fileSize: parseSize(config.upload.video.maxSize)
  }
});

async function prepareLocalThumbnail(fileBuffer, imageUrl) {
  try {
    const thumbnailUrl = await createLocalThumbnailFromBuffer(fileBuffer, imageUrl);
    return thumbnailUrl || buildThumbnailUrl(imageUrl);
  } catch (error) {
    console.warn(`预生成缩略图失败 ${imageUrl}:`, error.message);
    return buildThumbnailUrl(imageUrl);
  }
}

router.post('/single', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ code: RESPONSE_CODES.VALIDATION_ERROR, message: '没有上传文件' });
    }

    const result = await uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    if (result.success) {
      const thumbnailUrl = await prepareLocalThumbnail(req.file.buffer, result.url);
      console.log(`单图片上传成功 - 用户ID: ${req.user.id}, 文件名: ${req.file.originalname}`);

      res.json({
        code: RESPONSE_CODES.SUCCESS,
        message: '上传成功',
        data: {
          originalname: req.file.originalname,
          size: req.file.size,
          url: result.url,
          thumbnailUrl
        }
      });
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json({ code: RESPONSE_CODES.VALIDATION_ERROR, message: result.message || '图床上传失败' });
    }
  } catch (error) {
    console.error('单图片上传失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: '上传失败' });
  }
});

router.post('/multiple', authenticateToken, upload.array('files', 9), async (req, res) => {
  try {
    if (!Array.isArray(req.files) || req.files.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        data: null,
        message: '没有上传文件'
      });
    }

    const files = req.files;
    const uploadResults = [];
    const errors = [];

    for (const file of files) {
      const result = await uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype
      );

      if (result.success) {
        const thumbnailUrl = await prepareLocalThumbnail(file.buffer, result.url);
        uploadResults.push({
          originalname: file.originalname,
          size: file.size,
          url: result.url,
          thumbnailUrl
        });
      } else {
        errors.push({ file: file.originalname, error: result.message });
      }
    }

    if (uploadResults.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        data: null,
        message: '所有图片上传失败'
      });
    }

    console.log(`多图片上传成功 - 用户ID: ${req.user.id}, 文件数量: ${uploadResults.length}`);

    res.json({
      success: true,
      data: {
        uploaded: uploadResults,
        errors,
        total: files.length,
        successCount: uploadResults.length,
        errorCount: errors.length
      },
      message: errors.length === 0 ? '所有图片上传成功' : `${uploadResults.length}张上传成功，${errors.length}张失败`
    });
  } catch (error) {
    console.error('多图片上传失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      data: null,
      message: '上传失败'
    });
  }
});

router.post('/video', authenticateToken, videoUpload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]), async (req, res) => {
  try {
    if (!req.files || !Array.isArray(req.files.file) || !req.files.file[0]) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: RESPONSE_CODES.VALIDATION_ERROR,
        message: '没有上传视频文件'
      });
    }

    const videoFile = req.files.file[0];
    const thumbnailFile = Array.isArray(req.files.thumbnail) ? req.files.thumbnail[0] : null;

    console.log(`视频上传开始 - 用户ID: ${req.user.id}, 视频文件: ${videoFile.originalname}`);
    if (thumbnailFile) {
      console.log(`包含前端生成的缩略图: ${thumbnailFile.originalname}`);
    }

    const uploadResult = await uploadVideo(
      videoFile.buffer,
      videoFile.originalname,
      videoFile.mimetype
    );

    if (!uploadResult.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: RESPONSE_CODES.VALIDATION_ERROR,
        message: uploadResult.message || '视频上传失败'
      });
    }

    let coverUrl = null;

    if (thumbnailFile) {
      try {
        console.log('使用前端生成的缩略图');
        const thumbnailUploadResult = await uploadFile(
          thumbnailFile.buffer,
          thumbnailFile.originalname,
          thumbnailFile.mimetype
        );

        if (thumbnailUploadResult.success) {
          coverUrl = thumbnailUploadResult.url;
          await prepareLocalThumbnail(thumbnailFile.buffer, coverUrl);
          console.log('前端缩略图上传成功:', coverUrl);
        } else {
          console.warn('前端缩略图上传失败:', thumbnailUploadResult.message);
        }
      } catch (error) {
        console.warn('前端缩略图处理失败:', error.message);
      }
    }

    console.log(`视频上传成功 - 用户ID: ${req.user.id}, 文件名: ${videoFile.originalname}, 缩略图: ${coverUrl ? '有' : '无'}`);

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: '上传成功',
      data: {
        originalname: videoFile.originalname,
        size: videoFile.size,
        url: uploadResult.url,
        filePath: uploadResult.filePath,
        coverUrl: coverUrl
      }
    });
  } catch (error) {
    console.error('视频上传失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: '上传失败'
    });
  }
});

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ code: RESPONSE_CODES.VALIDATION_ERROR, message: `文件大小超过限制（图片：${config.upload.image.maxSize}，视频：${config.upload.video.maxSize}）` });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ code: RESPONSE_CODES.VALIDATION_ERROR, message: '文件数量超过限制（9个）' });
    }
  }

  if (error.message === '只允许上传图片文件' || error.message === '只允许上传视频文件') {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ code: RESPONSE_CODES.VALIDATION_ERROR, message: error.message });
  }

  console.error('文件上传错误:', error);
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: RESPONSE_CODES.ERROR, message: '文件上传失败' });
});

module.exports = router;
