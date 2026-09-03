const express = require('express');
const router = express.Router();
const { HTTP_STATUS, RESPONSE_CODES, ERROR_MESSAGES } = require('../constants');
const { pool } = require('../config/config');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt');
const { getIPLocation, getRealIP } = require('../utils/ipLocation');

/**
 * Login route with multi-device session support.
 *
 * The original auth route invalidates every existing session for the user on
 * each login. That makes a browser login immediately kick the same account out
 * of the Mini Program (and vice versa). This route is mounted before auth.js
 * and intentionally keeps other active sessions alive.
 */
router.post('/login', async (req, res) => {
  try {
    const { user_id, password } = req.body;
    if (!user_id || !password) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: RESPONSE_CODES.VALIDATION_ERROR,
        message: '缺少必要参数'
      });
    }

    const [userRows] = await pool.execute(
      'SELECT id, user_id, nickname, avatar, bio, location, follow_count, fans_count, like_count, is_active, gender, zodiac_sign, mbti, education, major, interests FROM users WHERE user_id = ?',
      [user_id.toString()]
    );

    if (userRows.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: RESPONSE_CODES.NOT_FOUND,
        message: '用户不存在'
      });
    }

    const user = userRows[0];
    if (!user.is_active) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        code: RESPONSE_CODES.FORBIDDEN,
        message: '账户已被禁用'
      });
    }

    const [passwordCheck] = await pool.execute(
      'SELECT 1 FROM users WHERE id = ? AND password = SHA2(?, 256)',
      [user.id.toString(), password]
    );

    if (passwordCheck.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: RESPONSE_CODES.VALIDATION_ERROR,
        message: '密码错误'
      });
    }

    const accessToken = generateAccessToken({ userId: user.id, user_id: user.user_id });
    const refreshToken = generateRefreshToken({ userId: user.id, user_id: user.user_id });
    const userAgent = req.headers['user-agent'] || '';

    let ipLocation = user.location || '未知';
    try {
      ipLocation = await getIPLocation(getRealIP(req));
    } catch (error) {
      console.warn('登录时获取IP属地失败，保留原属地:', error.message);
    }

    await pool.execute(
      'UPDATE users SET location = ?, last_login_at = NOW() WHERE id = ?',
      [ipLocation, user.id.toString()]
    );

    // Only clean up expired sessions. Do not invalidate sessions belonging to
    // other browsers, phones or Mini Program instances.
    await pool.execute(
      'UPDATE user_sessions SET is_active = 0 WHERE user_id = ? AND expires_at <= NOW()',
      [user.id.toString()]
    );
    await pool.execute(
      'INSERT INTO user_sessions (user_id, token, refresh_token, expires_at, user_agent, is_active) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY), ?, 1)',
      [user.id.toString(), accessToken, refreshToken, userAgent]
    );

    user.location = ipLocation;
    delete user.password;

    if (user.interests) {
      try {
        user.interests = typeof user.interests === 'string'
          ? JSON.parse(user.interests)
          : user.interests;
      } catch (error) {
        user.interests = null;
      }
    }

    console.log(`用户登录成功 - 用户ID: ${user.id}, 毛毛号: ${user.user_id}`);
    res.json({
      code: RESPONSE_CODES.SUCCESS,
      message: '登录成功',
      data: {
        user,
        tokens: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: 3600
        }
      }
    });
  } catch (error) {
    console.error('用户登录失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      code: RESPONSE_CODES.ERROR,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
});

module.exports = router;
