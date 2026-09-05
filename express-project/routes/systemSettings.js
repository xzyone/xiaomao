const express = require('express');
const router = express.Router();
const { HTTP_STATUS, RESPONSE_CODES } = require('../constants');
const { adminAuth } = require('../utils/uploadHelper');
const { REVIEW_MODES, getReviewMode, setReviewMode } = require('../utils/reviewPolicy');
const {
  MINIAPP_UI_TITLE_KEYS,
  getMiniappReadonlyMode,
  setMiniappReadonlyMode,
  getMiniappUiConfig,
  setMiniappUiConfig
} = require('../utils/miniappPolicy');

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

function parseMiniappUiConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (!value.titles || typeof value.titles !== 'object' || Array.isArray(value.titles)) return null;

  const titles = {};
  let count = 0;

  for (const key of Object.keys(MINIAPP_UI_TITLE_KEYS)) {
    if (!Object.prototype.hasOwnProperty.call(value.titles, key)) continue;

    const title = typeof value.titles[key] === 'string' ? value.titles[key].trim() : '';
    if (!title || Array.from(title).length > 32) return null;
    titles[key] = title;
    count += 1;
  }

  return count > 0 ? { titles } : null;
}

router.get('/', adminAuth, async (req, res) => {
  try {
    const [postReviewMode, miniappReadonlyMode, miniappUi] = await Promise.all([
      getReviewMode(),
      getMiniappReadonlyMode(),
      getMiniappUiConfig()
    ]);

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: 'success',
      data: {
        post_review_mode: postReviewMode,
        miniapp_readonly_mode: miniappReadonlyMode,
        miniapp_ui: miniappUi
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
    const hasMiniappUi = Object.prototype.hasOwnProperty.call(req.body, 'miniapp_ui');

    if (!hasPostReviewMode && !hasMiniappReadonlyMode && !hasMiniappUi) {
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

    if (hasMiniappUi) {
      const miniappUi = parseMiniappUiConfig(req.body.miniapp_ui);
      if (!miniappUi) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: RESPONSE_CODES.VALIDATION_ERROR,
          message: '无效的小程序界面配置'
        });
      }

      await setMiniappUiConfig(miniappUi);
      messages.push('小程序界面文案已更新');
    }

    const [currentPostReviewMode, currentMiniappReadonlyMode, currentMiniappUi] = await Promise.all([
      getReviewMode(),
      getMiniappReadonlyMode(),
      getMiniappUiConfig()
    ]);

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: messages.join('；'),
      data: {
        post_review_mode: currentPostReviewMode,
        miniapp_readonly_mode: currentMiniappReadonlyMode,
        miniapp_ui: currentMiniappUi
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
