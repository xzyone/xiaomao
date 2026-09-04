const express = require('express');
const router = express.Router();
const { RESPONSE_CODES } = require('../constants');
const { getMiniappReadonlyMode } = require('../utils/miniappPolicy');

router.get('/config', async (req, res) => {
  try {
    const readonlyMode = await getMiniappReadonlyMode();
    const interactiveEnabled = !readonlyMode;

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: 'success',
      data: {
        mode: readonlyMode ? 'readonly' : 'interactive',
        readonly_mode: readonlyMode,
        interactive_enabled: interactiveEnabled,
        features: {
          browse: true,
          share: true,
          login: interactiveEnabled,
          profile: interactiveEnabled,
          publish: interactiveEnabled,
          comment: interactiveEnabled,
          like: interactiveEnabled,
          collect: interactiveEnabled
        }
      }
    });
  } catch (error) {
    console.error('获取小程序配置失败:', error);
    res.status(500).json({
      code: RESPONSE_CODES.ERROR,
      message: '获取小程序配置失败'
    });
  }
});

module.exports = router;
