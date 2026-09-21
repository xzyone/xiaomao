const api = require('../../services/api')
const { clearSession } = require('../../services/request')
const { DEFAULT_AVATAR } = require('../../utils/media')

Page({
  data: {
    user: null,
    avatarUrl: DEFAULT_AVATAR,
    auditModeEnabled: true,
    loading: true,
    loggedIn: false,
    pageAllowed: false,
    ui: { labels: {} }
  },
  async onShow() {
    const app = getApp()
    await app.refreshMiniappConfig()
    app.setPageTitle('profile')
    const auditModeEnabled = app.isAuditModeEnabled()
    this.setData({ ui: app.getUi(), pageAllowed: true, auditModeEnabled })

    const token = wx.getStorageSync('token')
    if (!token) {
      this.setData({ user: null, avatarUrl: DEFAULT_AVATAR, loggedIn: false, loading: false })
      return
    }

    const sessionState = await app.validateSession(true)
    if (sessionState === false) {
      this.setData({ user: null, avatarUrl: DEFAULT_AVATAR, loggedIn: false, loading: false })
      return
    }

    const user = app.globalData.user || wx.getStorageSync('user') || null
    this.setData({
      user,
      avatarUrl: user ? (user.avatar || DEFAULT_AVATAR) : DEFAULT_AVATAR,
      loggedIn: true,
      loading: false
    })
  },
  onAvatarError() {
    if (this.data.avatarUrl !== DEFAULT_AVATAR) this.setData({ avatarUrl: DEFAULT_AVATAR })
  },
  goLogin() { wx.navigateTo({ url: '/pages/login/index' }) },
  async logout() {
    try {
      if (wx.getStorageSync('token')) await api.logout()
    } catch (error) {
      console.warn('服务端退出登录失败:', error)
    } finally {
      clearSession()
      const app = getApp()
      app.globalData.sessionValid = false
      app.globalData.lastSessionCheckAt = 0
      this.setData({ user: null, avatarUrl: DEFAULT_AVATAR, loggedIn: false })
    }
  }
})
