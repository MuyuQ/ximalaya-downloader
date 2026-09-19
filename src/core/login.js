/**
 * @fileoverview 登录模块
 * @description 处理用户登录流程，通过命令行交互获取凭证并验证
 * @module core/login
 *
 * @description
 * 本模块实现了基于 Cookie 的登录认证功能，主要流程：
 * 1. 引导用户从浏览器中获取 Cookie
 * 2. 从 Cookie 中提取 BID
 * 3. 调用用户信息接口验证 Cookie 有效性（获取真实用户名）
 * 4. 加密保存凭证到配置文件
 *
 * 注意：由于喜马拉雅不提供官方 API 登录接口，
 * 用户需要手动从浏览器中复制 Cookie 进行登录。
 *
 * @example
 * import { login, checkLoginStatus, logout } from './core/login.js';
 *
 * // 执行登录
 * const result = await login();
 * if (result.success) {
 *   console.log('登录成功:', result.username);
 * }
 *
 * // 检查登录状态
 * const status = await checkLoginStatus();
 * console.log('已登录:', status.isLoggedIn);
 *
 * // 注销登录
 * await logout();
 */

import { updateConfig, readConfig } from './configManager.js';
import { validateCredentials } from './api.js';

/**
 * 从 Cookie 中提取 BID
 * @description 依次尝试 xm_sg、1&_token 字段；都找不到时生成随机值兜底。
 * @param {string} cookie - Cookie 字符串
 * @returns {string} BID
 * @private
 */
function extractBid(cookie) {
  const xmSgMatch = cookie.match(/xm_sg=([^;]+)/);
  if (xmSgMatch) {
    return xmSgMatch[1];
  }

  const tokenMatch = cookie.match(/1&_token=([^;]+)/);
  if (tokenMatch) {
    return tokenMatch[1].substring(0, 32);
  }

  return Math.random().toString(36).substring(2, 18);
}

/**
 * 执行登录流程
 * @description 通过命令行交互引导用户完成登录，包括 Cookie 输入和验证。
 *   验证通过后凭证会加密保存到配置文件。
 * @param {Object} [options] - 登录选项
 * @param {Function} [options.prompt] - 自定义输入函数 (message) => Promise<string>，
 *   不传时使用 readline 从标准输入读取
 * @returns {Promise<Object>} 登录结果对象
 *
 * @returns {Object} 返回对象包含以下属性：
 * @returns {boolean} returns.success - 是否登录成功
 * @returns {string} [returns.username] - 用户名（仅成功时）
 * @returns {string} [returns.error] - 错误信息（仅失败时）
 *
 * @example
 * const result = await login();
 * if (result.success) {
 *   console.log('登录成功！用户名:', result.username);
 * }
 */
export async function login(options = {}) {
  const prompt = options.prompt || defaultPrompt;

  try {
    console.log('\n获取 Cookie 的方法：');
    console.log('1. 在浏览器中打开 https://www.ximalaya.com 并登录账号');
    console.log('2. 按 F12 打开开发者工具，在 Console 中输入: document.cookie');
    console.log('3. 复制输出的内容并粘贴到下方\n');

    const cookie = await prompt('请输入 Cookie: ');

    if (!cookie || cookie.trim().length < 10) {
      return { success: false, error: 'Cookie 无效（长度不足）' };
    }

    const trimmedCookie = cookie.trim();
    const bid = extractBid(trimmedCookie);

    console.log('\n正在验证登录凭证...');

    const validation = await validateCredentials(trimmedCookie, bid);

    if (!validation.valid) {
      return { success: false, error: validation.error || '登录凭证验证失败' };
    }

    await updateConfig({
      cookie: trimmedCookie,
      bid
    });

    return {
      success: true,
      username: validation.username
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 默认的命令行输入函数
 * @param {string} message - 提示信息
 * @returns {Promise<string>} 用户输入
 * @private
 */
function defaultPrompt(message) {
  return new Promise(resolve => {
    process.stdout.write(message);
    let input = '';
    const onData = chunk => {
      const text = chunk.toString();
      if (text.includes('\n') || text.includes('\r')) {
        process.stdin.removeListener('data', onData);
        resolve(input.trim());
      } else {
        input += text;
      }
    };
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', onData);
  });
}

/**
 * 检查登录状态
 * @description 读取配置中的凭证并调用接口验证
 * @returns {Promise<Object>} 登录状态 { isLoggedIn, username?, error? }
 *
 * @example
 * const status = await checkLoginStatus();
 * if (!status.isLoggedIn) {
 *   console.log('未登录:', status.error);
 * }
 */
export async function checkLoginStatus() {
  try {
    const config = await readConfig();

    if (config.cookieDecryptFailed) {
      return {
        isLoggedIn: false,
        error: '加密密钥丢失，无法解密 Cookie，请重新登录'
      };
    }

    if (!config.cookie || !config.bid) {
      return {
        isLoggedIn: false,
        error: '未配置 Cookie，请先登录'
      };
    }

    const validation = await validateCredentials(config.cookie, config.bid);

    return {
      isLoggedIn: validation.valid,
      username: validation.valid ? validation.username : null,
      error: validation.valid ? null : validation.error
    };
  } catch (error) {
    return {
      isLoggedIn: false,
      error: error.message
    };
  }
}

/**
 * 注销登录
 * @description 清空配置中的 Cookie 与 BID
 * @returns {Promise<Object>} 注销结果 { success } 或 { success: false, error }
 *
 * @example
 * const result = await logout();
 */
export async function logout() {
  try {
    await updateConfig({
      cookie: '',
      bid: ''
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
