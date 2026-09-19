/**
 * @fileoverview 下载模块
 * @description 负责处理音频文件的下载功能，包括单个文件下载和批量下载
 * @module core/downloader
 *
 * @description
 * 本模块提供完整的下载功能，包括：
 * - 单个音频文件下载
 * - 带自动命名的音频下载
 * - 批量音频下载（支持并发控制）
 * - 专辑下载
 *
 * 主要特性：
 * - 支持下载进度回调
 * - 支持跳过已存在文件
 * - 支持自定义超时和重试次数
 * - 支持并发下载数量控制
 * - 自动推断音频文件扩展名
 *
 * @example
 * import { downloadSoundWithNaming, downloadAlbum } from './core/downloader.js';
 *
 * // 下载单个音频
 * const result = await downloadSoundWithNaming(url, '音频标题', './downloads');
 *
 * // 下载专辑
 * const tracks = [{ id: '1', title: '音频1', url: '...' }];
 * const result = await downloadAlbum(tracks, '专辑名称', './downloads');
 */

import path from 'path';
import { downloadFile, httpRequest } from '../utils/networkUtils.js';
import { fileExists, createDirectory, getFileSize, generateSafeFilename, generateNumberedFilename, joinPath } from '../utils/fileUtils.js';
import { formatFileSize } from '../utils/stringUtils.js';

/**
 * 下载单个音频文件
 * @description 从指定URL下载音频文件到指定路径
 * @param {string} url - 音频文件的下载链接
 * @param {string} filePath - 文件的完整保存路径（包含文件名）
 * @param {Object} [options={}] - 下载选项配置
 * @param {Function} [options.onProgress] - 下载进度回调函数，参数为 (progress, downloaded, total)
 * @param {boolean} [options.skipExisting=true] - 是否跳过已存在的文件
 * @param {number} [options.timeout=30000] - 下载超时时间（毫秒）
 * @param {number} [options.retries=3] - 下载失败时的重试次数
 * @returns {Promise<Object>} 下载结果对象
 *
 * @returns {Object} 返回对象包含以下属性：
 * @returns {boolean} returns.success - 是否下载成功
 * @returns {string} [returns.filePath] - 文件保存路径
 * @returns {number} [returns.fileSize] - 文件大小（字节）
 * @returns {boolean} [returns.skipped] - 是否跳过下载（文件已存在）
 * @returns {string} [returns.message] - 结果消息
 * @returns {string} [returns.error] - 错误信息（仅失败时）
 *
 * @example
 * const result = await downloadSound(
 *   'https://example.com/audio.mp3',
 *   './downloads/audio.mp3',
 *   { skipExisting: true, timeout: 60000 }
 * );
 *
 * if (result.success) {
 *   console.log(`下载成功: ${result.filePath}`);
 * } else {
 *   console.error(`下载失败: ${result.error}`);
 * }
 */
export async function downloadSound(url, filePath, options = {}) {
  if (!url || typeof url !== 'string') {
    return { success: false, error: '下载链接不能为空' };
  }

  if (!filePath || typeof filePath !== 'string') {
    return { success: false, error: '保存路径不能为空' };
  }

  const {
    onProgress = null,
    skipExisting = true,
    timeout = 30000,
    retries = 3
  } = options;

  try {
    // 检查文件是否已存在
    if (skipExisting && await fileExists(filePath)) {
      const fileSize = await getFileSize(filePath);
      return {
        success: true,
        filePath,
        fileSize,
        skipped: true,
        message: '文件已存在，跳过下载'
      };
    }

    // 确保目录存在
    const dir = path.dirname(filePath);
    await createDirectory(dir);

    // 下载文件
    const result = await downloadFile(url, filePath, {
      onProgress,
      timeout,
      retries
    });

    if (result.success) {
      const fileSize = await getFileSize(filePath);
      return {
        success: true,
        filePath,
        fileSize,
        message: '下载成功'
      };
    } else {
      return {
        success: false,
        filePath,
        error: result.error || '下载失败'
      };
    }
  } catch (error) {
    return {
      success: false,
      filePath,
      error: error.message || '下载过程中发生错误'
    };
  }
}

/**
 * 下载音频并自动命名
 * @description 根据音频标题自动生成安全的文件名并下载
 * @param {string} url - 音频文件的下载链接
 * @param {string} title - 音频标题，用于生成文件名
 * @param {string} [dirPath='./downloads'] - 保存目录路径
 * @param {Object} [options={}] - 下载选项配置
 * @param {Function} [options.onProgress] - 下载进度回调函数
 * @param {boolean} [options.skipExisting=true] - 是否跳过已存在的文件
 * @param {number} [options.timeout=30000] - 下载超时时间（毫秒）
 * @param {number} [options.retries=3] - 重试次数
 * @param {boolean} [options.addNumber=false] - 是否在文件名中添加序号
 * @param {number} [options.number=0] - 序号值（当 addNumber 为 true 时使用）
 * @returns {Promise<Object>} 下载结果对象，包含 success, filePath, fileName, fileSize 等属性
 *
 * @example
 * // 基本用法
 * const result = await downloadSoundWithNaming(
 *   'https://example.com/audio.mp3',
 *   '我的音频',
 *   './downloads'
 * );
 *
 * // 添加序号
 * const result = await downloadSoundWithNaming(
 *   'https://example.com/audio.mp3',
 *   '第一章',
 *   './downloads',
 *   { addNumber: true, number: 1 }
 * );
 * // 生成文件名: 01 第一章.mp3
 */
export async function downloadSoundWithNaming(url, title, dirPath = './downloads', options = {}) {
  if (!url || typeof url !== 'string') {
    return { success: false, error: '下载链接不能为空' };
  }

  if (!title || typeof title !== 'string') {
    return { success: false, error: '音频标题不能为空' };
  }

  const {
    onProgress = null,
    skipExisting = true,
    timeout = 30000,
    retries = 3,
    addNumber = false,
    number = 0
  } = options;

  try {
    // 生成安全的文件名
    let fileName = generateSafeFilename(title);

    // 添加序号
    if (addNumber && number > 0) {
      fileName = generateNumberedFilename(fileName, '', number);
    }

    // 添加文件扩展名
    if (!fileName.includes('.')) {
      // 尝试从 URL 中推断扩展名
      let ext = '.mp3';  // 默认扩展名
      if (url.includes('.m4a')) {
        ext = '.m4a';
      } else if (url.includes('.mp3')) {
        ext = '.mp3';
      } else {
        // 尝试从 URL 路径中提取扩展名
        const urlPath = url.split('?')[0];  // 移除查询参数
        const pathMatch = urlPath.match(/\.(m4a|mp3|wav|flac|aac|ogg)(?:$|\/)/i);
        if (pathMatch) {
          ext = '.' + pathMatch[1].toLowerCase();
        }
      }
      fileName += ext;
    }

    // 构建完整文件路径
    const filePath = joinPath(dirPath, fileName);

    // 下载文件
    const result = await downloadSound(url, filePath, {
      onProgress,
      skipExisting,
      timeout,
      retries
    });

    return result.success ? { ...result, fileName } : result;
  } catch (error) {
    return {
      success: false,
      error: error.message || '下载过程中发生错误'
    };
  }
}

/**
 * 批量下载音频
 * @description 批量下载多个音频文件，支持并发控制和进度回调
 * @param {Array<Object>} sounds - 音频信息数组
 * @param {string} sounds[].id - 音频ID
 * @param {string} sounds[].title - 音频标题
 * @param {string} sounds[].url - 音频下载链接
 * @param {string} [dirPath='./downloads'] - 保存目录路径
 * @param {Object} [options={}] - 下载选项配置
 * @param {Function} [options.onProgress] - 总体进度回调，参数为 (percentage, completed, total)
 * @param {Function} [options.onItemComplete] - 单个文件完成回调，参数为 (id, result)
 * @param {boolean} [options.skipExisting=true] - 是否跳过已存在的文件
 * @param {number} [options.timeout=30000] - 下载超时时间（毫秒）
 * @param {number} [options.retries=3] - 重试次数
 * @param {boolean} [options.addNumber=true] - 是否在文件名中添加序号
 * @param {number} [options.concurrency=3] - 并发下载数量限制
 * @returns {Promise<Object>} 批量下载结果对象
 *
 * @returns {Object} 返回对象包含以下属性：
 * @returns {boolean} returns.success - 是否全部成功
 * @returns {number} returns.totalCount - 总数量
 * @returns {number} returns.successCount - 成功数量
 * @returns {number} returns.failureCount - 失败数量
 * @returns {number} returns.totalSize - 总下载大小（字节）
 * @returns {Array<Object>} returns.results - 每个音频的下载结果
 *
 * @example
 * const sounds = [
 *   { id: '1', title: '第一集', url: 'https://...' },
 *   { id: '2', title: '第二集', url: 'https://...' }
 * ];
 *
 * const result = await downloadSounds(sounds, './downloads', {
 *   concurrency: 5,
 *   onProgress: (pct, done, total) => console.log(`进度: ${pct}%`)
 * });
 */
export async function downloadSounds(sounds, dirPath = './downloads', options = {}) {
  if (!Array.isArray(sounds) || sounds.length === 0) {
    return { success: false, error: '音频列表不能为空' };
  }

  const {
    onProgress = null,
    onItemComplete = null,
    skipExisting = true,
    timeout = 30000,
    retries = 3,
    addNumber = true,
    concurrency = 3
  } = options;

  // 确保目录存在
  await createDirectory(dirPath);

  const totalCount = sounds.length;
  let completedCount = 0;
  let successCount = 0;
  let failureCount = 0;
  let totalSize = 0;
  const results = [];

  // 并发控制下载
  // 使用 Promise 池来控制并发
  async function downloadWithLimit() {
    const executing = new Map(); // 使用 Map 来追踪 promise 和其对应的 sound

    for (let i = 0; i < sounds.length; i++) {
      const sound = sounds[i];
      const currentIndex = i;

      // 创建一个包装的 promise，在完成时自动从 executing 中移除
      const wrappedPromise = (async () => {
        const result = await downloadSoundWithNaming(
          sound.url,
          sound.title,
          dirPath,
          {
            onProgress,
            skipExisting,
            timeout,
            retries,
            addNumber,
            number: addNumber ? currentIndex + 1 : 0
          }
        );

        completedCount++;
        if (result.success) {
          successCount++;
          totalSize += result.fileSize || 0;
        } else {
          failureCount++;
        }

        results.push({ id: sound.id, title: sound.title, result });

        if (onItemComplete) {
          onItemComplete(sound.id, result);
        }

        if (onProgress) {
          onProgress(Math.round((completedCount / totalCount) * 100), completedCount, totalCount);
        }

        return result;
      })();

      // 将 promise 存入 Map，以便后续移除
      const promiseWithKey = wrappedPromise.then(result => {
        executing.delete(promiseWithKey);
        return result;
      });

      executing.set(promiseWithKey, sound);

      // 当达到并发限制时，等待任意一个完成
      if (executing.size >= concurrency) {
        await Promise.race(executing.keys());
      }
    }

    // 等待所有剩余的下载完成
    await Promise.all(executing.keys());
  }

  await downloadWithLimit();

  return {
    success: true,
    totalCount,
    successCount,
    failureCount,
    totalSize,
    results
  };
}

/**
 * 下载专辑音频
 * @param {Array<Object>} tracks - 音轨列表
 * @param {string} albumTitle - 专辑标题
 * @param {string} [baseDir='./downloads'] - 基础目录
 * @param {Object} [options={}] - 下载选项
 * @returns {Promise<Object>} 下载结果对象
 */
export async function downloadAlbum(tracks, albumTitle, baseDir = './downloads', options = {}) {
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return { success: false, error: '音轨列表不能为空' };
  }

  if (!albumTitle || typeof albumTitle !== 'string') {
    return { success: false, error: '专辑标题不能为空' };
  }

  const albumDir = joinPath(baseDir, generateSafeFilename(albumTitle));

  const sounds = tracks.map(track => ({
    id: track.id,
    title: track.title,
    url: track.url
  }));

  const result = await downloadSounds(sounds, albumDir, {
    ...options,
    addNumber: true
  });

  return result.success ? { ...result, albumTitle, albumDir } : result;
}
