const express = require('express');
const router = express.Router();
const { HTTP_STATUS, RESPONSE_CODES } = require('../constants');
const { adminAuth } = require('../utils/uploadHelper');
const { REVIEW_MODES, getReviewMode, setReviewMode } = require('../utils/reviewPolicy');
const { getMiniappReadonlyMode, setMiniappReadonlyMode } = require('../utils/miniappPolicy');

const MODE_LABELS = {
  [REVIEW_MODES.NONE]: '全站免审',
  [REVIEW_MODES.VERIFIED]: '认证免审',
  [REVIEW_MODES.ALL]: '全站审核'
};

function parseReadonlyMode(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return null;
}

router.get('/', adminAuth, async (req, res) => {
  try {
    const [postReviewMode, miniappReadonlyMode] = await Promise.all([
      getReviewMode(),
      getMiniappReadonlyMode()
    ]);

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: 'success',
      data: {
        post_review_mode: postReviewMode,
        miniapp_readonly_mode: miniappReadonlyMode
      }
    });
  } catch (error) {
    console.error('获取系统设置失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: '获取系统设置失败'
    });
  }
});

router.put('/', adminAuth, async (req, res) => {
  try {
    const hasPostReviewMode = Object.prototype.hasOwnProperty.call(req.body, 'post_review_mode');
    const hasMiniappReadonlyMode = Object.prototype.hasOwnProperty.call(req.body, 'miniapp_readonly_mode');

    if (!hasPostReviewMode && !hasMiniappReadonlyMode) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: RESPONSE_CODES.VALIDATION_ERROR,
        message: '没有需要更新的系统设置'
      });
    }

    const messages = [];

    if (hasPostReviewMode) {
      const postReviewMode = req.body.post_review_mode;
      if (!Object.values(REVIEW_MODES).includes(postReviewMode)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: RESPONSE_CODES.VALIDATION_ERROR,
          message: '无效的审核模式'
        });
      }

      await setReviewMode(postReviewMode);
      messages.push(`内容审核已切换为“${MODE_LABELS[postReviewMode]}”`);
    }

    if (hasMiniappReadonlyMode) {
      const miniappReadonlyMode = parseReadonlyMode(req.body.miniapp_readonly_mode);
      if (miniappReadonlyMode === null) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: RESPONSE_CODES.VALIDATION_ERROR,
          message: '无效的小程序审核模式'
        });
      }

      await setMiniappReadonlyMode(miniappReadonlyMode);
      messages.push(miniappReadonlyMode ? '小程序审核模式已开启' : '小程序审核模式已关闭');
    }

    const [currentPostReviewMode, currentMiniappReadonlyMode] = await Promise.all([
      getReviewMode(),
      getMiniappReadonlyMode()
    ]);

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: messages.join('；'),
      data: {
        post_review_mode: currentPostReviewMode,
        miniapp_readonly_mode: currentMiniappReadonlyMode
      }
    });
  } catch (error) {
    console.error('更新系统设置失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: '更新系统设置失败'
    });
  }
});

module.exports = router;
