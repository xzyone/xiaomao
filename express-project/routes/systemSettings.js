const express = require('express');
const router = express.Router();
const { HTTP_STATUS, RESPONSE_CODES } = require('../constants');
const { adminAuth } = require('../utils/uploadHelper');
const { REVIEW_MODES, getReviewMode, setReviewMode } = require('../utils/reviewPolicy');

const MODE_LABELS = {
  [REVIEW_MODES.NONE]: '全站免审',
  [REVIEW_MODES.VERIFIED]: '认证免审',
  [REVIEW_MODES.ALL]: '全站审核'
};

router.get('/', adminAuth, async (req, res) => {
  try {
    const postReviewMode = await getReviewMode();
    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: 'success',
      data: {
        post_review_mode: postReviewMode
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
    const { post_review_mode: postReviewMode } = req.body;
    if (!Object.values(REVIEW_MODES).includes(postReviewMode)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: RESPONSE_CODES.VALIDATION_ERROR,
        message: '无效的审核模式'
      });
    }

    await setReviewMode(postReviewMode);
    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: `审核模式已切换为“${MODE_LABELS[postReviewMode]}”`,
      data: {
        post_review_mode: postReviewMode
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
