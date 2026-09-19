/**
 * @fileoverview 文件操作工具模块
 * @description 提供文件和目录操作相关的工具函数，基于Node.js fs模块
 * @module utils/fileUtils
 *
 * @description
 * 本模块封装了常用的文件系统操作，包括：
 * - 文件存在检查
 * - 目录创建
 * - 文件读写
 * - 文件名处理
 * - 路径操作
 *
 * 所有函数都返回Promise，支持async/await语法。
 *
 * @example
 * import {
 *   fileExists,
 *   createDirectory,
 *   readFile,
 *   writeFile,
 *   generateSafeFilename
 * } from './utils/fileUtils.js';
 *
 * // 检查文件是否存在
 * const exists = await fileExists('./config.json');
 *
 * // 创建目录
 * await createDirectory('./downloads');
 *
 * // 生成安全的文件名
 * const safeName = generateSafeFilename('音频: "测试".mp3');
 * // 结果: 音频_ _测试_.mp3
 */

import fs from 'fs';
import path from 'path';

/**
 * 检查文件是否存在
 * @description 检查指定路径的文件或目录是否存在
 * @param {string} filePath - 文件或目录的路径
 * @returns {Promise<boolean>} 存在返回true，不存在返回false
 *
 * @example
 * const exists = await fileExists('./config.json');
 * if (exists) {
 *   console.log('配置文件存在');
 * }
 */
export async function fileExists(filePath) {
  if (typeof filePath !== 'string' || !filePath) {
    return false;
  }
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 创建目录
 * @param {string} dirPath - 目录路径
 * @returns {Promise<boolean>} 是否成功创建
 */
export async function createDirectory(dirPath) {
  if (typeof dirPath !== 'string' || !dirPath) {
    return false;
  }
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
    return true;
  } catch (error) {
    console.error(`创建目录失败: ${error.message}`);
    return false;
  }
}

/**
 * 获取文件大小
 * @param {string} filePath - 文件路径
 * @returns {Promise<number>} 文件大小（字节）
 */
export async function getFileSize(filePath) {
  if (typeof filePath !== 'string' || !filePath) {
    return 0;
  }
  try {
    const stat = await fs.promises.stat(filePath);
    return stat.size;
  } catch {
    return 0;
  }
}

/**
 * 生成安全的文件名
 * @param {string} filename - 原始文件名
 * @returns {string} 安全的文件名
 */
export function generateSafeFilename(filename) {
  if (typeof filename !== 'string') {
    return '';
  }
  // 替换 Windows 和 Unix 不允许的字符
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200); // 限制长度
}

/**
 * 生成带序号的文件名
 * @param {string} name - 基础文件名
 * @param {string} ext - 扩展名
 * @param {number} number - 序号
 * @returns {string} 带序号的文件名
 */
export function generateNumberedFilename(name, ext, number) {
  const safeName = typeof name === 'string' ? name : 'file';
  const safeExt = typeof ext === 'string' ? ext : '';
  const safeNum = typeof number === 'number' ? number : 0;
  const paddedNum = String(safeNum).padStart(2, '0');
  return `${paddedNum} ${safeName}${safeExt}`;
}

/**
 * 获取文件扩展名
 * @param {string} filename - 文件名
 * @returns {string} 文件扩展名
 */
export function getFileExtension(filename) {
  if (typeof filename !== 'string') {
    return '';
  }
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.slice(lastDot) : '';
}

/**
 * 组合路径
 * @param {...string} parts - 路径部分
 * @returns {string} 组合后的路径
 */
export function joinPath(...parts) {
  return path.join(...parts);
}

/**
 * 读取文件内容
 * @param {string} filePath - 文件路径
 * @returns {Promise<string|null>} 文件内容
 */
export async function readFile(filePath) {
  if (typeof filePath !== 'string' || !filePath) {
    return null;
  }
  try {
    return await fs.promises.readFile(filePath, 'utf-8');
  } catch (error) {
    console.error(`读取文件失败: ${error.message}`);
    return null;
  }
}

/**
 * 写入文件
 * @param {string} filePath - 文件路径
 * @param {string|Buffer} content - 内容
 * @returns {Promise<boolean>} 是否成功
 */
export async function writeFile(filePath, content) {
  if (typeof filePath !== 'string' || !filePath) {
    return false;
  }
  try {
    // 确保目录存在
    const dir = path.dirname(filePath);
    await createDirectory(dir);
    await fs.promises.writeFile(filePath, content);
    return true;
  } catch (error) {
    console.error(`写入文件失败: ${error.message}`);
    return false;
  }
}

/**
 * 删除文件
 * @param {string} filePath - 文件路径
 * @returns {Promise<boolean>} 是否成功
 */
export async function deleteFile(filePath) {
  try {
    await fs.promises.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}
