const { apiBaseUrl } = require('../config')

let lastUnauthorizedNoticeAt = 0
let lastAuditRedirectAt = 0
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

function handleAuditMode() {
  try {
    const app = getApp()
    if (app) {
      if (typeof app.setAuditFallback === 'function') app.setAuditFallback()
      else if (app.globalData) app.globalData.auditConfig = { auditModeEnabled: true }
      if (app.globalData) app.globalData.configLoaded = true
    }
  } catch (error) {}

  const now = Date.now()
  if (now - lastAuditRedirectAt < 1500) return
  lastAuditRedirectAt = now
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

function isAuditModeResponse(statusCode, body = {}) {
  return statusCode === 403 && (body.error === 'MINIAPP_AUDIT_MODE' || body.error === 'MINIAPP_READONLY')
}

async function refreshSession() {
  if (refreshSessionPromise) return refreshSessionPromise

  const refreshToken = getRefreshToken()
  if (!refreshToken) return false

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

          try {
            const app = getApp()
            if (app && app.globalData) {
              app.globalData.sessionValid = true
              app.globalData.lastSessionCheckAt = Date.now()
            }
          } catch (error) {}

          resolve(true)
          return
        }

        if (isAuditModeResponse(res.statusCode, body)) handleAuditMode()
        resolve(false)
      },
      fail() {
        resolve(false)
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
          const refreshed = await refreshSession()
          if (refreshed) {
            request(options, true).then(resolve, reject)
            return
          }
        }

        if (res.statusCode === 401) handleUnauthorized()
        if (isAuditModeResponse(res.statusCode, body)) handleAuditMode()

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
          const refreshed = await refreshSession()
          if (refreshed) {
            uploadFile(options, true).then(resolve, reject)
            return
          }
        }

        if (res.statusCode === 401) handleUnauthorized()
        if (isAuditModeResponse(res.statusCode, body)) handleAuditMode()

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
