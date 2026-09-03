const { pool } = require('../config/config');

const MIGRATION_ID = '20260903_content_ip_location';

async function columnExists(tableName, columnName) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );

  return Number(rows[0].count) > 0;
}

async function ensureMigrationTable() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id varchar(100) NOT NULL,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function migrationApplied() {
  const [rows] = await pool.execute(
    'SELECT id FROM schema_migrations WHERE id = ? LIMIT 1',
    [MIGRATION_ID]
  );
  return rows.length > 0;
}

async function migrateContentIpLocation() {
  if (!(await columnExists('posts', 'ip_location'))) {
    console.log('Adding posts.ip_location...');
    await pool.execute(
      "ALTER TABLE posts ADD COLUMN ip_location varchar(100) DEFAULT NULL COMMENT '发布时IP属地' AFTER comment_count"
    );
  }

  if (!(await columnExists('comments', 'ip_location'))) {
    console.log('Adding comments.ip_location...');
    await pool.execute(
      "ALTER TABLE comments ADD COLUMN ip_location varchar(100) DEFAULT NULL COMMENT '评论时IP属地' AFTER like_count"
    );
  }

  // Historical rows are intentionally NOT backfilled from users.location.
  // The original publishing location cannot be reconstructed reliably.
  await pool.execute(
    'INSERT IGNORE INTO schema_migrations (id) VALUES (?)',
    [MIGRATION_ID]
  );
}

async function main() {
  try {
    await ensureMigrationTable();

    if (await migrationApplied()) {
      console.log(`Migration already applied: ${MIGRATION_ID}`);
      return;
    }

    await migrateContentIpLocation();
    console.log(`Migration applied: ${MIGRATION_ID}`);
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error('Database migration failed:', error);
  process.exit(1);
});
