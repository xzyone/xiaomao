const fs = require('fs');
const { pool } = require('../config/config');
const { extractLocalFilePath, deleteLocalFile } = require('./fileCleanup');
const { getLocalImageFilename, getThumbnailPath } = require('./imageThumbnail');

const RECYCLE_STATUS = 4;
const RECYCLE_RETENTION_DAYS = 30;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

function normalizeLocalMediaUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    if (/^https?:\/\//i.test(url)) {
      return new URL(url).pathname;
    }
  } catch (error) {
    return null;
  }
  return url;
}

async function cleanupLocalMedia(urls) {
  const uniqueUrls = [...new Set((urls || []).filter(Boolean))];
  for (const url of uniqueUrls) {
    try {
      const localUrl = normalizeLocalMediaUrl(url);
      const filePath = localUrl ? extractLocalFilePath(localUrl) : null;
      if (filePath) {
        await deleteLocalFile(filePath);
      }

      const imageFilename = getLocalImageFilename(url);
      if (imageFilename) {
        const thumbnailPath = getThumbnailPath(imageFilename);
        if (thumbnailPath && fs.existsSync(thumbnailPath)) {
await fs.promises.unlink(thumbnailPath).catch(() => {});
        }
      }
    } catch (error) {
      console.error(`清理回收站媒体失败: ${url}`, error.message);
    }
  }
}

async function softDeletePost(postId, { userId = null } = {}) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let sql = 'SELECT id, user_id, status FROM posts WHERE id = ? AND status <> ? FOR UPDATE';
    const params = [String(postId), String(RECYCLE_STATUS)];
    if (userId !== null && userId !== undefined) {
      sql = 'SELECT id, user_id, status FROM posts WHERE id = ? AND user_id = ? AND status <> ? FOR UPDATE';
      params.splice(1, 0, String(userId));
    }

    const [rows] = await connection.execute(sql, params);
    if (rows.length === 0) {
      await connection.rollback();
      return false;
    }

    const originalStatus = Number(rows[0].status);
    const [tagRows] = await connection.execute(
      'SELECT tag_id FROM post_tags WHERE post_id = ?',
      [String(postId)]
    );

    for (const tag of tagRows) {
      await connection.execute(
        'UPDATE tags SET use_count = GREATEST(use_count - 1, 0) WHERE id = ?',
        [String(tag.tag_id)]
      );
    }

    await connection.execute(
      'UPDATE posts SET deleted_status = ?, status = ?, deleted_at = UTC_TIMESTAMP() WHERE id = ?',
      [String(originalStatus), String(RECYCLE_STATUS), String(postId)]
    );

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function restorePost(postId, { userId = null } = {}) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let sql = 'SELECT id, deleted_status FROM posts WHERE id = ? AND status = ? AND deleted_at IS NOT NULL FOR UPDATE';
    const params = [String(postId), String(RECYCLE_STATUS)];
    if (userId !== null && userId !== undefined) {
      sql = 'SELECT id, deleted_status FROM posts WHERE id = ? AND user_id = ? AND status = ? AND deleted_at IS NOT NULL FOR UPDATE';
      params.splice(1, 0, String(userId));
    }

    const [rows] = await connection.execute(sql, params);
    if (rows.length === 0) {
      await connection.rollback();
      return false;
    }

    const previousStatus = Number(rows[0].deleted_status);
    const restoredStatus = [0, 1, 2, 3].includes(previousStatus) ? previousStatus : 1;

    const [tagRows] = await connection.execute(
      'SELECT tag_id FROM post_tags WHERE post_id = ?',
      [String(postId)]
    );
    for (const tag of tagRows) {
      await connection.execute(
        'UPDATE tags SET use_count = use_count + 1 WHERE id = ?',
        [String(tag.tag_id)]
      );
    }

    await connection.execute(
      'UPDATE posts SET status = ?, deleted_status = NULL, deleted_at = NULL WHERE id = ?',
      [String(restoredStatus), String(postId)]
    );

    await connection.commit();
    return { restored: true, status: restoredStatus };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function hardDeletePost(postId, { userId = null } = {}) {
  const connection = await pool.getConnection();
  let mediaUrls = [];
  try {
    await connection.beginTransaction();

    let sql = 'SELECT id FROM posts WHERE id = ? AND status = ? AND deleted_at IS NOT NULL FOR UPDATE';
    const params = [String(postId), String(RECYCLE_STATUS)];
    if (userId !== null && userId !== undefined) {
      sql = 'SELECT id FROM posts WHERE id = ? AND user_id = ? AND status = ? AND deleted_at IS NOT NULL FOR UPDATE';
      params.splice(1, 0, String(userId));
    }

    const [rows] = await connection.execute(sql, params);
    if (rows.length === 0) {
      await connection.rollback();
      return false;
    }

    const [imageRows] = await connection.execute(
      'SELECT image_url FROM post_images WHERE post_id = ?',
      [String(postId)]
    );
    const [videoRows] = await connection.execute(
      'SELECT video_url, cover_url FROM post_videos WHERE post_id = ?',
      [String(postId)]
    );
    mediaUrls = [
      ...imageRows.map(row => row.image_url),
      ...videoRows.flatMap(row => [row.video_url, row.cover_url])
    ].filter(Boolean);

    const [commentRows] = await connection.execute(
      'SELECT id FROM comments WHERE post_id = ?',
      [String(postId)]
    );
    const commentIds = commentRows.map(row => String(row.id));
    if (commentIds.length > 0) {
      const placeholders = commentIds.map(() => '?').join(',');
      await connection.execute(
        `DELETE FROM likes WHERE target_type = 2 AND target_id IN (${placeholders})`,
        commentIds
      );
      await connection.execute(
        `DELETE FROM notifications WHERE comment_id IN (${placeholders})`,
        commentIds
      );
    }

    await connection.execute(
      'DELETE FROM likes WHERE target_type = 1 AND target_id = ?',
      [String(postId)]
    );
    await connection.execute(
      'DELETE FROM notifications WHERE target_id = ?',
      [String(postId)]
    );
    await connection.execute(
      'DELETE FROM audit WHERE type = 3 AND target_id = ?',
      [String(postId)]
    );

    // post_images/post_videos/post_tags/comments/collections are removed by FK cascade.
    await connection.execute('DELETE FROM posts WHERE id = ?', [String(postId)]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  await cleanupLocalMedia(mediaUrls);
  return true;
}

async function purgeExpiredPosts() {
  let deletedCount = 0;
  while (true) {
    const [rows] = await pool.execute(
      `SELECT id FROM posts
       WHERE status = ?
         AND deleted_at IS NOT NULL
         AND deleted_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${RECYCLE_RETENTION_DAYS} DAY)
       ORDER BY deleted_at ASC
       LIMIT 100`,
      [String(RECYCLE_STATUS)]
    );

    if (rows.length === 0) break;
    for (const row of rows) {
      if (await hardDeletePost(row.id)) {
        deletedCount += 1;
      }
    }
    if (rows.length < 100) break;
  }

  if (deletedCount > 0) {
    console.log(`● 回收站自动清理完成：永久删除 ${deletedCount} 篇过期笔记`);
  }
  return deletedCount;
}

function startRecycleBinCleanupService(interval = CLEANUP_INTERVAL_MS) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await purgeExpiredPosts();
    } catch (error) {
      console.error('回收站自动清理失败:', error);
    } finally {
      running = false;
    }
  };

  run();
  const timer = setInterval(run, interval);
  if (typeof timer.unref === 'function') timer.unref();
  console.log(`● 笔记回收站已启用，保留 ${RECYCLE_RETENTION_DAYS} 天，每 ${Math.round(interval / 3600000)} 小时检查一次`);
  return timer;
}

module.exports = {
  RECYCLE_STATUS,
  RECYCLE_RETENTION_DAYS,
  softDeletePost,
  restorePost,
  hardDeletePost,
  purgeExpiredPosts,
  startRecycleBinCleanupService
};
