Component({
  properties: {
    current: { type: String, value: 'home' },
    readonlyMode: { type: Boolean, value: false }
  },
  methods: {
    goHome() {
      if (this.data.current !== 'home') wx.reLaunch({ url: '/pages/home/index' })
    },
    goPublish() {
      if (this.data.readonlyMode) return
      wx.navigateTo({ url: '/pages/publish/index' })
    },
    goProfile() {
      if (this.data.readonlyMode) return
      wx.navigateTo({ url: '/pages/profile/index' })
    }
  }
})
