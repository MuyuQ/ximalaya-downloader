/**
 * @fileoverview 账号命令
 * @description 实现登录、登出与登录状态查看的交互流程
 * @module cli/commands/account
 *
 * @example
 * import { loginFlow, logoutFlow, showLoginStatus } from './cli/commands/account.js';
 * await loginFlow();
 */

import { login, checkLoginStatus, logout } from '../../core/login.js';
import { c } from '../ui/ansi.js';

/**
 * 登录流程
 * @description 引导用户粘贴浏览器 Cookie 并验证，成功后加密保存。
 * @returns {Promise<void>}
 *
 * @example
 * await loginFlow();
 */
export async function loginFlow() {
  console.log(`\n${c.bold('=== 登录账号 ===')}`);

  const result = await login();

  if (result.success) {
    console.log(`${c.green('✔')} 登录成功，欢迎 ${c.bold(result.username)}`);
  } else {
    console.log(`${c.red('✗')} 登录失败: ${result.error}`);
  }
}

/**
 * 登出流程
 * @description 清空本地保存的登录凭证
 * @returns {Promise<void>}
 */
export async function logoutFlow() {
  const result = await logout();

  if (result.success) {
    console.log(`${c.green('✔')} 已退出登录`);
  } else {
    console.log(`${c.red('✗')} 退出失败: ${result.error}`);
  }
}

/**
 * 显示登录状态
 * @description 调用接口验证当前凭证并展示用户名
 * @returns {Promise<void>}
 */
export async function showLoginStatus() {
  console.log(`\n${c.bold('=== 登录状态 ===')}`);

  const status = await checkLoginStatus();

  if (status.isLoggedIn) {
    console.log(`  ${c.green('●')} 当前用户: ${c.bold(status.username)}`);
  } else {
    console.log(`  ${c.yellow('○')} ${status.error || '未登录'}`);
  }
  console.log('');
}
