Component({
  properties: {
    post: { type: Object, value: {} }
  },
  methods: {
    openPost() {
      const id = this.data.post && this.data.post.id
      if (id) wx.navigateTo({ url: `/pages/post-detail/index?id=${id}` })
    }
  }
})
