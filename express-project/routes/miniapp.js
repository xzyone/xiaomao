const express = require('express');
const router = express.Router();
const { RESPONSE_CODES } = require('../constants');
const { getMiniappReadonlyMode, getMiniappUiConfig } = require('../utils/miniappPolicy');

const READONLY_UI_KEYS = Object.freeze({
  titles: ['home', 'detail', 'login', 'profile'],
  labels: [
    'homeBrand',
    'homeSubtitle',
    'recommend',
    'loading',
    'reachedEnd',
    'emptyContent',
    'navHome',
    'navProfile',
    'anonymousUser',
    'loginBrand',
    'loginSubtitle',
    'loginAccount',
    'loginPassword',
    'loginSubmit',
    'loginHint',
    'profileAccountPrefix',
    'profileEmptyBio',
    'profileFollowing',
    'profileFans',
    'profileLikes',
    'profileLogout',
    'profileGuestTitle',
    'profileGoLogin',
    'detailOriginal',
    'detailViews'
  ],
  placeholders: [
    'loginAccount',
    'loginPassword'
  ],
  messages: [
    'loginCredentialsRequired',
    'loginSuccess',
    'loginFailed',
    'sessionUnavailable',
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

function getReadonlyUiConfig(ui = {}) {
  const result = {};

  for (const [group, keys] of Object.entries(READONLY_UI_KEYS)) {
    const values = pickUiValues(ui[group] || {}, keys);
    if (Object.keys(values).length > 0) result[group] = values;
  }

  return result;
}

router.get('/config', async (req, res) => {
  try {
    const readonlyModeEnabled = await getMiniappReadonlyMode();
    const ui = await getMiniappUiConfig();

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: 'success',
      data: {
        readonlyConfig: {
          readonlyModeEnabled
        },
        ui: readonlyModeEnabled ? getReadonlyUiConfig(ui) : ui
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
