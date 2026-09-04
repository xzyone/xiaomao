const api = require('./services/api')

App({
  globalData: {
    // Fail closed until the server explicitly confirms interactive mode.
    readonlyMode: true,
    interactiveEnabled: false,
    configLoaded: false,
    user: null,
    sessionValid: false,
    lastSessionCheckAt: 0
  },

  async onLaunch() {
    this.restoreSession()
    await this.refreshMiniappConfig()
  },

  async onShow() {
    const result = await this.refreshMiniappConfig()
    if (result && this.globalData.interactiveEnabled && wx.getStorageSync('token')) {
      await this.validateSession(true)
    }
  },

  restoreSession() {
    this.globalData.user = wx.getStorageSync('user') || null
    this.globalData.sessionValid = Boolean(wx.getStorageSync('token'))
  },

  async validateSession(force = false) {
    if (!this.globalData.interactiveEnabled) return false

    const token = wx.getStorageSync('token')
    if (!token) {
      this.globalData.user = null
      this.globalData.sessionValid = false
      return false
    }

    const now = Date.now()
    if (!force && this.globalData.sessionValid && now - this.globalData.lastSessionCheckAt < 30000) {
      return true
    }

    try {
      const user = await api.getCurrentUser()
      this.globalData.user = user
      this.globalData.sessionValid = true
      this.globalData.lastSessionCheckAt = now
      wx.setStorageSync('user', user)
      return true
    } catch (error) {
      if (error && error.statusCode === 401) {
        this.globalData.user = null
        this.globalData.sessionValid = false
        this.globalData.lastSessionCheckAt = now
        return false
      }
      console.warn('校验登录状态失败:', error)
      return null
    }
  },

  applyMiniappConfig(result) {
    const readonlyMode = Boolean(result && result.readonly_mode)
    this.globalData.readonlyMode = readonlyMode
    this.globalData.interactiveEnabled = !readonlyMode
    this.globalData.configLoaded = true
    return result
  },

  async refreshMiniappConfig() {
    try {
      const result = await api.getMiniappConfig()
      return this.applyMiniappConfig(result)
    } catch (error) {
      // Do not expose interactive features when config cannot be verified.
      console.warn('读取小程序模式失败，保持只读:', error)
      this.globalData.readonlyMode = true
      this.globalData.interactiveEnabled = false
      return null
    }
  },

  async ensureInteractivePage({ toast = true } = {}) {
    await this.refreshMiniappConfig()
    if (this.globalData.interactiveEnabled) return true

    if (toast) wx.showToast({ title: '当前仅支持浏览', icon: 'none' })
    setTimeout(() => wx.reLaunch({ url: '/pages/home/index' }), 50)
    return false
  }
})
