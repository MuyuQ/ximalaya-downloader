/**
 * @fileoverview 解密模块
 * @description 负责处理喜马拉雅VIP音频URL的解密功能
 * @module core/decryptor
 *
 * @description
 * 喜马拉雅的VIP音频URL使用自定义加密算法进行保护，本模块实现了解密逻辑。
 *
 * 解密流程：
 * 1. Base64 解码
 * 2. 字节映射（使用预设的映射表）
 * 3. CBC 风格 XOR 解密（使用预设的IV）
 * 4. 第二次 XOR 解密（使用预设的常量表）
 * 5. 转换为 UTF-8 字符串
 *
 * @example
 * import { decryptUrl, isUrlEncrypted, decryptUrlIfNeeded } from './core/decryptor.js';
 *
 * // 检查URL是否需要解密
 * if (isUrlEncrypted(url)) {
 *   const decryptedUrl = decryptUrl(url);
 *   console.log('解密后的URL:', decryptedUrl);
 * }
 *
 * // 自动判断并解密
 * const finalUrl = decryptUrlIfNeeded(url);
 */

/**
 * 解密VIP音频URL
 * @description 对加密的音频URL进行解密，返回可直接使用的下载链接
 * @param {string} encryptedUrl - 加密的URL字符串（Base64编码格式）
 * @returns {string} 解密后的完整URL
 *
 * @example
 * const encryptedUrl = '加密的URL字符串';
 * const decryptedUrl = decryptUrl(encryptedUrl);
 * console.log('解密后的URL:', decryptedUrl);
 *
 * @throws {Error} 当加密URL为空或格式错误时抛出错误
 * @throws {Error} 当解密过程失败时抛出错误
 */
export function decryptUrl(encryptedUrl) {
  if (!encryptedUrl || typeof encryptedUrl !== 'string') {
    throw new Error('加密URL不能为空');
  }

  // Buffer 解码不会校验合法性（非法字符被忽略），先显式校验 Base64 格式
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encryptedUrl)) {
    throw new Error('解密失败: 加密URL不是有效的Base64格式');
  }

  try {
    // 第一步：Base64解码
    const base64Decoded = base64Decode(encryptedUrl);

    // 第二步：字节映射
    const mappedBytes = byteMapping(base64Decoded);

    // 第三步：CBC风格XOR解密
    const xorDecrypted = cbcXorDecrypt(mappedBytes);

    // 第四步：第二次XOR解密
    const finalDecrypted = secondXorDecrypt(xorDecrypted);

    // 第五步：转换为UTF-8字符串
    const decryptedUrl = bytesToUtf8(finalDecrypted);

    return decryptedUrl;
  } catch (error) {
    throw new Error(`解密失败: ${error.message}`);
  }
}

/**
 * Base64解码
 * @description 将Base64编码的字符串解码为字节数组
 * @param {string} str - Base64编码的字符串
 * @returns {Array<number>} 解码后的字节数组
 * @private
 *
 * @description
 * 使用 Node.js 原生 Buffer 进行解码，结果为字节数组
 */
function base64Decode(str) {
  return Array.from(Buffer.from(str, 'base64'));
}

/**
 * 字节映射
 * @description 使用预设的映射表对字节进行转换
 * @param {Array<number>} bytes - 输入字节数组
 * @returns {Array<number>} 映射后的字节数组
 * @private
 *
 * @description
 * 映射逻辑：取每个字节的低5位作为索引，从映射表中获取对应值
 * 映射表是喜马拉雅加密算法的关键部分
 */
function byteMapping(bytes) {
  // 定义映射表
  const mappingTable = [
    0x4A, 0x57, 0x4E, 0x43, 0x46, 0x5F, 0x58, 0x41,
    0x56, 0x53, 0x5A, 0x4B, 0x4C, 0x55, 0x4D, 0x52,
    0x50, 0x49, 0x4F, 0x48, 0x45, 0x42, 0x47, 0x44,
    0x51, 0x5E, 0x5B, 0x40, 0x5D, 0x5C, 0x59, 0x44
  ];

  const result = new Array(bytes.length);

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    const index = byte & 0x1F; // 取低5位作为索引
    result[i] = mappingTable[index];
  }

  return result;
}

/**
 * CBC风格XOR解密
 * @param {Array<number>} bytes - 输入字节数组
 * @returns {Array<number>} 解密后的字节数组
 * @private
 */
function cbcXorDecrypt(bytes) {
  // 定义初始化向量(IV)
  const iv = [0x12, 0x34, 0x56, 0x78, 0x90, 0xAB, 0xCD, 0xEF];

  const result = new Array(bytes.length);
  let previousByte = 0;

  for (let i = 0; i < bytes.length; i++) {
    // 使用IV或前一个字节进行XOR
    const xorByte = i < iv.length ? iv[i] : previousByte;
    result[i] = bytes[i] ^ xorByte;
    previousByte = bytes[i];
  }

  return result;
}

/**
 * 第二次XOR解密
 * @param {Array<number>} bytes - 输入字节数组
 * @returns {Array<number>} 解密后的字节数组
 * @private
 */
function secondXorDecrypt(bytes) {
  // 定义常量表
  const constantTable = [
    0x73, 0x8F, 0x73, 0x8F, 0x73, 0x8F, 0x73, 0x8F,
    0x73, 0x8F, 0x73, 0x8F, 0x73, 0x8F, 0x73, 0x8F
  ];

  const result = new Array(bytes.length);

  for (let i = 0; i < bytes.length; i++) {
    const constant = constantTable[i % constantTable.length];
    result[i] = bytes[i] ^ constant;
  }

  return result;
}

/**
 * 字节数组转换为UTF-8字符串
 * @param {Array<number>} bytes - 输入字节数组
 * @returns {string} UTF-8字符串
 * @private
 */
function bytesToUtf8(bytes) {
  return Buffer.from(bytes).toString('utf-8');
}

/**
 * 批量解密URL
 * @param {Array<string>} encryptedUrls - 加密的URL列表
 * @returns {Array<Object>} 解密结果列表
 *
 * @example
 * const encryptedUrls = [
 *   '加密的URL1',
 *   '加密的URL2',
 *   '加密的URL3'
 * ];
 *
 * const results = batchDecryptUrls(encryptedUrls);
 * results.forEach((result, index) => {
 *   if (result.success) {
 *     console.log(`URL${index + 1}解密成功:`, result.decryptedUrl);
 *   } else {
 *     console.error(`URL${index + 1}解密失败:`, result.error);
 *   }
 * });
 */
export function batchDecryptUrls(encryptedUrls) {
  if (!Array.isArray(encryptedUrls)) {
    throw new Error('加密URL列表必须是数组');
  }

  const results = [];

  for (let i = 0; i < encryptedUrls.length; i++) {
    const encryptedUrl = encryptedUrls[i];

    try {
      const decryptedUrl = decryptUrl(encryptedUrl);
      results.push({
        index: i,
        success: true,
        encryptedUrl,
        decryptedUrl
      });
    } catch (error) {
      results.push({
        index: i,
        success: false,
        encryptedUrl,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * 异步批量解密URL
 * @param {Array<string>} encryptedUrls - 加密的URL列表
 * @param {number} [concurrency=5] - 并发数
 * @returns {Promise<Array<Object>>} 解密结果列表
 *
 * @example
 * const encryptedUrls = [
 *   '加密的URL1',
 *   '加密的URL2',
 *   '加密的URL3'
 * ];
 *
 * const results = await batchDecryptUrlsAsync(encryptedUrls, 3);
 * results.forEach((result, index) => {
 *   if (result.success) {
 *     console.log(`URL${index + 1}解密成功:`, result.decryptedUrl);
 *   } else {
 *     console.error(`URL${index + 1}解密失败:`, result.error);
 *   }
 * });
 */
export async function batchDecryptUrlsAsync(encryptedUrls, concurrency = 5) {
  if (!Array.isArray(encryptedUrls)) {
    throw new Error('加密URL列表必须是数组');
  }

  if (typeof concurrency !== 'number' || concurrency <= 0) {
    concurrency = 5;
  }

  const results = new Array(encryptedUrls.length);
  const queue = [...encryptedUrls];
  const activeTasks = new Set();

  // 处理解密完成
  const handleDecryptComplete = (index, result) => {
    results[index] = result;
    activeTasks.delete(index);

    // 处理队列中的下一个URL
    if (queue.length > 0) {
      const nextIndex = encryptedUrls.length - queue.length;
      const nextUrl = queue.shift();
      activeTasks.add(nextIndex);
      decryptSingleUrl(nextIndex, nextUrl);
    }
  };

  // 解密单个URL
  const decryptSingleUrl = (index, encryptedUrl) => {
    try {
      const decryptedUrl = decryptUrl(encryptedUrl);
      handleDecryptComplete(index, {
        index,
        success: true,
        encryptedUrl,
        decryptedUrl
      });
    } catch (error) {
      handleDecryptComplete(index, {
        index,
        success: false,
        encryptedUrl,
        error: error.message
      });
    }
  };

  // 启动初始解密任务
  const initialCount = Math.min(concurrency, encryptedUrls.length);
  for (let i = 0; i < initialCount; i++) {
    const url = queue.shift();
    activeTasks.add(i);
    decryptSingleUrl(i, url);
  }

  // 等待所有解密完成
  while (activeTasks.size > 0) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  return results;
}

/**
 * 检查URL是否需要解密
 * @param {string} url - URL字符串
 * @returns {boolean} 是否需要解密
 *
 * @example
 * const url1 = 'https://example.com/audio.mp3';
 * const url2 = '加密的URL字符串';
 *
 * console.log(isUrlEncrypted(url1)); // false
 * console.log(isUrlEncrypted(url2)); // true
 */
export function isUrlEncrypted(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // 检查URL是否以http开头
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return false;
  }

  // 检查URL是否包含Base64字符
  const base64Pattern = /^[A-Za-z0-9+/]+={0,2}$/;
  return base64Pattern.test(url);
}

/**
 * 解密URL（如果需要）
 * @param {string} url - URL字符串
 * @returns {string} 解密后的URL
 *
 * @example
 * const url1 = 'https://example.com/audio.mp3';
 * const url2 = '加密的URL字符串';
 *
 * console.log(decryptUrlIfNeeded(url1)); // https://example.com/audio.mp3
 * console.log(decryptUrlIfNeeded(url2)); // 解密后的URL
 */
export function decryptUrlIfNeeded(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL不能为空');
  }

  if (isUrlEncrypted(url)) {
    return decryptUrl(url);
  } else {
    return url;
  }
}
