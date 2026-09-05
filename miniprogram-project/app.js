const api = require('./services/api')

const AUDIT_RESTRICTED_ROUTES = new Set([
  'pages/editor/index',
  'pages/login/index',
  'pages/profile/index'
])

App({
  globalData: {
    auditConfig: {
      auditModeEnabled: true
    },
    configLoaded: false,
    user: null,
    sessionValid: false,
    lastSessionCheckAt: 0,
    auditRedirecting: false
  },

  async onLaunch(options) {
    this.restoreSession()
    await this.refreshMiniappConfig()
    this.guardAuditRoute(options && options.path)
  },

  async onShow(options) {
    const result = await this.refreshMiniappConfig()
    if (this.guardAuditRoute(options && options.path)) return
    if (result && !this.isAuditModeEnabled() && wx.getStorageSync('token')) {
      await this.validateSession(true)
    }
  },

  restoreSession() {
    this.globalData.user = wx.getStorageSync('user') || null
    this.globalData.sessionValid = Boolean(wx.getStorageSync('token'))
  },

  isAuditModeEnabled() {
    return Boolean(this.globalData.auditConfig && this.globalData.auditConfig.auditModeEnabled)
  },

  currentRoute(path) {
    const explicitRoute = String(path || '').replace(/^\/+/, '')
    if (explicitRoute) return explicitRoute
    const pages = getCurrentPages()
    return pages.length ? String(pages[pages.length - 1].route || '') : ''
  },

  guardAuditRoute(path) {
    if (!this.isAuditModeEnabled()) return false

    const route = this.currentRoute(path)
    if (!AUDIT_RESTRICTED_ROUTES.has(route)) return false
    if (this.globalData.auditRedirecting) return true

    this.globalData.auditRedirecting = true
    wx.reLaunch({
      url: '/pages/home/index',
      complete: () => {
        setTimeout(() => {
          this.globalData.auditRedirecting = false
        }, 200)
      }
    })
    return true
  },

  async validateSession(force = false) {
    if (this.isAuditModeEnabled()) return false

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
    const auditModeEnabled = !(
      result &&
      result.auditConfig &&
      result.auditConfig.auditModeEnabled === false
    )

    this.globalData.auditConfig = { auditModeEnabled }
    this.globalData.configLoaded = true
    return result
  },

  setAuditFallback() {
    this.globalData.auditConfig = { auditModeEnabled: true }
  },

  async refreshMiniappConfig() {
    try {
      const result = await api.getMiniappConfig()
      return this.applyMiniappConfig(result)
    } catch (error) {
      console.warn('读取小程序审核配置失败，保持审核模式:', error)
      this.setAuditFallback()
      return null
    }
  },

  async ensureNormalMode({ toast = true } = {}) {
    await this.refreshMiniappConfig()
    if (!this.isAuditModeEnabled()) return true

    if (toast) wx.showToast({ title: '当前仅支持浏览', icon: 'none' })
    if (!this.guardAuditRoute()) {
      setTimeout(() => wx.reLaunch({ url: '/pages/home/index' }), 50)
    }
    return false
  }
})
