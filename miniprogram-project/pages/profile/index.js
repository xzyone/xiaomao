const api = require('../../services/api')

Page({
  data: { user: null, readonlyMode: false, loading: true },
  async onShow() {
    const app = getApp()
    await app.refreshMiniappConfig()
    if (app.globalData.readonlyMode) return wx.reLaunch({ url: '/pages/home/index' })
    const token = wx.getStorageSync('token')
    if (!token) {
      this.setData({ user: null, readonlyMode: false, loading: false })
      return
    }
    try {
      const user = await api.getCurrentUser()
      wx.setStorageSync('user', user)
      app.globalData.user = user
      this.setData({ user, readonlyMode: false, loading: false })
    } catch (error) {
      this.setData({ loading: false })
    }
  },
  goLogin() { wx.navigateTo({ url: '/pages/login/index' }) },
  logout() {
    wx.removeStorageSync('token')
    wx.removeStorageSync('refresh_token')
    wx.removeStorageSync('user')
    getApp().globalData.user = null
    this.setData({ user: null })
  }
})
