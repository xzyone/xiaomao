const express = require('express');
const router = express.Router();
const { RESPONSE_CODES } = require('../constants');
const { getMiniappReadonlyMode, getMiniappUiConfig } = require('../utils/miniappPolicy');

const AUDIT_UI_KEYS = Object.freeze({
  titles: ['home', 'detail'],
  labels: [
    'homeBrand',
    'homeSubtitle',
    'recommend',
    'loading',
    'reachedEnd',
    'emptyContent',
    'navHome',
    'postVideo',
    'anonymousUser',
    'detailOriginal',
    'detailViews'
  ],
  messages: [
    'loadFailed',
    'detailLoadFailed',
    'detailOriginalLoading',
    'detailOriginalFailed'
  ]
});

function pickUiValues(source = {}, keys = []) {
  const result = {};
  for (const key of keys) {
    if (typeof source[key] === 'string' && source[key].trim()) {
      result[key] = source[key];
    }
  }
  return result;
}

function getAuditUiConfig(ui = {}) {
  const result = {};

  for (const [group, keys] of Object.entries(AUDIT_UI_KEYS)) {
    const values = pickUiValues(ui[group] || {}, keys);
    if (Object.keys(values).length > 0) result[group] = values;
  }

  return result;
}

router.get('/config', async (req, res) => {
  try {
    const auditModeEnabled = await getMiniappReadonlyMode();
    const ui = await getMiniappUiConfig();

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: 'success',
      data: {
        auditConfig: {
          auditModeEnabled
        },
        ui: auditModeEnabled ? getAuditUiConfig(ui) : ui
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
