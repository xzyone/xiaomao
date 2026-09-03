const api = require('../../services/api')
const { clearSession } = require('../../services/request')
const { apiBaseUrl } = require('../../config')
const { getServerOrigin } = require('../../utils/media')

const serverOrigin = getServerOrigin(apiBaseUrl)
const defaultAvatarUrl = serverOrigin ? `${serverOrigin}/android-icon-192x192.png` : ''

Page({
  data: {
    user: null,
    avatarUrl: '',
    defaultAvatarUrl,
    readonlyMode: false,
    loading: true
  },
  async onShow() {
    const app = getApp()
    await app.refreshMiniappConfig()
    if (app.globalData.readonlyMode) return wx.reLaunch({ url: '/pages/home/index' })

    const token = wx.getStorageSync('token')
    if (!token) {
      this.setData({ user: null, avatarUrl: '', readonlyMode: false, loading: false })
      return
    }

    const sessionState = await app.validateSession(true)
    if (sessionState === false) {
      this.setData({ user: null, avatarUrl: '', readonlyMode: false, loading: false })
      return
    }

    const user = app.globalData.user || wx.getStorageSync('user') || null
    this.setData({
      user,
      avatarUrl: user ? (user.avatar || defaultAvatarUrl) : '',
      readonlyMode: false,
      loading: false
    })
  },
  onAvatarError() {
    if (this.data.avatarUrl && this.data.avatarUrl !== this.data.defaultAvatarUrl && this.data.defaultAvatarUrl) {
      this.setData({ avatarUrl: this.data.defaultAvatarUrl })
      return
    }
    this.setData({ avatarUrl: '' })
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
      this.setData({ user: null, avatarUrl: '' })
    }
  }
})
