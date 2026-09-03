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
