const express = require('express');
const router = express.Router();
const { RESPONSE_CODES } = require('../constants');
const { getMiniappReadonlyMode, getMiniappUiConfig } = require('../utils/miniappPolicy');

router.get('/config', async (req, res) => {
  try {
    const [auditModeEnabled, ui] = await Promise.all([
      getMiniappReadonlyMode(),
      getMiniappUiConfig()
    ]);

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: 'success',
      data: {
        auditConfig: {
          auditModeEnabled
        },
        ui
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
