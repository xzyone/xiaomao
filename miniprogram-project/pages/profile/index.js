const api = require('../../services/api')
const { clearSession } = require('../../services/request')
const { DEFAULT_AVATAR } = require('../../utils/media')

Page({
  data: {
    user: null,
    avatarUrl: DEFAULT_AVATAR,
    readonlyMode: true,
    loading: true
  },
  async onShow() {
    const app = getApp()
    if (!(await app.ensureInteractivePage({ toast: false }))) return

    const token = wx.getStorageSync('token')
    if (!token) {
      this.setData({ user: null, avatarUrl: DEFAULT_AVATAR, readonlyMode: false, loading: false })
      return
    }

    const sessionState = await app.validateSession(true)
    if (sessionState === false) {
      this.setData({ user: null, avatarUrl: DEFAULT_AVATAR, readonlyMode: false, loading: false })
      return
    }

    const user = app.globalData.user || wx.getStorageSync('user') || null
    this.setData({
      user,
      avatarUrl: user ? (user.avatar || DEFAULT_AVATAR) : DEFAULT_AVATAR,
      readonlyMode: false,
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
      this.setData({ user: null, avatarUrl: DEFAULT_AVATAR })
    }
  }
})
