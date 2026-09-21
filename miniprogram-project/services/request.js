const { apiBaseUrl } = require('../config')

let lastUnauthorizedNoticeAt = 0
let lastReadonlyRedirectAt = 0
let refreshSessionPromise = null

function getToken() {
  return wx.getStorageSync('token') || ''
}

function getRefreshToken() {
  return wx.getStorageSync('refresh_token') || ''
}

function clearSession() {
  wx.removeStorageSync('token')
  wx.removeStorageSync('refresh_token')
  wx.removeStorageSync('user')
  wx.removeStorageSync('persistent_session_version')

  try {
    const app = getApp()
    if (app && app.globalData) {
      app.globalData.user = null
      app.globalData.sessionValid = false
      app.globalData.lastSessionCheckAt = 0
    }
  } catch (error) {}
}

function handleUnauthorized() {
  clearSession()

  const now = Date.now()
  if (now - lastUnauthorizedNoticeAt < 2000) return
  lastUnauthorizedNoticeAt = now
  wx.showToast({ title: '登录已失效，请重新登录', icon: 'none' })
}

function handleReadonlyMode() {
  try {
    const app = getApp()
    if (app) {
      if (typeof app.setReadonlyFallback === 'function') app.setReadonlyFallback()
      else if (app.globalData) app.globalData.readonlyConfig = { readonlyModeEnabled: true }
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

function isReadonlyModeResponse(statusCode, body = {}) {
  return statusCode === 403 &&
    (body.error === 'MINIAPP_READONLY' || body.error === 'MINIAPP_AUDIT_MODE')
}

async function refreshSession() {
  if (refreshSessionPromise) return refreshSessionPromise

  const refreshToken = getRefreshToken()
  if (!refreshToken) return 'invalid'

  refreshSessionPromise = new Promise(resolve => {
    wx.request({
      url: `${apiBaseUrl}/auth/refresh`,
      method: 'POST',
      data: { refresh_token: refreshToken },
      header: {
        'Content-Type': 'application/json',
        'X-Client-Platform': 'wechat-miniapp'
      },
      success(res) {
        const body = res.data || {}
        const tokens = body && body.data
        if (
          res.statusCode >= 200 &&
          res.statusCode < 300 &&
          body.code === 200 &&
          tokens &&
          tokens.access_token &&
          tokens.refresh_token
        ) {
          wx.setStorageSync('token', tokens.access_token)
          wx.setStorageSync('refresh_token', tokens.refresh_token)
          wx.setStorageSync('persistent_session_version', 1)

          try {
            const app = getApp()
            if (app && app.globalData) {
              app.globalData.sessionValid = true
              app.globalData.lastSessionCheckAt = Date.now()
            }
          } catch (error) {}

          resolve('ok')
          return
        }

        if (isReadonlyModeResponse(res.statusCode, body)) {
          handleReadonlyMode()
          resolve('readonly')
          return
        }

        if (res.statusCode === 400 || res.statusCode === 401) {
          resolve('invalid')
          return
        }

        resolve('unavailable')
      },
      fail() {
        resolve('unavailable')
      }
    })
  })

  try {
    return await refreshSessionPromise
  } finally {
    refreshSessionPromise = null
  }
}

function request(options, retried = false) {
  const { url, method = 'GET', data, header = {} } = options

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${apiBaseUrl}${url}`,
      method,
      data,
      header: buildHeaders(header),
      async success(res) {
        const body = res.data || {}
        if (res.statusCode >= 200 && res.statusCode < 300 && (body.code === 200 || body.success === true || body.code === undefined)) {
          resolve(body)
          return
        }

        if (res.statusCode === 401 && !retried && url !== '/auth/refresh') {
          const refreshResult = await refreshSession()
          if (refreshResult === 'ok') {
            request(options, true).then(resolve, reject)
            return
          }
          if (refreshResult === 'unavailable') {
            const error = new Error('暂时无法验证登录状态，请检查网络')
            error.statusCode = 0
            reject(error)
            return
          }
          if (refreshResult === 'readonly') {
            const error = new Error('当前仅支持浏览')
            error.statusCode = 403
            error.error = 'MINIAPP_READONLY'
            reject(error)
            return
          }
        }

        if (res.statusCode === 401) handleUnauthorized()
        if (isReadonlyModeResponse(res.statusCode, body)) handleReadonlyMode()

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

function uploadFile(options, retried = false) {
  const { url, filePath, name = 'file', formData = {} } = options

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
      async success(res) {
        let body = {}
        try { body = JSON.parse(res.data || '{}') } catch (error) {}

        if (res.statusCode >= 200 && res.statusCode < 300 && (body.code === 200 || body.success === true)) {
          resolve(body)
          return
        }

        if (res.statusCode === 401 && !retried) {
          const refreshResult = await refreshSession()
          if (refreshResult === 'ok') {
            uploadFile(options, true).then(resolve, reject)
            return
          }
          if (refreshResult === 'unavailable') {
            const error = new Error('暂时无法验证登录状态，请检查网络')
            error.statusCode = 0
            reject(error)
            return
          }
          if (refreshResult === 'readonly') {
            const error = new Error('当前仅支持浏览')
            error.statusCode = 403
            error.error = 'MINIAPP_READONLY'
            reject(error)
            return
          }
        }

        if (res.statusCode === 401) handleUnauthorized()
        if (isReadonlyModeResponse(res.statusCode, body)) handleReadonlyMode()

        const requestError = new Error(body.message || `上传失败 (${res.statusCode})`)
        requestError.statusCode = res.statusCode
        requestError.error = body.error
        reject(requestError)
      },
      fail: reject
    })
  })
}

module.exports = { request, uploadFile, getToken, clearSession, refreshSession }
