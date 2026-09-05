const { pool } = require('../config/config');
const { HTTP_STATUS, RESPONSE_CODES } = require('../constants');

const MINIAPP_SETTING_KEY = 'miniapp_readonly_mode';
const MINIAPP_CLIENT_HEADER = 'wechat-miniapp';
const MINIAPP_UI_TITLE_KEYS = Object.freeze({
  home: 'miniapp_title_home',
  detail: 'miniapp_title_detail',
  editor: 'miniapp_title_editor',
  login: 'miniapp_title_login',
  profile: 'miniapp_title_profile'
});
const MINIAPP_UI_TITLE_DEFAULTS = Object.freeze({
  home: '小毛毛',
  detail: '笔记详情',
  editor: '发布笔记',
  login: '登录',
  profile: '我的'
});
let ensureSettingsTablePromise = null;

async function ensureSystemSettingsTable() {
  if (!ensureSettingsTablePromise) {
    ensureSettingsTablePromise = (async () => {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS system_settings (
          setting_key varchar(100) NOT NULL,
          setting_value varchar(255) NOT NULL,
          updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (setting_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统设置'
      `);

      const defaults = [
        [MINIAPP_SETTING_KEY, '0'],
        ...Object.entries(MINIAPP_UI_TITLE_KEYS).map(([name, settingKey]) => [
          settingKey,
          MINIAPP_UI_TITLE_DEFAULTS[name]
        ])
      ];

      for (const [settingKey, settingValue] of defaults) {
        await pool.execute(
          'INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES (?, ?)',
          [settingKey, settingValue]
        );
      }
    })().catch(error => {
      ensureSettingsTablePromise = null;
      throw error;
    });
  }

  return ensureSettingsTablePromise;
}

async function getMiniappReadonlyMode() {
  await ensureSystemSettingsTable();

  const [rows] = await pool.execute(
    'SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1',
    [MINIAPP_SETTING_KEY]
  );

  if (rows.length === 0) return false;
  return String(rows[0].setting_value).toLowerCase() === '1' || String(rows[0].setting_value).toLowerCase() === 'true';
}

async function setMiniappReadonlyMode(enabled) {
  await ensureSystemSettingsTable();

  const value = enabled ? '1' : '0';
  await pool.execute(
    `INSERT INTO system_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [MINIAPP_SETTING_KEY, value]
  );

  return Boolean(enabled);
}

async function getMiniappUiConfig() {
  await ensureSystemSettingsTable();

  const settingKeys = Object.values(MINIAPP_UI_TITLE_KEYS);
  const placeholders = settingKeys.map(() => '?').join(', ');
  const [rows] = await pool.execute(
    `SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (${placeholders})`,
    settingKeys
  );

  const titles = { ...MINIAPP_UI_TITLE_DEFAULTS };
  const keyToName = Object.fromEntries(
    Object.entries(MINIAPP_UI_TITLE_KEYS).map(([name, settingKey]) => [settingKey, name])
  );

  for (const row of rows) {
    const name = keyToName[row.setting_key];
    const value = String(row.setting_value || '').trim();
    if (name && value) titles[name] = value;
  }

  return { titles };
}

async function setMiniappUiConfig(config = {}) {
  await ensureSystemSettingsTable();

  const titles = config && config.titles && typeof config.titles === 'object'
    ? config.titles
    : {};

  for (const [name, settingKey] of Object.entries(MINIAPP_UI_TITLE_KEYS)) {
    if (!Object.prototype.hasOwnProperty.call(titles, name)) continue;
    const value = String(titles[name] || '').trim();
    if (!value) continue;

    await pool.execute(
      `INSERT INTO system_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [settingKey, value]
    );
  }

  return getMiniappUiConfig();
}

function isMiniappRequest(req) {
  return String(req.headers['x-client-platform'] || '').toLowerCase() === MINIAPP_CLIENT_HEADER;
}

async function miniappReadonlyGuard(req, res, next) {
  try {
    if (!isMiniappRequest(req)) {
      return next();
    }

    const auditModeEnabled = await getMiniappReadonlyMode();
    req.miniappAuditMode = auditModeEnabled;

    if (!auditModeEnabled) {
      return next();
    }

    const requestPath = (req.path || '/').replace(/\/+$/, '') || '/';

    // Client configuration stays available so a mode change can take effect
    // as soon as the mini program refreshes its settings.
    if (req.method === 'GET' && requestPath === '/miniapp/config') {
      return next();
    }

    if (req.method !== 'GET') {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        code: RESPONSE_CODES.FORBIDDEN,
        message: '小程序当前处于审核模式',
        error: 'MINIAPP_AUDIT_MODE'
      });
    }

    if (requestPath === '/posts') {
      req.query.status = '0';
      return next();
    }

    const postDetailMatch = requestPath.match(/^\/posts\/(\d+)$/);
    if (postDetailMatch) {
      const [rows] = await pool.execute(
        'SELECT status FROM posts WHERE id = ? LIMIT 1',
        [postDetailMatch[1]]
      );

      if (rows.length === 0 || Number(rows[0].status) !== 0) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          code: RESPONSE_CODES.NOT_FOUND,
          message: '笔记不存在'
        });
      }

      return next();
    }

    // Only data required by the audit presentation remains available here.
    if (requestPath === '/categories' || requestPath === '/tags' || requestPath === '/search') {
      return next();
    }

    return res.status(HTTP_STATUS.FORBIDDEN).json({
      code: RESPONSE_CODES.FORBIDDEN,
      message: '小程序当前处于审核模式',
      error: 'MINIAPP_AUDIT_MODE'
    });
  } catch (error) {
    console.error('检查小程序审核模式失败:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: '读取小程序配置失败'
    });
  }
}

module.exports = {
  MINIAPP_SETTING_KEY,
  MINIAPP_UI_TITLE_KEYS,
  MINIAPP_UI_TITLE_DEFAULTS,
  getMiniappReadonlyMode,
  setMiniappReadonlyMode,
  getMiniappUiConfig,
  setMiniappUiConfig,
  isMiniappRequest,
  miniappReadonlyGuard
};
