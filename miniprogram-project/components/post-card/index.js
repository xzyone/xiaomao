Component({
  properties: {
    post: { type: Object, value: {} }
  },
  data: {
    avatarFailed: false
  },
  observers: {
    'post.user_avatar': function () {
      if (this.data.avatarFailed) this.setData({ avatarFailed: false })
    }
  },
  methods: {
    onAvatarError() {
      if (!this.data.avatarFailed) this.setData({ avatarFailed: true })
    },
    openPost() {
      const id = this.data.post && this.data.post.id
      if (id) wx.navigateTo({ url: `/pages/post-detail/index?id=${id}` })
    }
  }
})
