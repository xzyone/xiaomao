const { apiBaseUrl } = require('../config')

let lastUnauthorizedNoticeAt = 0
let lastReadonlyRedirectAt = 0

function getToken() {
  return wx.getStorageSync('token') || ''
}

function clearSession() {
  wx.removeStorageSync('token')
  wx.removeStorageSync('refresh_token')
  wx.removeStorageSync('user')

  try {
    const app = getApp()
    if (app && app.globalData) app.globalData.user = null
  } catch (error) {}
}

function handleUnauthorized() {
  clearSession()

  const now = Date.now()
  if (now - lastUnauthorizedNoticeAt < 2000) return
  lastUnauthorizedNoticeAt = now
  wx.showToast({ title: '登录已失效，请重新登录', icon: 'none' })
}

function handleReadonly() {
  try {
    const app = getApp()
    if (app) {
      if (typeof app.setReadonlyFallback === 'function') app.setReadonlyFallback()
      else if (app.globalData) {
        app.globalData.readonlyMode = true
        app.globalData.interactiveEnabled = false
      }
      if (app.globalData) app.globalData.configLoaded = true
    }
  } catch (error) {}

  const now = Date.now()
  if (now - lastReadonlyRedirectAt < 1500) return
  lastReadonlyRedirectAt = now
  wx.showToast({ title: '当前仅支持浏览', icon: 'none' })
  setTimeout(() => wx.reLaunch({ url: '/pages/home/index' }), 100)
}

function buildHeaders(extra = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    'X-Client-Platform': 'wechat-miniapp',
    ...extra
  }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

function request({ url, method = 'GET', data, header = {} }) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${apiBaseUrl}${url}`,
      method,
      data,
      header: buildHeaders(header),
      success(res) {
        const body = res.data || {}
        if (res.statusCode >= 200 && res.statusCode < 300 && (body.code === 200 || body.success === true || body.code === undefined)) {
          resolve(body)
          return
        }
        if (res.statusCode === 401) handleUnauthorized()
        if (res.statusCode === 403 && body.error === 'MINIAPP_READONLY') handleReadonly()
        const error = new Error(body.message || `请求失败 (${res.statusCode})`)
        error.statusCode = res.statusCode
        error.code = body.code
        error.error = body.error
        reject(error)
      },
      fail: reject
    })
  })
}

function uploadFile({ url, filePath, name = 'file', formData = {} }) {
  return new Promise((resolve, reject) => {
    const token = getToken()
    const header = { 'X-Client-Platform': 'wechat-miniapp' }
    if (token) header.Authorization = `Bearer ${token}`

    wx.uploadFile({
      url: `${apiBaseUrl}${url}`,
      filePath,
      name,
      formData,
      header,
      success(res) {
        let body = {}
        try { body = JSON.parse(res.data || '{}') } catch (error) {}
        if (res.statusCode >= 200 && res.statusCode < 300 && (body.code === 200 || body.success === true)) {
          resolve(body)
          return
        }
        if (res.statusCode === 401) handleUnauthorized()
        if (res.statusCode === 403 && body.error === 'MINIAPP_READONLY') handleReadonly()
        const requestError = new Error(body.message || `上传失败 (${res.statusCode})`)
        requestError.statusCode = res.statusCode
        requestError.error = body.error
        reject(requestError)
      },
      fail: reject
    })
  })
}

module.exports = { request, uploadFile, getToken, clearSession }
