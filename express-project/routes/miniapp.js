const express = require('express');
const router = express.Router();
const { RESPONSE_CODES } = require('../constants');
const { getMiniappReadonlyMode } = require('../utils/miniappPolicy');

router.get('/config', async (req, res) => {
  try {
    const readonlyMode = await getMiniappReadonlyMode();

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: 'success',
      data: {
        readonly_mode: readonlyMode,
        interactive_enabled: !readonlyMode
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
