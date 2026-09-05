Component({
  properties: {
    current: { type: String, value: 'home' },
    auditModeEnabled: { type: Boolean, value: true },
    labels: { type: Object, value: {} }
  },
  methods: {
    goHome() {
      if (this.data.current !== 'home') wx.reLaunch({ url: '/pages/home/index' })
    },
    goPublish() {
      if (this.data.auditModeEnabled) return
      wx.navigateTo({ url: '/pages/editor/index' })
    },
    goProfile() {
      if (this.data.auditModeEnabled) return
      wx.navigateTo({ url: '/pages/profile/index' })
    }
  }
})
