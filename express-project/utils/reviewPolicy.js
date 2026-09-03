const { pool } = require('../config/config');

const REVIEW_SETTING_KEY = 'post_review_mode';
const REVIEW_MODES = Object.freeze({
  NONE: 'none',
  VERIFIED: 'verified',
  ALL: 'all'
});

const VALID_REVIEW_MODES = new Set(Object.values(REVIEW_MODES));
let ensureSettingsTablePromise = null;

async function ensureSystemSettingsTable() {
  if (!ensureSettingsTablePromise) {
    ensureSettingsTablePromise = (async () => {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS system_settings (
          setting_key varchar(100) NOT NULL,
          setting_value varchar(255) NOT NULL,
          updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (setting_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统设置'
      `);

      // Preserve the current site behaviour after upgrading: all posts require review.
      await pool.execute(
        'INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES (?, ?)',
        [REVIEW_SETTING_KEY, REVIEW_MODES.ALL]
      );
    })().catch(error => {
      ensureSettingsTablePromise = null;
      throw error;
    });
  }

  return ensureSettingsTablePromise;
}

async function getReviewMode() {
  await ensureSystemSettingsTable();

  const [rows] = await pool.execute(
    'SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1',
    [REVIEW_SETTING_KEY]
  );

  const mode = rows.length > 0 ? rows[0].setting_value : REVIEW_MODES.ALL;
  return VALID_REVIEW_MODES.has(mode) ? mode : REVIEW_MODES.ALL;
}

async function setReviewMode(mode) {
  if (!VALID_REVIEW_MODES.has(mode)) {
    throw new Error('INVALID_REVIEW_MODE');
  }

  await ensureSystemSettingsTable();
  await pool.execute(
    `INSERT INTO system_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [REVIEW_SETTING_KEY, mode]
  );

  return mode;
}

async function resolvePublicationStatus(userId) {
  const mode = await getReviewMode();

  if (mode === REVIEW_MODES.NONE) {
    return 0;
  }

  if (mode === REVIEW_MODES.ALL) {
    return 2;
  }

  const [rows] = await pool.execute(
    'SELECT verified FROM users WHERE id = ? LIMIT 1',
    [String(userId)]
  );
  const isVerified = rows.length > 0 && Number(rows[0].verified) > 0;

  return isVerified ? 0 : 2;
}

async function resolvePostStatus({ userId, requestedStatus, currentStatus = null }) {
  const requested = Number(requestedStatus);

  // Draft status always follows the author's explicit action.
  if (requested === 1) {
    return 1;
  }

  // Editing content that is already published/pending should not silently change
  // its moderation state merely because the global mode changed afterward.
  if (currentStatus !== null && currentStatus !== undefined) {
    const current = Number(currentStatus);
    if (current === 0 || current === 2) {
      return current;
    }
  }

  // New publication, draft submission and rejected-post resubmission all use policy.
  return resolvePublicationStatus(userId);
}

async function queuePostAudit(postId) {
  const [rows] = await pool.execute(
    'SELECT id FROM audit WHERE type = 3 AND target_id = ? ORDER BY id DESC LIMIT 1',
    [String(postId)]
  );

  if (rows.length > 0) {
    await pool.execute(
      'UPDATE audit SET status = 0, admin_id = NULL, audit_time = NULL WHERE id = ?',
      [String(rows[0].id)]
    );
  } else {
    await pool.execute(
      'INSERT INTO audit (type, target_id, status) VALUES (?, ?, ?)',
      [3, String(postId), 0]
    );
  }
}

module.exports = {
  REVIEW_MODES,
  getReviewMode,
  setReviewMode,
  resolvePostStatus,
  queuePostAudit
};
