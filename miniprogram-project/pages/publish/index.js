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
    uploading: false
  },

  async onLoad() {
    const app = getApp()
    await app.refreshMiniappConfig()
    if (app.globalData.readonlyMode) {
      wx.showToast({ title: '当前仅支持浏览', icon: 'none' })
      return wx.navigateBack({ delta: 1 })
    }
    if (!wx.getStorageSync('token')) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return wx.redirectTo({ url: '/pages/login/index' })
    }
    try {
      const categories = await api.getCategories()
      this.setData({ categories: Array.isArray(categories) ? categories : [] })
    } catch (error) {
      console.warn('加载分类失败:', error)
    }
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
    const remain = 9 - this.data.images.length
    if (remain <= 0) return
    try {
      const result = await wx.chooseMedia({
        count: remain,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed']
      })
      const paths = (result.tempFiles || []).map(file => file.tempFilePath)
      this.setData({ images: this.data.images.concat(paths).slice(0, 9) })
    } catch (error) {}
  },

  async chooseVideo() {
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
      const result = await api.uploadImage(filePath)
      if (result && result.url) urls.push(result.url)
    }
    return urls
  },

  async uploadVideo() {
    if (!this.data.video) return null
    let coverUrl = null
    if (this.data.video.thumbPath) {
      const cover = await api.uploadImage(this.data.video.thumbPath)
      coverUrl = cover && cover.url ? cover.url : null
    }
    const uploaded = await api.uploadVideo(this.data.video.path)
    if (!uploaded || !uploaded.url) throw new Error('视频上传失败')
    return { url: uploaded.url, coverUrl: coverUrl || uploaded.coverUrl || null }
  },

  async submit() {
    if (this.data.submitting || this.data.uploading) return
    const title = this.data.title.trim()
    const content = this.data.content.trim()
    if (!title || !content) return wx.showToast({ title: '标题和正文不能为空', icon: 'none' })
    if (this.data.type === 1 && this.data.images.length === 0) return wx.showToast({ title: '请选择至少一张图片', icon: 'none' })
    if (this.data.type === 2 && !this.data.video) return wx.showToast({ title: '请选择视频', icon: 'none' })

    this.setData({ submitting: true, uploading: true })
    wx.showLoading({ title: '正在发布', mask: true })
    try {
      const app = getApp()
      await app.refreshMiniappConfig()
      if (app.globalData.readonlyMode) throw new Error('小程序当前处于只读模式')

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

      const result = await api.createPost(payload)
      wx.hideLoading()
      wx.showToast({ title: result && result.review_required ? '已提交审核' : '发布成功', icon: 'success' })
      setTimeout(() => wx.reLaunch({ url: '/pages/home/index' }), 500)
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: error.message || '发布失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false, uploading: false })
    }
  }
})
