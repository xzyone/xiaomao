const api = require('./services/api')

const AUDIT_RESTRICTED_ROUTES = new Set([
  'pages/editor/index',
  'pages/login/index',
  'pages/profile/index'
])

const DEFAULT_UI = Object.freeze({
  titles: Object.freeze({
    home: '小毛毛',
    detail: '小毛毛',
    editor: '小毛毛',
    login: '小毛毛',
    profile: '小毛毛'
  }),
  labels: Object.freeze({
    homeBrand: '小毛毛',
    homeSubtitle: '',
    recommend: '推荐',
    loading: '加载中...',
    reachedEnd: '',
    emptyContent: '暂无内容',
    navHome: '首页',
    navProfile: '我的',
    postVideo: '视频',
    anonymousUser: '用户',
    editorImageTab: '图文',
    editorVideoTab: '视频',
    editorPhoto: '照片',
    editorChooseVideo: '选择视频',
    editorCategory: '分类',
    editorChooseCategory: '选择分类',
    editorTags: '# 标签',
    editorSubmit: '确认',
    loginBrand: '小毛毛',
    loginSubtitle: '',
    loginAccount: '账号',
    loginPassword: '密码',
    loginSubmit: '确认',
    loginHint: '',
    profileAccountPrefix: '账号：',
    profileEmptyBio: '暂无简介',
    profileFollowing: '关注',
    profileFans: '粉丝',
    profileLikes: '获赞',
    profileLogout: '退出',
    profileGuestTitle: '欢迎',
    profileGoLogin: '进入',
    detailOriginal: '原图',
    detailViews: '浏览',
    detailComments: '评论',
    detailEmptyComments: '暂无内容',
    detailSend: '发送',
    detailIpPrefix: 'IP属地 · '
  }),
  placeholders: Object.freeze({
    editorTitle: '填写标题',
    editorContent: '填写内容',
    editorTags: '填写标签',
    loginAccount: '请输入账号',
    loginPassword: '请输入密码',
    detailComment: '说点什么...',
    detailCommentLogin: '登录后参与'
  }),
  messages: Object.freeze({
    browseOnly: '当前仅支持浏览',
    loginRequired: '请先登录',
    sessionUnavailable: '暂时无法验证登录状态，请检查网络',
    loginCredentialsRequired: '请输入账号和密码',
    loginSuccess: '操作成功',
    loginFailed: '操作失败',
    loadFailed: '加载失败',
    editorTitleContentRequired: '请填写完整内容',
    editorImageRequired: '请选择图片',
    editorVideoRequired: '请选择视频',
    editorSubmitting: '处理中',
    editorReviewSubmitted: '已提交',
    editorSuccess: '操作成功',
    editorFailed: '操作失败',
    editorVideoFailed: '处理失败',
    detailLoadFailed: '加载失败',
    detailOriginalLoading: '加载中',
    detailOriginalFailed: '加载失败',
    commentSuccess: '操作成功',
    commentFailed: '操作失败'
  })
})

function cloneDefaultUi() {
  return Object.fromEntries(
    Object.entries(DEFAULT_UI).map(([group, values]) => [group, { ...values }])
  )
}

App({
  globalData: {
    auditConfig: {
      auditModeEnabled: true
    },
    ui: cloneDefaultUi(),
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

  getUiText(group, name) {
    const values = this.globalData.ui && this.globalData.ui[group]
    const value = values ? values[name] : ''
    if (typeof value === 'string' && value.trim()) return value.trim()
    return DEFAULT_UI[group] && DEFAULT_UI[group][name] ? DEFAULT_UI[group][name] : ''
  },

  getUi() {
    return this.globalData.ui || cloneDefaultUi()
  },

  getUiTitle(name) {
    return this.getUiText('titles', name) || '小毛毛'
  },

  setPageTitle(name) {
    const title = this.getUiTitle(name)
    if (wx.setNavigationBarTitle) wx.setNavigationBarTitle({ title })
    return title
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

    const ui = cloneDefaultUi()
    const remoteUi = result && result.ui && typeof result.ui === 'object' ? result.ui : {}

    for (const [group, defaults] of Object.entries(DEFAULT_UI)) {
      const remoteValues = remoteUi[group] && typeof remoteUi[group] === 'object'
        ? remoteUi[group]
        : {}
      for (const key of Object.keys(defaults)) {
        const value = remoteValues[key]
        if (typeof value === 'string' && value.trim()) ui[group][key] = value.trim()
      }
    }

    this.globalData.auditConfig = { auditModeEnabled }
    this.globalData.ui = ui
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
      console.warn('读取小程序配置失败，保持安全默认状态:', error)
      this.setAuditFallback()
      return null
    }
  },

  async ensureNormalMode({ toast = true } = {}) {
    await this.refreshMiniappConfig()
    if (!this.isAuditModeEnabled()) return true

    if (toast) wx.showToast({ title: this.getUiText('messages', 'browseOnly'), icon: 'none' })
    if (!this.guardAuditRoute()) {
      setTimeout(() => wx.reLaunch({ url: '/pages/home/index' }), 50)
    }
    return false
  }
})
