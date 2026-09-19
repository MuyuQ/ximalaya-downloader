/**
 * @fileoverview 音频解析模块
 * @description 负责解析喜马拉雅音频信息，包括单个音频和专辑信息的获取与解析
 * @module core/audioParser
 *
 * @description
 * 本模块在 api.js 之上提供业务语义的解析功能：
 * - 单个音频信息解析（支持免费和 VIP 音频，VIP 自动解密）
 * - 专辑信息解析（支持分页与整本获取）
 * - 专辑类型判断
 * - 音频下载链接获取
 *
 * 所有函数都支持传入 `auth`（{ cookie, bid }）复用凭证，避免批量操作
 * 时重复读取配置文件；不传时自动从配置读取。
 *
 * @example
 * import { analyzeSound, analyzeAlbum, getAllAlbumTracks } from './core/audioParser.js';
 *
 * // 解析单个音频
 * const soundInfo = await analyzeSound('12345678');
 *
 * // 获取专辑所有音轨（自动翻页）
 * const albumInfo = await getAllAlbumTracks('87654321');
 */

import { readConfig } from './configManager.js';
import { getSoundPlayInfo, getAlbumTracksPage, getAlbumSimple, extractIdFromInput as apiExtractId } from './api.js';
import { decryptUrl } from './decryptor.js';

/**
 * 音频质量枚举
 * @readonly
 * @enum {string}
 * @description 定义可用的音频质量选项
 * @property {string} AI - AI智能质量（最高质量）
 * @property {string} M4A_128 - M4A格式128kbps
 * @property {string} MP3_64 - MP3格式64kbps
 * @property {string} MP3_32 - MP3格式32kbps（最低质量）
 */
export const AudioQuality = {
  AI: 'AI',
  M4A_128: 'M4A_128',
  MP3_64: 'MP3_64',
  MP3_32: 'MP3_32'
};

/**
 * 音频类型枚举
 * @readonly
 * @enum {string}
 * @description 定义音频的付费类型
 * @property {string} FREE - 免费音频
 * @property {string} VIP - VIP音频（需要会员才能下载）
 * @property {string} PURCHASED - 已购买的音频
 */
export const AudioType = {
  FREE: 'free',
  VIP: 'vip',
  PURCHASED: 'purchased'
};

/**
 * 获取认证信息（优先使用传入值，否则读取配置）
 * @param {Object} [auth] - 认证信息 { cookie, bid }
 * @returns {Promise<Object>} 认证信息 { cookie, bid }
 * @private
 */
async function resolveAuth(auth) {
  if (auth && auth.cookie) {
    return auth;
  }
  const config = await readConfig();
  return { cookie: config.cookie, bid: config.bid };
}

/**
 * 从播放接口数据中提取各质量的下载链接
 * @description 免费音频直接使用 src；VIP 音频从 epInfo 中解密各质量链接。
 * @param {Object} audioData - 播放接口返回的音频数据
 * @returns {Object} 各质量的下载链接对象 { [quality]: url }
 * @private
 */
function extractUrls(audioData) {
  const urls = {};

  if (audioData.src) {
    urls[AudioQuality.MP3_64] = audioData.src;
    return urls;
  }

  const epInfo = audioData.epInfo;
  if (epInfo && typeof epInfo === 'object') {
    for (const quality of [AudioQuality.AI, AudioQuality.M4A_128, AudioQuality.MP3_64, AudioQuality.MP3_32]) {
      if (epInfo[quality]) {
        try {
          urls[quality] = decryptUrl(epInfo[quality]);
        } catch {
          // 单个质量解密失败不影响其他质量
        }
      }
    }
  }

  return urls;
}

/**
 * 解析单个音频信息
 * @description 获取并解析指定音频ID的详细信息，包括标题、时长、下载链接等
 * @param {string} soundId - 音频ID，可从喜马拉雅网页URL中获取
 * @param {Object} [auth] - 认证信息 { cookie, bid }，不传时从配置读取
 * @returns {Promise<Object>} 音频信息对象
 * @throws {Error} 当 ID 为空或接口请求失败时抛出
 *
 * @returns {Object} 返回对象包含以下属性：
 * @returns {string} returns.id - 音频ID
 * @returns {string} returns.title - 音频标题
 * @returns {number} returns.duration - 音频时长（秒）
 * @returns {string} returns.type - 音频类型（free/vip/purchased）
 * @returns {Object} returns.urls - 各质量的下载链接对象
 *
 * @example
 * const soundInfo = await analyzeSound('12345678');
 * if (soundInfo) {
 *   console.log('音频标题:', soundInfo.title);
 *   console.log('下载链接:', soundInfo.urls);
 * }
 */
export async function analyzeSound(soundId, auth) {
  if (!soundId || typeof soundId !== 'string') {
    throw new Error('音频ID不能为空');
  }

  const resolvedAuth = await resolveAuth(auth);
  const audioData = await getSoundPlayInfo(soundId, resolvedAuth);

  return {
    id: soundId,
    title: audioData.title || '未知标题',
    duration: audioData.duration || 0,
    type: audioData.isPaid ? AudioType.VIP : AudioType.FREE,
    urls: extractUrls(audioData)
  };
}

/**
 * 解析专辑信息（单页）
 * @description 获取并解析指定专辑ID某一页的音轨列表
 * @param {string} albumId - 专辑ID，可从喜马拉雅网页URL中获取
 * @param {number} [page=1] - 页码，默认为1
 * @param {number} [pageSize=30] - 每页数量，默认为30
 * @param {Object} [auth] - 认证信息 { cookie, bid }，不传时从配置读取
 * @returns {Promise<Object>} 专辑信息对象
 * @throws {Error} 当 ID 为空或接口请求失败时抛出
 *
 * @returns {Object} 返回对象包含以下属性：
 * @returns {string} returns.id - 专辑ID
 * @returns {string} returns.title - 专辑标题
 * @returns {number} returns.totalCount - 音频总数
 * @returns {Array<Object>} returns.tracks - 音轨列表
 *
 * @example
 * const albumInfo = await analyzeAlbum('12345678');
 * console.log('音频数量:', albumInfo.tracks.length);
 */
export async function analyzeAlbum(albumId, page = 1, pageSize = 30, auth) {
  if (!albumId || typeof albumId !== 'string') {
    throw new Error('专辑ID不能为空');
  }

  const resolvedAuth = await resolveAuth(auth);
  const albumData = await getAlbumTracksPage(albumId, page, pageSize, resolvedAuth);

  const albumInfo = {
    id: albumId,
    title: albumData.albumTitle || '未知专辑',
    description: albumData.albumIntro || '',
    coverUrl: albumData.coverUrl || '',
    totalCount: albumData.totalCount || 0,
    currentPage: page,
    pageSize,
    tracks: []
  };

  if (albumData.tracks && Array.isArray(albumData.tracks)) {
    albumInfo.tracks = albumData.tracks.map(track => ({
      id: String(track.trackId || ''),
      title: track.title || '未知标题',
      duration: track.duration || 0,
      index: track.orderNum || 0,
      isPaid: track.isPaid || false,
      playCount: track.playCount || 0,
      createTime: track.createTime || '',
      updateTime: track.updateTime || ''
    }));
  }

  return albumInfo;
}

/**
 * 获取专辑的所有音频（自动翻页）
 * @param {string} albumId - 专辑ID
 * @param {Object} [options] - 获取选项
 * @param {Function} [options.onProgress] - 进度回调 (fetchedPages, totalPages)
 * @param {number} [options.pageSize=30] - 每页数量
 * @param {Object} [options.auth] - 认证信息 { cookie, bid }
 * @returns {Promise<Object|null>} 包含所有音频的专辑信息对象，失败时返回null
 *
 * @example
 * const albumInfo = await getAllAlbumTracks('12345678', {
 *   onProgress: (done, total) => console.log(`翻页进度: ${done}/${total}`)
 * });
 */
export async function getAllAlbumTracks(albumId, { onProgress, pageSize = 30, auth } = {}) {
  if (!albumId || typeof albumId !== 'string') {
    throw new Error('专辑ID不能为空');
  }

  try {
    const firstPage = await analyzeAlbum(albumId, 1, pageSize, auth);

    if (!firstPage) {
      return null;
    }

    const totalPages = Math.max(1, Math.ceil(firstPage.totalCount / pageSize));
    const allTracks = [...firstPage.tracks];

    if (onProgress) {
      onProgress(1, totalPages);
    }

    for (let page = 2; page <= totalPages; page++) {
      const pageData = await analyzeAlbum(albumId, page, pageSize, auth);
      if (pageData && pageData.tracks) {
        allTracks.push(...pageData.tracks);
      }
      if (onProgress) {
        onProgress(page, totalPages);
      }
    }

    return { ...firstPage, tracks: allTracks };
  } catch (error) {
    console.error(`获取专辑所有音频失败: ${error.message}`);
    return null;
  }
}

/**
 * 判断专辑类型
 * @param {string} albumId - 专辑ID
 * @param {Object} [auth] - 认证信息 { cookie, bid }，不传时从配置读取
 * @returns {Promise<string|null>} 专辑类型（free/purchased/vip），判断失败时返回null
 *
 * @example
 * const albumType = await judgeAlbum('12345678');
 * if (albumType === 'vip') {
 *   console.log('该专辑为VIP专辑');
 * }
 */
export async function judgeAlbum(albumId, auth) {
  if (!albumId || typeof albumId !== 'string') {
    throw new Error('专辑ID不能为空');
  }

  const resolvedAuth = await resolveAuth(auth);
  const albumData = await getAlbumSimple(albumId, resolvedAuth);

  if (albumData.isPaid) {
    return albumData.isPurchased ? AudioType.PURCHASED : AudioType.VIP;
  }
  return AudioType.FREE;
}

/**
 * 检查音频是否可下载
 * @param {string} soundId - 音频ID
 * @param {Object} [auth] - 认证信息 { cookie, bid }
 * @returns {Promise<boolean>} 是否可下载
 */
export async function checkSoundDownloadable(soundId, auth) {
  try {
    const soundInfo = await analyzeSound(soundId, auth);
    return Boolean(soundInfo) && Object.values(soundInfo.urls).some(url => url && typeof url === 'string');
  } catch {
    return false;
  }
}

/**
 * 获取音频下载链接
 * @param {string} soundId - 音频ID
 * @param {string} [quality=AudioQuality.MP3_64] - 音频质量
 * @param {Object} [auth] - 认证信息 { cookie, bid }
 * @returns {Promise<string|null>} 下载链接，获取失败时返回null
 *
 * @example
 * const downloadUrl = await getSoundDownloadUrl('12345678', AudioQuality.M4A_128);
 */
export async function getSoundDownloadUrl(soundId, quality = AudioQuality.MP3_64, auth) {
  if (!Object.values(AudioQuality).includes(quality)) {
    throw new Error(`不支持的音频质量: ${quality}`);
  }

  const soundInfo = await analyzeSound(soundId, auth);
  return soundInfo ? (soundInfo.urls[quality] || null) : null;
}

/**
 * 检查是否需要登录
 * @description 通过尝试获取用户信息来判断当前凭证是否有效
 * @param {Object} [auth] - 认证信息 { cookie, bid }，不传时从配置读取
 * @returns {Promise<boolean>} 是否需要登录
 */
export async function isLoginRequired(auth) {
  const { validateCredentials } = await import('./api.js');
  const resolvedAuth = await resolveAuth(auth);
  const result = await validateCredentials(resolvedAuth.cookie, resolvedAuth.bid);
  return !result.valid;
}

/**
 * 从用户输入中提取音频或专辑 ID（转发至 api 模块）
 * @description 支持直接输入数字 ID 或粘贴喜马拉雅网页链接
 * @param {string} input - 用户输入（ID 或 URL）
 * @returns {{ type: 'sound'|'album'|'unknown', id: string }|null} 提取结果
 *
 * @example
 * extractIdFromInput('https://www.ximalaya.com/album/987654');
 * // { type: 'album', id: '987654' }
 */
export function extractIdFromInput(input) {
  return apiExtractId(input);
}

/**
 * 批量解析音轨的下载链接
 * @description 为专辑音轨列表解析每个音轨最高可用质量的下载链接，
 *   使用固定并发池避免对接口造成压力。
 * @param {Array<Object>} tracks - 音轨列表 [{ id, title }]
 * @param {Object} [options] - 解析选项
 * @param {number} [options.concurrency=3] - 并发数
 * @param {Function} [options.onProgress] - 进度回调 (resolved, total)
 * @param {Object} [options.auth] - 认证信息 { cookie, bid }
 * @returns {Promise<Array<Object>>} 带下载链接的音轨列表 [{ id, title, url }]（解析失败的音轨被跳过）
 *
 * @example
 * const withUrls = await resolveTrackUrls(albumInfo.tracks, {
 *   onProgress: (done, total) => console.log(`${done}/${total}`)
 * });
 */
export async function resolveTrackUrls(tracks, { concurrency = 3, onProgress, auth } = {}) {
  const resolved = [];
  let completed = 0;
  let nextIndex = 0;

  const resolvedAuth = await resolveAuth(auth);

  async function worker() {
    while (nextIndex < tracks.length) {
      const index = nextIndex++;
      const track = tracks[index];
      try {
        const soundInfo = await analyzeSound(String(track.id), resolvedAuth);
        const qualities = Object.keys(soundInfo.urls);
        if (qualities.length > 0) {
          resolved.push({
            id: track.id,
            title: soundInfo.title || track.title,
            url: soundInfo.urls[qualities[0]]
          });
        }
      } catch {
        // 单个音轨解析失败不影响整体
      }
      completed++;
      if (onProgress) {
        onProgress(completed, tracks.length);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, tracks.length)) }, worker)
  );

  return resolved;
}
