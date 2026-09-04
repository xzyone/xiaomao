Component({
  properties: {
    current: { type: String, value: 'home' },
    readonlyMode: { type: Boolean, value: true }
  },
  methods: {
    goHome() {
      if (this.data.current !== 'home') wx.reLaunch({ url: '/pages/home/index' })
    },
    goPublish() {
      if (this.data.readonlyMode) return
      wx.navigateTo({ url: '/pages/editor/index' })
    },
    goProfile() {
      if (this.data.readonlyMode) return
      wx.navigateTo({ url: '/pages/profile/index' })
    }
  }
})
