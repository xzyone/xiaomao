const api = require('./services/api')

App({
  globalData: {
    readonlyMode: false,
    interactiveEnabled: true,
    configLoaded: false,
    user: null
  },

  async onLaunch() {
    this.restoreSession()
    await this.refreshMiniappConfig()
  },

  async onShow() {
    if (this.globalData.configLoaded) await this.refreshMiniappConfig()
  },

  restoreSession() {
    this.globalData.user = wx.getStorageSync('user') || null
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
