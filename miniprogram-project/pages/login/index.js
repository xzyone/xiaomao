const api = require('../../services/api')
const { apiBaseUrl } = require('../../config')
const { getServerOrigin } = require('../../utils/media')

const serverOrigin = getServerOrigin(apiBaseUrl)
const logoUrl = serverOrigin ? `${serverOrigin}/android-icon-192x192.png` : ''

Page({
  data: {
    userId: '',
    password: '',
    submitting: false,
    logoUrl,
    logoLoadFailed: false,
    pageAllowed: false
  },
  async onLoad() {
    const app = getApp()
    const allowed = await app.ensureNormalMode({ toast: false })
    if (allowed) {
      app.setPageTitle('login')
      this.setData({ pageAllowed: true })
    }
  },
  async onShow() {
    const app = getApp()
    const allowed = await app.ensureNormalMode({ toast: false })
    if (allowed) {
      app.setPageTitle('login')
      if (!this.data.pageAllowed) this.setData({ pageAllowed: true })
    }
  },
  onUserIdInput(event) { this.setData({ userId: event.detail.value }) },
  onPasswordInput(event) { this.setData({ password: event.detail.value }) },
  onLogoError() { this.setData({ logoLoadFailed: true }) },
  async submit() {
    if (this.data.submitting) return
    if (!(await getApp().ensureNormalMode())) return
    if (!this.data.userId.trim() || !this.data.password) {
      return wx.showToast({ title: '请输入毛毛号和密码', icon: 'none' })
    }
    this.setData({ submitting: true })
    try {
      const result = await api.login(this.data.userId.trim(), this.data.password)
      wx.setStorageSync('token', result.tokens.access_token)
      wx.setStorageSync('refresh_token', result.tokens.refresh_token)
      wx.setStorageSync('user', result.user)
      const app = getApp()
      app.globalData.user = result.user
      app.globalData.sessionValid = true
      app.globalData.lastSessionCheckAt = Date.now()
      wx.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => wx.navigateBack({ delta: 1 }), 300)
    } catch (error) {
      wx.showToast({ title: error.message || '登录失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
