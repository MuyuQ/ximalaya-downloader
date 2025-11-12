/**
 * 下载模块
 * 负责处理音频文件的下载功能
 */

import { httpRequest, downloadFile } from '../utils/networkUtils.js';
import { generateSafeFilename, generateNumberedFilename, createDirectory, fileExists, getFileSize } from '../utils/fileUtils.js';
import { formatFileSize } from '../utils/stringUtils.js';

/**
 * 下载单个音频文件
 * @param {string} url - 下载链接
 * @param {string} filePath - 保存路径
 * @param {Object} [options={}] - 下载选项
 * @param {Function} [options.onProgress] - 进度回调函数
 * @param {boolean} [options.skipExisting=true] - 是否跳过已存在的文件
 * @param {number} [options.timeout=30000] - 下载超时时间（毫秒）
 * @param {number} [options.retries=3] - 重试次数
 * @returns {Promise<Object>} 下载结果对象
 * 
 * @example
 * const result = await downloadSound(
 *   'https://example.com/audio.mp3',
 *   'path/to/save/audio.mp3',
 *   {
 *     onProgress: (progress) => console.log(`下载进度: ${progress}%`),
 *     skipExisting: true,
 *     timeout: 30000,
 *     retries: 3
 *   }
 * );
 * 
 * if (result.success) {
 *   console.log('下载成功:', result.filePath);
 *   console.log('文件大小:', formatFileSize(result.fileSize));
 * } else {
 *   console.error('下载失败:', result.error);
 * }
 */
export async function downloadSound(url, filePath, options = {}) {
  if (!url || typeof url !== 'string') {
    return { success: false, error: '下载链接不能为空' };
  }
  
  if (!filePath || typeof filePath !== 'string') {
    return { success: false, error: '保存路径不能为空' };
  }
  
  // 设置默认选项
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
    const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
    if (dirPath) {
      await createDirectory(dirPath);
    }
    
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
 * @param {string} url - 下载链接
 * @param {string} title - 音频标题
 * @param {string} [dirPath='./'] - 保存目录
 * @param {Object} [options={}] - 下载选项
 * @param {Function} [options.onProgress] - 进度回调函数
 * @param {boolean} [options.skipExisting=true] - 是否跳过已存在的文件
 * @param {number} [options.timeout=30000] - 下载超时时间（毫秒）
 * @param {number} [options.retries=3] - 重试次数
 * @param {boolean} [options.addNumber=false] - 是否添加序号
 * @param {number} [options.number=0] - 序号
 * @param {number} [options.numberDigits=2] - 序号位数
 * @returns {Promise<Object>} 下载结果对象
 * 
 * @example
 * const result = await downloadSoundWithNaming(
 *   'https://example.com/audio.mp3',
 *   '音频标题',
 *   './downloads',
 *   {
 *     onProgress: (progress) => console.log(`下载进度: ${progress}%`),
 *     skipExisting: true,
 *     addNumber: true,
 *     number: 1,
 *     numberDigits: 2
 *   }
 * );
 * 
 * if (result.success) {
 *   console.log('下载成功:', result.filePath);
 *   console.log('文件名:', result.fileName);
 * } else {
 *   console.error('下载失败:', result.error);
 * }
 */
export async function downloadSoundWithNaming(url, title, dirPath = './', options = {}) {
  if (!url || typeof url !== 'string') {
    return { success: false, error: '下载链接不能为空' };
  }
  
  if (!title || typeof title !== 'string') {
    return { success: false, error: '音频标题不能为空' };
  }
  
  if (!dirPath || typeof dirPath !== 'string') {
    dirPath = './';
  }
  
  // 设置默认选项
  const {
    onProgress = null,
    skipExisting = true,
    timeout = 30000,
    retries = 3,
    addNumber = false,
    number = 0,
    numberDigits = 2
  } = options;
  
  try {
    // 生成安全的文件名
    let fileName = generateSafeFilename(title);
    
    // 添加序号
    if (addNumber && typeof number === 'number' && number >= 0) {
      const hasExt = fileName.includes('.');
      const base = hasExt ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
      const ext = hasExt ? fileName.substring(fileName.lastIndexOf('.')) : '';
      fileName = generateNumberedFilename(base, ext, number);
    }
    
    // 添加文件扩展名
    if (!fileName.includes('.')) {
      // 从URL中提取文件扩展名
      const urlExtension = url.split('.').pop().split('?')[0];
      if (urlExtension && /^[a-zA-Z0-9]+$/.test(urlExtension)) {
        fileName += `.${urlExtension}`;
      } else {
        fileName += '.mp3'; // 默认扩展名
      }
    }
    
    // 构建完整文件路径
    const filePath = dirPath.endsWith('/') ? `${dirPath}${fileName}` : `${dirPath}/${fileName}`;
    
    // 下载文件
    const result = await downloadSound(url, filePath, {
      onProgress,
      skipExisting,
      timeout,
      retries
    });
    
    if (result.success) {
      return {
        ...result,
        fileName
      };
    } else {
      return result;
    }
  } catch (error) {
    return {
      success: false,
      error: error.message || '下载过程中发生错误'
    };
  }
}

/**
 * 批量下载音频
 * @param {Array<Object>} sounds - 音频列表
 * @param {string} [dirPath='./'] - 保存目录
 * @param {Object} [options={}] - 下载选项
 * @param {Function} [options.onProgress] - 总体进度回调函数
 * @param {Function} [options.onItemProgress] - 单个音频进度回调函数
 * @param {Function} [options.onItemComplete] - 单个音频完成回调函数
 * @param {boolean} [options.skipExisting=true] - 是否跳过已存在的文件
 * @param {number} [options.timeout=30000] - 下载超时时间（毫秒）
 * @param {number} [options.retries=3] - 重试次数
 * @param {boolean} [options.addNumber=false] - 是否添加序号
 * @param {number} [options.numberDigits=2] - 序号位数
 * @param {number} [options.concurrency=3] - 并发下载数
 * @returns {Promise<Object>} 批量下载结果对象
 * 
 * @example
 * const sounds = [
 *   { id: '1', title: '音频1', url: 'https://example.com/audio1.mp3' },
 *   { id: '2', title: '音频2', url: 'https://example.com/audio2.mp3' },
 *   { id: '3', title: '音频3', url: 'https://example.com/audio3.mp3' }
 * ];
 * 
 * const result = await downloadSounds(
 *   sounds,
 *   './downloads',
 *   {
 *     onProgress: (progress) => console.log(`总体进度: ${progress}%`),
 *     onItemProgress: (id, progress) => console.log(`音频${id}进度: ${progress}%`),
 *     onItemComplete: (id, result) => console.log(`音频${id}完成:`, result),
 *     addNumber: true,
 *     concurrency: 3
 *   }
 * );
 * 
 * console.log(`成功: ${result.successCount}, 失败: ${result.failureCount}`);
 * console.log('总大小:', formatFileSize(result.totalSize));
 */
export async function downloadSounds(sounds, dirPath = './', options = {}) {
  if (!Array.isArray(sounds) || sounds.length === 0) {
    return { success: false, error: '音频列表不能为空' };
  }
  
  if (!dirPath || typeof dirPath !== 'string') {
    dirPath = './';
  }
  
  // 设置默认选项
  const {
    onProgress = null,
    onItemProgress = null,
    onItemComplete = null,
    skipExisting = true,
    timeout = 30000,
    retries = 3,
    addNumber = false,
    numberDigits = 2,
    concurrency = 3
  } = options;
  
  try {
    // 确保目录存在
    await createDirectory(dirPath);
    
    const totalCount = sounds.length;
    let completedCount = 0;
    let successCount = 0;
    let failureCount = 0;
    let totalSize = 0;
    const results = [];
    
    // 创建下载队列
    const queue = [...sounds];
    const activeDownloads = new Set();
    
    // 处理下载完成
    const handleDownloadComplete = async (sound, result) => {
      completedCount++;
      
      if (result.success) {
        successCount++;
        totalSize += result.fileSize || 0;
      } else {
        failureCount++;
      }
      
      results.push({
        id: sound.id,
        title: sound.title,
        result
      });
      
      // 调用单个音频完成回调
      if (onItemComplete) {
        onItemComplete(sound.id, result);
      }
      
      // 更新总体进度
      if (onProgress) {
        const progress = Math.round((completedCount / totalCount) * 100);
        onProgress(progress);
      }
      
      // 从活动下载集合中移除
      activeDownloads.delete(sound.id);
      
      // 处理队列中的下一个音频
      if (queue.length > 0) {
        const nextSound = queue.shift();
        activeDownloads.add(nextSound.id);
        downloadSingleSound(nextSound);
      }
    };
    
    // 下载单个音频
    const downloadSingleSound = async (sound) => {
      try {
        const result = await downloadSoundWithNaming(
          sound.url,
          sound.title,
          dirPath,
          {
            onProgress: (progress) => {
              if (onItemProgress) {
                onItemProgress(sound.id, progress);
              }
            },
            skipExisting,
            timeout,
            retries,
            addNumber,
            number: addNumber ? sound.index || 0 : 0,
            numberDigits
          }
        );
        
        await handleDownloadComplete(sound, result);
      } catch (error) {
        await handleDownloadComplete(sound, {
          success: false,
          error: error.message || '下载过程中发生错误'
        });
      }
    };
    
    // 启动初始下载
    const initialCount = Math.min(concurrency, sounds.length);
    for (let i = 0; i < initialCount; i++) {
      const sound = queue.shift();
      activeDownloads.add(sound.id);
      downloadSingleSound(sound);
    }
    
    // 等待所有下载完成
    while (activeDownloads.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return {
      success: true,
      totalCount,
      successCount,
      failureCount,
      totalSize,
      results
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || '批量下载过程中发生错误'
    };
  }
}

/**
 * 下载专辑音频
 * @param {Array<Object>} tracks - 音轨列表
 * @param {string} albumTitle - 专辑标题
 * @param {string} [baseDir='./'] - 基础目录
 * @param {Object} [options={}] - 下载选项
 * @param {Function} [options.onProgress] - 总体进度回调函数
 * @param {Function} [options.onItemProgress] - 单个音频进度回调函数
 * @param {Function} [options.onItemComplete] - 单个音频完成回调函数
 * @param {boolean} [options.skipExisting=true] - 是否跳过已存在的文件
 * @param {number} [options.timeout=30000] - 下载超时时间（毫秒）
 * @param {number} [options.retries=3] - 重试次数
 * @param {boolean} [options.addNumber=true] - 是否添加序号
 * @param {number} [options.numberDigits=2] - 序号位数
 * @param {number} [options.concurrency=3] - 并发下载数
 * @returns {Promise<Object>} 下载结果对象
 * 
 * @example
 * const tracks = [
 *   { id: '1', title: '音频1', url: 'https://example.com/audio1.mp3', index: 1 },
 *   { id: '2', title: '音频2', url: 'https://example.com/audio2.mp3', index: 2 },
 *   { id: '3', title: '音频3', url: 'https://example.com/audio3.mp3', index: 3 }
 * ];
 * 
 * const result = await downloadAlbum(
 *   tracks,
 *   '专辑标题',
 *   './downloads',
 *   {
 *     onProgress: (progress) => console.log(`总体进度: ${progress}%`),
 *     onItemProgress: (id, progress) => console.log(`音频${id}进度: ${progress}%`),
 *     onItemComplete: (id, result) => console.log(`音频${id}完成:`, result),
 *     addNumber: true,
 *     concurrency: 3
 *   }
 * );
 * 
 * console.log(`成功: ${result.successCount}, 失败: ${result.failureCount}`);
 * console.log('总大小:', formatFileSize(result.totalSize));
 * console.log('专辑目录:', result.albumDir);
 */
export async function downloadAlbum(tracks, albumTitle, baseDir = './', options = {}) {
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return { success: false, error: '音轨列表不能为空' };
  }
  
  if (!albumTitle || typeof albumTitle !== 'string') {
    return { success: false, error: '专辑标题不能为空' };
  }
  
  if (!baseDir || typeof baseDir !== 'string') {
    baseDir = './';
  }
  
  // 设置默认选项
  const {
    onProgress = null,
    onItemProgress = null,
    onItemComplete = null,
    skipExisting = true,
    timeout = 30000,
    retries = 3,
    addNumber = true,
    numberDigits = 2,
    concurrency = 3
  } = options;
  
  try {
    // 生成安全的专辑目录名
    const albumDirName = generateSafeFilename(albumTitle);
    const albumDir = baseDir.endsWith('/') ? `${baseDir}${albumDirName}` : `${baseDir}/${albumDirName}`;
    
    // 确保专辑目录存在
    await createDirectory(albumDir);
    
    // 准备音频列表
    const sounds = tracks.map(track => ({
      id: track.id,
      title: track.title,
      url: track.url,
      index: track.index || 0
    }));
    
    // 下载音频
    const result = await downloadSounds(sounds, albumDir, {
      onProgress,
      onItemProgress,
      onItemComplete,
      skipExisting,
      timeout,
      retries,
      addNumber,
      numberDigits,
      concurrency
    });
    
    if (result.success) {
      return {
        ...result,
        albumTitle,
        albumDir
      };
    } else {
      return result;
    }
  } catch (error) {
    return {
      success: false,
      error: error.message || '下载专辑过程中发生错误'
    };
  }
}

/**
 * 重试失败的下载
 * @param {Array<Object>} failedResults - 失败的下载结果列表
 * @param {string} [dirPath='./'] - 保存目录
 * @param {Object} [options={}] - 下载选项
 * @param {Function} [options.onProgress] - 总体进度回调函数
 * @param {Function} [options.onItemProgress] - 单个音频进度回调函数
 * @param {Function} [options.onItemComplete] - 单个音频完成回调函数
 * @param {number} [options.timeout=30000] - 下载超时时间（毫秒）
 * @param {number} [options.retries=3] - 重试次数
 * @param {boolean} [options.addNumber=false] - 是否添加序号
 * @param {number} [options.numberDigits=2] - 序号位数
 * @param {number} [options.concurrency=3] - 并发下载数
 * @returns {Promise<Object>} 重试结果对象
 * 
 * @example
 * const failedResults = [
 *   { id: '1', title: '音频1', result: { success: false, error: '网络错误' } },
 *   { id: '2', title: '音频2', result: { success: false, error: '超时' } }
 * ];
 * 
 * const result = await retryFailedDownloads(
 *   failedResults,
 *   './downloads',
 *   {
 *     onProgress: (progress) => console.log(`重试进度: ${progress}%`),
 *     retries: 5,
 *     concurrency: 2
 *   }
 * );
 * 
 * console.log(`重试成功: ${result.successCount}, 重试失败: ${result.failureCount}`);
 */
export async function retryFailedDownloads(failedResults, dirPath = './', options = {}) {
  if (!Array.isArray(failedResults) || failedResults.length === 0) {
    return { success: false, error: '失败下载列表不能为空' };
  }
  
  if (!dirPath || typeof dirPath !== 'string') {
    dirPath = './';
  }
  
  // 设置默认选项
  const {
    onProgress = null,
    onItemProgress = null,
    onItemComplete = null,
    timeout = 30000,
    retries = 3,
    addNumber = false,
    numberDigits = 2,
    concurrency = 3
  } = options;
  
  try {
    // 准备重试的音频列表
    const sounds = failedResults.map(item => {
      // 从失败结果中提取原始信息
      const originalSound = item.originalSound || {
        id: item.id,
        title: item.title,
        url: item.url,
        index: item.index || 0
      };
      
      return originalSound;
    });
    
    // 重新下载
    const result = await downloadSounds(sounds, dirPath, {
      onProgress,
      onItemProgress,
      onItemComplete,
      skipExisting: false, // 重试时不跳过已存在的文件
      timeout,
      retries,
      addNumber,
      numberDigits,
      concurrency
    });
    
    if (result.success) {
      return {
        ...result,
        retryCount: failedResults.length
      };
    } else {
      return result;
    }
  } catch (error) {
    return {
      success: false,
      error: error.message || '重试下载过程中发生错误'
    };
  }
}
