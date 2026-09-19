/**
 * @fileoverview 音频解析模块
 * @description 负责解析喜马拉雅音频信息，包括单个音频和专辑信息的获取与解析
 * @module core/audioParser
 *
 * @description
 * 本模块提供完整的音频信息解析功能，包括：
 * - 单个音频信息解析（支持免费和VIP音频）
 * - 专辑信息解析
 * - 专辑所有音轨获取
 * - 音频下载链接获取
 * - 专辑类型判断
 *
 * VIP音频URL解密：
 * 本模块自动调用 decryptor.js 中的解密函数对VIP音频的加密URL进行解密
 *
 * @example
 * import {
 *   analyzeSound,
 *   analyzeAlbum,
 *   getAllAlbumTracks,
 *   AudioQuality
 * } from './core/audioParser.js';
 *
 * // 解析单个音频
 * const soundInfo = await analyzeSound('12345678');
 *
 * // 解析专辑
 * const albumInfo = await analyzeAlbum('87654321');
 *
 * // 获取专辑所有音轨
 * const allTracks = await getAllAlbumTracks('87654321');
 */

import { httpRequest, createAuthHeaders } from '../utils/networkUtils.js';
import { decryptUrl } from './decryptor.js';
import { readConfig } from './configManager.js';

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
 */
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
 * 解析单个音频信息
 * @description 获取并解析指定音频ID的详细信息，包括标题、时长、下载链接等
 * @param {string} soundId - 音频ID，可从喜马拉雅网页URL中获取
 * @returns {Promise<Object|null>} 音频信息对象，解析失败时返回null
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
 *
 * if (soundInfo) {
 *   console.log('音频标题:', soundInfo.title);
 *   console.log('音频时长:', soundInfo.duration);
 *   console.log('音频类型:', soundInfo.type);
 *   console.log('下载链接:', soundInfo.urls);
 * } else {
 *   console.log('解析音频信息失败');
 * }
 */
export async function analyzeSound(soundId) {
  if (!soundId || typeof soundId !== 'string') {
    console.error('音频ID不能为空');
    return null;
  }

  try {
    const url = `https://www.ximalaya.com/revision/play/v1/audio?id=${soundId}&ptype=1`;
    const config = await readConfig();
    const headers = createAuthHeaders(config.cookie, config.bid);
    const data = await httpRequest(url, { method: 'GET', headers, timeout: 10000, retries: 3 });

    if (!data || data.ret !== 200 || !data.data) {
      console.error('音频信息响应格式错误');
      return null;
    }

    const audioData = data.data;

    // 提取音频基本信息
    const soundInfo = {
      id: soundId,
      title: audioData.title || '未知标题',
      duration: audioData.duration || 0,
      type: audioData.isPaid ? AudioType.VIP : AudioType.FREE,
      urls: {}
    };

    // 解析不同质量的音频URL
    if (audioData.src) {
      // 免费音频直接使用src
      soundInfo.urls[AudioQuality.MP3_64] = audioData.src;
    } else if (audioData.epInfo) {
      // VIP音频需要解密
      const epInfo = audioData.epInfo;

      if (epInfo.AI) {
        soundInfo.urls[AudioQuality.AI] = decryptUrl(epInfo.AI);
      }

      if (epInfo.M4A_128) {
        soundInfo.urls[AudioQuality.M4A_128] = decryptUrl(epInfo.M4A_128);
      }

      if (epInfo.MP3_64) {
        soundInfo.urls[AudioQuality.MP3_64] = decryptUrl(epInfo.MP3_64);
      }

      if (epInfo.MP3_32) {
        soundInfo.urls[AudioQuality.MP3_32] = decryptUrl(epInfo.MP3_32);
      }
    }

    return soundInfo;
  } catch (error) {
    console.error(`解析音频信息失败: ${error.message}`);
    return null;
  }
}

/**
 * 解析专辑信息
 * @description 获取并解析指定专辑ID的详细信息，包括标题、描述、音轨列表等
 * @param {string} albumId - 专辑ID，可从喜马拉雅网页URL中获取
 * @param {number} [page=1] - 页码，默认为1
 * @param {number} [pageSize=30] - 每页数量，默认为30
 * @returns {Promise<Object|null>} 专辑信息对象，解析失败时返回null
 *
 * @returns {Object} 返回对象包含以下属性：
 * @returns {string} returns.id - 专辑ID
 * @returns {string} returns.title - 专辑标题
 * @returns {string} returns.description - 专辑描述
 * @returns {string} returns.coverUrl - 专辑封面URL
 * @returns {number} returns.totalCount - 音频总数
 * @returns {number} returns.currentPage - 当前页码
 * @returns {number} returns.pageSize - 每页数量
 * @returns {Array<Object>} returns.tracks - 音轨列表
 *
 * @example
 * const albumInfo = await analyzeAlbum('12345678');
 *
 * if (albumInfo) {
 *   console.log('专辑标题:', albumInfo.title);
 *   console.log('音频数量:', albumInfo.tracks.length);
 *   console.log('音频列表:', albumInfo.tracks);
 * } else {
 *   console.log('解析专辑信息失败');
 * }
 */
export async function analyzeAlbum(albumId, page = 1, pageSize = 30) {
  if (!albumId || typeof albumId !== 'string') {
    console.error('专辑ID不能为空');
    return null;
  }

  if (typeof page !== 'number' || page < 1) {
    page = 1;
  }

  if (typeof pageSize !== 'number' || pageSize < 1) {
    pageSize = 30;
  }

  try {
    const url = `https://www.ximalaya.com/revision/album/v1/getTracksList?albumId=${albumId}&pageNum=${page}&pageSize=${pageSize}`;
    const config = await readConfig();
    const headers = createAuthHeaders(config.cookie, config.bid);
    const data = await httpRequest(url, { method: 'GET', headers, timeout: 10000, retries: 3 });

    if (!data || data.ret !== 200 || !data.data) {
      console.error('专辑信息响应格式错误');
      return null;
    }

    const albumData = data.data;

    // 提取专辑基本信息
    const albumInfo = {
      id: albumId,
      title: albumData.albumTitle || '未知专辑',
      description: albumData.albumIntro || '',
      coverUrl: albumData.coverUrl || '',
      totalCount: albumData.totalCount || 0,
      currentPage: page,
      pageSize: pageSize,
      tracks: []
    };

    // 解析音频列表
    if (albumData.tracks && Array.isArray(albumData.tracks)) {
      albumInfo.tracks = albumData.tracks.map(track => ({
        id: track.trackId || '',
        title: track.title || '未知标题',
        duration: track.duration || 0,
        index: track.orderNum || 0,
        isPaid: track.isPaid || false,
        playCount: track.playCount || 0,
        favoriteCount: track.favoriteCount || 0,
        commentCount: track.commentCount || 0,
        createTime: track.createTime || '',
        updateTime: track.updateTime || ''
      }));
    }

    return albumInfo;
  } catch (error) {
    console.error(`解析专辑信息失败: ${error.message}`);
    return null;
  }
}

/**
 * 获取专辑的所有音频
 * @param {string} albumId - 专辑ID
 * @param {Object} headers - 请求头
 * @param {Function} [onProgress] - 进度回调函数
 * @returns {Promise<Object|null>} 包含所有音频的专辑信息对象，解析失败时返回null
 *
 * @example
 * const albumInfo = await getAllAlbumTracks('12345678', {
 *   'Cookie': 'your_cookie',
 *   'User-Agent': 'your_user_agent'
 * }, (progress) => console.log(`获取进度: ${progress}%`));
 *
 * if (albumInfo) {
 *   console.log('专辑标题:', albumInfo.title);
 *   console.log('音频数量:', albumInfo.tracks.length);
 *   console.log('音频列表:', albumInfo.tracks);
 * } else {
 *   console.log('获取专辑所有音频失败');
 * }
 */
export async function getAllAlbumTracks(albumId, onProgress) {
  if (!albumId || typeof albumId !== 'string') {
    console.error('专辑ID不能为空');
    return null;
  }

  try {
    // 首先获取第一页，确定总页数
    const firstPage = await analyzeAlbum(albumId, 1, 30);

    if (!firstPage) {
      return null;
    }

    const totalPages = Math.ceil(firstPage.totalCount / firstPage.pageSize);
    const allTracks = [...firstPage.tracks];

    // 如果只有一页，直接返回
    if (totalPages <= 1) {
      return {
        ...firstPage,
        tracks: allTracks
      };
    }

    // 获取剩余页面的音频
    for (let page = 2; page <= totalPages; page++) {
      const pageData = await analyzeAlbum(albumId, page, 30);

      if (pageData && pageData.tracks) {
        allTracks.push(...pageData.tracks);
      }

      // 更新进度
      if (onProgress) {
        const progress = Math.round((page / totalPages) * 100);
        onProgress(progress);
      }
    }

    return {
      ...firstPage,
      tracks: allTracks
    };
  } catch (error) {
    console.error(`获取专辑所有音频失败: ${error.message}`);
    return null;
  }
}

/**
 * 判断专辑类型
 * @param {string} albumId - 专辑ID
 * @param {Object} headers - 请求头
 * @returns {Promise<string|null>} 专辑类型（free/purchased/vip），判断失败时返回null
 *
 * @example
 * const albumType = await judgeAlbum('12345678', {
 *   'Cookie': 'your_cookie',
 *   'User-Agent': 'your_user_agent'
 * });
 *
 * if (albumType) {
 *   console.log('专辑类型:', albumType);
 * } else {
 *   console.log('判断专辑类型失败');
 * }
 */
export async function judgeAlbum(albumId) {
  if (!albumId || typeof albumId !== 'string') {
    console.error('专辑ID不能为空');
    return null;
  }

  try {
    const url = `https://www.ximalaya.com/revision/album/v1/getSimple?albumId=${albumId}`;
    const config = await readConfig();
    const headers = createAuthHeaders(config.cookie, config.bid);
    const data = await httpRequest(url, { method: 'GET', headers, timeout: 10000, retries: 3 });

    if (!data || data.ret !== 200 || !data.data) {
      console.error('专辑信息响应格式错误');
      return null;
    }

    const albumData = data.data;

    // 判断专辑类型
    if (albumData.isPaid) {
      if (albumData.isPurchased) {
        return AudioType.PURCHASED;
      } else {
        return AudioType.VIP;
      }
    } else {
      return AudioType.FREE;
    }
  } catch (error) {
    console.error(`判断专辑类型失败: ${error.message}`);
    return null;
  }
}

/**
 * 检查音频是否可下载
 * @param {string} soundId - 音频ID
 * @param {Object} headers - 请求头
 * @returns {Promise<boolean>} 是否可下载
 *
 * @example
 * const canDownload = await checkSoundDownloadable('12345678', {
 *   'Cookie': 'your_cookie',
 *   'User-Agent': 'your_user_agent'
 * });
 *
 * if (canDownload) {
 *   console.log('音频可下载');
 * } else {
 *   console.log('音频不可下载');
 * }
 */
export async function checkSoundDownloadable(soundId) {
  if (!soundId || typeof soundId !== 'string') {
    console.error('音频ID不能为空');
    return false;
  }

  try {
    const soundInfo = await analyzeSound(soundId);

    if (!soundInfo) {
      return false;
    }

    // 检查是否有可用的下载链接
    const hasValidUrl = Object.values(soundInfo.urls).some(url => url && typeof url === 'string');

    return hasValidUrl;
  } catch (error) {
    console.error(`检查音频是否可下载失败: ${error.message}`);
    return false;
  }
}

/**
 * 获取音频下载链接
 * @param {string} soundId - 音频ID
 * @param {Object} headers - 请求头
 * @param {string} [quality=AudioQuality.MP3_64] - 音频质量
 * @returns {Promise<string|null>} 下载链接，获取失败时返回null
 *
 * @example
 * const downloadUrl = await getSoundDownloadUrl('12345678', {
 *   'Cookie': 'your_cookie',
 *   'User-Agent': 'your_user_agent'
 * }, AudioQuality.M4A_128);
 *
 * if (downloadUrl) {
 *   console.log('下载链接:', downloadUrl);
 * } else {
 *   console.log('获取下载链接失败');
 * }
 */
export async function getSoundDownloadUrl(soundId, quality = AudioQuality.MP3_64) {
  if (!soundId || typeof soundId !== 'string') {
    console.error('音频ID不能为空');
    return null;
  }

  if (!Object.values(AudioQuality).includes(quality)) {
    console.error(`不支持的音频质量: ${quality}`);
    return null;
  }

  try {
    const soundInfo = await analyzeSound(soundId);

    if (!soundInfo) {
      return null;
    }

    // 返回指定质量的下载链接
    return soundInfo.urls[quality] || null;
  } catch (error) {
    console.error(`获取音频下载链接失败: ${error.message}`);
    return null;
  }
}

/**
 * 检查是否达到每日下载限制
 * @description 通过尝试获取音频信息来判断是否达到每日下载限制
 * @returns {Promise<boolean>} 是否达到每日下载限制
 *
 * @description
 * 此函数通过调用音频信息接口来判断下载限制状态：
 * - 如果接口返回错误消息包含"每日下载"字样，说明已达限制
 * - 否则说明未达限制
 *
 * @example
 * const isLimitReached = await isDailyLimitReached();
 *
 * if (isLimitReached) {
 *   console.log('已达到每日下载限制');
 * } else {
 *   console.log('未达到每日下载限制');
 * }
 */
export async function isDailyLimitReached() {
  try {
    // 读取配置获取认证信息
    const config = await readConfig();
    const headers = createAuthHeaders(config.cookie, config.bid);

    // 尝试获取一个测试音频的信息
    const data = await httpRequest(
      'https://www.ximalaya.com/revision/play/v1/audio?id=12345678&ptype=1',
      {
        method: 'GET',
        headers,
        retries: 1
      }
    );

    if (!data || data.ret !== 200) {
      const msg = (data && data.msg) || '';
      return typeof msg === 'string' && msg.includes('每日下载');
    }

    return false;
  } catch (error) {
    console.error(`检查每日下载限制失败: ${error.message}`);
    return false;
  }
}

/**
 * 检查是否需要登录
 * @description 通过尝试获取用户信息来判断当前是否需要登录
 * @returns {Promise<boolean>} 是否需要登录
 *
 * @description
 * 此函数通过调用用户信息接口来判断登录状态：
 * - 如果接口返回有效的用户信息，说明已登录
 * - 如果接口返回错误或无效数据，说明需要登录
 *
 * @example
 * const needLogin = await isLoginRequired();
 *
 * if (needLogin) {
 *   console.log('需要登录');
 * } else {
 *   console.log('不需要登录');
 * }
 */
export async function isLoginRequired() {
  try {
    // 读取配置获取认证信息
    const config = await readConfig();
    const headers = createAuthHeaders(config.cookie, config.bid);

    // 尝试获取用户信息
    const response = await httpRequest(
      'https://www.ximalaya.com/revision/user/v1/getUserInfo',
      {
        method: 'GET',
        headers,
        timeout: 10000,
        retries: 1
      }
    );

    // 检查响应数据
    if (!response || response.ret !== 200 || !response.data) {
      return true;
    }

    // 检查用户信息
    const userInfo = response.data;
    if (!userInfo || !userInfo.nickname) {
      return true;
    }

    return false;
  } catch (error) {
    console.error(`检查是否需要登录失败: ${error.message}`);
    return true;
  }
}
