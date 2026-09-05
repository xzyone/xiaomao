const api = require('../../services/api')

const PAGE_SIZE = 12

Page({
  data: {
    posts: [], leftPosts: [], rightPosts: [], categories: [], currentCategory: 'recommend',
    page: 1, hasMore: true, loading: false, auditModeEnabled: true
  },
  async onLoad() {
    if (wx.showShareMenu) {
      wx.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage', 'shareTimeline']
      })
    }
    await this.syncAuditMode()
    await Promise.all([this.loadCategories(), this.loadPosts(true)])
  },
  async onShow() { await this.syncAuditMode() },
  async onPullDownRefresh() {
    await this.syncAuditMode(); await this.loadPosts(true); wx.stopPullDownRefresh()
  },
  async onReachBottom() { if (this.data.hasMore && !this.data.loading) await this.loadPosts(false) },
  async syncAuditMode() {
    const app = getApp()
    await app.refreshMiniappConfig()
    app.setPageTitle('home')
    this.setData({ auditModeEnabled: app.isAuditModeEnabled() })
  },
  async loadCategories() {
    try {
      const categories = await api.categories()
      this.setData({ categories: Array.isArray(categories) ? categories : [] })
    } catch (error) { console.warn('加载分类失败:', error) }
  },
  async loadPosts(reset = false) {
    if (this.data.loading) return
    const nextPage = reset ? 1 : this.data.page + 1
    this.setData({ loading: true })
    try {
      const params = { page: nextPage, limit: PAGE_SIZE }
      if (this.data.currentCategory !== 'recommend') params.category = this.data.currentCategory
      const result = await api.posts(params)
      const incoming = (result && result.posts) || []
      const posts = reset ? incoming : this.data.posts.concat(incoming)
      this.setData({ posts, page: nextPage, hasMore: Boolean(result && result.pagination && nextPage < result.pagination.pages) })
      this.distributePosts(posts)
    } catch (error) { wx.showToast({ title: error.message || '加载失败', icon: 'none' }) }
    finally { this.setData({ loading: false }) }
  },
  distributePosts(posts) {
    const leftPosts = [], rightPosts = []
    posts.forEach((post, index) => (index % 2 === 0 ? leftPosts : rightPosts).push(post))
    this.setData({ leftPosts, rightPosts })
  },
  changeCategory(event) {
    const category = event.currentTarget.dataset.category
    if (String(category) === String(this.data.currentCategory)) return
    this.setData({ currentCategory: category }); this.loadPosts(true)
  },
  onShareAppMessage() {
    return {
      title: '小毛毛的快乐狗生',
      path: '/pages/home/index',
      imageUrl: '/assets/avatar.png'
    }
  },
  onShareTimeline() {
    return {
      title: '小毛毛的快乐狗生',
      imageUrl: '/assets/avatar.png'
    }
  }
})
