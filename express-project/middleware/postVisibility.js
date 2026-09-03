const { HTTP_STATUS, RESPONSE_CODES } = require('../constants');
const { optionalAuth } = require('./auth');

const ALLOWED_POST_STATUSES = new Set([0, 1, 2, 3]);

/**
 * Non-published post lists must never be globally enumerable.
 * Published posts (status=0) stay public. Draft/pending/rejected lists require
 * a valid user session and are forcibly scoped to that user's own account.
 */
function protectPostListVisibility(req, res, next) {
  if (req.method !== 'GET' || req.path !== '/') {
    return next();
  }

  const rawStatus = req.query.status;
  const status = rawStatus === undefined ? 0 : Number(rawStatus);

  if (!Number.isInteger(status) || !ALLOWED_POST_STATUSES.has(status)) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      code: RESPONSE_CODES.VALIDATION_ERROR,
      message: '无效的笔记状态'
    });
  }

  req.query.status = String(status);

  if (status === 0) {
    return next();
  }

  return optionalAuth(req, res, () => {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        code: RESPONSE_CODES.UNAUTHORIZED,
        message: '查看未公开笔记需要登录'
      });
    }

    // posts.js already handles drafts specially. For pending/rejected lists,
    // this prevents callers from selecting another user's id.
    req.query.user_id = String(req.user.id);
    return next();
  });
}

module.exports = {
  protectPostListVisibility
};
