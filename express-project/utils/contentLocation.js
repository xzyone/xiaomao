const { getIPLocation, getRealIP } = require('./ipLocation');

/**
 * Resolve the geographic label for a content creation request.
 * Location lookup failures must never block publishing.
 * Raw IP addresses are not persisted by this helper.
 *
 * @param {Object} req Express request
 * @returns {Promise<string|null>} Stable display location, or null when unavailable
 */
async function getContentLocation(req) {
  try {
    const ip = getRealIP(req);
    const location = await getIPLocation(ip);

    if (!location || location === '未知' || location === '本地') {
      return null;
    }

    return location;
  } catch (error) {
    console.warn('获取内容发布IP属地失败:', error.message);
    return null;
  }
}

module.exports = {
  getContentLocation
};
