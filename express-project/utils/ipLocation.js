const axios = require('axios');
const config = require('../config/config');

function normalizeLocation(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  return value
    .replace('维吾尔自治区', '')
    .replace('壮族自治区', '')
    .replace('回族自治区', '')
    .replace('特别行政区', '')
    .replace('自治区', '')
    .replace('省', '')
    .replace('市', '')
    .trim();
}

function isPrivateIP(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1') {
    return true;
  }

  if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('169.254.')) {
    return true;
  }

  if (ip.startsWith('172.')) {
    const secondOctet = Number(ip.split('.')[1]);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  const lower = ip.toLowerCase();
  return lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:');
}

function specialRegionName(countryCode) {
  const names = {
    HK: '香港',
    MO: '澳门',
    TW: '台湾'
  };
  return names[countryCode] || null;
}

async function queryPrimary(ip) {
  const response = await axios.get(config.ipLocation.primaryApi, {
    params: { ip },
    timeout: config.ipLocation.primaryTimeout
  });

  const data = response.data;
  if (!data || data.error) {
    return null;
  }

  const countryCode = data.country && data.country.code;
  const specialRegion = specialRegionName(countryCode);
  if (specialRegion) {
    return specialRegion;
  }

  const country = data.country && data.country.name;

  // 国内 IP 属地保持省级显示；GeoCN 的 city/area 仅作为省份缺失时的兜底。
  if (countryCode === 'CN') {
    return normalizeLocation(data.subdivision || data.city || data.area || country);
  }

  return normalizeLocation(country || data.subdivision || data.city || data.area);
}

async function queryBackup(ip) {
  const baseUrl = config.ipLocation.backupApi.replace(/\/+$/, '');
  const response = await axios.get(`${baseUrl}/${encodeURIComponent(ip)}`, {
    params: {
      lang: 'zh-CN',
      fields: 'success,country,country_code,region,city,message'
    },
    timeout: config.ipLocation.backupTimeout
  });

  const data = response.data;
  if (!data || data.success !== true) {
    return null;
  }

  const specialRegion = specialRegionName(data.country_code);
  if (specialRegion) {
    return specialRegion;
  }

  if (data.country_code === 'CN') {
    return normalizeLocation(data.region || data.city || data.country);
  }

  return normalizeLocation(data.country || data.region || data.city);
}

/**
 * 获取IP属地信息
 * @param {string} ip - IP地址
 * @returns {Promise<string>} 返回属地信息
 */
async function getIPLocation(ip) {
  if (isPrivateIP(ip)) {
    return '本地';
  }

  try {
    const primaryLocation = await queryPrimary(ip);
    if (primaryLocation) {
      return primaryLocation;
    }
    console.warn('主IP属地接口 ip.netart.cn 未返回有效属地');
  } catch (error) {
    const status = error.response && error.response.status;
    console.warn(`主IP属地接口 ip.netart.cn 调用失败${status ? ` (HTTP ${status})` : ''}:`, error.message);
  }

  try {
    const backupLocation = await queryBackup(ip);
    if (backupLocation) {
      return backupLocation;
    }
    console.warn('备用IP属地接口 ipwho.is 未返回有效属地');
  } catch (error) {
    const status = error.response && error.response.status;
    console.warn(`备用IP属地接口 ipwho.is 调用失败${status ? ` (HTTP ${status})` : ''}:`, error.message);
  }

  console.error('IP属地查询失败: 主备接口均未返回有效结果');
  return '未知';
}

/**
 * 从请求中获取真实IP地址
 * @param {Object} req - Express请求对象
 * @returns {string} IP地址
 */
function getRealIP(req) {
  let ip = req.headers['x-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
    req.ip;

  if (Array.isArray(ip)) {
    ip = ip[0];
  }

  if (ip && typeof ip === 'string' && ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }

  if (ip && typeof ip === 'string' && ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  return typeof ip === 'string' ? ip.trim() : ip;
}

module.exports = {
  getIPLocation,
  getRealIP
};
