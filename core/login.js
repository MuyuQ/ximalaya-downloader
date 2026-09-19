/**
 * @fileoverview 登录模块
 * @description 处理用户登录流程，通过命令行交互获取凭证并验证
 * @module core/login
 *
 * @description
 * 本模块实现了基于Cookie的登录认证功能，主要流程：
 * 1. 引导用户从浏览器中获取Cookie
 * 2. 提取必要的认证信息（xm_sg, 1&_token）
 * 3. 验证Cookie有效性
 * 4. 保存凭证到配置文件
 *
 * 注意：由于喜马拉雅不提供官方API登录接口，
 * 用户需要手动从浏览器中复制Cookie进行登录。
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
import { httpRequest, createAuthHeaders } from '../utils/networkUtils.js';
import readline from 'readline';

/**
 * 执行登录流程
 * @description 通过命令行交互引导用户完成登录，包括Cookie输入和验证
 * @returns {Promise<Object>} 登录结果对象
 *
 * @returns {Object} 返回对象包含以下属性：
 * @returns {boolean} returns.success - 是否登录成功
 * @returns {string} [returns.username] - 用户名（仅成功时）
 * @returns {string} [returns.error] - 错误信息（仅失败时）
 *
 * @example
 * const result = await login();
 *
 * if (result.success) {
 *   console.log('登录成功！用户名:', result.username);
 * } else {
 *   console.error('登录失败:', result.error);
 * }
 */
export async function login() {
  console.log('\n=== 喜马拉雅登录 ===');
  console.log('请先在浏览器中登录喜马拉雅网站，然后按提示输入凭证。\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

  try {
    // 获取 Cookie
    console.log('获取 Cookie 的方法：');
    console.log('1. 在浏览器中打开 https://www.ximalaya.com');
    console.log('2. 登录账号');
    console.log('3. 按 F12 打开开发者工具');
    console.log('4. 在 Console 中输入: document.cookie');
    console.log('5. 复制输出的内容\n');

    const cookie = await question('请输入 Cookie: ');

    if (!cookie || cookie.trim().length < 10) {
      return { success: false, error: 'Cookie 无效' };
    }

    // 从 cookie 中提取 xm_sg 和 1&_token
    const bid = extractBid(cookie);

    console.log('\n正在验证登录凭证...');

    // 验证凭证
    const validation = await validateCredentials(cookie.trim(), bid);

    if (!validation.success) {
      return { success: false, error: validation.error || '登录凭证验证失败' };
    }

    // 保存凭证
    await updateConfig({
      cookie: cookie.trim(),
      bid: bid
    });

    console.log(`\n✓ 登录成功！用户名: ${validation.username}`);

    return {
      success: true,
      username: validation.username
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  } finally {
    rl.close();
  }
}

/**
 * 从 cookie 中提取 bid
 * @param {string} cookie - Cookie 字符串
 * @returns {string} bid
 */
function extractBid(cookie) {
  // 尝试从 xm_sg 中提取
  const xmSgMatch = cookie.match(/xm_sg=([^;]+)/);
  if (xmSgMatch) {
    return xmSgMatch[1];
  }

  // 尝试从 1&_token 中提取
  const tokenMatch = cookie.match(/1&_token=([^;]+)/);
  if (tokenMatch) {
    return tokenMatch[1].substring(0, 32);
  }

  // 使用随机值
  return Math.random().toString(36).substring(2, 18);
}

/**
 * 验证登录凭证
 * @param {string} cookie - Cookie 字符串
 * @param {string} bid - BID
 * @returns {Promise<Object>} 验证结果
 */
async function validateCredentials(cookie, bid) {
  try {
    const headers = createAuthHeaders(cookie, bid);

    const data = await httpRequest('https://www.ximalaya.com/revision/user/v1/getUserInfo', {
      method: 'GET',
      headers,
      timeout: 10000,
      retries: 2
    });

    if (data && data.ret === 200 && data.data) {
      return {
        success: true,
        username: data.data.nickname || data.data.mobile || '未知用户'
      };
    }

    return { success: false, error: '获取用户信息失败' };
  } catch (error) {
    return {
      success: false,
      error: `验证凭证失败: ${error.message}`
    };
  }
}

/**
 * 检查登录状态
 * @returns {Promise<Object>} 登录状态
 */
export async function checkLoginStatus() {
  try {
    const config = await readConfig();

    if (!config.cookie) {
      return {
        isLoggedIn: false,
        error: '未配置 Cookie，请先登录'
      };
    }

    const validation = await validateCredentials(config.cookie, config.bid);

    return {
      isLoggedIn: validation.success,
      username: validation.success ? validation.username : null,
      error: validation.success ? null : validation.error
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
 * @returns {Promise<Object>} 注销结果
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
