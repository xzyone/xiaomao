const { pool } = require('../config/config');
const { HTTP_STATUS, RESPONSE_CODES } = require('../constants');

const MINIAPP_SETTING_KEY = 'miniapp_readonly_mode';
const MINIAPP_CLIENT_HEADER = 'wechat-miniapp';

const MINIAPP_UI_DEFAULTS = Object.freeze({
  titles: Object.freeze({
    home: '小毛毛',
    detail: '笔记详情',
    editor: '发布笔记',
    login: '登录',
    profile: '我的'
  }),
  labels: Object.freeze({
    homeBrand: '小毛毛',
    homeSubtitle: '毛毛的快乐狗生',
    recommend: '推荐',
    loading: '加载中...',
    reachedEnd: '已经到底啦',
    emptyContent: '还没有内容',
    navHome: '首页',
    navProfile: '我的',
    postVideo: '视频',
    anonymousUser: '匿名用户',
    editorImageTab: '图文',
    editorVideoTab: '视频',
    editorPhoto: '照片',
    editorChooseVideo: '选择视频',
    editorCategory: '分类',
    editorChooseCategory: '选择分类',
    editorTags: '# 标签',
    editorSubmit: '发布笔记',
    loginBrand: '小毛毛',
    loginSubtitle: '登录后和家人一起记录毛毛',
    loginAccount: '毛毛号',
    loginPassword: '密码',
    loginSubmit: '登录',
    loginHint: '注册和找回密码请前往网页端操作。',
    profileAccountPrefix: '毛毛号：',
    profileEmptyBio: '还没有个人简介',
    profileFollowing: '关注',
    profileFans: '粉丝',
    profileLikes: '获赞',
    profileLogout: '退出登录',
    profileGuestTitle: '登录小毛毛',
    profileGoLogin: '去登录',
    detailOriginal: '原图',
    detailViews: '浏览',
    detailComments: '评论',
    detailEmptyComments: '还没有评论',
    detailSend: '发送',
    detailIpPrefix: 'IP属地 · '
  }),
  placeholders: Object.freeze({
    editorTitle: '填写标题会有更多赞哦',
    editorContent: '分享毛毛的这一刻...',
    editorTags: '多个标签用空格或逗号分隔',
    loginAccount: '请输入毛毛号',
    loginPassword: '请输入密码',
    detailComment: '说点什么...',
    detailCommentLogin: '登录后参与评论'
  }),
  messages: Object.freeze({
    browseOnly: '当前仅支持浏览',
    loginRequired: '请先登录',
    sessionUnavailable: '暂时无法验证登录状态，请检查网络',
    loginCredentialsRequired: '请输入毛毛号和密码',
    loginSuccess: '登录成功',
    loginFailed: '登录失败',
    loadFailed: '加载失败',
    editorTitleContentRequired: '标题和正文不能为空',
    editorImageRequired: '请选择至少一张图片',
    editorVideoRequired: '请选择视频',
    editorSubmitting: '正在发布',
    editorReviewSubmitted: '已提交审核',
    editorSuccess: '发布成功',
    editorFailed: '发布失败',
    editorVideoFailed: '视频上传失败',
    detailLoadFailed: '笔记加载失败',
    detailOriginalLoading: '加载原图',
    detailOriginalFailed: '原图加载失败',
    commentSuccess: '评论成功',
    commentFailed: '评论失败'
  })
});

const MINIAPP_UI_SETTING_KEYS = Object.freeze({
  titles: Object.freeze({
    home: 'miniapp_title_home',
    detail: 'miniapp_title_detail',
    editor: 'miniapp_title_editor',
    login: 'miniapp_title_login',
    profile: 'miniapp_title_profile'
  }),
  ...Object.fromEntries(
    Object.entries(MINIAPP_UI_DEFAULTS)
      .filter(([group]) => group !== 'titles')
      .map(([group, values]) => [
        group,
        Object.freeze(
          Object.fromEntries(
            Object.keys(values).map(name => [name, `miniapp_ui_${group}_${name}`])
          )
        )
      ])
  )
});

const MINIAPP_UI_TITLE_KEYS = MINIAPP_UI_SETTING_KEYS.titles;
const MINIAPP_UI_TITLE_DEFAULTS = MINIAPP_UI_DEFAULTS.titles;
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

      const defaults = [[MINIAPP_SETTING_KEY, '0']];
      for (const [group, keyMap] of Object.entries(MINIAPP_UI_SETTING_KEYS)) {
        for (const [name, settingKey] of Object.entries(keyMap)) {
          defaults.push([settingKey, MINIAPP_UI_DEFAULTS[group][name]]);
        }
      }

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

  const settingKeys = Object.values(MINIAPP_UI_SETTING_KEYS).flatMap(group => Object.values(group));
  const placeholders = settingKeys.map(() => '?').join(', ');
  const [rows] = await pool.execute(
    `SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (${placeholders})`,
    settingKeys
  );

  const ui = Object.fromEntries(
    Object.entries(MINIAPP_UI_DEFAULTS).map(([group, values]) => [group, { ...values }])
  );
  const settingLookup = {};

  for (const [group, keyMap] of Object.entries(MINIAPP_UI_SETTING_KEYS)) {
    for (const [name, settingKey] of Object.entries(keyMap)) {
      settingLookup[settingKey] = { group, name };
    }
  }

  for (const row of rows) {
    const target = settingLookup[row.setting_key];
    const value = String(row.setting_value || '').trim();
    if (target && value) ui[target.group][target.name] = value;
  }

  return ui;
}

async function setMiniappUiConfig(config = {}) {
  await ensureSystemSettingsTable();

  for (const [group, keyMap] of Object.entries(MINIAPP_UI_SETTING_KEYS)) {
    const values = config && config[group] && typeof config[group] === 'object'
      ? config[group]
      : {};

    for (const [name, settingKey] of Object.entries(keyMap)) {
      if (!Object.prototype.hasOwnProperty.call(values, name)) continue;
      const value = String(values[name] || '').trim();
      if (!value) continue;

      await pool.execute(
        `INSERT INTO system_settings (setting_key, setting_value)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [settingKey, value]
      );
    }
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
  MINIAPP_UI_DEFAULTS,
  MINIAPP_UI_SETTING_KEYS,
  MINIAPP_UI_TITLE_KEYS,
  MINIAPP_UI_TITLE_DEFAULTS,
  getMiniappReadonlyMode,
  setMiniappReadonlyMode,
  getMiniappUiConfig,
  setMiniappUiConfig,
  isMiniappRequest,
  miniappReadonlyGuard
};
