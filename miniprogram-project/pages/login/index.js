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
    pageAllowed: false,
    ui: { labels: {}, placeholders: {} }
  },
  async onLoad() {
    const app = getApp()
    const allowed = await app.ensureNormalMode({ toast: false })
    if (allowed) {
      app.setPageTitle('login')
      this.setData({ pageAllowed: true, ui: app.getUi() })
    }
  },
  async onShow() {
    const app = getApp()
    const allowed = await app.ensureNormalMode({ toast: false })
    if (allowed) {
      app.setPageTitle('login')
      this.setData({ ui: app.getUi() })
      if (!this.data.pageAllowed) this.setData({ pageAllowed: true })
    }
  },
  onUserIdInput(event) { this.setData({ userId: event.detail.value }) },
  onPasswordInput(event) { this.setData({ password: event.detail.value }) },
  onLogoError() { this.setData({ logoLoadFailed: true }) },
  async submit() {
    if (this.data.submitting) return
    const app = getApp()
    if (!(await app.ensureNormalMode())) return
    if (!this.data.userId.trim() || !this.data.password) {
      return wx.showToast({ title: app.getUiText('messages', 'loginCredentialsRequired'), icon: 'none' })
    }
    this.setData({ submitting: true })
    try {
      const result = await api.login(this.data.userId.trim(), this.data.password)
      wx.setStorageSync('token', result.tokens.access_token)
      wx.setStorageSync('refresh_token', result.tokens.refresh_token)
      wx.setStorageSync('user', result.user)
      app.globalData.user = result.user
      app.globalData.sessionValid = true
      app.globalData.lastSessionCheckAt = Date.now()
      wx.showToast({ title: app.getUiText('messages', 'loginSuccess'), icon: 'success' })
      setTimeout(() => wx.navigateBack({ delta: 1 }), 300)
    } catch (error) {
      wx.showToast({ title: error.message || app.getUiText('messages', 'loginFailed'), icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
