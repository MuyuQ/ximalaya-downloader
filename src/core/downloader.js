/**
 * @fileoverview 下载模块
 * @description 负责处理音频文件的下载功能，包括单个文件下载和批量下载
 * @module core/downloader
 *
 * @description
 * 本模块提供完整的下载功能，包括：
 * - 单个音频文件下载（支持进度回调）
 * - 带自动命名的音频下载（自动推断扩展名、可选序号前缀）
 * - 批量音频下载（工作池并发控制，无内存泄漏）
 * - 专辑下载（按专辑名建目录、序号补零保证排序）
 *
 * 主要特性：
 * - 断点续传（跳过已存在文件）
 * - 自定义超时和重试次数
 * - 文件名安全化与长度截断
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
import { URL } from 'url';
import { downloadFile } from '../utils/networkUtils.js';
import {
  fileExists,
  createDirectory,
  getFileSize,
  generateSafeFilename,
  generateNumberedFilename,
  joinPath
} from '../utils/fileUtils.js';

/**
 * 已知的音频文件扩展名
 * @type {string[]}
 * @private
 */
const AUDIO_EXTENSIONS = ['m4a', 'mp3', 'wav', 'flac', 'aac', 'ogg'];

/**
 * 从下载 URL 推断音频扩展名
 * @description 优先匹配 URL 路径中的已知音频扩展名，默认 .mp3。
 * @param {string} url - 下载链接
 * @returns {string} 扩展名（含点，如 '.mp3'）
 * @private
 */
function inferAudioExtension(url) {
  try {
    const urlObj = new URL(url);
    const match = urlObj.pathname.match(/\.([a-z0-9]+)$/i);
    if (match) {
      const ext = match[1].toLowerCase();
      if (AUDIO_EXTENSIONS.includes(ext)) {
        return `.${ext}`;
      }
    }
  } catch {
    // URL 解析失败时使用默认扩展名
  }
  return '.mp3';
}

/**
 * 运行固定并发的任务池
 * @description 每个 worker 顺序领取任务，避免旧版 Promise.race 池的
 *   Map 清理逻辑带来的内存泄漏风险。
 * @param {Array} items - 任务列表
 * @param {number} concurrency - 并发数
 * @param {Function} worker - 任务处理函数 (item, index)
 * @returns {Promise<void>} 所有任务完成后 resolve
 * @private
 */
async function runTaskPool(items, concurrency, worker) {
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      await worker(items[index], index);
    }
  });

  await Promise.all(workers);
}

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
 * @returns {string} [returns.error] - 错误信息（仅失败时）
 *
 * @example
 * const result = await downloadSound('https://example.com/audio.mp3', './downloads/audio.mp3');
 * if (result.success) {
 *   console.log(`下载成功: ${result.filePath}`);
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
    // 检查文件是否已存在（断点续传：跳过已下载文件）
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
    await createDirectory(path.dirname(filePath));

    // 下载文件
    const result = await downloadFile(url, filePath, { onProgress, timeout, retries });

    if (result.success) {
      const fileSize = await getFileSize(filePath);
      return {
        success: true,
        filePath,
        fileSize,
        message: '下载成功'
      };
    }

    return {
      success: false,
      filePath,
      error: result.error || '下载失败'
    };
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
 * @description 根据音频标题自动生成安全的文件名并下载；扩展名从 URL 推断。
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
 * @param {number} [options.padWidth=2] - 序号补零宽度
 * @returns {Promise<Object>} 下载结果对象，包含 success, filePath, fileName, fileSize 等属性
 *
 * @example
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
    number = 0,
    padWidth = 2
  } = options;

  try {
    // 生成安全的文件名
    let fileName = generateSafeFilename(title);

    // 添加序号
    if (addNumber && number > 0) {
      fileName = generateNumberedFilename(fileName, '', number, padWidth);
    }

    // 添加文件扩展名
    if (!fileName.includes('.')) {
      fileName += inferAudioExtension(url);
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
 * @description 批量下载多个音频文件，使用固定大小的工作池控制并发，
 *   支持总体进度与单项完成回调。
 * @param {Array<Object>} sounds - 音频信息数组
 * @param {string} sounds[].id - 音频ID
 * @param {string} sounds[].title - 音频标题
 * @param {string} sounds[].url - 音频下载链接
 * @param {string} [dirPath='./downloads'] - 保存目录路径
 * @param {Object} [options={}] - 下载选项配置
 * @param {Function} [options.onProgress] - 总体进度回调 (percentage, completed, total)
 * @param {Function} [options.onItemComplete] - 单个文件完成回调 (id, result)
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

  await createDirectory(dirPath);

  const totalCount = sounds.length;
  // 序号宽度至少 2 位（"01"），超过 99 集自动加宽
  const padWidth = Math.max(2, String(totalCount).length);
  let completedCount = 0;
  let successCount = 0;
  let failureCount = 0;
  let totalSize = 0;
  const results = [];

  await runTaskPool(sounds, concurrency, async (sound, index) => {
    const result = await downloadSoundWithNaming(
      sound.url,
      sound.title,
      dirPath,
      {
        skipExisting,
        timeout,
        retries,
        addNumber,
        number: addNumber ? index + 1 : 0,
        padWidth
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
  });

  return {
    success: failureCount === 0,
    totalCount,
    successCount,
    failureCount,
    totalSize,
    results
  };
}

/**
 * 下载专辑音频
 * @description 在基础目录下按专辑名创建子目录，音轨文件名默认带补零序号
 *   （可通过 options.addNumber 关闭）。
 * @param {Array<Object>} tracks - 音轨列表 [{ id, title, url }]
 * @param {string} albumTitle - 专辑标题
 * @param {string} [baseDir='./downloads'] - 基础目录
 * @param {Object} [options={}] - 下载选项（同 downloadSounds，另支持 addNumber）
 * @returns {Promise<Object>} 下载结果对象（附带 albumTitle 与 albumDir）
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

  const { addNumber = true, ...restOptions } = options;

  const result = await downloadSounds(sounds, albumDir, {
    ...restOptions,
    addNumber
  });

  return result.success || result.results
    ? { ...result, albumTitle, albumDir }
    : result;
}
