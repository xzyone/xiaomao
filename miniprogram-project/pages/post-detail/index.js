const api = require('../../services/api')
const { stripHtml, formatDate } = require('../../utils/format')

Page({
  data: {
    id: null, post: null, contentText: '', displayDate: '', comments: [], commentText: '',
    readonlyMode: false, loggedIn: false, loading: true
  },
  async onLoad(options) {
    this.setData({ id: options.id })
    await this.syncMode(); await this.loadPost()
    if (!this.data.readonlyMode) await this.loadComments()
  },
  async onShow() { await this.syncMode() },
  async syncMode() {
    const app = getApp(); await app.refreshMiniappConfig()
    this.setData({ readonlyMode: app.globalData.readonlyMode, loggedIn: Boolean(wx.getStorageSync('token')) })
  },
  async loadPost() {
    try {
      const post = await api.getPostDetail(this.data.id)
      this.setData({ post, contentText: stripHtml(post.content), displayDate: formatDate(post.created_at) })
    } catch (error) { wx.showToast({ title: error.message || '笔记加载失败', icon: 'none' }) }
    finally { this.setData({ loading: false }) }
  },
  async loadComments() {
    try {
      const result = await api.getComments(this.data.id)
      this.setData({ comments: (result && result.comments) || [] })
    } catch (error) { if (error.error !== 'MINIAPP_READONLY') console.warn('加载评论失败:', error) }
  },
  previewImage(event) {
    const current = event.currentTarget.dataset.url
    wx.previewImage({ current, urls: (this.data.post.images || []).slice() })
  },
  onCommentInput(event) { this.setData({ commentText: event.detail.value }) },
  handleCommentInputTap() { if (!this.data.loggedIn) this.goLogin() },
  goLogin() { wx.navigateTo({ url: '/pages/login/index' }) },
  async submitComment() {
    const content = this.data.commentText.trim()
    if (!content) return
    if (!this.data.loggedIn) return this.goLogin()
    try {
      await api.createComment(this.data.id, content)
      this.setData({ commentText: '' }); await this.loadComments()
      wx.showToast({ title: '评论成功', icon: 'success' })
    } catch (error) { wx.showToast({ title: error.message || '评论失败', icon: 'none' }) }
  }
})
