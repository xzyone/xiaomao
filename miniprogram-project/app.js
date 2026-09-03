const api = require('./services/api')

App({
  globalData: {
    readonlyMode: false,
    interactiveEnabled: true,
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
    const tasks = []
    if (this.globalData.configLoaded) tasks.push(this.refreshMiniappConfig())
    if (wx.getStorageSync('token')) tasks.push(this.validateSession(true))
    if (tasks.length) await Promise.allSettled(tasks)
  },

  restoreSession() {
    this.globalData.user = wx.getStorageSync('user') || null
    this.globalData.sessionValid = Boolean(wx.getStorageSync('token'))
  },

  async validateSession(force = false) {
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

  async refreshMiniappConfig() {
    try {
      const result = await api.getMiniappConfig()
      const readonlyMode = Boolean(result && result.readonly_mode)
      this.globalData.readonlyMode = readonlyMode
      this.globalData.interactiveEnabled = !readonlyMode
      this.globalData.configLoaded = true
      return result
    } catch (error) {
      console.warn('读取小程序模式失败:', error)
      return null
    }
  }
})
