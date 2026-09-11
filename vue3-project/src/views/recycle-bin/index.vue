<template>
  <div class="recycle-container">
    <div class="page-header">
      <div class="header-left">
        <button class="back-btn" @click="router.push('/post-management')">
<SvgIcon name="left" width="20" height="20" />
        </button>
        <div>
<h1 class="page-title">回收站</h1>
<p class="page-subtitle">删除的笔记保留 {{ retentionDays }} 天，过期后自动永久删除</p>
        </div>
      </div>
      <span class="post-count">共 {{ total }} 篇</span>
    </div>

    <div v-if="loading" class="state">加载中...</div>
    <div v-else-if="posts.length === 0" class="state empty-state">
      <SvgIcon name="empty" width="72" height="72" />
      <p>回收站是空的</p>
    </div>

    <div v-else class="recycle-list">
      <article v-for="post in posts" :key="post.id" class="recycle-card">
        <div class="thumb">
<img v-if="getCover(post)" :src="getCover(post)" :alt="post.title" @error="handleImageError" />
<div v-else class="placeholder">{{ post.type === 2 ? '视频' : '图文' }}</div>
        </div>

        <div class="post-info">
<h3>{{ post.title || '未命名笔记' }}</h3>
<p class="content">{{ plainText(post.content) }}</p>
<div class="meta">
  <span>删除前：{{ getStatusText(post.deleted_status) }}</span>
  <span>删除于 {{ formatDate(post.deleted_at) }}</span>
  <span class="expire">{{ getRemainingText(post) }}</span>
</div>
        </div>

        <div class="actions">
<button class="restore-btn" @click="handleRestore(post)">恢复</button>
<button class="delete-btn" @click="confirmPermanentDelete(post)">彻底删除</button>
        </div>
      </article>
    </div>

    <div v-if="pages > 1" class="pagination">
      <button :disabled="page <= 1" @click="changePage(page - 1)">上一页</button>
      <span>{{ page }} / {{ pages }}</span>
      <button :disabled="page >= pages" @click="changePage(page + 1)">下一页</button>
    </div>

    <ConfirmDialog
      v-model:visible="showPermanentDelete"
      title="彻底删除"
      :message="`确定要永久删除《${selectedPost?.title || '这篇笔记'}》吗？图片、视频和相关数据将立即清理，且无法恢复。`"
      type="warning"
      confirm-text="彻底删除"
      cancel-text="取消"
      @confirm="handlePermanentDelete"
      @cancel="showPermanentDelete = false"
    />
    <MessageToast v-if="toastMessage" :message="toastMessage" :type="toastType" @close="toastMessage = ''" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getRecycleBinPosts, restorePost, permanentlyDeletePost } from '@/api/posts'
import SvgIcon from '@/components/SvgIcon.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import MessageToast from '@/components/MessageToast.vue'
import defaultPlaceholder from '@/assets/imgs/未加载.png'

const router = useRouter()
const posts = ref([])
const loading = ref(false)
const page = ref(1)
const pages = ref(1)
const total = ref(0)
const retentionDays = ref(30)
const selectedPost = ref(null)
const showPermanentDelete = ref(false)
const toastMessage = ref('')
const toastType = ref('success')

const showMessage = (message, type = 'success') => {
  toastMessage.value = message
  toastType.value = type
}

const loadPosts = async () => {
  loading.value = true
  try {
    const result = await getRecycleBinPosts({ page: page.value, limit: 10 })
    if (!result.success) {
      showMessage(result.message || '加载失败', 'error')
      return
    }
    posts.value = result.data.posts
    retentionDays.value = result.data.retention_days || 30
    total.value = result.data.pagination.total || 0
    pages.value = result.data.pagination.pages || 1
  } finally {
    loading.value = false
  }
}

const changePage = value => {
  page.value = value
  loadPosts()
}

const getCover = post => post.thumbnail_cover_url || post.thumbnail_image || post.cover_url || post.images?.[0] || ''
const handleImageError = event => { event.target.src = defaultPlaceholder }
const plainText = value => String(value || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
const formatDate = value => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'
const getStatusText = status => ({ 0: '已发布', 1: '草稿', 2: '待审核', 3: '未过审' }[Number(status)] || '笔记')
const getRemainingText = post => {
  const days = Math.max(0, Number(post.remaining_days ?? retentionDays.value))
  return days === 0 ? '即将自动清理' : `剩余 ${days} 天`
}

const handleRestore = async post => {
  const result = await restorePost(post.id)
  if (result.success) {
    showMessage('已恢复到删除前状态')
    await loadPosts()
  } else {
    showMessage(result.message || '恢复失败', 'error')
  }
}

const confirmPermanentDelete = post => {
  selectedPost.value = post
  showPermanentDelete.value = true
}

const handlePermanentDelete = async () => {
  if (!selectedPost.value) return
  const result = await permanentlyDeletePost(selectedPost.value.id)
  if (result.success) {
    showPermanentDelete.value = false
    selectedPost.value = null
    showMessage('已永久删除')
    if (posts.value.length === 1 && page.value > 1) page.value -= 1
    await loadPosts()
  } else {
    showMessage(result.message || '永久删除失败', 'error')
  }
}

onMounted(loadPosts)
</script>

<style scoped>
.recycle-container { min-height: 100vh; max-width: 760px; min-width: 700px; margin: 72px auto; padding-bottom: 48px; color: var(--text-color-primary); }
.page-header { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px; background: var(--bg-color-primary); border-bottom: 1px solid var(--border-color-primary); }
.header-left { display: flex; align-items: center; gap: 12px; }
.back-btn { width: 40px; height: 40px; border: 0; border-radius: 50%; background: transparent; color: var(--text-color-primary); cursor: pointer; }
.back-btn:hover { background: var(--bg-color-secondary); }
.page-title { margin: 0; font-size: 1.2rem; }
.page-subtitle { margin: 4px 0 0; font-size: 12px; color: var(--text-color-secondary); }
.post-count { font-size: 13px; color: var(--text-color-secondary); white-space: nowrap; }
.state { padding: 64px 16px; text-align: center; color: var(--text-color-secondary); }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.recycle-list { display: flex; flex-direction: column; gap: 12px; padding: 16px; }
.recycle-card { display: flex; align-items: center; gap: 14px; padding: 14px; border: 1px solid var(--border-color-primary); border-radius: 10px; background: var(--bg-color-primary); }
.thumb { width: 82px; height: 82px; flex: 0 0 82px; border-radius: 8px; overflow: hidden; background: var(--bg-color-secondary); }
.thumb img { width: 100%; height: 100%; object-fit: cover; }
.placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 13px; color: var(--text-color-secondary); }
.post-info { min-width: 0; flex: 1; }
.post-info h3 { margin: 0 0 6px; font-size: 15px; }
.content { margin: 0 0 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: var(--text-color-secondary); }
.meta { display: flex; flex-wrap: wrap; gap: 6px 12px; font-size: 12px; color: var(--text-color-secondary); }
.expire { color: var(--primary-color); }
.actions { display: flex; flex-direction: column; gap: 8px; flex: 0 0 auto; }
.actions button { min-width: 76px; padding: 7px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; }
.restore-btn { border: 0; background: var(--primary-color); color: #fff; }
.delete-btn { border: 1px solid var(--border-color-primary); background: transparent; color: var(--text-color-primary); }
.pagination { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 16px; }
.pagination button { padding: 7px 12px; border: 1px solid var(--border-color-primary); border-radius: 6px; background: var(--bg-color-primary); color: var(--text-color-primary); cursor: pointer; }
.pagination button:disabled { opacity: .45; cursor: not-allowed; }
@media (max-width: 960px) {
  .recycle-container { min-width: 0; width: 100%; margin: 0; padding-top: 72px; }
  .recycle-card { align-items: flex-start; }
  .thumb { width: 64px; height: 64px; flex-basis: 64px; }
  .actions { flex-direction: row; position: absolute; right: 30px; margin-top: 74px; }
  .recycle-card { position: relative; padding-bottom: 52px; }
  .page-subtitle { max-width: 230px; }
}
</style>
