/**
 * 音频解析模块
 * 负责解析喜马拉雅音频信息，包括单个音频和专辑信息
 */

import { httpRequest } from '../utils/networkUtils.js';
import { decryptUrl } from './decryptor.js';

/**
 * 音频质量枚举
 * @readonly
 * @enum {string}
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
export const AudioType = {
  FREE: 'free',
  VIP: 'vip',
  PURCHASED: 'purchased'
};

/**
 * 解析单个音频信息
 * @param {string} soundId - 音频ID
 * @param {Object} headers - 请求头
 * @returns {Promise<Object|null>} 音频信息对象，解析失败时返回null
 * 
 * @example
 * const soundInfo = await analyzeSound('12345678', {
 *   'Cookie': 'your_cookie',
 *   'User-Agent': 'your_user_agent'
 * });
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
export async function analyzeSound(soundId, headers) {
  if (!soundId || typeof soundId !== 'string') {
    console.error('音频ID不能为空');
    return null;
  }
  
  if (!headers || typeof headers !== 'object') {
    console.error('请求头不能为空');
    return null;
  }
  
  try {
    const url = `https://www.ximalaya.com/revision/play/v1/audio?id=${soundId}&ptype=1`;
    const response = await httpRequest({
      url,
      method: 'GET',
      headers,
      timeout: 10000,
      retries: 3
    });
    
    if (!response.success) {
      console.error(`请求音频信息失败: ${response.error}`);
      return null;
    }
    
    const data = response.data;
    
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
 * 异步解析单个音频信息
 * @param {string} soundId - 音频ID
 * @param {Object} headers - 请求头
 * @returns {Promise<Object|null>} 音频信息对象，解析失败时返回null
 * 
 * @example
 * const soundInfo = await asyncAnalyzeSound('12345678', {
 *   'Cookie': 'your_cookie',
 *   'User-Agent': 'your_user_agent'
 * });
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
export async function asyncAnalyzeSound(soundId, headers) {
  // 这个函数与analyzeSound功能相同，但使用async/await语法
  return await analyzeSound(soundId, headers);
}

/**
 * 解析专辑信息
 * @param {string} albumId - 专辑ID
 * @param {Object} headers - 请求头
 * @param {number} [page=1] - 页码，默认为1
 * @param {number} [pageSize=30] - 每页数量，默认为30
 * @returns {Promise<Object|null>} 专辑信息对象，解析失败时返回null
 * 
 * @example
 * const albumInfo = await analyzeAlbum('12345678', {
 *   'Cookie': 'your_cookie',
 *   'User-Agent': 'your_user_agent'
 * }, 1, 30);
 * 
 * if (albumInfo) {
 *   console.log('专辑标题:', albumInfo.title);
 *   console.log('专辑描述:', albumInfo.description);
 *   console.log('音频数量:', albumInfo.totalCount);
 *   console.log('音频列表:', albumInfo.tracks);
 * } else {
 *   console.log('解析专辑信息失败');
 * }
 */
export async function analyzeAlbum(albumId, headers, page = 1, pageSize = 30) {
  if (!albumId || typeof albumId !== 'string') {
    console.error('专辑ID不能为空');
    return null;
  }
  
  if (!headers || typeof headers !== 'object') {
    console.error('请求头不能为空');
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
    const response = await httpRequest({
      url,
      method: 'GET',
      headers,
      timeout: 10000,
      retries: 3
    });
    
    if (!response.success) {
      console.error(`请求专辑信息失败: ${response.error}`);
      return null;
    }
    
    const data = response.data;
    
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
export async function getAllAlbumTracks(albumId, headers, onProgress) {
  if (!albumId || typeof albumId !== 'string') {
    console.error('专辑ID不能为空');
    return null;
  }
  
  if (!headers || typeof headers !== 'object') {
    console.error('请求头不能为空');
    return null;
  }
  
  try {
    // 首先获取第一页，确定总页数
    const firstPage = await analyzeAlbum(albumId, headers, 1, 30);
    
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
      const pageData = await analyzeAlbum(albumId, headers, page, 30);
      
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
export async function judgeAlbum(albumId, headers) {
  if (!albumId || typeof albumId !== 'string') {
    console.error('专辑ID不能为空');
    return null;
  }
  
  if (!headers || typeof headers !== 'object') {
    console.error('请求头不能为空');
    return null;
  }
  
  try {
    const url = `https://www.ximalaya.com/revision/album/v1/getSimple?albumId=${albumId}`;
    const response = await httpRequest({
      url,
      method: 'GET',
      headers,
      timeout: 10000,
      retries: 3
    });
    
    if (!response.success) {
      console.error(`请求专辑信息失败: ${response.error}`);
      return null;
    }
    
    const data = response.data;
    
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
export async function checkSoundDownloadable(soundId, headers) {
  if (!soundId || typeof soundId !== 'string') {
    console.error('音频ID不能为空');
    return false;
  }
  
  if (!headers || typeof headers !== 'object') {
    console.error('请求头不能为空');
    return false;
  }
  
  try {
    const soundInfo = await analyzeSound(soundId, headers);
    
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
export async function getSoundDownloadUrl(soundId, headers, quality = AudioQuality.MP3_64) {
  if (!soundId || typeof soundId !== 'string') {
    console.error('音频ID不能为空');
    return null;
  }
  
  if (!headers || typeof headers !== 'object') {
    console.error('请求头不能为空');
    return null;
  }
  
  if (!Object.values(AudioQuality).includes(quality)) {
    console.error(`不支持的音频质量: ${quality}`);
    return null;
  }
  
  try {
    const soundInfo = await analyzeSound(soundId, headers);
    
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
 * @param {Object} headers - 请求头
 * @returns {Promise<boolean>} 是否达到每日下载限制
 * 
 * @example
 * const isLimitReached = await isDailyLimitReached({
 *   'Cookie': 'your_cookie',
 *   'User-Agent': 'your_user_agent'
 * });
 * 
 * if (isLimitReached) {
 *   console.log('已达到每日下载限制');
 * } else {
 *   console.log('未达到每日下载限制');
 * }
 */
export async function isDailyLimitReached(headers) {
  if (!headers || typeof headers !== 'object') {
    console.error('请求头不能为空');
    return false;
  }
  
  try {
    // 尝试获取一个免费音频的信息
    const response = await httpRequest({
      url: 'https://www.ximalaya.com/revision/play/v1/audio?id=12345678&ptype=1',
      method: 'GET',
      headers,
      timeout: 10000,
      retries: 1
    });
    
    if (!response.success) {
      // 如果请求失败，检查是否是每日限制错误
      if (response.error && response.error.includes('每日下载')) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error(`检查每日下载限制失败: ${error.message}`);
    return false;
  }
}

/**
 * 检查是否需要登录
 * @param {Object} headers - 请求头
 * @returns {Promise<boolean>} 是否需要登录
 * 
 * @example
 * const needLogin = await isLoginRequired({
 *   'Cookie': 'your_cookie',
 *   'User-Agent': 'your_user_agent'
 * });
 * 
 * if (needLogin) {
 *   console.log('需要登录');
 * } else {
 *   console.log('不需要登录');
 * }
 */
export async function isLoginRequired(headers) {
  if (!headers || typeof headers !== 'object') {
    console.error('请求头不能为空');
    return true;
  }
  
  try {
    // 尝试获取用户信息
    const response = await httpRequest({
      url: 'https://www.ximalaya.com/revision/user/v1/getUserInfo',
      method: 'GET',
      headers,
      timeout: 10000,
      retries: 1
    });
    
    if (!response.success) {
      // 如果请求失败，可能需要登录
      return true;
    }
    
    const data = response.data;
    
    // 检查响应数据
    if (!data || data.ret !== 200 || !data.data) {
      return true;
    }
    
    // 检查用户信息
    const userInfo = data.data;
    if (!userInfo || !userInfo.nickname) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`检查是否需要登录失败: ${error.message}`);
    return true;
  }
}