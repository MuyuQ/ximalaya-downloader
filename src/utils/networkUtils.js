/**
 * @fileoverview 网络请求工具模块
 * @description 提供HTTP请求的通用方法，包括指数退避重试、错误处理和流式文件下载
 * @module utils/networkUtils
 *
 * @description
 * 本模块基于 Node.js 原生 https/http 模块实现，零第三方依赖，主要功能：
 * - HTTP/HTTPS 请求发送（自动解析 JSON）
 * - 指数退避 + 抖动的重试机制（网络错误与 5xx/429 才重试）
 * - 认证请求头生成（xm-sign 签名，使用加密安全随机数）
 * - 流式文件下载（失败时清理残留文件）
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
 * // 发送 GET 请求（响应为 JSON 时自动解析）
 * const data = await httpRequest('https://api.example.com/data');
 *
 * // 创建认证请求头
 * const headers = createAuthHeaders('cookie_value', 'bid_value');
 *
 * // 下载文件（支持进度回调）
 * await downloadFile('https://example.com/file.mp3', './downloads/file.mp3', {
 *   onProgress: (pct, downloaded, total) => console.log(`${pct}%`)
 * });
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import { randomBytes } from 'crypto';
import { createWriteStream, unlink } from 'fs';

/**
 * 默认请求头
 * @type {Object}
 * @private
 */
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': '*/*'
};

/**
 * 默认请求配置
 * @type {Object}
 * @private
 */
const DEFAULT_REQUEST_CONFIG = {
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
  backoffFactor: 2,
  maxRetryDelay: 10000
};

/**
 * 延迟函数
 * @param {number} ms - 毫秒
 * @returns {Promise<void>}
 * @private
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 计算指数退避延迟（带随机抖动，避免高并发下的重试风暴）
 * @param {number} baseDelay - 基础延迟（毫秒）
 * @param {number} attempt - 当前尝试次数（从 1 开始）
 * @param {number} backoffFactor - 退避倍数
 * @param {number} maxDelay - 最大延迟（毫秒）
 * @returns {number} 实际延迟时间（毫秒）
 * @private
 */
function computeBackoffDelay(baseDelay, attempt, backoffFactor, maxDelay) {
  const exponential = Math.min(baseDelay * Math.pow(backoffFactor, attempt - 1), maxDelay);
  // 添加 ±20% 的抖动
  const jitter = exponential * 0.2 * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(exponential + jitter));
}

/**
 * 判断错误是否值得重试
 * @param {Object} error - 错误对象（含可选的 statusCode）
 * @returns {boolean} 是否重试
 * @private
 */
function isRetryable(error) {
  if (error.statusCode) {
    // 服务器错误与限流可重试；其他 4xx 属于请求问题，重试无意义
    return error.statusCode >= 500 || error.statusCode === 429;
  }
  // 网络层错误（超时、连接失败等）默认可重试
  return true;
}

/**
 * 发送 HTTP 请求（Node.js 原生实现）
 * @description 发送请求并返回响应体；Content-Type 为 JSON 时自动解析为对象。
 *   网络错误与 5xx/429 响应会按指数退避重试；其余 4xx 直接返回响应体（由调用方判断业务错误码）。
 * @param {string} url - 请求URL
 * @param {Object} [options] - 请求选项
 * @param {string} [options.method='GET'] - HTTP 方法
 * @param {Object} [options.headers={}] - 请求头
 * @param {number} [options.timeout=30000] - 请求超时时间（毫秒）
 * @param {number} [options.retries=3] - 失败重试次数（总尝试次数）
 * @param {number} [options.retryDelay=1000] - 首次重试延迟（毫秒）
 * @param {number} [options.backoffFactor=2] - 指数退避倍数
 * @param {number} [options.maxRetryDelay=10000] - 最大重试延迟（毫秒）
 * @returns {Promise<Object|string>} 解析后的 JSON 对象或原始文本
 * @throws {Error} 重试次数用尽后抛出最后一次错误
 *
 * @example
 * const data = await httpRequest('https://api.example.com/data', { retries: 3 });
 */
export async function httpRequest(url, options = {}) {
  const config = { ...DEFAULT_REQUEST_CONFIG, ...options };
  const { method = 'GET', headers = {}, timeout, retries, retryDelay, backoffFactor, maxRetryDelay } = config;

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
          headers: { ...DEFAULT_HEADERS, ...headers },
          timeout
        };

        const req = client.request(requestOptions, (res) => {
          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            const contentType = res.headers['content-type'] || '';

            let parsed = body;
            if (contentType.includes('json')) {
              try {
                parsed = JSON.parse(body);
              } catch {
                // JSON 解析失败时返回原始文本
              }
            }

            if (res.statusCode >= 400) {
              const error = new Error(`HTTP ${res.statusCode}`);
              error.statusCode = res.statusCode;
              error.body = parsed;
              reject(error);
              return;
            }

            resolve(parsed);
          });
        });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy(new Error('请求超时'));
        });

        req.end();
      });

      return result;
    } catch (error) {
      lastError = error;
      if (attempt < retries && isRetryable(error)) {
        const wait = computeBackoffDelay(retryDelay, attempt, backoffFactor, maxRetryDelay);
        console.warn(`请求失败，${wait}ms 后重试 (${attempt}/${retries}): ${error.message}`);
        await delay(wait);
      } else if (attempt < retries) {
        // 不可重试的错误（如 404），立即抛出
        throw error;
      }
    }
  }

  const finalError = lastError instanceof Error ? lastError : new Error(String(lastError));
  throw new Error(`请求失败，已重试 ${retries} 次: ${finalError.message}`);
}

/**
 * 创建带有认证信息的请求头
 * @param {string} cookie - 认证cookie（为空时不添加 Cookie 头）
 * @param {string} bid - BID（为空时不添加 xm-sign 头）
 * @returns {Object} 包含认证信息的请求头
 *
 * @example
 * const headers = createAuthHeaders('1&_token=xxx', 'bid_value');
 * // { 'User-Agent': '...', 'Cookie': '...', 'xm-sign': '...' }
 */
export function createAuthHeaders(cookie, bid) {
  const headers = { ...DEFAULT_HEADERS };

  if (cookie) {
    headers['Cookie'] = cookie;
  }
  if (bid) {
    headers['xm-sign'] = generateXmSign(bid);
  }

  return headers;
}

/**
 * 生成 xm-sign 签名
 * @description 格式为 `${bid}:${timestamp}:${nonce}`，nonce 使用加密安全的
 *   crypto.randomBytes 生成（修复了旧版使用 Math.random 的问题）。
 * @param {string} bid - bid 部分
 * @returns {string} 完整的 xm-sign 签名
 *
 * @example
 * const sign = generateXmSign('abc123');
 * // 'abc123:1700000000000:8f3a2b1c'
 */
export function generateXmSign(bid = '') {
  const nonce = randomBytes(4).toString('hex');
  const ts = Date.now().toString();
  return `${bid}:${ts}:${nonce}`;
}

/**
 * 检查网络连接状态
 * @returns {Promise<boolean>} 是否有网络连接
 *
 * @example
 * if (!(await checkNetworkStatus())) {
 *   console.error('网络不可用');
 * }
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
 * 下载文件到本地（流式写入）
 * @description 使用流式写入避免大文件占用内存；失败时自动清理未完成的残留文件。
 * @param {string} url - 文件URL
 * @param {string} filePath - 保存路径
 * @param {Object} [options] - 下载选项
 * @param {Function} [options.onProgress] - 进度回调 (percentage, downloaded, totalSize)
 * @param {number} [options.timeout=30000] - 超时时间（毫秒）
 * @param {number} [options.retries=3] - 重试次数（总尝试次数）
 * @param {number} [options.retryDelay=1000] - 首次重试延迟（毫秒）
 * @param {Object} [options.headers={}] - 额外请求头
 * @returns {Promise<Object>} 下载结果 { success, filePath, fileSize } 或 { success: false, error }
 *
 * @example
 * const result = await downloadFile('https://cdn.example.com/a.mp3', './a.mp3');
 * if (result.success) {
 *   console.log(`已下载 ${result.fileSize} 字节`);
 * }
 */
export async function downloadFile(url, filePath, options = {}) {
  const {
    onProgress,
    timeout = 30000,
    retries = 3,
    retryDelay = 1000,
    headers = {}
  } = options;

  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const fileSize = await new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const client = urlObj.protocol === 'https:' ? https : http;

        const requestOptions = {
          hostname: urlObj.hostname,
          port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: 'GET',
          headers: { ...DEFAULT_HEADERS, ...headers },
          timeout
        };

        const req = client.request(requestOptions, (res) => {
          if (res.statusCode !== 200) {
            res.resume();
            const error = new Error(`HTTP ${res.statusCode}`);
            error.statusCode = res.statusCode;
            reject(error);
            return;
          }

          const totalSize = parseInt(res.headers['content-length'], 10) || 0;
          let downloaded = 0;
          let lastReported = 0;

          // 使用流式写入，避免内存问题
          const writeStream = createWriteStream(filePath);

          res.on('data', (chunk) => {
            downloaded += chunk.length;
            if (onProgress && totalSize > 0) {
              // 进度节流：至少变化 1% 才触发回调，避免高频刷新
              const progress = Math.floor((downloaded / totalSize) * 100);
              if (progress > lastReported) {
                lastReported = progress;
                onProgress(progress, downloaded, totalSize);
              }
            }
          });

          res.pipe(writeStream);

          writeStream.on('finish', () => resolve(downloaded));
          writeStream.on('error', reject);
        });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy(new Error('下载超时'));
        });

        req.end();
      });

      return { success: true, filePath, fileSize };
    } catch (error) {
      lastError = error;

      // 清理未完成的残留文件，避免下次误判为已下载
      await cleanupFile(filePath);

      if (attempt < retries && isRetryable(error)) {
        const wait = computeBackoffDelay(retryDelay, attempt, 2, 10000);
        console.warn(`下载失败，${wait}ms 后重试 (${attempt}/${retries}): ${error.message}`);
        await delay(wait);
      } else if (attempt < retries) {
        return { success: false, error: error.message };
      }
    }
  }

  return { success: false, error: lastError ? lastError.message : '下载失败，重试次数已用完' };
}

/**
 * 清理文件（忽略所有错误）
 * @param {string} filePath - 文件路径
 * @returns {Promise<void>}
 * @private
 */
async function cleanupFile(filePath) {
  try {
    await new Promise((resolve, reject) => unlink(filePath, err => (err ? reject(err) : resolve())));
  } catch {
    // 文件不存在或无法删除时忽略
  }
}
