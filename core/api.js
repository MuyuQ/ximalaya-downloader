/**
 * API请求模块
 * 处理与喜马拉雅API的所有交互，包括获取音频信息和专辑信息
 */

import { httpRequest, createAuthHeaders } from '../utils/networkUtils.js';

/**
 * 喜马拉雅API基础URL
 * @type {string}
 */
const API_BASE_URL = 'https://www.ximalaya.com';

/**
 * API端点
 * @type {Object}
 */
const API_ENDPOINTS = {
  soundInfo: '/revision/play/v1/audio',
  albumInfo: '/revision/album/v1/getTracksList',
  userInfo: '/revision/user/v1/getUserInfo'
};

/**
 * 获取音频基本信息
 * @param {string} soundId - 音频ID
 * @param {Object} headers - 请求头
 * @param {string} bid - xm-sign中的bid部分
 * @returns {Promise<Object>} 音频信息对象
 * @throws {Error} 当API请求失败时抛出错误
 * 
 * @example
 * try {
 *   const soundInfo = await getSoundInfo('12345678', headers, 'bid_value');
 *   console.log('音频标题:', soundInfo.title);
 *   console.log('音频时长:', soundInfo.duration);
 * } catch (error) {
 *   console.error('获取音频信息失败:', error.message);
 * }
 */
export async function getSoundInfo(soundId, headers, bid) {
  if (!soundId) {
    throw new Error('音频ID不能为空');
  }
  
  const url = `${API_BASE_URL}${API_ENDPOINTS.soundInfo}?id=${soundId}&ptype=1`;
  
  try {
    const authHeaders = createAuthHeaders(headers.Cookie, bid);
    const data = await httpRequest(url, {
      headers: { ...headers, ...authHeaders },
      retries: 3
    });
    if (!data || data.ret !== 200) {
      throw new Error(`API返回错误: ${data ? data.msg : '未知错误'}`);
    }
    return data.data;
  } catch (error) {
    throw new Error(`获取音频信息失败: ${error.message}`);
  }
}

/**
 * 获取专辑信息
 * @param {string} albumId - 专辑ID
 * @param {Object} headers - 请求头
 * @param {number} [page=1] - 页码，默认为1
 * @param {number} [pageSize=30] - 每页数量，默认为30
 * @returns {Promise<Object>} 专辑信息对象
 * @throws {Error} 当API请求失败时抛出错误
 * 
 * @example
 * try {
 *   const albumInfo = await getAlbumInfo('12345678', headers);
 *   console.log('专辑标题:', albumInfo.albumTitle);
 *   console.log('音频数量:', albumInfo.trackTotalCount);
 *   console.log('音频列表:', albumInfo.tracks);
 * } catch (error) {
 *   console.error('获取专辑信息失败:', error.message);
 * }
 */
export async function getAlbumInfo(albumId, headers, page = 1, pageSize = 30) {
  if (!albumId) {
    throw new Error('专辑ID不能为空');
  }
  
  const url = `${API_BASE_URL}${API_ENDPOINTS.albumInfo}?albumId=${albumId}&pageNum=${page}&pageSize=${pageSize}&sort=1`;
  
  try {
    const data = await httpRequest(url, { headers, retries: 3 });
    if (!data || data.ret !== 200) {
      throw new Error(`API返回错误: ${data ? data.msg : '未知错误'}`);
    }
    return data.data;
  } catch (error) {
    throw new Error(`获取专辑信息失败: ${error.message}`);
  }
}

/**
 * 获取用户信息
 * @param {Object} headers - 请求头
 * @returns {Promise<Object>} 用户信息对象
 * @throws {Error} 当API请求失败时抛出错误
 * 
 * @example
 * try {
 *   const userInfo = await getUserInfo(headers);
 *   console.log('用户昵称:', userInfo.nickname);
 *   console.log('用户ID:', userInfo.uid);
 * } catch (error) {
 *   console.error('获取用户信息失败:', error.message);
 * }
 */
export async function getUserInfo(headers) {
  const url = `${API_BASE_URL}${API_ENDPOINTS.userInfo}`;
  
  try {
    const data = await httpRequest(url, { headers, retries: 3 });
    if (!data || data.ret !== 200) {
      throw new Error(`API返回错误: ${data ? data.msg : '未知错误'}`);
    }
    return data.data;
  } catch (error) {
    throw new Error(`获取用户信息失败: ${error.message}`);
  }
}

/**
 * 获取专辑的所有音频信息
 * @param {string} albumId - 专辑ID
 * @param {Object} headers - 请求头
 * @returns {Promise<Array>} 音频信息列表
 * @throws {Error} 当API请求失败时抛出错误
 * 
 * @example
 * try {
 *   const allTracks = await getAllAlbumTracks('12345678', headers);
 *   console.log(`共获取到 ${allTracks.length} 个音频`);
 *   allTracks.forEach(track => {
 *     console.log(`- ${track.title} (${track.duration})`);
 *   });
 * } catch (error) {
 *   console.error('获取专辑音频失败:', error.message);
 * }
 */
export async function getAllAlbumTracks(albumId, headers) {
  if (!albumId) {
    throw new Error('专辑ID不能为空');
  }
  
  try {
    // 首先获取第一页，确定总页数
    const firstPage = await getAlbumInfo(albumId, headers, 1, 30);
    const { trackTotalCount, tracks } = firstPage;
    
    if (trackTotalCount <= 30) {
      // 如果总数不超过一页，直接返回
      return tracks;
    }
    
    // 计算总页数
    const totalPages = Math.ceil(trackTotalCount / 30);
    const allTracks = [...tracks];
    
    // 获取剩余页面的数据
    for (let page = 2; page <= totalPages; page++) {
      const pageData = await getAlbumInfo(albumId, headers, page, 30);
      allTracks.push(...pageData.tracks);
    }
    
    return allTracks;
  } catch (error) {
    throw new Error(`获取专辑所有音频失败: ${error.message}`);
  }
}

/**
 * 检查音频是否可下载
 * @param {string} soundId - 音频ID
 * @param {Object} headers - 请求头
 * @param {string} bid - xm-sign中的bid部分
 * @returns {Promise<boolean>} 是否可下载
 * 
 * @example
 * const canDownload = await checkSoundDownloadable('12345678', headers, 'bid_value');
 * if (canDownload) {
 *   console.log('音频可下载');
 * } else {
 *   console.log('音频不可下载或需要VIP权限');
 * }
 */
export async function checkSoundDownloadable(soundId, headers, bid) {
  try {
    const soundInfo = await getSoundInfo(soundId, headers, bid);
    return !!(soundInfo && soundInfo.url);
  } catch (error) {
    console.error(`检查音频可下载性失败: ${error.message}`);
    return false;
  }
}

/**
 * 获取音频的下载链接
 * @param {string} soundId - 音频ID
 * @param {Object} headers - 请求头
 * @param {string} bid - xm-sign中的bid部分
 * @param {string} [quality='high'] - 音频质量，可选值: 'high', 'medium', 'low'
 * @returns {Promise<string>} 下载链接
 * @throws {Error} 当获取下载链接失败时抛出错误
 * 
 * @example
 * try {
 *   const downloadUrl = await getSoundDownloadUrl('12345678', headers, 'bid_value', 'high');
 *   console.log('下载链接:', downloadUrl);
 * } catch (error) {
 *   console.error('获取下载链接失败:', error.message);
 * }
 */
export async function getSoundDownloadUrl(soundId, headers, bid, quality = 'high') {
  try {
    const soundInfo = await getSoundInfo(soundId, headers, bid);
    
    if (!soundInfo || !soundInfo.url) {
      throw new Error('无法获取音频下载链接，可能需要VIP权限');
    }
    
    // 根据质量选择合适的URL
    if (soundInfo.url[quality]) {
      return soundInfo.url[quality];
    }
    
    // 如果指定质量不可用，返回可用的最高质量
    const availableQualities = Object.keys(soundInfo.url);
    if (availableQualities.length > 0) {
      return soundInfo.url[availableQualities[0]];
    }
    
    throw new Error('没有可用的下载链接');
  } catch (error) {
    throw new Error(`获取音频下载链接失败: ${error.message}`);
  }
}

/**
 * 生成xm-sign签名
 * @param {string} bid - bid部分
 * @returns {string} 完整的xm-sign签名
 * @private
 */
function generateXmSign(bid) {
  // 这里实现xm-sign的生成逻辑
  // 原始代码中有相关实现，需要移植过来
  // 暂时返回bid作为占位符
  return bid;
}

/**
 * 检查API请求是否达到每日限制
 * @param {Object} error - 错误对象
 * @returns {boolean} 是否达到每日限制
 * 
 * @example
 * try {
 *   await getSoundInfo('12345678', headers, 'bid_value');
 * } catch (error) {
 *   if (isDailyLimitReached(error)) {
 *     console.log('已达到每日下载限制，请明天再试');
 *   } else {
 *     console.error('获取音频信息失败:', error.message);
 *   }
 * }
 */
export function isDailyLimitReached(error) {
  if (!error || !error.message) {
    return false;
  }
  
  const message = error.message.toLowerCase();
  return message.includes('每日') && 
         (message.includes('限制') || message.includes('limit'));
}

/**
 * 检查是否需要登录
 * @param {Object} error - 错误对象
 * @returns {boolean} 是否需要登录
 * 
 * @example
 * try {
 *   await getSoundInfo('12345678', headers, 'bid_value');
 * } catch (error) {
 *   if (isLoginRequired(error)) {
 *     console.log('需要登录才能下载此音频');
 *   } else {
 *     console.error('获取音频信息失败:', error.message);
 *   }
 * }
 */
export function isLoginRequired(error) {
  if (!error || !error.message) {
    return false;
  }
  
  const message = error.message.toLowerCase();
  return message.includes('登录') || 
         message.includes('login') || 
         message.includes('认证') || 
         message.includes('auth');
}
