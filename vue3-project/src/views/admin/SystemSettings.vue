<template>
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

    <section class="settings-card">
      <div class="settings-card-header miniapp-header">
        <div>
          <h2>小程序审核模式</h2>
          <p>用于小程序提交审核时切换展示状态。</p>
        </div>
        <button type="button" class="toggle-switch" :class="{ active: miniappAuditMode }"
          :disabled="loading || savingMiniapp" :aria-pressed="miniappAuditMode"
          @click="toggleMiniappAuditMode">
          <span class="toggle-knob"></span>
        </button>
      </div>

      <div class="miniapp-mode-panel" :class="{ active: miniappAuditMode }">
        <div>
          <strong>{{ miniappAuditMode ? '审核模式' : '日常模式' }}</strong>
          <p v-if="miniappAuditMode">
            小程序按审核配置展示页面及数据，首页和笔记详情保持可浏览。
          </p>
          <p v-else>
            小程序按日常配置展示页面及数据。
          </p>
        </div>
        <span class="mode-state" :class="{ enabled: miniappAuditMode }">
          {{ miniappAuditMode ? '已开启' : '未开启' }}
        </span>
      </div>

      <div class="settings-note">
        该设置只影响小程序客户端，不影响现有网页端。切换后小程序会在下次进入页面时重新读取状态。
      </div>
    </section>

    <section class="settings-card">
      <div class="settings-card-header">
        <div>
          <h2>小程序界面文案</h2>
          <p>统一管理导航栏标题、页面标签、输入提示和操作提示，保存后由小程序远程读取。</p>
        </div>
        <span v-if="savingMiniappUi" class="settings-status">保存中...</span>
      </div>

      <details v-for="group in uiFieldGroups" :key="group.key" class="miniapp-copy-group" :open="group.key === 'titles'">
        <summary>{{ group.label }}</summary>
        <div class="miniapp-title-grid">
          <label v-for="field in group.fields" :key="field.key" class="miniapp-title-field">
            <span>{{ field.label }}</span>
            <input v-model="miniappUi[group.key][field.key]" type="text" :maxlength="group.maxLength"
              :disabled="loading || savingMiniappUi" />
          </label>
        </div>
      </details>

      <div class="settings-actions">
        <button type="button" class="settings-save-button" :disabled="loading || savingMiniappUi"
          @click="saveMiniappUi">
          {{ savingMiniappUi ? '保存中...' : '保存界面文案' }}
        </button>
      </div>

      <div class="settings-note">
        这些文案通过 /api/miniapp/config 下发。小程序端保留基础兜底值，网络正常时以这里保存的配置为准，后续也可以继续扩展多语言配置。
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
  { value: 'none', label: '全站免审', description: '所有用户发布笔记后直接上线，不进入审核队列。' },
  { value: 'verified', label: '认证免审', description: '官方认证和个人认证用户直接上线，未认证用户需要审核。' },
  { value: 'all', label: '全站审核', description: '所有用户发布笔记后都需要审核通过才会公开。' }
]

const defaultMiniappUi = {
  titles: {
    home: '小毛毛', detail: '笔记详情', editor: '发布笔记', login: '登录', profile: '我的'
  },
  labels: {
    homeBrand: '小毛毛', homeSubtitle: '毛毛的快乐狗生', recommend: '推荐', loading: '加载中...',
    reachedEnd: '已经到底啦', emptyContent: '还没有内容', navHome: '首页', navProfile: '我的',
    postVideo: '视频', anonymousUser: '匿名用户', editorImageTab: '图文', editorVideoTab: '视频',
    editorPhoto: '照片', editorChooseVideo: '选择视频', editorCategory: '分类', editorChooseCategory: '选择分类',
    editorTags: '# 标签', editorSubmit: '发布笔记', loginBrand: '小毛毛', loginSubtitle: '登录后和家人一起记录毛毛',
    loginAccount: '毛毛号', loginPassword: '密码', loginSubmit: '登录', loginHint: '注册和找回密码请前往网页端操作。',
    profileAccountPrefix: '毛毛号：', profileEmptyBio: '还没有个人简介', profileFollowing: '关注', profileFans: '粉丝',
    profileLikes: '获赞', profileLogout: '退出登录', profileGuestTitle: '登录小毛毛', profileGoLogin: '去登录',
    detailOriginal: '原图', detailViews: '浏览', detailComments: '评论', detailEmptyComments: '还没有评论',
    detailSend: '发送', detailIpPrefix: 'IP属地 · '
  },
  placeholders: {
    editorTitle: '填写标题会有更多赞哦', editorContent: '分享毛毛的这一刻...',
    editorTags: '多个标签用空格或逗号分隔', loginAccount: '请输入毛毛号', loginPassword: '请输入密码',
    detailComment: '说点什么...', detailCommentLogin: '登录后参与评论'
  },
  messages: {
    browseOnly: '当前仅支持浏览', loginRequired: '请先登录', sessionUnavailable: '暂时无法验证登录状态，请检查网络',
    loginCredentialsRequired: '请输入毛毛号和密码', loginSuccess: '登录成功', loginFailed: '登录失败', loadFailed: '加载失败',
    editorTitleContentRequired: '标题和正文不能为空', editorImageRequired: '请选择至少一张图片', editorVideoRequired: '请选择视频',
    editorSubmitting: '正在发布', editorReviewSubmitted: '已提交审核', editorSuccess: '发布成功', editorFailed: '发布失败',
    editorVideoFailed: '视频上传失败', detailLoadFailed: '笔记加载失败', detailOriginalLoading: '加载原图',
    detailOriginalFailed: '原图加载失败', commentSuccess: '评论成功', commentFailed: '评论失败'
  }
}

const uiFieldGroups = [
  {
    key: 'titles', label: '导航栏标题', maxLength: 32,
    fields: [
      { key: 'home', label: '首页标题' }, { key: 'detail', label: '详情页标题' },
      { key: 'editor', label: '编辑页标题' }, { key: 'login', label: '登录页标题' },
      { key: 'profile', label: '个人页标题' }
    ]
  },
  {
    key: 'labels', label: '页面标签与按钮', maxLength: 100,
    fields: [
      { key: 'homeBrand', label: '首页品牌名' }, { key: 'homeSubtitle', label: '首页副标题' },
      { key: 'recommend', label: '推荐分类' }, { key: 'loading', label: '加载状态' },
      { key: 'reachedEnd', label: '列表到底提示' }, { key: 'emptyContent', label: '空内容提示' },
      { key: 'navHome', label: '底部首页' }, { key: 'navProfile', label: '底部个人页' },
      { key: 'postVideo', label: '视频占位' }, { key: 'anonymousUser', label: '匿名用户' },
      { key: 'editorImageTab', label: '编辑-图文标签' }, { key: 'editorVideoTab', label: '编辑-视频标签' },
      { key: 'editorPhoto', label: '编辑-照片按钮' }, { key: 'editorChooseVideo', label: '编辑-视频选择' },
      { key: 'editorCategory', label: '编辑-分类' }, { key: 'editorChooseCategory', label: '编辑-选择分类' },
      { key: 'editorTags', label: '编辑-标签' }, { key: 'editorSubmit', label: '编辑-提交按钮' },
      { key: 'loginBrand', label: '登录-品牌名' }, { key: 'loginSubtitle', label: '登录-副标题' },
      { key: 'loginAccount', label: '登录-账号标签' }, { key: 'loginPassword', label: '登录-密码标签' },
      { key: 'loginSubmit', label: '登录-按钮' }, { key: 'loginHint', label: '登录-底部提示' },
      { key: 'profileAccountPrefix', label: '个人页-账号前缀' }, { key: 'profileEmptyBio', label: '个人页-空简介' },
      { key: 'profileFollowing', label: '个人页-关注' }, { key: 'profileFans', label: '个人页-粉丝' },
      { key: 'profileLikes', label: '个人页-获赞' }, { key: 'profileLogout', label: '个人页-退出' },
      { key: 'profileGuestTitle', label: '个人页-访客标题' }, { key: 'profileGoLogin', label: '个人页-登录按钮' },
      { key: 'detailOriginal', label: '详情-原图按钮' }, { key: 'detailViews', label: '详情-浏览' },
      { key: 'detailComments', label: '详情-评论标题' }, { key: 'detailEmptyComments', label: '详情-空评论' },
      { key: 'detailSend', label: '详情-发送按钮' }, { key: 'detailIpPrefix', label: '详情-IP属地前缀' }
    ]
  },
  {
    key: 'placeholders', label: '输入框提示', maxLength: 100,
    fields: [
      { key: 'editorTitle', label: '编辑-标题输入提示' }, { key: 'editorContent', label: '编辑-正文输入提示' },
      { key: 'editorTags', label: '编辑-标签输入提示' }, { key: 'loginAccount', label: '登录-账号输入提示' },
      { key: 'loginPassword', label: '登录-密码输入提示' }, { key: 'detailComment', label: '详情-评论输入提示' },
      { key: 'detailCommentLogin', label: '详情-未登录评论提示' }
    ]
  },
  {
    key: 'messages', label: 'Toast 与状态提示', maxLength: 100,
    fields: [
      { key: 'browseOnly', label: '仅浏览提示' }, { key: 'loginRequired', label: '需要登录' },
      { key: 'sessionUnavailable', label: '登录状态不可用' }, { key: 'loginCredentialsRequired', label: '账号密码未填' },
      { key: 'loginSuccess', label: '登录成功' }, { key: 'loginFailed', label: '登录失败' },
      { key: 'loadFailed', label: '通用加载失败' }, { key: 'editorTitleContentRequired', label: '编辑-标题正文未填' },
      { key: 'editorImageRequired', label: '编辑-未选图片' }, { key: 'editorVideoRequired', label: '编辑-未选视频' },
      { key: 'editorSubmitting', label: '编辑-处理中' }, { key: 'editorReviewSubmitted', label: '编辑-已提交审核' },
      { key: 'editorSuccess', label: '编辑-成功' }, { key: 'editorFailed', label: '编辑-失败' },
      { key: 'editorVideoFailed', label: '编辑-视频失败' }, { key: 'detailLoadFailed', label: '详情-加载失败' },
      { key: 'detailOriginalLoading', label: '详情-原图加载中' }, { key: 'detailOriginalFailed', label: '详情-原图失败' },
      { key: 'commentSuccess', label: '评论成功' }, { key: 'commentFailed', label: '评论失败' }
    ]
  }
]

const cloneUi = () => JSON.parse(JSON.stringify(defaultMiniappUi))

const currentMode = ref('all')
const miniappAuditMode = ref(false)
const miniappUi = ref(cloneUi())
const loading = ref(true)
const saving = ref(false)
const savingMiniapp = ref(false)
const savingMiniappUi = ref(false)
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

const applyMiniappUi = (ui) => {
  if (!ui || typeof ui !== 'object') return
  for (const group of uiFieldGroups) {
    if (ui[group.key] && typeof ui[group.key] === 'object') {
      miniappUi.value[group.key] = { ...miniappUi.value[group.key], ...ui[group.key] }
    }
  }
}

const loadSettings = async () => {
  loading.value = true
  try {
    const response = await fetch(`${apiConfig.baseURL}/admin/system-settings`, { headers: getAuthHeaders() })
    const result = await response.json()
    if (result.code === 200 && result.data?.post_review_mode) {
      currentMode.value = result.data.post_review_mode
      miniappAuditMode.value = Boolean(result.data.miniapp_readonly_mode)
      applyMiniappUi(result.data.miniapp_ui)
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
      method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ post_review_mode: mode })
    })
    const result = await response.json()
    if (result.code === 200) {
      currentMode.value = result.data?.post_review_mode || mode
      miniappAuditMode.value = Boolean(result.data?.miniapp_readonly_mode)
      applyMiniappUi(result.data?.miniapp_ui)
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

const toggleMiniappAuditMode = async () => {
  if (savingMiniapp.value || loading.value) return
  const nextMode = !miniappAuditMode.value
  savingMiniapp.value = true
  try {
    const response = await fetch(`${apiConfig.baseURL}/admin/system-settings`, {
      method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ miniapp_readonly_mode: nextMode })
    })
    const result = await response.json()
    if (result.code === 200) {
      miniappAuditMode.value = Boolean(result.data?.miniapp_readonly_mode)
      if (result.data?.post_review_mode) currentMode.value = result.data.post_review_mode
      applyMiniappUi(result.data?.miniapp_ui)
      showMessage(result.message || '设置已保存')
    } else {
      showMessage(result.message || '保存小程序设置失败', 'error')
    }
  } catch (error) {
    console.error('保存小程序设置失败:', error)
    showMessage('保存小程序设置失败', 'error')
  } finally {
    savingMiniapp.value = false
  }
}

const saveMiniappUi = async () => {
  if (savingMiniappUi.value || loading.value) return

  const payload = {}
  for (const group of uiFieldGroups) {
    payload[group.key] = {}
    for (const field of group.fields) {
      const value = String(miniappUi.value[group.key]?.[field.key] || '').trim()
      if (!value) {
        showMessage(`${field.label}不能为空`, 'error')
        return
      }
      payload[group.key][field.key] = value
    }
  }

  savingMiniappUi.value = true
  try {
    const response = await fetch(`${apiConfig.baseURL}/admin/system-settings`, {
      method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ miniapp_ui: payload })
    })
    const result = await response.json()
    if (result.code === 200) {
      applyMiniappUi(result.data?.miniapp_ui)
      showMessage(result.message || '界面文案已保存')
    } else {
      showMessage(result.message || '保存界面文案失败', 'error')
    }
  } catch (error) {
    console.error('保存小程序界面文案失败:', error)
    showMessage('保存界面文案失败', 'error')
  } finally {
    savingMiniappUi.value = false
  }
}

onMounted(loadSettings)
</script>

<style scoped>
.system-settings-page {
  width: 100%;
  max-width: 980px;
  display: flex;
  flex-direction: column;
  gap: 18px;
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

.review-mode-button:hover:not(:disabled) { border-color: var(--primary-color); }
.review-mode-button.active {
  border-color: var(--primary-color);
  background: var(--bg-color-primary);
  box-shadow: 0 0 0 2px var(--primary-color-shadow);
}

.review-mode-button:disabled,
.toggle-switch:disabled,
.settings-save-button:disabled,
.miniapp-title-field input:disabled {
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
.mode-title { font-size: 16px; font-weight: 600; }
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

.miniapp-header { align-items: center; }
.toggle-switch {
  position: relative;
  width: 50px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: var(--bg-color-tertiary);
  cursor: pointer;
  transition: background 0.2s ease;
  flex-shrink: 0;
}
.toggle-switch.active { background: var(--primary-color); }
.toggle-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.16);
  transition: transform 0.2s ease;
}
.toggle-switch.active .toggle-knob { transform: translateX(22px); }

.miniapp-mode-panel {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 16px;
  border: 1px solid var(--border-color-primary);
  border-radius: 10px;
  background: var(--bg-color-secondary);
}
.miniapp-mode-panel.active { border-color: var(--primary-color); background: var(--bg-color-primary); }
.miniapp-mode-panel strong { color: var(--text-color-primary); font-size: 15px; }
.miniapp-mode-panel p {
  margin: 7px 0 0;
  color: var(--text-color-secondary);
  font-size: 13px;
  line-height: 1.65;
}
.mode-state {
  flex-shrink: 0;
  padding: 4px 9px;
  border-radius: 999px;
  background: var(--bg-color-tertiary);
  color: var(--text-color-secondary);
  font-size: 12px;
}
.mode-state.enabled { background: var(--primary-color); color: #fff; }

.miniapp-copy-group {
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border-color-secondary);
  border-radius: 10px;
  background: var(--bg-color-secondary);
}
.miniapp-copy-group summary {
  cursor: pointer;
  color: var(--text-color-primary);
  font-size: 14px;
  font-weight: 600;
}
.miniapp-copy-group[open] summary { margin-bottom: 14px; }
.miniapp-title-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.miniapp-title-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
  color: var(--text-color-secondary);
  font-size: 13px;
}
.miniapp-title-field input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--border-color-primary);
  border-radius: 8px;
  background: var(--bg-color-primary);
  color: var(--text-color-primary);
  font-size: 14px;
  outline: none;
}
.miniapp-title-field input:focus { border-color: var(--primary-color); }
.settings-actions { display: flex; justify-content: flex-end; margin-top: 16px; }
.settings-save-button {
  padding: 9px 16px;
  border: 0;
  border-radius: 8px;
  background: var(--primary-color);
  color: var(--button-text-color);
  font-size: 13px;
  cursor: pointer;
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
  .review-mode-options,
  .miniapp-title-grid { grid-template-columns: 1fr; }
  .review-mode-button { min-height: auto; }
  .miniapp-mode-panel { flex-direction: column; gap: 12px; }
}
</style>
