const { request, uploadFile } = require('./request')

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
  return unwrap(await request({ url: `/posts?${query}` }))
}

async function getPostDetail(id, skipViewCount = false) {
  return unwrap(await request({ url: `/posts/${id}${skipViewCount ? '?skipViewCount=true' : ''}` }))
}

async function getCategories() {
  return unwrap(await request({ url: '/categories' }))
}

async function getComments(postId, page = 1) {
  return unwrap(await request({ url: `/comments?post_id=${postId}&page=${page}&limit=20` }))
}

async function login(userId, password) {
  return unwrap(await request({ url: '/auth/login', method: 'POST', data: { user_id: userId, password } }))
}

async function getCurrentUser() {
  return unwrap(await request({ url: '/auth/me' }))
}

async function createComment(postId, content) {
  return unwrap(await request({ url: '/comments', method: 'POST', data: { post_id: postId, content } }))
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
  getCurrentUser,
  createComment,
  createPost,
  uploadImage,
  uploadVideo
}
