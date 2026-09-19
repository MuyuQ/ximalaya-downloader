/**
 * @fileoverview 配置管理模块
 * @description 负责处理用户配置的读取、验证、保存和导入导出功能
 * @module core/configManager
 *
 * @description
 * 本模块提供完整的配置管理功能，包括：
 * - 配置文件的读取和写入
 * - 配置项的验证和更新
 * - 配置的导入和导出
 * - 默认配置的管理
 *
 * 配置文件存储在项目根目录的 config.json 文件中，首次运行时会自动创建。
 *
 * @example
 * // 读取配置
 * import { readConfig } from './core/configManager.js';
 * const config = await readConfig();
 * console.log(config.path); // 输出下载路径
 *
 * @example
 * // 更新配置
 * import { updateConfig } from './core/configManager.js';
 * await updateConfig({ path: './my-downloads' });
 */

import { fileExists, readFile, writeFile, joinPath } from '../utils/fileUtils.js';
import { encryptCookie, decryptCookie, isEncryptedCookie, getEncryptionKey } from '../utils/crypto.js';

/**
 * 默认配置对象
 * @type {Object}
 * @private
 * @description 包含所有配置项的默认值，当配置文件不存在或配置项缺失时使用
 *
 * @property {string} cookie - 用户认证 Cookie，用于访问需要登录的接口
 * @property {string} path - 默认下载目录路径
 * @property {string} bid - 用户标识，用于生成 xm-sign 签名
 * @property {string} quality - 默认音频质量，可选值: 'low', 'medium', 'high'
 * @property {boolean} addSequenceNumber - 是否在文件名中添加序号
 * @property {number} maxRetries - 下载失败时的最大重试次数
 * @property {number} retryDelay - 重试之间的延迟时间（毫秒）
 * @property {number} concurrentDownloads - 并发下载数量限制
 * @property {string} userAgent - HTTP 请求使用的 User-Agent
 */
const DEFAULT_CONFIG = {
  cookie: '',
  path: './downloads',
  bid: '',
  quality: 'high',
  addSequenceNumber: true,
  maxRetries: 3,
  retryDelay: 1000,
  concurrentDownloads: 3,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

/**
 * 配置文件路径
 * @type {string}
 * @private
 * @description 配置文件存储位置的相对路径，默认为当前目录下的 config.json
 */
const CONFIG_FILE_PATH = './config.json';

/**
 * 读取配置文件
 * @description 从 config.json 文件读取配置，如果文件不存在则创建默认配置
 * @returns {Promise<Object>} 配置对象，包含所有配置项
 *
 * @example
 * const config = await readConfig();
 * console.log('下载路径:', config.path);
 * console.log('音频质量:', config.quality);
 *
 * @throws {Error} 当读取文件失败时返回默认配置
 */
export async function readConfig() {
  try {
    if (!(await fileExists(CONFIG_FILE_PATH))) {
      await writeConfig(DEFAULT_CONFIG);
      return { ...DEFAULT_CONFIG };
    }

    const configData = await readFile(CONFIG_FILE_PATH);
    const config = JSON.parse(configData);
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    if (isEncryptedCookie(mergedConfig.cookie)) {
      try {
        const key = await getEncryptionKey();
        mergedConfig.cookie = decryptCookie(mergedConfig.cookie, key);
      } catch (decryptError) {
        console.warn('解密Cookie失败，可能使用了错误的密钥:', decryptError.message);
        mergedConfig.cookie = '';
      }
    }

    const validatedConfig = validateConfig(mergedConfig);
    return validatedConfig;
  } catch (error) {
    console.error('读取配置文件失败:', error.message);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * 写入配置文件
 * @description 将配置对象保存到 config.json 文件中
 * @param {Object} config - 要保存的配置对象
 * @returns {Promise<boolean>} 保存成功返回 true，失败返回 false
 *
 * @example
 * const newConfig = {
 *   cookie: '新的cookie',
 *   path: './my-downloads',
 *   quality: 'high'
 * };
 *
 * const success = await writeConfig(newConfig);
 * if (success) {
 *   console.log('配置保存成功');
 * } else {
 *   console.error('配置保存失败');
 * }
 */
export async function writeConfig(config) {
  try {
    const validatedConfig = validateConfig(config);

    if (validatedConfig.cookie && !isEncryptedCookie(validatedConfig.cookie)) {
      const key = await getEncryptionKey();
      validatedConfig.cookie = encryptCookie(validatedConfig.cookie, key);
    }

    const configData = JSON.stringify(validatedConfig, null, 2);
    await writeFile(CONFIG_FILE_PATH, configData);

    return true;
  } catch (error) {
    console.error('写入配置文件失败:', error.message);
    return false;
  }
}

/**
 * 更新配置
 * @description 合并新的配置项到当前配置中并保存
 * @param {Object} updates - 要更新的配置项键值对
 * @returns {Promise<Object>} 更新后的完整配置对象
 *
 * @example
 * // 仅更新下载路径
 * const updatedConfig = await updateConfig({
 *   path: './new-downloads'
 * });
 *
 * // 更新多个配置项
 * const newConfig = await updateConfig({
 *   path: './new-downloads',
 *   quality: 'medium',
 *   concurrentDownloads: 5
 * });
 * console.log('更新后的配置:', newConfig);
 *
 * @throws {Error} 当更新或保存配置失败时抛出错误
 */
export async function updateConfig(updates) {
  try {
    // 读取当前配置
    const currentConfig = await readConfig();

    // 合并更新
    const newConfig = { ...currentConfig, ...updates };

    // 验证并写入配置
    const validatedConfig = validateConfig(newConfig);
    await writeConfig(validatedConfig);

    return validatedConfig;
  } catch (error) {
    console.error('更新配置失败:', error.message);
    throw error;
  }
}

/**
 * 验证配置
 * @param {Object} config - 配置对象
 * @returns {Object} 验证后的配置
 * @throws {Error} 配置验证失败时抛出错误
 */
export function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('配置必须是对象');
  }

  const validatedConfig = { ...config };
  const errors = [];

  if (typeof validatedConfig.cookie !== 'string') {
    validatedConfig.cookie = '';
  }
  if (typeof validatedConfig.path !== 'string' || validatedConfig.path.trim() === '') {
    validatedConfig.path = DEFAULT_CONFIG.path;
    errors.push('path');
  }
  if (typeof validatedConfig.bid !== 'string') {
    validatedConfig.bid = '';
  }
  const validQualities = ['low', 'medium', 'high'];
  if (!validQualities.includes(validatedConfig.quality)) {
    validatedConfig.quality = DEFAULT_CONFIG.quality;
    errors.push('quality');
  }
  if (typeof validatedConfig.addSequenceNumber !== 'boolean') {
    validatedConfig.addSequenceNumber = DEFAULT_CONFIG.addSequenceNumber;
  }
  if (typeof validatedConfig.maxRetries !== 'number' || validatedConfig.maxRetries < 0) {
    validatedConfig.maxRetries = DEFAULT_CONFIG.maxRetries;
    errors.push('maxRetries');
  }
  if (typeof validatedConfig.retryDelay !== 'number' || validatedConfig.retryDelay < 0) {
    validatedConfig.retryDelay = DEFAULT_CONFIG.retryDelay;
    errors.push('retryDelay');
  }
  if (typeof validatedConfig.concurrentDownloads !== 'number' || validatedConfig.concurrentDownloads < 1) {
    validatedConfig.concurrentDownloads = DEFAULT_CONFIG.concurrentDownloads;
    errors.push('concurrentDownloads');
  }
  if (typeof validatedConfig.userAgent !== 'string' || validatedConfig.userAgent.trim() === '') {
    validatedConfig.userAgent = DEFAULT_CONFIG.userAgent;
    errors.push('userAgent');
  }

  validatedConfig.isValid = errors.length === 0;
  validatedConfig.errors = errors;
  return validatedConfig;
}

/**
 * 检查配置是否有效
 * @description 验证配置的各项设置是否正确，包括凭证有效性和路径可写性
 * @param {Object} config - 配置对象
 * @returns {Promise<Object>} 检查结果对象
 *
 * @returns {Object} 返回对象包含以下属性：
 * @returns {boolean} returns.valid - 配置是否完全有效
 * @returns {boolean} returns.needLogin - 是否需要登录（cookie无效）
 * @returns {string} [returns.username] - 用户名（仅有效时）
 * @returns {string} [returns.error] - 错误信息（仅无效时）
 * @returns {Array<string>} returns.errors - 错误字段列表
 *
 * @example
 * const config = await readConfig();
 * const result = await checkConfig(config);
 *
 * if (result.valid) {
 *   console.log('配置有效');
 *   console.log('用户名:', result.username);
 * } else {
 *   console.error('配置无效:', result.error);
 * }
 */
export async function checkConfig(config) {
  try {
    // 验证配置格式
    const validatedConfig = validateConfig(config);

    // 检查cookie和bid是否有效
    if (!validatedConfig.cookie || !validatedConfig.bid) {
      return { valid: false, needLogin: true, error: 'cookie和bid不能为空，请先登录', errors: ['cookie', 'bid'] };
    }

    // 这里可以添加更多的验证逻辑，例如：
    // 1. 尝试使用cookie和bid获取用户信息
    // 2. 检查网络连接
    // 3. 验证下载路径是否可写

    // 模拟验证过程
    // 在实际应用中，这里应该调用API验证cookie和bid的有效性
    const isValid = await validateCredentials(validatedConfig.cookie, validatedConfig.bid);

    if (!isValid) {
      return { valid: false, needLogin: true, error: 'cookie或bid无效，请重新登录', errors: ['cookie', 'bid'] };
    }

    // 检查下载路径
    const pathValid = await validateDownloadPath(validatedConfig.path);

    if (!pathValid) {
      return { valid: false, needLogin: false, error: '下载路径无效或不可写', errors: ['path'] };
    }

    // 获取用户名
    const username = await getUsername(validatedConfig.cookie, validatedConfig.bid);

    return { valid: true, needLogin: false, username: username || '未知用户', errors: [] };
  } catch (error) {
    return { valid: false, needLogin: false, error: error.message, errors: ['unknown'] };
  }
}

/**
 * 验证凭据
 * @description 验证 Cookie 和 BID 是否有效
 * @param {string} cookie - Cookie字符串
 * @param {string} bid - BID字符串
 * @returns {Promise<boolean>} 是否有效
 * @private
 *
 * @description
 * 当前实现为简化版本，仅检查字符串长度。
 * 在生产环境中，应该调用喜马拉雅 API 进行真实验证。
 *
 * 改进建议：
 * - 调用 /revision/user/v1/getUserInfo 接口验证
 * - 检查返回的用户信息是否有效
 */
async function validateCredentials(cookie, bid) {
  // 简化验证：检查 Cookie 和 BID 是否有足够长度
  // 实际生产环境应调用 API 进行验证
  if (!cookie || !bid) {
    return false;
  }

  // 基本格式检查
  // Cookie 通常包含多个键值对，长度应大于 10
  // BID 通常是 32 位的字符串，长度应大于 5
  return cookie.length > 10 && bid.length > 5;
}

/**
 * 验证下载路径
 * @description 检查下载路径是否有效且可写
 * @param {string} downloadPath - 下载路径
 * @returns {Promise<boolean>} 是否有效
 * @private
 *
 * @description
 * 当前实现仅做基本检查，始终返回 true。
 * 在生产环境中，应该检查：
 * - 路径是否存在（不存在则创建）
 * - 路径是否有写入权限
 * - 磁盘空间是否充足
 */
async function validateDownloadPath(downloadPath) {
  try {
    // 基本格式检查
    if (!downloadPath || typeof downloadPath !== 'string') {
      return false;
    }

    // 生产环境应进行以下检查：
    // 1. 检查路径是否存在，不存在则尝试创建
    // 2. 检查写入权限
    // 3. 检查磁盘空间

    return true;
  } catch (error) {
    console.error('验证下载路径失败:', error.message);
    return false;
  }
}

/**
 * 获取用户名
 * @description 通过 Cookie 和 BID 获取当前登录用户的用户名
 * @param {string} cookie - Cookie字符串
 * @param {string} bid - BID字符串
 * @returns {Promise<string|null>} 用户名，获取失败返回 null
 * @private
 *
 * @description
 * 当前实现返回模拟用户名。
 * 在生产环境中，应该调用喜马拉雅 API 获取真实用户信息。
 *
 * 改进建议：
 * - 调用 /revision/user/v1/getUserInfo 接口
 * - 从返回数据中提取 nickname 或 mobile 字段
 */
async function getUsername(cookie, bid) {
  try {
    // 基本参数检查
    if (!cookie || !bid) {
      return null;
    }

    // 生产环境应调用 API 获取真实用户名：
    // const response = await httpRequest(
    //   'https://www.ximalaya.com/revision/user/v1/getUserInfo',
    //   { headers: { Cookie: cookie, 'xm-bid': bid } }
    // );
    // return response.data?.nickname || response.data?.mobile || null;

    // 当前返回占位用户名
    return '测试用户';
  } catch (error) {
    console.error('获取用户名失败:', error.message);
    return null;
  }
}

/**
 * 重置配置为默认值
 * @returns {Promise<Object>} 默认配置
 *
 * @example
 * const defaultConfig = await resetConfig();
 * console.log('配置已重置为默认值:', defaultConfig);
 */
export async function resetConfig() {
  try {
    await writeConfig(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  } catch (error) {
    console.error('重置配置失败:', error.message);
    throw error;
  }
}

/**
 * 获取配置文件路径
 * @returns {string} 配置文件路径
 *
 * @example
 * const configPath = getConfigFilePath();
 * console.log('配置文件路径:', configPath);
 */
export function getConfigFilePath() {
  return CONFIG_FILE_PATH;
}

/**
 * 获取默认配置
 * @returns {Object} 默认配置
 *
 * @example
 * const defaultConfig = getDefaultConfig();
 * console.log('默认下载路径:', defaultConfig.path);
 */
export function getDefaultConfig() {
  return { ...DEFAULT_CONFIG };
}

/**
 * 导出配置
 * @param {string} filePath - 导出文件路径
 * @returns {Promise<boolean>} 是否成功
 *
 * @example
 * const success = await exportConfig('./my-config.json');
 * if (success) {
 *   console.log('配置导出成功');
 * } else {
 *   console.error('配置导出失败');
 * }
 */
export async function exportConfig(filePath) {
  try {
    const config = await readConfig();
    const configData = JSON.stringify(config, null, 2);
    await writeFile(filePath, configData);
    return true;
  } catch (error) {
    console.error('导出配置失败:', error.message);
    return false;
  }
}

/**
 * 导入配置
 * @param {string} filePath - 导入文件路径
 * @param {boolean} [merge=false] - 是否与当前配置合并
 * @returns {Promise<Object>} 导入后的配置
 *
 * @example
 * // 完全替换当前配置
 * const newConfig = await importConfig('./my-config.json');
 *
 * // 与当前配置合并
 * const mergedConfig = await importConfig('./my-config.json', true);
 */
export async function importConfig(filePath, merge = false) {
  try {
    // 检查文件是否存在
    if (!(await fileExists(filePath))) {
      throw new Error('配置文件不存在');
    }

    // 读取配置文件
    const configData = await readFile(filePath);
    const importedConfig = JSON.parse(configData);

    // 验证导入的配置
    const validatedConfig = validateConfig(importedConfig);

    if (merge) {
      // 与当前配置合并
      const currentConfig = await readConfig();
      const mergedConfig = { ...currentConfig, ...validatedConfig };
      await writeConfig(mergedConfig);
      return mergedConfig;
    } else {
      // 完全替换当前配置
      await writeConfig(validatedConfig);
      return validatedConfig;
    }
  } catch (error) {
    console.error('导入配置失败:', error.message);
    throw error;
  }
}
