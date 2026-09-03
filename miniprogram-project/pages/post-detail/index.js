const api = require('../../services/api')
const { stripHtml, formatDate } = require('../../utils/format')
const { DEFAULT_AVATAR } = require('../../utils/media')

const DEFAULT_MEDIA_HEIGHT_RPX = 760
const MIN_MEDIA_HEIGHT_RPX = 520
const MAX_MEDIA_HEIGHT_RPX = 1000

Page({
  data: {
    id: null,
    post: null,
    contentText: '',
    displayDate: '',
    comments: [],
    commentText: '',
    displayImages: [],
    originalImageShown: [],
    currentMediaHeight: DEFAULT_MEDIA_HEIGHT_RPX,
    currentImageIndex: 0,
    currentImageCanShowOriginal: false,
    readonlyMode: false,
    loggedIn: false,
    loading: true
  },
  async onLoad(options) {
    this.setData({ id: options.id })
    if (wx.showShareMenu) {
      wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
    }
    await this.syncMode()
    await this.loadPost()
    if (!this.data.readonlyMode) await this.loadComments()
  },
  async onShow() { await this.syncMode() },
  async syncMode() {
    const app = getApp()
    await app.refreshMiniappConfig()
    this.setData({
      readonlyMode: app.globalData.readonlyMode,
      loggedIn: Boolean(wx.getStorageSync('token'))
    })
  },
  async loadPost() {
    try {
      const post = await api.getPostDetail(this.data.id)
      const originalImages = Array.isArray(post.images) ? post.images : []
      const thumbnailImages = Array.isArray(post.thumbnail_images) ? post.thumbnail_images : []
      const displayImages = originalImages.map((original, index) => thumbnailImages[index] || original)
      const originalImageShown = originalImages.map((original, index) => displayImages[index] === original)

      this.setData({
        post,
        contentText: stripHtml(post.content),
        displayDate: formatDate(post.created_at),
        displayImages,
        originalImageShown,
        currentMediaHeight: DEFAULT_MEDIA_HEIGHT_RPX,
        currentImageIndex: 0,
        currentImageCanShowOriginal: Boolean(originalImages[0] && displayImages[0] !== originalImages[0])
      })
    } catch (error) {
      wx.showToast({ title: error.message || '笔记加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },
  async loadComments() {
    try {
      const result = await api.getComments(this.data.id)
      this.setData({ comments: (result && result.comments) || [] })
    } catch (error) {
      if (error.error !== 'MINIAPP_READONLY') console.warn('加载评论失败:', error)
    }
  },
  onPostAvatarError() {
    if (this.data.post && this.data.post.user_avatar !== DEFAULT_AVATAR) {
      this.setData({ 'post.user_avatar': DEFAULT_AVATAR })
    }
  },
  onCommentAvatarError(event) {
    const index = Number(event.currentTarget.dataset.index)
    const comment = this.data.comments[index]
    if (!comment || comment.user_avatar === DEFAULT_AVATAR) return
    this.setData({ [`comments[${index}].user_avatar`]: DEFAULT_AVATAR })
  },
  onDetailImageLoad(event) {
    const index = Number(event.currentTarget.dataset.index) || 0
    if (index !== 0) return

    const width = Number(event.detail.width) || 0
    const height = Number(event.detail.height) || 0
    if (!width || !height) return

    const naturalHeight = Math.round(750 * height / width)
    const mediaHeight = Math.max(MIN_MEDIA_HEIGHT_RPX, Math.min(MAX_MEDIA_HEIGHT_RPX, naturalHeight))
    this.setData({ currentMediaHeight: mediaHeight })
  },
  onMediaChange(event) {
    const index = Number(event.detail.current) || 0
    const original = this.data.post?.images?.[index]
    const current = this.data.displayImages[index]
    this.setData({
      currentImageIndex: index,
      currentImageCanShowOriginal: Boolean(original && current && original !== current)
    })
  },
  async showOriginalImage() {
    const index = this.data.currentImageIndex
    const originalUrl = this.data.post?.images?.[index]
    if (!originalUrl || !this.data.currentImageCanShowOriginal) return

    wx.showLoading({ title: '加载原图', mask: false })
    try {
      await new Promise((resolve, reject) => {
        wx.getImageInfo({ src: originalUrl, success: resolve, fail: reject })
      })

      const displayImages = this.data.displayImages.slice()
      const originalImageShown = this.data.originalImageShown.slice()
      displayImages[index] = originalUrl
      originalImageShown[index] = true

      this.setData({
        displayImages,
        originalImageShown,
        currentImageCanShowOriginal: false
      })
    } catch (error) {
      console.warn('加载原图失败:', error)
      wx.showToast({ title: '原图加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },
  previewImage(event) {
    const current = event.currentTarget.dataset.url
    wx.previewImage({ current, urls: this.data.displayImages.slice() })
  },
  onShareAppMessage() {
    const post = this.data.post || {}
    const imageUrl = this.data.displayImages[0] || post.poster_url || ''
    const shareData = {
      title: post.title || '小毛毛的快乐狗生',
      path: `/pages/post-detail/index?id=${this.data.id}`
    }
    if (imageUrl) shareData.imageUrl = imageUrl
    return shareData
  },
  onShareTimeline() {
    const post = this.data.post || {}
    const imageUrl = this.data.displayImages[0] || post.poster_url || ''
    const shareData = {
      title: post.title || '小毛毛的快乐狗生',
      query: `id=${encodeURIComponent(this.data.id || '')}`
    }
    if (imageUrl) shareData.imageUrl = imageUrl
    return shareData
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
      this.setData({ commentText: '' })
      await this.loadComments()
      wx.showToast({ title: '评论成功', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: error.message || '评论失败', icon: 'none' })
    }
  }
})
