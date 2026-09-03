const ABSOLUTE_URL_RE = /^[a-z][a-z\d+.-]*:/i
const DEFAULT_AVATAR = '/assets/avatar.png'

function getServerOrigin(apiBaseUrl = '') {
  const match = String(apiBaseUrl).trim().match(/^(https?:\/\/[^/]+)/i)
  return match ? match[1] : ''
}

function toAbsoluteMediaUrl(value, apiBaseUrl = '') {
  if (typeof value !== 'string') return value

  const mediaUrl = value.trim()
  if (!mediaUrl || ABSOLUTE_URL_RE.test(mediaUrl)) return mediaUrl

  if (mediaUrl.startsWith('//')) {
    const protocolMatch = String(apiBaseUrl).trim().match(/^(https?):/i)
    return `${protocolMatch ? protocolMatch[1].toLowerCase() : 'https'}:${mediaUrl}`
  }

  const origin = getServerOrigin(apiBaseUrl)
  if (!origin) return mediaUrl

  return mediaUrl.startsWith('/')
    ? `${origin}${mediaUrl}`
    : `${origin}/${mediaUrl.replace(/^(\.\/)+/, '')}`
}

function normalizeVideo(video, apiBaseUrl) {
  if (!video || typeof video !== 'object') return video
  return {
    ...video,
    video_url: toAbsoluteMediaUrl(video.video_url, apiBaseUrl),
    cover_url: toAbsoluteMediaUrl(video.cover_url, apiBaseUrl)
  }
}

function normalizePost(post, apiBaseUrl) {
  if (!post || typeof post !== 'object') return post

  const images = Array.isArray(post.images)
    ? post.images.map(image => toAbsoluteMediaUrl(image, apiBaseUrl))
    : []
  const coverUrl = toAbsoluteMediaUrl(post.cover_url, apiBaseUrl)
  const avatarUrl = toAbsoluteMediaUrl(post.user_avatar, apiBaseUrl)

  return {
    ...post,
    images,
    image: toAbsoluteMediaUrl(post.image, apiBaseUrl),
    video_url: toAbsoluteMediaUrl(post.video_url, apiBaseUrl),
    cover_url: coverUrl,
    poster_url: coverUrl || images[0] || '',
    user_avatar: avatarUrl || DEFAULT_AVATAR,
    videos: Array.isArray(post.videos)
      ? post.videos.map(video => normalizeVideo(video, apiBaseUrl))
      : post.videos
  }
}

function normalizeComment(comment, apiBaseUrl) {
  if (!comment || typeof comment !== 'object') return comment
  const avatarUrl = toAbsoluteMediaUrl(comment.user_avatar, apiBaseUrl)
  return {
    ...comment,
    user_avatar: avatarUrl || DEFAULT_AVATAR,
    replies: Array.isArray(comment.replies)
      ? comment.replies.map(reply => normalizeComment(reply, apiBaseUrl))
      : comment.replies
  }
}

function normalizeUser(user, apiBaseUrl) {
  if (!user || typeof user !== 'object') return user
  const avatarUrl = toAbsoluteMediaUrl(user.avatar, apiBaseUrl)
  return {
    ...user,
    avatar: avatarUrl || DEFAULT_AVATAR
  }
}

module.exports = {
  DEFAULT_AVATAR,
  getServerOrigin,
  toAbsoluteMediaUrl,
  normalizePost,
  normalizeComment,
  normalizeUser
}
