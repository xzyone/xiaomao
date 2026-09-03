from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'Expected block not found in {path}: {old[:160]!r}')
    p.write_text(text.replace(old, new, 1))


def replace_count(path, old, new, expected):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != expected:
        raise SystemExit(f'Expected {expected} matches in {path}, found {count}: {old[:160]!r}')
    p.write_text(text.replace(old, new))


# -----------------------------------------------------------------------------
# New backend policy helper
# -----------------------------------------------------------------------------
Path('express-project/utils/reviewPolicy.js').write_text(r'''const { pool } = require('../config/config');

const REVIEW_SETTING_KEY = 'post_review_mode';
const REVIEW_MODES = Object.freeze({
  NONE: 'none',
  VERIFIED: 'verified',
  ALL: 'all'
});

const VALID_REVIEW_MODES = new Set(Object.values(REVIEW_MODES));
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

      // Preserve the current site behaviour after upgrading: all posts require review.
      await pool.execute(
        'INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES (?, ?)',
        [REVIEW_SETTING_KEY, REVIEW_MODES.ALL]
      );
    })().catch(error => {
      ensureSettingsTablePromise = null;
      throw error;
    });
  }

  return ensureSettingsTablePromise;
}

async function getReviewMode() {
  await ensureSystemSettingsTable();

  const [rows] = await pool.execute(
    'SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1',
    [REVIEW_SETTING_KEY]
  );

  const mode = rows.length > 0 ? rows[0].setting_value : REVIEW_MODES.ALL;
  return VALID_REVIEW_MODES.has(mode) ? mode : REVIEW_MODES.ALL;
}

async function setReviewMode(mode) {
  if (!VALID_REVIEW_MODES.has(mode)) {
    throw new Error('INVALID_REVIEW_MODE');
  }

  await ensureSystemSettingsTable();
  await pool.execute(
    `INSERT INTO system_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [REVIEW_SETTING_KEY, mode]
  );

  return mode;
}

async function resolvePublicationStatus(userId) {
  const mode = await getReviewMode();

  if (mode === REVIEW_MODES.NONE) {
    return 0;
  }

  if (mode === REVIEW_MODES.ALL) {
    return 2;
  }

  const [rows] = await pool.execute(
    'SELECT verified FROM users WHERE id = ? LIMIT 1',
    [String(userId)]
  );
  const isVerified = rows.length > 0 && Number(rows[0].verified) > 0;

  return isVerified ? 0 : 2;
}

async function resolvePostStatus({ userId, requestedStatus, currentStatus = null }) {
  const requested = Number(requestedStatus);

  // Draft status always follows the author's explicit action.
  if (requested === 1) {
    return 1;
  }

  // Editing content that is already published/pending should not silently change
  // its moderation state merely because the global mode changed afterward.
  if (currentStatus !== null && currentStatus !== undefined) {
    const current = Number(currentStatus);
    if (current === 0 || current === 2) {
      return current;
    }
  }

  // New publication, draft submission and rejected-post resubmission all use policy.
  return resolvePublicationStatus(userId);
}

async function queuePostAudit(postId) {
  const [rows] = await pool.execute(
    'SELECT id FROM audit WHERE type = 3 AND target_id = ? ORDER BY id DESC LIMIT 1',
    [String(postId)]
  );

  if (rows.length > 0) {
    await pool.execute(
      'UPDATE audit SET status = 0, admin_id = NULL, audit_time = NULL WHERE id = ?',
      [String(rows[0].id)]
    );
  } else {
    await pool.execute(
      'INSERT INTO audit (type, target_id, status) VALUES (?, ?, ?)',
      [3, String(postId), 0]
    );
  }
}

module.exports = {
  REVIEW_MODES,
  getReviewMode,
  setReviewMode,
  resolvePostStatus,
  queuePostAudit
};
''')


# -----------------------------------------------------------------------------
# New admin API for system settings
# -----------------------------------------------------------------------------
Path('express-project/routes/systemSettings.js').write_text(r'''const express = require('express');
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
''')


# -----------------------------------------------------------------------------
# New admin System Settings page
# -----------------------------------------------------------------------------
Path('vue3-project/src/views/admin/SystemSettings.vue').write_text(r'''<template>
  <div class="system-settings-page">
    <section class="settings-card">
      <div class="settings-card-header">
        <div>
          <h2>内容审核</h2>
          <p>设置用户发布笔记时的审核策略。</p>
        </div>
        <span v-if="loading" class="settings-status">读取中...</span>
      </div>

      <div class="review-mode-options" :class="{ disabled: loading || saving }">
        <button v-for="option in reviewModes" :key="option.value" type="button" class="review-mode-button"
          :class="{ active: currentMode === option.value }" :disabled="loading || saving"
          @click="changeReviewMode(option.value)">
          <div class="mode-main-row">
            <span class="mode-title">{{ option.label }}</span>
            <span v-if="currentMode === option.value" class="current-badge">当前</span>
          </div>
          <span class="mode-description">{{ option.description }}</span>
        </button>
      </div>

      <div class="settings-note">
        设置只影响之后新发布、草稿提交或被驳回后重新提交的笔记；已经进入审核队列的内容不会自动改变状态。
      </div>
    </section>

    <MessageToast v-if="showToast" :message="toastMessage" :type="toastType" @close="showToast = false" />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { apiConfig } from '@/config/api'
import MessageToast from '@/components/MessageToast.vue'

const reviewModes = [
  {
    value: 'none',
    label: '全站免审',
    description: '所有用户发布笔记后直接上线，不进入审核队列。'
  },
  {
    value: 'verified',
    label: '认证免审',
    description: '官方认证和个人认证用户直接上线，未认证用户需要审核。'
  },
  {
    value: 'all',
    label: '全站审核',
    description: '所有用户发布笔记后都需要审核通过才会公开。'
  }
]

const currentMode = ref('all')
const loading = ref(true)
const saving = ref(false)
const showToast = ref(false)
const toastMessage = ref('')
const toastType = ref('success')

const getAuthHeaders = () => {
  const headers = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('admin_token')
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

const showMessage = (message, type = 'success') => {
  toastMessage.value = message
  toastType.value = type
  showToast.value = true
}

const loadSettings = async () => {
  loading.value = true
  try {
    const response = await fetch(`${apiConfig.baseURL}/admin/system-settings`, {
      headers: getAuthHeaders()
    })
    const result = await response.json()
    if (result.code === 200 && result.data?.post_review_mode) {
      currentMode.value = result.data.post_review_mode
    } else {
      showMessage(result.message || '读取系统设置失败', 'error')
    }
  } catch (error) {
    console.error('读取系统设置失败:', error)
    showMessage('读取系统设置失败', 'error')
  } finally {
    loading.value = false
  }
}

const changeReviewMode = async (mode) => {
  if (saving.value || loading.value || mode === currentMode.value) return

  saving.value = true
  try {
    const response = await fetch(`${apiConfig.baseURL}/admin/system-settings`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ post_review_mode: mode })
    })
    const result = await response.json()
    if (result.code === 200) {
      currentMode.value = result.data?.post_review_mode || mode
      showMessage(result.message || '设置已保存')
    } else {
      showMessage(result.message || '保存系统设置失败', 'error')
    }
  } catch (error) {
    console.error('保存系统设置失败:', error)
    showMessage('保存系统设置失败', 'error')
  } finally {
    saving.value = false
  }
}

onMounted(loadSettings)
</script>

<style scoped>
.system-settings-page {
  width: 100%;
  max-width: 980px;
}

.settings-card {
  padding: 22px;
  border: 1px solid var(--border-color-primary);
  border-radius: 12px;
  background: var(--bg-color-primary);
}

.settings-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 18px;
}

.settings-card-header h2 {
  margin: 0 0 6px;
  color: var(--text-color-primary);
  font-size: 18px;
}

.settings-card-header p {
  margin: 0;
  color: var(--text-color-tertiary);
  font-size: 13px;
}

.settings-status {
  color: var(--text-color-tertiary);
  font-size: 13px;
}

.review-mode-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.review-mode-button {
  min-height: 118px;
  padding: 16px;
  border: 1px solid var(--border-color-primary);
  border-radius: 10px;
  background: var(--bg-color-secondary);
  color: var(--text-color-primary);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.review-mode-button:hover:not(:disabled) {
  border-color: var(--primary-color);
}

.review-mode-button.active {
  border-color: var(--primary-color);
  background: var(--bg-color-primary);
  box-shadow: 0 0 0 2px var(--primary-color-shadow);
}

.review-mode-button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.mode-main-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.mode-title {
  font-size: 16px;
  font-weight: 600;
}

.current-badge {
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--primary-color);
  color: var(--button-text-color);
  font-size: 11px;
  font-weight: 600;
}

.mode-description {
  display: block;
  color: var(--text-color-secondary);
  font-size: 13px;
  line-height: 1.65;
}

.settings-note {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--border-color-secondary);
  color: var(--text-color-tertiary);
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 760px) {
  .review-mode-options {
    grid-template-columns: 1fr;
  }

  .review-mode-button {
    min-height: auto;
  }
}
</style>
''')


# -----------------------------------------------------------------------------
# Mount system settings API
# -----------------------------------------------------------------------------
replace_once(
    'express-project/app.js',
    "const adminRoutes = require('./routes/admin');\nconst categoriesRoutes = require('./routes/categories');",
    "const adminRoutes = require('./routes/admin');\nconst systemSettingsRoutes = require('./routes/systemSettings');\nconst categoriesRoutes = require('./routes/categories');"
)
replace_once(
    'express-project/app.js',
    "app.use('/api/stats', statsRoutes);\napp.use('/api/admin', adminRoutes);",
    "app.use('/api/stats', statsRoutes);\napp.use('/api/admin/system-settings', systemSettingsRoutes);\napp.use('/api/admin', adminRoutes);"
)


# -----------------------------------------------------------------------------
# Backend post publication policy
# -----------------------------------------------------------------------------
posts_path = Path('express-project/routes/posts.js')
posts = posts_path.read_text()

old_import = "const { getContentLocation } = require('../utils/contentLocation');\n"
if old_import not in posts:
    raise SystemExit('posts.js review policy import marker not found')
posts = posts.replace(
    old_import,
    old_import + "const { resolvePostStatus, queuePostAudit } = require('../utils/reviewPolicy');\n",
    1
)

old_create_intro = r'''    const { title, content, category_id, images, video, tags, status, type } = req.body;
    const userId = req.user.id;
    const postType = type || 1; // 默认为图文类型'''
new_create_intro = r'''    const { title, content, category_id, images, video, tags, status, type } = req.body;
    const userId = req.user.id;
    const postType = type || 1; // 默认为图文类型
    const requestedStatus = status === undefined ? 0 : Number(status);'''
if old_create_intro not in posts:
    raise SystemExit('posts.js create intro not found')
posts = posts.replace(old_create_intro, new_create_intro, 1)

if "if (status !== 1 && (!title || !content))" not in posts:
    raise SystemExit('posts.js create validation not found')
posts = posts.replace(
    "if (status !== 1 && (!title || !content))",
    "if (requestedStatus !== 1 && (!title || !content))",
    1
)

old_create_status = r'''    // 草稿不记录属地；首次提交/发布时固化当次请求的IP属地
    const ipLocation = String(status) === '1' ? null : await getContentLocation(req);

    // 插入笔记
    console.log('📝 开始插入笔记到数据库...');
    const [result] = await pool.execute(
      'INSERT INTO posts (user_id, title, content, category_id, status, type, ip_location) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, title || '', sanitizedContent, category_id || null, (status !== undefined ? status : 2).toString(), postType, ipLocation]
    );'''
new_create_status = r'''    // 客户端只表达“草稿/发布”意图，最终是否审核由服务端系统设置决定。
    const effectiveStatus = await resolvePostStatus({
      userId,
      requestedStatus
    });

    // 草稿不记录属地；首次提交/发布时固化当次请求的IP属地
    const ipLocation = effectiveStatus === 1 ? null : await getContentLocation(req);

    // 插入笔记
    console.log('📝 开始插入笔记到数据库...');
    const [result] = await pool.execute(
      'INSERT INTO posts (user_id, title, content, category_id, status, type, ip_location) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, title || '', sanitizedContent, category_id || null, effectiveStatus.toString(), postType, ipLocation]
    );'''
if old_create_status not in posts:
    raise SystemExit('posts.js create status block not found')
posts = posts.replace(old_create_status, new_create_status, 1)

if "if (status === 0 && content && hasMentions(content))" not in posts:
    raise SystemExit('posts.js create mention condition not found')
posts = posts.replace(
    "if (status === 0 && content && hasMentions(content))",
    "if (effectiveStatus === 0 && content && hasMentions(content))",
    1
)

old_create_audit = r'''    // 如果笔记状态为待审核(status=2)，在audit表中添加审核记录
    if (status === 2) {
      try {
        await pool.execute(
          'INSERT INTO audit (type, target_id, status) VALUES (?, ?, ?)',
          [3, postId, 0]
        );
        console.log(`✅ 审核记录创建成功 - 笔记ID: ${postId}`);
      } catch (error) {
        console.error('❌ 创建审核记录失败:', error);
      }
    }

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: '发布成功',
      data: { id: postId }
    });'''
new_create_audit = r'''    // 只有服务端策略最终判定为待审核时才创建审核记录。
    if (effectiveStatus === 2) {
      try {
        await queuePostAudit(postId);
        console.log(`✅ 审核记录创建成功 - 笔记ID: ${postId}`);
      } catch (error) {
        console.error('❌ 创建审核记录失败:', error);
      }
    }

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: effectiveStatus === 1 ? '草稿保存成功' : (effectiveStatus === 2 ? '已提交审核' : '发布成功'),
      data: {
        id: postId,
        status: effectiveStatus,
        review_required: effectiveStatus === 2
      }
    });'''
if old_create_audit not in posts:
    raise SystemExit('posts.js create audit/response block not found')
posts = posts.replace(old_create_audit, new_create_audit, 1)

# Update route: also fix the already-present destructuring gap for video_url/cover_url,
# because the route references both variables later in the same function.
old_update_intro = r'''    const postId = req.params.id;
    const { title, content, category_id, images, video, tags, status } = req.body;
    const userId = req.user.id;'''
new_update_intro = r'''    const postId = req.params.id;
    const { title, content, category_id, images, video, video_url, cover_url, tags, status } = req.body;
    const userId = req.user.id;'''
if old_update_intro not in posts:
    raise SystemExit('posts.js update intro not found')
posts = posts.replace(old_update_intro, new_update_intro, 1)

if "if (status !== 1 && (!title || !content || !category_id))" not in posts:
    raise SystemExit('posts.js update validation not found')
posts = posts.replace(
    "if (status !== 1 && (!title || !content || !category_id))",
    "if (Number(status) !== 1 && (!title || !content || !category_id))",
    1
)

old_update_status = r'''    // 在更新之前获取原始笔记信息（用于对比@用户变化）
    const [originalPostRows] = await pool.execute('SELECT status, content, ip_location FROM posts WHERE id = ?', [postId.toString()]);
    const wasOriginallyDraft = originalPostRows.length > 0 && originalPostRows[0].status === 1;
    const originalContent = originalPostRows.length > 0 ? originalPostRows[0].content : '';
    let ipLocation = originalPostRows.length > 0 ? originalPostRows[0].ip_location : null;

    // 只有草稿首次提交时记录发布属地；已提交内容后续编辑不改变历史属地
    if (wasOriginallyDraft && String(status) !== '1') {
      ipLocation = await getContentLocation(req);
    }

    // 更新笔记基本信息
    await pool.execute(
      'UPDATE posts SET title = ?, content = ?, category_id = ?, status = ?, ip_location = ? WHERE id = ?',
      [title || '', sanitizedContent, category_id || null, (status !== undefined ? status : 2).toString(), ipLocation, postId.toString()]
    );'''
new_update_status = r'''    // 在更新之前获取原始笔记信息（用于对比@用户变化和审核状态）
    const [originalPostRows] = await pool.execute('SELECT status, content, ip_location FROM posts WHERE id = ?', [postId.toString()]);
    const originalStatus = originalPostRows.length > 0 ? Number(originalPostRows[0].status) : 1;
    const requestedStatus = status === undefined ? originalStatus : Number(status);
    const effectiveStatus = await resolvePostStatus({
      userId,
      requestedStatus,
      currentStatus: originalStatus
    });
    const wasOriginallyDraft = originalStatus === 1;
    const originalContent = originalPostRows.length > 0 ? originalPostRows[0].content : '';
    let ipLocation = originalPostRows.length > 0 ? originalPostRows[0].ip_location : null;

    // 草稿或驳回内容重新提交且尚无历史属地时，记录本次提交属地。
    if (!ipLocation && (originalStatus === 1 || originalStatus === 3) && effectiveStatus !== 1) {
      ipLocation = await getContentLocation(req);
    }

    // 更新笔记基本信息
    await pool.execute(
      'UPDATE posts SET title = ?, content = ?, category_id = ?, status = ?, ip_location = ? WHERE id = ?',
      [title || '', sanitizedContent, category_id || null, effectiveStatus.toString(), ipLocation, postId.toString()]
    );'''
if old_update_status not in posts:
    raise SystemExit('posts.js update status block not found')
posts = posts.replace(old_update_status, new_update_status, 1)

if "if (status === 0 && content) { // 只有在已发布状态下才处理@通知" not in posts:
    raise SystemExit('posts.js update mention condition not found')
posts = posts.replace(
    "if (status === 0 && content) { // 只有在已发布状态下才处理@通知",
    "if (effectiveStatus === 0 && content) { // 只有实际发布状态才处理@通知",
    1
)

old_update_response = r'''    console.log(`更新笔记成功 - 用户ID: ${userId}, 笔记ID: ${postId}`);

    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: '更新成功',
      data: { id: postId }
    });'''
new_update_response = r'''    // 草稿/驳回内容提交后，如果实际进入待审核，则创建或重置审核记录。
    if (effectiveStatus === 2 && originalStatus !== 2) {
      await queuePostAudit(postId);
    }

    console.log(`更新笔记成功 - 用户ID: ${userId}, 笔记ID: ${postId}, 状态: ${effectiveStatus}`);

    const isSubmission = originalStatus === 1 || originalStatus === 3;
    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: isSubmission
        ? (effectiveStatus === 2 ? '已提交审核' : '发布成功')
        : '更新成功',
      data: {
        id: postId,
        status: effectiveStatus,
        review_required: effectiveStatus === 2
      }
    });'''
if old_update_response not in posts:
    raise SystemExit('posts.js update response block not found')
posts = posts.replace(old_update_response, new_update_response, 1)

posts_path.write_text(posts)


# -----------------------------------------------------------------------------
# Frontend publish page: send publication intent, display backend result
# -----------------------------------------------------------------------------
replace_count(
    'vue3-project/src/views/publish/index.vue',
    "status: 2 // 发布状态：2=待审核",
    "status: 0 // 发布意图：最终是否审核由后端系统设置决定",
    2
)
replace_count(
    'vue3-project/src/views/publish/index.vue',
    "showMessage('发布成功！', 'success')",
    "showMessage(response.message || '发布成功！', 'success')",
    2
)


# -----------------------------------------------------------------------------
# Admin router: add system settings page
# -----------------------------------------------------------------------------
replace_once(
    'vue3-project/src/router/index.js',
    "import PostAudit from '@/views/admin/PostAudit.vue'\n",
    "import PostAudit from '@/views/admin/PostAudit.vue'\nimport SystemSettings from '@/views/admin/SystemSettings.vue'\n"
)
replace_once(
    'vue3-project/src/router/index.js',
    r'''        {
          path: 'monitor',
          name: 'admin_monitor',
          component: AdminMonitor
        },''',
    r'''        {
          path: 'monitor',
          name: 'admin_monitor',
          component: AdminMonitor
        },
        {
          path: 'system-settings',
          name: 'admin_system_settings',
          component: SystemSettings
        },'''
)


# -----------------------------------------------------------------------------
# Admin sidebar/title/description
# -----------------------------------------------------------------------------
replace_once(
    'vue3-project/src/views/admin/AdminLayout.vue',
    "  const noFilterRoutes = ['/admin/api-docs', '/admin/monitor']",
    "  const noFilterRoutes = ['/admin/api-docs', '/admin/monitor', '/admin/system-settings']"
)
replace_once(
    'vue3-project/src/views/admin/AdminLayout.vue',
    "  { path: '/admin/monitor', title: '动态监控', icon: 'monitor' },\n  { path: '/admin/users', title: '用户管理', icon: 'user' },",
    "  { path: '/admin/monitor', title: '动态监控', icon: 'monitor' },\n  { path: '/admin/system-settings', title: '系统设置', icon: 'setting' },\n  { path: '/admin/users', title: '用户管理', icon: 'user' },"
)
replace_once(
    'vue3-project/src/views/admin/AdminLayout.vue',
    "    '/admin/monitor': '查看系统最近动态和活动监控',\n    '/admin/users': '管理用户账户和权限',",
    "    '/admin/monitor': '查看系统最近动态和活动监控',\n    '/admin/system-settings': '配置站点级功能和内容策略',\n    '/admin/users': '管理用户账户和权限',"
)
