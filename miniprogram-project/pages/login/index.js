const api = require('../../services/api')
const { apiBaseUrl } = require('../../config')
const { getServerOrigin } = require('../../utils/media')

const serverOrigin = getServerOrigin(apiBaseUrl)
const logoUrl = serverOrigin ? `${serverOrigin}/android-icon-192x192.png` : ''

Page({
  data: {
    registerMode: false, nickname: '', confirmPassword: '', email: '', emailCode: '',
    captchaId: '', captchaText: '', captchaImage: '', loadingCaptcha: false,
    sendingCode: false, countdown: 0,
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
    if (!(await app.ensureWritableMode({ toast: false }))) return
    app.setPageTitle('login')
    this.setData({ pageAllowed: true, ui: app.getUi() })
  },
  async onShow() {
    const app = getApp()
    if (!(await app.ensureWritableMode({ toast: false }))) return
    app.setPageTitle('login')
    this.setData({ pageAllowed: true, ui: app.getUi() })
  },
  onUnload() {
    this.unloaded = true
    clearInterval(this.codeTimer)
    this.removeCaptchaFile()
  },
  toast(key) {
    wx.showToast({ title: getApp().getUiText('messages', key), icon: 'none' })
  },
  onRegisterInput(event) {
    const field = event.currentTarget.dataset.field
    if (['nickname', 'confirmPassword', 'email', 'emailCode', 'captchaText'].includes(field)) {
      const update = { [field]: event.detail.value }
      if (field === 'email') update.emailCode = ''
      this.setData(update)
    }
  },
  async toggleMode() {
    if (this.data.submitting || this.data.sendingCode) return
    const registerMode = !this.data.registerMode
    this.setData({ registerMode, password: '', confirmPassword: '', emailCode: '', captchaText: '' })
    if (registerMode) {
      try {
        const config = await api.emailConfig()
        if (!config.emailEnabled) this.toast('registerEmailUnavailable')
      } catch (error) { this.toast('registerEmailUnavailable') }
      await this.refreshCaptcha()
    }
  },
  removeCaptchaFile() {
    if (this.captchaFile) {
      try { wx.getFileSystemManager().unlinkSync(this.captchaFile) } catch (error) {}
      this.captchaFile = ''
    }
  },
  async refreshCaptcha() {
    if (this.data.loadingCaptcha || this.unloaded) return
    this.setData({ loadingCaptcha: true, captchaId: '', captchaText: '', captchaImage: '' })
    try {
      const result = await api.captcha()
      if (this.unloaded) return
      this.removeCaptchaFile()
      const filePath = `${wx.env.USER_DATA_PATH}/register-captcha-${Date.now()}.png`
      wx.getFileSystemManager().writeFileSync(filePath, result.captchaPng, 'base64')
      this.captchaFile = filePath
      this.setData({ captchaId: result.captchaId, captchaImage: filePath })
    } catch (error) { if (!this.unloaded) this.toast('registerCaptchaFailed') }
    finally { if (!this.unloaded) this.setData({ loadingCaptcha: false }) }
  },
  async sendCode() {
    if (this.data.sendingCode || this.data.countdown > 0) return
    const email = this.data.email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return this.toast('registerInvalidEmail')
    this.setData({ sendingCode: true })
    try {
      if (!(await getApp().ensureWritableMode())) return
      await api.sendEmailCode(email)
      if (this.unloaded) return
      this.toast('registerCodeSent')
      this.codeDeadline = Date.now() + 60000
      const tick = () => {
        const countdown = Math.max(0, Math.ceil((this.codeDeadline - Date.now()) / 1000))
        this.setData({ countdown })
        if (!countdown) clearInterval(this.codeTimer)
      }
      tick()
      this.codeTimer = setInterval(tick, 1000)
      await this.refreshCaptcha()
    } catch (error) {
      if (!this.unloaded) wx.showToast({ title: error.message || getApp().getUiText('messages', 'registerCodeFailed'), icon: 'none' })
    } finally { if (!this.unloaded) this.setData({ sendingCode: false }) }
  },
  validateRegistration() {
    const d = this.data
    if (!/^[a-zA-Z0-9_]{3,15}$/.test(d.userId.trim())) return 'registerInvalidAccount'
    if (!d.nickname.trim() || d.nickname.trim().length > 10) return 'registerInvalidNickname'
    if (d.password.length < 6 || d.password.length > 20) return 'registerInvalidPassword'
    if (d.password !== d.confirmPassword) return 'registerPasswordMismatch'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) return 'registerInvalidEmail'
    if (!/^\d{6}$/.test(d.emailCode.trim())) return 'registerCodeRequired'
    if (!d.captchaId || !d.captchaText.trim()) return 'registerCaptchaRequired'
    return ''
  },
  onUserIdInput(event) { this.setData({ userId: event.detail.value }) },
  onPasswordInput(event) { this.setData({ password: event.detail.value }) },
  onLogoError() { this.setData({ logoLoadFailed: true }) },
  async submit() {
    if (this.data.submitting) return
    const app = getApp()
    if (!(await app.ensureWritableMode())) return
    if (this.data.registerMode) {
      const error = this.validateRegistration()
      if (error) return this.toast(error)
    }
    if (!this.data.userId.trim() || !this.data.password) {
      return wx.showToast({ title: app.getUiText('messages', 'loginCredentialsRequired'), icon: 'none' })
    }
    this.setData({ submitting: true })
    try {
      const result = this.data.registerMode
        ? await api.register({
          user_id: this.data.userId.trim(), nickname: this.data.nickname.trim(), password: this.data.password,
          email: this.data.email.trim(), emailCode: this.data.emailCode.trim(),
          captchaId: this.data.captchaId, captchaText: this.data.captchaText.trim()
        })
        : await api.login(this.data.userId.trim(), this.data.password)
      wx.setStorageSync('token', result.tokens.access_token)
      wx.setStorageSync('refresh_token', result.tokens.refresh_token)
      wx.setStorageSync('user', result.user)
      app.globalData.user = result.user
      app.globalData.sessionValid = true
      app.globalData.lastSessionCheckAt = Date.now()
      wx.showToast({ title: app.getUiText('messages', this.data.registerMode ? 'registerSuccess' : 'loginSuccess'), icon: 'success' })
      setTimeout(() => {
        if (getCurrentPages().length > 1) wx.navigateBack({ delta: 1 })
        else wx.reLaunch({ url: '/pages/home/index' })
      }, 300)
    } catch (error) {
      wx.showToast({ title: error.message || app.getUiText('messages', this.data.registerMode ? 'registerFailed' : 'loginFailed'), icon: 'none' })
      if (this.data.registerMode) await this.refreshCaptcha()
    } finally {
      this.setData({ submitting: false })
    }
  }
})
