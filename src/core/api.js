/**
 * @fileoverview 喜马拉雅 API 客户端模块
 * @description 集中封装所有喜马拉雅平台接口的调用，统一请求头、错误处理与响应校验
 * @module core/api
 *
 * @description
 * 本模块是平台接口的唯一入口，上层模块（audioParser / login / configManager）
 * 不应自行拼接 API URL。职责包括：
 * - 统一的请求头与签名生成
 * - 各端点的响应校验（ret === 200）
 * - 从用户输入（ID 或网页 URL）提取音频/专辑 ID
 * - 支持通过环境变量 XIMALAYA_API_BASE 覆盖接口地址（便于测试与代理）
 *
 * @example
 * import { getSoundPlayInfo, getAlbumTracksPage, getUserInfo } from './core/api.js';
 *
 * const playInfo = await getSoundPlayInfo('12345678', { cookie: '...', bid: '...' });
 * const userInfo = await getUserInfo({ cookie: '...', bid: '...' });
 */

import { httpRequest, createAuthHeaders } from '../utils/networkUtils.js';

/**
 * API 基础地址（可通过环境变量覆盖，便于测试与调试）
 * @type {string}
 * @private
 */
const API_BASE = process.env.XIMALAYA_API_BASE || 'https://www.ximalaya.com';

/**
 * 最近的响应错误（供上层展示更友好的错误信息）
 * @type {Object|null}
 * @private
 */
let lastApiError = null;

/**
 * 获取最近一次 API 业务错误
 * @returns {Object|null} { code, message } 或 null
 *
 * @example
 * const info = await getSoundPlayInfo('123', {});
 * if (!info) {
 *   const err = getLastApiError();
 *   console.error(err?.message);
 * }
 */
export function getLastApiError() {
  return lastApiError;
}

/**
 * 记录 API 业务错误
 * @param {number} code - 业务错误码
 * @param {string} message - 错误信息
 * @private
 */
function recordApiError(code, message) {
  lastApiError = { code, message, timestamp: Date.now() };
}

/**
 * 请求 API 端点并校验业务状态码
 * @description 内部通用方法：发起 GET 请求，校验 ret === 200 与 data 存在。
 * @param {string} path - 接口路径（含查询参数）
 * @param {Object} auth - 认证信息 { cookie, bid }
 * @param {Object} [options] - 请求选项
 * @returns {Promise<Object>} 接口返回的 data 字段
 * @throws {Error} 当业务状态码非 200 或网络失败时抛出
 * @private
 */
async function requestEndpoint(path, auth, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = createAuthHeaders(auth.cookie, auth.bid);

  const data = await httpRequest(url, {
    method: 'GET',
    headers,
    timeout: options.timeout || 10000,
    retries: options.retries ?? 2,
    retryDelay: options.retryDelay || 1000
  });

  if (!data || typeof data !== 'object') {
    recordApiError(-1, '接口响应格式错误');
    throw new Error('接口响应格式错误');
  }

  if (data.ret !== 200) {
    const message = (typeof data.msg === 'string' && data.msg) || `接口返回错误码 ${data.ret}`;
    recordApiError(data.ret, message);
    throw new Error(message);
  }

  if (!data.data) {
    recordApiError(-1, '接口未返回数据');
    throw new Error('接口未返回数据');
  }

  return data.data;
}

/**
 * 获取音频播放信息
 * @description 调用 revision/play/v1/audio 接口，返回原始音频数据（含标题、时长、
 *   免费音频的 src 或 VIP 音频的加密 epInfo）。
 * @param {string} soundId - 音频ID
 * @param {Object} auth - 认证信息 { cookie, bid }
 * @param {Object} [options] - 请求选项
 * @returns {Promise<Object>} 音频原始数据
 * @throws {Error} 请求或校验失败时抛出
 *
 * @example
 * const audioData = await getSoundPlayInfo('12345678', { cookie, bid });
 * console.log(audioData.title, audioData.isPaid);
 */
export async function getSoundPlayInfo(soundId, auth, options = {}) {
  return requestEndpoint(`/revision/play/v1/audio?id=${encodeURIComponent(soundId)}&ptype=1`, auth, options);
}

/**
 * 分页获取专辑音轨列表
 * @description 调用 revision/album/v1/getTracksList 接口。
 * @param {string} albumId - 专辑ID
 * @param {number} page - 页码（从 1 开始）
 * @param {number} pageSize - 每页数量（最大 30）
 * @param {Object} auth - 认证信息 { cookie, bid }
 * @param {Object} [options] - 请求选项
 * @returns {Promise<Object>} 音轨列表原始数据（含 totalCount 与 tracks 数组）
 * @throws {Error} 请求或校验失败时抛出
 *
 * @example
 * const page = await getAlbumTracksPage('87654321', 1, 30, { cookie, bid });
 * console.log(page.totalCount, page.tracks.length);
 */
export async function getAlbumTracksPage(albumId, page, pageSize, auth, options = {}) {
  return requestEndpoint(
    `/revision/album/v1/getTracksList?albumId=${encodeURIComponent(albumId)}&pageNum=${page}&pageSize=${pageSize}`,
    auth,
    options
  );
}

/**
 * 获取专辑简要信息
 * @description 调用 revision/album/v1/getSimple 接口，用于判断专辑付费状态。
 * @param {string} albumId - 专辑ID
 * @param {Object} auth - 认证信息 { cookie, bid }
 * @param {Object} [options] - 请求选项
 * @returns {Promise<Object>} 专辑简要信息（含 isPaid / isPurchased 等）
 * @throws {Error} 请求或校验失败时抛出
 */
export async function getAlbumSimple(albumId, auth, options = {}) {
  return requestEndpoint(`/revision/album/v1/getSimple?albumId=${encodeURIComponent(albumId)}`, auth, options);
}

/**
 * 获取当前登录用户信息
 * @description 调用 revision/user/v1/getUserInfo 接口，用于验证 Cookie 有效性。
 * @param {Object} auth - 认证信息 { cookie, bid }
 * @param {Object} [options] - 请求选项
 * @returns {Promise<Object>} 用户信息（含 nickname / mobile 等）
 * @throws {Error} 请求或校验失败时抛出（未登录时通常抛出）
 *
 * @example
 * try {
 *   const user = await getUserInfo({ cookie, bid });
 *   console.log('当前用户:', user.nickname);
 * } catch {
 *   console.log('未登录或凭证已失效');
 * }
 */
export async function getUserInfo(auth, options = {}) {
  return requestEndpoint('/revision/user/v1/getUserInfo', auth, {
    retries: 1,
    timeout: 10000,
    ...options
  });
}

/**
 * 从用户输入中提取音频或专辑 ID
 * @description 支持直接输入数字 ID，或粘贴以下形式的喜马拉雅网页链接：
 *   - https://www.ximalaya.com/sound/123456789
 *   - https://www.ximalaya.com/album/987654321
 *   - https://www.ximalaya.com/youshengshu/xxx/album/987654321
 * @param {string} input - 用户输入（ID 或 URL）
 * @returns {{ type: 'sound'|'album'|'unknown', id: string }|null} 提取结果，无法识别返回 null
 *
 * @example
 * extractIdFromInput('12345678');
 * // { type: 'sound', id: '12345678' }
 *
 * extractIdFromInput('https://www.ximalaya.com/album/987654');
 * // { type: 'album', id: '987654' }
 */
export function extractIdFromInput(input) {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // 纯数字视为音频 ID
  if (/^\d+$/.test(trimmed)) {
    return { type: 'sound', id: trimmed };
  }

  // 显式音频链接
  const soundMatch = trimmed.match(/ximalaya\.com\/sound\/(\d+)/i);
  if (soundMatch) {
    return { type: 'sound', id: soundMatch[1] };
  }

  // 专辑链接（含各类二级栏目路径）
  const albumMatch = trimmed.match(/ximalaya\.com\/(?:[^/]+\/)*album\/(\d+)/i);
  if (albumMatch) {
    return { type: 'album', id: albumMatch[1] };
  }

  return null;
}

/**
 * 验证登录凭证是否有效
 * @description 通过获取用户信息验证 Cookie 与 BID；成功时返回用户名。
 * @param {string} cookie - Cookie 字符串
 * @param {string} bid - BID 字符串
 * @param {Object} [options] - 请求选项
 * @returns {Promise<{ valid: boolean, username?: string, error?: string }>} 验证结果
 *
 * @example
 * const result = await validateCredentials(cookie, bid);
 * if (result.valid) {
 *   console.log(`欢迎, ${result.username}`);
 * }
 */
export async function validateCredentials(cookie, bid, options = {}) {
  if (!cookie || !bid) {
    return { valid: false, error: 'Cookie 或 BID 为空' };
  }

  try {
    const userInfo = await getUserInfo({ cookie, bid }, options);
    const username = userInfo.nickname || userInfo.mobile || '未知用户';
    return { valid: true, username };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}
