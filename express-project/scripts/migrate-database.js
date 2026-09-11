const { pool } = require('../config/config');

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

async function indexExists(tableName, indexName) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?`,
    [tableName, indexName]
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

async function migrationApplied(id) {
  const [rows] = await pool.execute(
    'SELECT id FROM schema_migrations WHERE id = ? LIMIT 1',
    [id]
  );
  return rows.length > 0;
}

async function markApplied(id) {
  await pool.execute('INSERT IGNORE INTO schema_migrations (id) VALUES (?)', [id]);
}

const migrations = [
  {
    id: '20260903_content_ip_location',
    up: async () => {
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
    }
  },
  {
    id: '20260911_post_recycle_bin',
    up: async () => {
      if (!(await columnExists('posts', 'deleted_status'))) {
        console.log('Adding posts.deleted_status...');
        await pool.execute(
"ALTER TABLE posts ADD COLUMN deleted_status tinyint(1) DEFAULT NULL COMMENT '移入回收站前的状态' AFTER status"
        );
      }
      if (!(await columnExists('posts', 'deleted_at'))) {
        console.log('Adding posts.deleted_at...');
        await pool.execute(
"ALTER TABLE posts ADD COLUMN deleted_at timestamp NULL DEFAULT NULL COMMENT '移入回收站时间' AFTER deleted_status"
        );
      }
      if (!(await indexExists('posts', 'idx_deleted_at'))) {
        console.log('Adding idx_deleted_at...');
        await pool.execute('ALTER TABLE posts ADD KEY idx_deleted_at (deleted_at)');
      }
    }
  }
];

async function main() {
  try {
    await ensureMigrationTable();
    for (const migration of migrations) {
      if (await migrationApplied(migration.id)) {
        console.log(`Migration already applied: ${migration.id}`);
        continue;
      }
      await migration.up();
      await markApplied(migration.id);
      console.log(`Migration applied: ${migration.id}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error('Database migration failed:', error);
  process.exit(1);
});
