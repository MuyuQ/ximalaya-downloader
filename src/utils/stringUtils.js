/**
 * @fileoverview 字符串处理工具模块
 * @description 提供字符串处理相关的工具函数，包括文件名清理、格式化、命名转换等
 * @module utils/stringUtils
 *
 * @description
 * 本模块提供常用的字符串处理功能：
 * - 文件名非法字符替换
 * - 时间格式化
 * - 文件大小格式化
 * - 命名风格转换（驼峰、短横线、下划线）
 * - URL解析
 *
 * @example
 * import {
 *   replaceInvalidChars,
 *   formatTime,
 *   formatFileSize,
 *   truncateString
 * } from './utils/stringUtils.js';
 *
 * // 替换非法字符
 * const safeName = replaceInvalidChars('音频: "测试".mp3');
 * // 结果: 音频__测试_.mp3
 *
 * // 格式化时间
 * const time = formatTime(125); // "02:05"
 *
 * // 格式化文件大小
 * const size = formatFileSize(1048576); // "1 MB"
 */

/**
 * 替换文件名中的非法字符
 * @description 移除或替换Windows和Linux/macOS文件系统不允许的字符
 * @param {string} filename - 原始文件名
 * @param {string} [replacement='_'] - 用于替换非法字符的字符串，默认为下划线
 * @returns {string} 清理后的安全文件名
 *
 * @description
 * 处理规则：
 * - 替换 <>:"/\\|?* 等非法字符
 * - 替换控制字符（\x00-\x1f）
 * - 移除开头和结尾的空格和点
 * - 如果结果为空，返回 'untitled'
 *
 * @example
 * const cleanName = replaceInvalidChars('音频: "测试".mp3');
 * console.log(cleanName); // 输出: 音频__测试_.mp3
 *
 * const cleanName2 = replaceInvalidChars('file/name?.txt', '-');
 * console.log(cleanName2); // 输出: file-name-.txt
 */
export function replaceInvalidChars(filename, replacement = '_') {
  if (typeof filename !== 'string') {
    return '';
  }

  // Windows和Linux/macOS都不允许的字符
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/g;

  // 替换非法字符
  let cleaned = filename.replace(invalidChars, replacement);

  // 移除文件名开头和结尾的空格和点
  cleaned = cleaned.replace(/^[ .]+|[ .]+$/g, '');

  // 确保文件名不为空
  if (!cleaned) {
    cleaned = 'untitled';
  }

  return cleaned;
}

/**
 * 格式化时间（秒转换为分:秒格式）
 * @param {number} seconds - 秒数
 * @param {boolean} [showHours=false] - 是否显示小时
 * @returns {string} 格式化后的时间字符串
 *
 * @example
 * const time1 = formatTime(125); // "2:05"
 * const time2 = formatTime(3665, true); // "1:01:05"
 */
export function formatTime(seconds, showHours = false) {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
    return '00:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (showHours || hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @param {number} [decimals=2] - 小数位数
 * @returns {string} 格式化后的文件大小字符串
 *
 * @example
 * const size1 = formatFileSize(1024); // "1 KB"
 * const size2 = formatFileSize(1048576); // "1 MB"
 * const size3 = formatFileSize(1234567, 3); // "1.177 MB"
 */
export function formatFileSize(bytes, decimals = 2) {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes < 0) {
    return '0 B';
  }
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  const value = (bytes / Math.pow(k, i)).toFixed(dm);
  return `${value} ${sizes[i]}`;
}

/**
 * 生成随机字符串
 * @param {number} [length=8] - 字符串长度
 * @param {string} [charset='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'] - 字符集
 * @returns {string} 随机字符串
 *
 * @example
 * const randomStr1 = generateRandomString(); // 8位随机字符串
 * const randomStr2 = generateRandomString(16); // 16位随机字符串
 * const randomStr3 = generateRandomString(6, '0123456789'); // 6位随机数字
 */
export function generateRandomString(length = 8, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
  if (typeof length !== 'number' || length <= 0) {
    length = 8;
  }

  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

/**
 * 截断字符串并添加省略号
 * @param {string} str - 原始字符串
 * @param {number} [maxLength=50] - 最大长度
 * @param {string} [suffix='...'] - 后缀
 * @returns {string} 截断后的字符串
 *
 * @example
 * const truncated1 = truncateString('这是一个很长的字符串', 10); // "这是一个很..."
 * const truncated2 = truncateString('Short', 10); // "Short"
 */
export function truncateString(str, maxLength = 50, suffix = '...') {
  if (typeof str !== 'string') {
    return '';
  }

  if (str.length <= maxLength) {
    return str;
  }

  return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * 首字母大写
 * @param {string} str - 原始字符串
 * @returns {string} 首字母大写的字符串
 *
 * @example
 * const capitalized = capitalize('hello world'); // "Hello world"
 */
export function capitalize(str) {
  if (typeof str !== 'string' || str.length === 0) {
    return '';
  }

  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * 驼峰命名转换
 * @param {string} str - 原始字符串
 * @returns {string} 驼峰命名的字符串
 *
 * @example
 * const camelCase1 = toCamelCase('hello_world'); // "helloWorld"
 * const camelCase2 = toCamelCase('hello-world'); // "helloWorld"
 * const camelCase3 = toCamelCase('Hello World'); // "helloWorld"
 * const camelCase4 = toCamelCase('hello.world'); // "helloWorld"
 */
export function toCamelCase(str) {
  if (typeof str !== 'string') {
    return '';
  }

  return str
    .replace(/[\s_.-]+/g, ' ')
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, '');
}

/**
 * 短横线命名转换
 * @param {string} str - 原始字符串
 * @returns {string} 短横线命名的字符串
 *
 * @example
 * const kebabCase1 = toKebabCase('helloWorld'); // "hello-world"
 * const kebabCase2 = toKebabCase('Hello World'); // "hello-world"
 * const kebabCase3 = toKebabCase('hello_world'); // "hello-world"
 * const kebabCase4 = toKebabCase('hello.world'); // "hello-world"
 */
export function toKebabCase(str) {
  if (typeof str !== 'string') {
    return '';
  }

  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_.]+/g, '-')
    .toLowerCase();
}

/**
 * 下划线命名转换
 * @param {string} str - 原始字符串
 * @returns {string} 下划线命名的字符串
 *
 * @example
 * const snakeCase1 = toSnakeCase('helloWorld'); // "hello_world"
 * const snakeCase2 = toSnakeCase('Hello World'); // "hello_world"
 * const snakeCase3 = toSnakeCase('hello-world'); // "hello_world"
 * const snakeCase4 = toSnakeCase('hello.world'); // "hello_world"
 */
export function toSnakeCase(str) {
  if (typeof str !== 'string') {
    return '';
  }

  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s_.-]+/g, '_')
    .toLowerCase();
}

/**
 * 检查字符串是否为空或只包含空白字符
 * @param {string} str - 要检查的字符串
 * @returns {boolean} 是否为空或只包含空白字符
 *
 * @example
 * const isEmpty1 = isEmptyOrWhitespace(''); // true
 * const isEmpty2 = isEmptyOrWhitespace('   '); // true
 * const isEmpty3 = isEmptyOrWhitespace('hello'); // false
 */
export function isEmptyOrWhitespace(str) {
  return typeof str !== 'string' || str.trim().length === 0;
}

/**
 * 从URL中提取文件名
 * @param {string} url - URL字符串
 * @returns {string} 文件名
 *
 * @example
 * const filename = extractFilenameFromUrl('https://example.com/path/to/file.mp3?param=value');
 * console.log(filename); // "file.mp3"
 */
export function extractFilenameFromUrl(url) {
  if (typeof url !== 'string') {
    return '';
  }

  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.substring(pathname.lastIndexOf('/') + 1);

    // 移除查询参数
    return filename.split('?')[0];
  } catch {
    // 如果URL解析失败，尝试简单提取
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1];
    return lastPart.split('?')[0];
  }
}

/**
 * 获取文件扩展名
 * @description 从文件名中提取扩展名部分（包含点）
 * @param {string} filename - 文件名
 * @returns {string} 文件扩展名（包含点）
 *
 * @example
 * const ext1 = getFileExtension('file.mp3'); // ".mp3"
 * const ext2 = getFileExtension('archive.tar.gz'); // ".gz"
 * const ext3 = getFileExtension('noextension'); // ""
 */
export function getFileExtension(filename) {
  if (typeof filename !== 'string') {
    return '';
  }
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
    return '';
  }
  return filename.substring(lastDotIndex);  // 返回包含点的扩展名
}

/**
 * 移除文件扩展名
 * @description 从文件名中移除扩展名部分
 * @param {string} filename - 文件名
 * @returns {string} 不包含扩展名的文件名
 *
 * @example
 * const name1 = removeFileExtension('file.mp3'); // "file"
 * const name2 = removeFileExtension('archive.tar.gz'); // "archive.tar"
 * const name3 = removeFileExtension('noextension'); // "noextension"
 */
export function removeFileExtension(filename) {
  if (typeof filename !== 'string') {
    return '';
  }
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return filename;
  }
  return filename.substring(0, lastDotIndex);
}
