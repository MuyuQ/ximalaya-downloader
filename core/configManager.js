/**
 * 配置管理模块
 * 负责处理用户配置的读取、验证和保存
 */

import { fileExists, readFile, writeFile, joinPath } from '../utils/fileUtils.js';

/**
 * 默认配置
 * @type {Object}
 * @private
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
 */
const CONFIG_FILE_PATH = './config.json';

/**
 * 读取配置文件
 * @returns {Promise<Object>} 配置对象
 * 
 * @example
 * const config = await readConfig();
 * console.log('下载路径:', config.path);
 * console.log('音频质量:', config.quality);
 */
export async function readConfig() {
  try {
    // 检查配置文件是否存在
    if (!(await fileExists(CONFIG_FILE_PATH))) {
      // 如果不存在，创建默认配置文件
      await writeConfig(DEFAULT_CONFIG);
      return { ...DEFAULT_CONFIG };
    }
    
    // 读取配置文件
    const configData = await readFile(CONFIG_FILE_PATH);
    const config = JSON.parse(configData);
    
    // 合并默认配置和用户配置
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    
    // 验证配置
    const validatedConfig = validateConfig(mergedConfig);
    
    return validatedConfig;
  } catch (error) {
    console.error('读取配置文件失败:', error.message);
    // 返回默认配置
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * 写入配置文件
 * @param {Object} config - 配置对象
 * @returns {Promise<boolean>} 是否成功
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
    // 验证配置
    const validatedConfig = validateConfig(config);
    
    // 写入配置文件
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
 * @param {Object} updates - 要更新的配置项
 * @returns {Promise<Object>} 更新后的配置
 * 
 * @example
 * const updatedConfig = await updateConfig({
 *   path: './new-downloads',
 *   quality: 'medium'
 * });
 * console.log('更新后的配置:', updatedConfig);
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
 * @param {Object} config - 配置对象
 * @returns {Promise<Object>} 检查结果
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
      return { valid: true, isValid: true, needLogin: true, error: 'cookie和bid不能为空，请先登录', errors: [] };
    }
    
    // 这里可以添加更多的验证逻辑，例如：
    // 1. 尝试使用cookie和bid获取用户信息
    // 2. 检查网络连接
    // 3. 验证下载路径是否可写
    
    // 模拟验证过程
    // 在实际应用中，这里应该调用API验证cookie和bid的有效性
    const isValid = await validateCredentials(validatedConfig.cookie, validatedConfig.bid);
    
    if (!isValid) {
      return { valid: false, isValid: false, error: 'cookie或bid无效，请重新登录', errors: ['cookie', 'bid'] };
    }
    
    // 检查下载路径
    const pathValid = await validateDownloadPath(validatedConfig.path);
    
    if (!pathValid) {
      return { valid: false, isValid: false, error: '下载路径无效或不可写', errors: ['path'] };
    }
    
    // 获取用户名
    const username = await getUsername(validatedConfig.cookie, validatedConfig.bid);
    
    return { valid: true, isValid: true, username: username || '未知用户', errors: [] };
  } catch (error) {
    return { valid: false, isValid: false, error: error.message, errors: ['unknown'] };
  }
}

/**
 * 验证凭据
 * @param {string} cookie - Cookie字符串
 * @param {string} bid - BID字符串
 * @returns {Promise<boolean>} 是否有效
 * @private
 */
async function validateCredentials(cookie, bid) {
  // 在实际应用中，这里应该调用API验证cookie和bid的有效性
  // 这里只是一个模拟实现
  
  if (!cookie || !bid) {
    return false;
  }
  
  // 模拟API调用
  // const response = await httpRequest({
  //   url: 'https://www.ximalaya.com/revision/user/v1/info',
  //   headers: {
  //     'Cookie': cookie,
  //     'xm-bid': bid
  //   }
  // });
  
  // return response.success;
  
  // 模拟验证结果
  return cookie.length > 10 && bid.length > 5;
}

/**
 * 验证下载路径
 * @param {string} path - 下载路径
 * @returns {Promise<boolean>} 是否有效
 * @private
 */
async function validateDownloadPath(path) {
  try {
    // 在实际应用中，这里应该检查路径是否存在且可写
    // 这里只是一个模拟实现
    
    if (!path || typeof path !== 'string') {
      return false;
    }
    
    // 模拟路径验证
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 获取用户名
 * @param {string} cookie - Cookie字符串
 * @param {string} bid - BID字符串
 * @returns {Promise<string|null>} 用户名
 * @private
 */
async function getUsername(cookie, bid) {
  try {
    // 在实际应用中，这里应该调用API获取用户信息
    // 这里只是一个模拟实现
    
    if (!cookie || !bid) {
      return null;
    }
    
    // 模拟API调用
    // const response = await httpRequest({
    //   url: 'https://www.ximalaya.com/revision/user/v1/info',
    //   headers: {
    //     'Cookie': cookie,
    //     'xm-bid': bid
    //   }
    // });
    
    // return response.data.nickname;
    
    // 模拟用户名
    return '测试用户';
  } catch (error) {
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
