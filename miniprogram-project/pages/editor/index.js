const api = require('../../services/api')

Page({
  data: {
    type: 1,
    title: '',
    content: '',
    categories: [],
    categoryIndex: -1,
    images: [],
    video: null,
    tagsText: '',
    submitting: false,
    uploading: false,
    pageAllowed: false,
    ui: { labels: {}, placeholders: {} }
  },

  async onLoad() {
    const app = getApp()
    if (!(await app.ensureNormalMode({ toast: false }))) return
    app.setPageTitle('editor')
    this.setData({ pageAllowed: true, ui: app.getUi() })
    if (!wx.getStorageSync('token')) {
      wx.showToast({ title: app.getUiText('messages', 'loginRequired'), icon: 'none' })
      return wx.redirectTo({ url: '/pages/login/index' })
    }
    try {
      const categories = await api.categories()
      this.setData({ categories: Array.isArray(categories) ? categories : [] })
    } catch (error) {
      console.warn('加载分类失败:', error)
    }
  },

  async onShow() {
    const app = getApp()
    if (!(await app.ensureNormalMode({ toast: false }))) return
    app.setPageTitle('editor')
    this.setData({ ui: app.getUi() })
    if (!this.data.pageAllowed) this.setData({ pageAllowed: true })
    if (!wx.getStorageSync('token')) return
    const state = await app.validateSession(false)
    if (state === false) wx.redirectTo({ url: '/pages/login/index' })
  },

  async ensureSession() {
    const app = getApp()
    if (!(await app.ensureNormalMode())) return false

    if (!wx.getStorageSync('token')) {
      wx.showToast({ title: app.getUiText('messages', 'loginRequired'), icon: 'none' })
      wx.navigateTo({ url: '/pages/login/index' })
      return false
    }

    const state = await app.validateSession(true)
    if (state === true) return true

    if (state === false) {
      setTimeout(() => wx.navigateTo({ url: '/pages/login/index' }), 300)
      return false
    }

    wx.showToast({ title: app.getUiText('messages', 'sessionUnavailable'), icon: 'none' })
    return false
  },

  setType(event) {
    const type = Number(event.currentTarget.dataset.type)
    if (type === this.data.type) return
    this.setData({ type, images: [], video: null })
  },
  onTitleInput(event) { this.setData({ title: event.detail.value }) },
  onContentInput(event) { this.setData({ content: event.detail.value }) },
  onTagsInput(event) { this.setData({ tagsText: event.detail.value }) },
  onCategoryChange(event) { this.setData({ categoryIndex: Number(event.detail.value) }) },

  async chooseImages() {
    if (!(await this.ensureSession())) return
    const remain = 9 - this.data.images.length
    if (remain <= 0) return
    try {
      const result = await wx.chooseMedia({
        count: remain,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['original']
      })
      const paths = (result.tempFiles || []).map(file => file.tempFilePath)
      this.setData({ images: this.data.images.concat(paths).slice(0, 9) })
    } catch (error) {}
  },

  async chooseVideo() {
    if (!(await this.ensureSession())) return
    try {
      const result = await wx.chooseMedia({
        count: 1,
        mediaType: ['video'],
        sourceType: ['album', 'camera'],
        maxDuration: 120
      })
      const file = result.tempFiles && result.tempFiles[0]
      if (file) {
        this.setData({
          video: {
            path: file.tempFilePath,
            thumbPath: file.thumbTempFilePath || '',
            duration: file.duration || 0
          }
        })
      }
    } catch (error) {}
  },

  removeImage(event) {
    const index = Number(event.currentTarget.dataset.index)
    const images = this.data.images.slice()
    images.splice(index, 1)
    this.setData({ images })
  },
  removeVideo() { this.setData({ video: null }) },

  async uploadImages() {
    const urls = []
    for (const filePath of this.data.images) {
      const result = await api.image(filePath)
      if (result && result.url) urls.push(result.url)
    }
    return urls
  },

  async uploadVideo() {
    if (!this.data.video) return null
    let coverUrl = null
    if (this.data.video.thumbPath) {
      const cover = await api.image(this.data.video.thumbPath)
      coverUrl = cover && cover.url ? cover.url : null
    }
    const uploaded = await api.video(this.data.video.path)
    if (!uploaded || !uploaded.url) throw new Error(getApp().getUiText('messages', 'editorVideoFailed'))
    return { url: uploaded.url, coverUrl: coverUrl || uploaded.coverUrl || null }
  },

  async submit() {
    if (this.data.submitting || this.data.uploading) return
    if (!(await this.ensureSession())) return

    const app = getApp()
    const title = this.data.title.trim()
    const content = this.data.content.trim()
    if (!title || !content) return wx.showToast({ title: app.getUiText('messages', 'editorTitleContentRequired'), icon: 'none' })
    if (this.data.type === 1 && this.data.images.length === 0) return wx.showToast({ title: app.getUiText('messages', 'editorImageRequired'), icon: 'none' })
    if (this.data.type === 2 && !this.data.video) return wx.showToast({ title: app.getUiText('messages', 'editorVideoRequired'), icon: 'none' })

    this.setData({ submitting: true, uploading: true })
    wx.showLoading({ title: app.getUiText('messages', 'editorSubmitting'), mask: true })
    try {
      if (!(await app.ensureNormalMode())) throw new Error(app.getUiText('messages', 'browseOnly'))

      const category = this.data.categoryIndex >= 0 ? this.data.categories[this.data.categoryIndex] : null
      const tags = this.data.tagsText
        .split(/[，,\s]+/)
        .map(tag => tag.replace(/^#/, '').trim())
        .filter(Boolean)
        .slice(0, 10)
      const payload = {
        type: this.data.type,
        title,
        content,
        category_id: category ? category.id : null,
        tags,
        status: 0
      }
      if (this.data.type === 1) payload.images = await this.uploadImages()
      if (this.data.type === 2) payload.video = await this.uploadVideo()

      const result = await api.post(payload)
      wx.hideLoading()
      wx.showToast({
        title: app.getUiText('messages', result && result.review_required ? 'editorReviewSubmitted' : 'editorSuccess'),
        icon: 'success'
      })
      setTimeout(() => wx.reLaunch({ url: '/pages/home/index' }), 500)
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: error.message || app.getUiText('messages', 'editorFailed'), icon: 'none' })
    } finally {
      this.setData({ submitting: false, uploading: false })
    }
  }
})
