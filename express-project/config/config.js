/**
 * 小毛毛生活社区 - 应用配置文件
 * 集中管理所有配置项
 * 
 * @author ZTMYO
 * @github https://github.com/ZTMYO
 * @description Express应用的核心配置管理
 * @version v1.3.2
 */

const mysql = require('mysql2');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });


const config = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3001,
    env: process.env.NODE_ENV || 'development',
    trustProxy: parseInt(process.env.TRUST_PROXY || '0', 10)
  },

  // CORS配置
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) : ['http://localhost:5173', 'http://localhost:3001']
  },

  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d'
  },

  // 数据库配置
  // MySQL TIMESTAMP 统一以 UTC 会话读写，浏览器再按访问者本地时区显示。
  database: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'xiaomao',
    port: process.env.DB_PORT || 3306,
    charset: 'utf8mb4',
    timezone: 'Z'
  },

  // 上传配置
  upload: {
    image: {
      maxSize: process.env.IMAGE_MAX_SIZE || '10mb',
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      strategy: process.env.IMAGE_UPLOAD_STRATEGY || 'imagehost',
      local: {
        uploadDir: process.env.IMAGE_LOCAL_UPLOAD_DIR || 'uploads/images',
        baseUrl: process.env.LOCAL_BASE_URL || 'http://localhost:3001'
      },
      imagehost: {
        apiUrl: process.env.IMAGEHOST_API_URL || 'https://api.xinyew.cn/api/360tc',
        timeout: parseInt(process.env.IMAGEHOST_TIMEOUT) || 60000
      },
      r2: {
        accountId: process.env.R2_ACCOUNT_ID,
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        bucketName: process.env.R2_BUCKET_NAME,
        endpoint: process.env.R2_ENDPOINT,
        publicUrl: process.env.R2_PUBLIC_URL,
        region: process.env.R2_REGION || 'auto'
      }
    },
    video: {
      maxSize: process.env.VIDEO_MAX_SIZE || '100mb',
      allowedTypes: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm'],
      strategy: process.env.VIDEO_UPLOAD_STRATEGY || 'local',
      local: {
        uploadDir: process.env.VIDEO_LOCAL_UPLOAD_DIR || 'uploads/videos',
        baseUrl: process.env.LOCAL_BASE_URL || 'http://localhost:3001'
      },
      r2: {
        accountId: process.env.R2_ACCOUNT_ID,
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        bucketName: process.env.R2_BUCKET_NAME,
        endpoint: process.env.R2_ENDPOINT,
        publicUrl: process.env.R2_PUBLIC_URL,
        region: process.env.R2_REGION || 'auto'
      }
    }
  },

  api: {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
    timeout: 30000
  },

  pagination: {
    defaultLimit: 20,
    maxLimit: 100
  },

  cache: {
    ttl: 300
  },

  email: {
    enabled: process.env.EMAIL_ENABLED === 'true',
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.qq.com',
      port: parseInt(process.env.SMTP_PORT) || 465,
      secure: process.env.SMTP_SECURE === 'false' ? false : true,
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASSWORD || ''
      }
    },
    from: {
      email: process.env.EMAIL_FROM || '',
      name: process.env.EMAIL_FROM_NAME || '小毛毛生活社区'
    }
  },

  // IP属地查询：GeoCN 国内精度优先，ipwho.is 作为独立备用
  ipLocation: {
    primaryApi: process.env.IP_LOCATION_PRIMARY_API || 'https://ip.netart.cn',
    backupApi: process.env.IP_LOCATION_BACKUP_API || 'https://ipwho.is',
    primaryTimeout: parseInt(process.env.IP_LOCATION_PRIMARY_TIMEOUT) || 5000,
    backupTimeout: parseInt(process.env.IP_LOCATION_BACKUP_TIMEOUT) || 5000
  }
};

const dbConfig = {
  ...config.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// 使用原始 pool 设置每条 MySQL 连接的会话时区，再暴露 Promise API 给业务层。
// 这样 TIMESTAMP 在数据库和 Node 之间始终按 UTC 传递，不受 MySQL 主机时区影响。
const rawPool = mysql.createPool(dbConfig);
rawPool.on('connection', (connection) => {
  connection.query("SET time_zone = '+00:00'", (error) => {
    if (error) {
      console.error('设置数据库会话时区失败:', error.message);
    }
  });
});

const pool = rawPool.promise();

module.exports = {
  ...config,
  pool
};
