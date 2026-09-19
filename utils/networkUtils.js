/**
 * @fileoverview 网络请求工具模块
 * @description 提供HTTP请求的通用方法，包括请求重试机制、错误处理和文件下载
 * @module utils/networkUtils
 *
 * @description
 * 本模块基于Node.js原生https/http模块实现，不依赖第三方库，主要功能：
 * - HTTP/HTTPS请求发送
 * - 自动重试机制
 * - 认证请求头生成（xm-sign签名）
 * - 流式文件下载
 * - 网络状态检查
 *
 * @example
 * import {
 *   httpRequest,
 *   createAuthHeaders,
 *   downloadFile,
 *   checkNetworkStatus
 * } from './utils/networkUtils.js';
 *
 * // 发送GET请求
 * const data = await httpRequest('https://api.example.com/data');
 *
 * // 创建认证请求头
 * const headers = createAuthHeaders('cookie_value', 'bid_value');
 *
 * // 下载文件
 * await downloadFile('https://example.com/file.mp3', './downloads/file.mp3');
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import { createWriteStream } from 'fs';

/**
 * 默认请求配置
 * @type {Object}
 * @constant
 * @description 定义HTTP请求的默认参数
 * @property {number} timeout - 请求超时时间（毫秒）
 * @property {number} retries - 失败重试次数
 * @property {number} retryDelay - 重试间隔（毫秒）
 * @property {Object} headers - 默认请求头
 */
const DEFAULT_CONFIG = {
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  }
};

/**
 * 发送HTTP请求 (Node.js 原生实现)
 * @param {string} url - 请求URL
 * @param {Object} options - 请求选项
 * @returns {Promise<Object>} 请求响应
 */
export async function httpRequest(url, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  const { method = 'GET', headers = {}, timeout, retries, retryDelay } = config;

  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const client = urlObj.protocol === 'https:' ? https : http;

        const requestOptions = {
          hostname: urlObj.hostname,
          port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method,
          headers: { ...DEFAULT_CONFIG.headers, ...headers },
          timeout
        };

        const req = client.request(requestOptions, (res) => {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            try {
              const contentType = res.headers['content-type'] || '';
              if (contentType.includes('application/json')) {
                resolve(JSON.parse(data));
              } else {
                resolve(data);
              }
            } catch {
              resolve(data);
            }
          });
        });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('请求超时'));
        });

        req.end();
      });

      return result;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        console.warn(`请求失败，${retryDelay}ms后重试 (${attempt}/${retries}): ${error.message}`);
        await delay(retryDelay);
      }
    }
  }

  throw new Error(`请求失败，已重试${retries}次: ${lastError.message}`);
}

/**
 * 创建带有认证信息的请求头
 * @param {string} cookie - 认证cookie
 * @param {string} bid - BID
 * @returns {Object} 包含认证信息的请求头
 */
export function createAuthHeaders(cookie, bid) {
  const headers = { ...DEFAULT_CONFIG.headers };

  if (cookie) {
    headers['Cookie'] = cookie;
  }
  if (bid) {
    headers['xm-sign'] = generateXmSign(bid);
  }

  return headers;
}

/**
 * 生成xm-sign签名
 * @param {string} bid - bid部分
 * @returns {string} 完整的xm-sign签名
 */
export function generateXmSign(bid = '') {
  const nonce = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString();
  return `${bid}:${ts}:${nonce}`;
}

/**
 * 延迟函数
 * @param {number} ms - 毫秒
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 检查网络连接状态
 * @returns {Promise<boolean>} 是否有网络连接
 */
export async function checkNetworkStatus() {
  try {
    await httpRequest('https://www.baidu.com', { retries: 1, timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * 下载文件
 * @param {string} url - 文件URL
 * @param {string} filePath - 保存路径
 * @param {Object} options - 下载选项
 * @returns {Promise<Object>} 下载结果
 */
export async function downloadFile(url, filePath, options = {}) {
  const { onProgress, timeout = 30000, retries = 3 } = options;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const client = urlObj.protocol === 'https:' ? https : http;

        const requestOptions = {
          hostname: urlObj.hostname,
          port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: 'GET',
          headers: DEFAULT_CONFIG.headers,
          timeout
        };

        const req = client.request(requestOptions, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }

          const totalSize = parseInt(res.headers['content-length'], 10) || 0;
          let downloaded = 0;

          // 使用流式写入，避免内存问题
          const writeStream = createWriteStream(filePath);

          res.on('data', (chunk) => {
            downloaded += chunk.length;
            if (onProgress && totalSize > 0) {
              const progress = Math.round((downloaded / totalSize) * 100);
              onProgress(progress, downloaded, totalSize);
            }
          });

          res.pipe(writeStream);

          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('下载超时'));
        });

        req.end();
      });

      return { success: true, filePath };
    } catch (error) {
      if (attempt < retries) {
        console.warn(`下载失败，${attempt}/${retries} 次重试: ${error.message}`);
        await delay(1000 * attempt);
      } else {
        return { success: false, error: error.message };
      }
    }
  }

  return { success: false, error: '下载失败，重试次数已用完' };
}
