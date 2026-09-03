const { request, uploadFile } = require('./request')
const { apiBaseUrl } = require('../config')
const { normalizePost, normalizeComment, normalizeUser } = require('../utils/media')

function unwrap(result) {
  return result && result.data !== undefined ? result.data : result
}

async function getMiniappConfig() {
  return unwrap(await request({ url: '/miniapp/config' }))
}

async function getPosts(params = {}) {
  const query = Object.entries({ page: 1, limit: 20, status: 0, ...params })
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
  const result = unwrap(await request({ url: `/posts?${query}` }))
  if (!result || !Array.isArray(result.posts)) return result
  return { ...result, posts: result.posts.map(post => normalizePost(post, apiBaseUrl)) }
}

async function getPostDetail(id, skipViewCount = false) {
  const post = unwrap(await request({ url: `/posts/${id}${skipViewCount ? '?skipViewCount=true' : ''}` }))
  return normalizePost(post, apiBaseUrl)
}

async function getCategories() {
  return unwrap(await request({ url: '/categories' }))
}

async function getComments(postId, page = 1) {
  const result = unwrap(await request({ url: `/comments?post_id=${postId}&page=${page}&limit=20` }))
  if (!result || !Array.isArray(result.comments)) return result
  return { ...result, comments: result.comments.map(comment => normalizeComment(comment, apiBaseUrl)) }
}

async function login(userId, password) {
  const result = unwrap(await request({ url: '/auth/login', method: 'POST', data: { user_id: userId, password } }))
  if (!result || !result.user) return result
  return { ...result, user: normalizeUser(result.user, apiBaseUrl) }
}

async function logout() {
  return unwrap(await request({ url: '/auth/logout', method: 'POST' }))
}

async function getCurrentUser() {
  return normalizeUser(unwrap(await request({ url: '/auth/me' })), apiBaseUrl)
}

async function createComment(postId, content) {
  return normalizeComment(
    unwrap(await request({ url: '/comments', method: 'POST', data: { post_id: postId, content } })),
    apiBaseUrl
  )
}

async function createPost(payload) {
  return unwrap(await request({ url: '/posts', method: 'POST', data: payload }))
}

async function uploadImage(filePath) {
  return unwrap(await uploadFile({ url: '/upload/single', filePath }))
}

async function uploadVideo(filePath) {
  return unwrap(await uploadFile({ url: '/upload/video', filePath, name: 'file' }))
}

module.exports = {
  getMiniappConfig,
  getPosts,
  getPostDetail,
  getCategories,
  getComments,
  login,
  logout,
  getCurrentUser,
  createComment,
  createPost,
  uploadImage,
  uploadVideo
}
