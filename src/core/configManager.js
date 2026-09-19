/**
 * @fileoverview 配置管理模块
 * @description 负责处理用户配置的读取、验证、保存和导入导出功能
 * @module core/configManager
 *
 * @description
 * 本模块提供完整的配置管理功能，包括：
 * - 配置文件的读取和写入（Cookie 使用 AES-256-GCM 加密存储）
 * - 配置项的验证和更新
 * - 凭证在线校验（通过 API 获取真实用户名）
 * - 下载路径可写性校验（自动创建缺失目录）
 * - 配置的导入和导出
 *
 * 配置文件默认存储在当前工作目录的 config.json，可通过环境变量
 * XIMALAYA_CONFIG_PATH 覆盖（便于测试与自定义位置）。首次运行时自动创建。
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

import { fileExists, readFile, writeFile, ensureWritableDirectory } from '../utils/fileUtils.js';
import { encryptCookie, decryptCookie, isEncryptedCookie, getEncryptionKey } from '../utils/crypto.js';
import { validateCredentials } from './api.js';

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
 */
const DEFAULT_CONFIG = {
  cookie: '',
  path: './downloads',
  bid: '',
  quality: 'high',
  addSequenceNumber: true,
  maxRetries: 3,
  retryDelay: 1000,
  concurrentDownloads: 3
};

/**
 * 配置文件路径
 * @type {string}
 * @private
 * @description 可通过环境变量 XIMALAYA_CONFIG_PATH 覆盖
 */
const CONFIG_FILE_PATH = process.env.XIMALAYA_CONFIG_PATH || './config.json';

/**
 * 读取配置文件
 * @description 从配置文件读取配置，如果文件不存在则创建默认配置。
 *   存储的加密 Cookie 会自动解密；解密失败时保留原始密文并标记
 *   cookieDecryptFailed（不再静默清空，提示用户重新登录）。
 * @returns {Promise<Object>} 配置对象，包含所有配置项
 *
 * @example
 * const config = await readConfig();
 * console.log('下载路径:', config.path);
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
        mergedConfig.cookieDecryptFailed = false;
      } catch {
        // 解密失败（通常是密钥文件丢失）：保留密文并明确标记，
        // 让 checkConfig 给出"请重新登录"的清晰提示，而不是静默清空
        console.warn('Cookie 解密失败（密钥文件可能已丢失），请重新登录');
        mergedConfig.cookieDecryptFailed = true;
      }
    } else {
      mergedConfig.cookieDecryptFailed = false;
    }

    delete mergedConfig.isValid;
    delete mergedConfig.errors;
    return validateConfig(mergedConfig);
  } catch (error) {
    console.error('读取配置文件失败:', error.message);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * 写入配置文件
 * @description 将配置对象保存到配置文件中，Cookie 自动加密。
 * @param {Object} config - 要保存的配置对象
 * @returns {Promise<boolean>} 保存成功返回 true，失败返回 false
 *
 * @example
 * const success = await writeConfig({
 *   cookie: '新的cookie',
 *   path: './my-downloads',
 *   quality: 'high'
 * });
 */
export async function writeConfig(config) {
  try {
    const validatedConfig = validateConfig(config);

    if (validatedConfig.cookie && !isEncryptedCookie(validatedConfig.cookie)) {
      const key = await getEncryptionKey();
      validatedConfig.cookie = encryptCookie(validatedConfig.cookie, key);
    }

    // 内部标记不落盘
    const { cookieDecryptFailed, ...persistConfig } = validatedConfig;
    void cookieDecryptFailed;

    const configData = JSON.stringify(persistConfig, null, 2);
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
 * const updatedConfig = await updateConfig({ path: './new-downloads' });
 *
 * // 更新多个配置项
 * await updateConfig({ quality: 'medium', concurrentDownloads: 5 });
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
 * 验证配置（本地格式校验，不访问网络）
 * @param {Object} config - 配置对象
 * @returns {Object} 验证后的配置
 * @throws {Error} 配置不是对象时抛出错误
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

  validatedConfig.cookieDecryptFailed = Boolean(validatedConfig.cookieDecryptFailed);
  return validatedConfig;
}

/**
 * 检查配置是否有效
 * @description 验证配置格式、下载路径可写性，并在线校验凭证有效性（获取真实用户名）。
 * @param {Object} config - 配置对象
 * @param {Object} [options] - 检查选项
 * @param {boolean} [options.verifyOnline=true] - 是否在线校验凭证（离线环境可关闭）
 * @returns {Promise<Object>} 检查结果对象
 *
 * @returns {Object} 返回对象包含以下属性：
 * @returns {boolean} returns.valid - 配置是否完全有效
 * @returns {boolean} returns.needLogin - 是否需要登录（cookie无效）
 * @returns {string} [returns.username] - 用户名（仅有效时）
 * @returns {string} [returns.error] - 错误信息（仅无效时）
 *
 * @example
 * const config = await readConfig();
 * const result = await checkConfig(config);
 *
 * if (result.valid) {
 *   console.log('当前用户:', result.username);
 * } else {
 *   console.error('配置无效:', result.error);
 * }
 */
export async function checkConfig(config, { verifyOnline = true } = {}) {
  try {
    const validatedConfig = validateConfig(config);

    if (validatedConfig.cookieDecryptFailed) {
      return {
        valid: false,
        needLogin: true,
        error: '加密密钥丢失，无法解密已保存的 Cookie，请重新登录'
      };
    }

    if (!validatedConfig.cookie || !validatedConfig.bid) {
      return { valid: false, needLogin: true, error: '尚未登录，请先登录账号' };
    }

    if (verifyOnline) {
      const credentialCheck = await validateCredentials(validatedConfig.cookie, validatedConfig.bid);
      if (!credentialCheck.valid) {
        return { valid: false, needLogin: true, error: '登录凭证已失效，请重新登录' };
      }

      const pathValid = await ensureWritableDirectory(validatedConfig.path);
      if (!pathValid) {
        return { valid: false, needLogin: false, error: '下载路径无效或不可写' };
      }

      return { valid: true, needLogin: false, username: credentialCheck.username };
    }

    return { valid: true, needLogin: false, username: '已登录' };
  } catch (error) {
    return { valid: false, needLogin: false, error: error.message };
  }
}

/**
 * 重置配置为默认值
 * @returns {Promise<Object>} 默认配置
 *
 * @example
 * const defaultConfig = await resetConfig();
 * console.log('配置已重置为默认值');
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
 */
export function getConfigFilePath() {
  return CONFIG_FILE_PATH;
}

/**
 * 获取默认配置
 * @returns {Object} 默认配置
 */
export function getDefaultConfig() {
  return { ...DEFAULT_CONFIG };
}

/**
 * 导出配置
 * @description 导出的配置包含解密后的 Cookie 明文，请妥善保管导出文件。
 * @param {string} filePath - 导出文件路径
 * @returns {Promise<boolean>} 是否成功
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
    if (!(await fileExists(filePath))) {
      throw new Error('配置文件不存在');
    }

    const configData = await readFile(filePath);
    const importedConfig = JSON.parse(configData);
    const validatedConfig = validateConfig(importedConfig);

    if (merge) {
      const currentConfig = await readConfig();
      const mergedConfig = validateConfig({ ...currentConfig, ...validatedConfig });
      await writeConfig(mergedConfig);
      return mergedConfig;
    }

    await writeConfig(validatedConfig);
    return validatedConfig;
  } catch (error) {
    console.error('导入配置失败:', error.message);
    throw error;
  }
}
