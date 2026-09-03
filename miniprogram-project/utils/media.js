const ABSOLUTE_URL_RE = /^[a-z][a-z\d+.-]*:/i
const ORIGINAL_IMAGE_ROUTE = '/api/files/images/'
const THUMBNAIL_ROUTE = '/api/files/thumbnails/'

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

function toThumbnailUrl(value, apiBaseUrl = '') {
  const absoluteUrl = toAbsoluteMediaUrl(value, apiBaseUrl)
  if (typeof absoluteUrl !== 'string' || !absoluteUrl.includes(ORIGINAL_IMAGE_ROUTE)) {
    return absoluteUrl
  }
  return absoluteUrl.replace(ORIGINAL_IMAGE_ROUTE, THUMBNAIL_ROUTE)
}

function normalizeVideo(video, apiBaseUrl) {
  if (!video || typeof video !== 'object') return video
  return {
    ...video,
    video_url: toAbsoluteMediaUrl(video.video_url, apiBaseUrl),
    cover_url: toAbsoluteMediaUrl(video.cover_url, apiBaseUrl),
    thumbnail_cover_url: toThumbnailUrl(video.cover_url, apiBaseUrl)
  }
}

function normalizePost(post, apiBaseUrl) {
  if (!post || typeof post !== 'object') return post

  const images = Array.isArray(post.images)
    ? post.images.map(image => toAbsoluteMediaUrl(image, apiBaseUrl))
    : []
  const thumbnailImages = Array.isArray(post.thumbnail_images) && post.thumbnail_images.length
    ? post.thumbnail_images.map(image => toAbsoluteMediaUrl(image, apiBaseUrl))
    : images.map(image => toThumbnailUrl(image, apiBaseUrl))
  const coverUrl = toAbsoluteMediaUrl(post.cover_url, apiBaseUrl)
  const thumbnailCoverUrl = toThumbnailUrl(coverUrl, apiBaseUrl)

  return {
    ...post,
    images,
    thumbnail_images: thumbnailImages,
    image: toAbsoluteMediaUrl(post.image, apiBaseUrl),
    thumbnail_image: thumbnailImages[0] || toThumbnailUrl(post.image, apiBaseUrl),
    video_url: toAbsoluteMediaUrl(post.video_url, apiBaseUrl),
    cover_url: coverUrl,
    thumbnail_cover_url: thumbnailCoverUrl,
    poster_url: thumbnailCoverUrl || thumbnailImages[0] || coverUrl || images[0] || '',
    user_avatar: toAbsoluteMediaUrl(post.user_avatar, apiBaseUrl),
    videos: Array.isArray(post.videos)
      ? post.videos.map(video => normalizeVideo(video, apiBaseUrl))
      : post.videos
  }
}

function normalizeComment(comment, apiBaseUrl) {
  if (!comment || typeof comment !== 'object') return comment
  return {
    ...comment,
    user_avatar: toAbsoluteMediaUrl(comment.user_avatar, apiBaseUrl),
    replies: Array.isArray(comment.replies)
      ? comment.replies.map(reply => normalizeComment(reply, apiBaseUrl))
      : comment.replies
  }
}

function normalizeUser(user, apiBaseUrl) {
  if (!user || typeof user !== 'object') return user
  return {
    ...user,
    avatar: toAbsoluteMediaUrl(user.avatar, apiBaseUrl)
  }
}

module.exports = {
  getServerOrigin,
  toAbsoluteMediaUrl,
  toThumbnailUrl,
  normalizePost,
  normalizeComment,
  normalizeUser
}
