/**
 * @fileoverview 欢迎横幅与状态栏
 * @description 提供程序启动时的品牌横幅与当前状态（登录用户、下载路径）展示
 * @module cli/ui/banner
 *
 * @example
 * import { showBanner, showVersion } from './cli/ui/banner.js';
 * showBanner({ username: '张三', path: './downloads', loggedIn: true });
 */

import { readFileSync } from 'fs';
import { c } from './ansi.js';

/**
 * 应用版本号（模块加载时从 package.json 读取一次）
 * @type {string}
 * @private
 */
const APP_VERSION = (() => {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'));
    return pkg.version || '3.0.0';
  } catch {
    return '3.0.0';
  }
})();

/**
 * 显示欢迎横幅
 * @description 绘制带边框的品牌横幅，并显示当前登录状态与下载路径。
 * @param {Object} [status] - 状态信息
 * @param {string} [status.username] - 已登录用户名
 * @param {string} [status.path] - 下载路径
 * @param {boolean} [status.loggedIn=false] - 是否已登录
 *
 * @example
 * showBanner({ username: '张三', path: './downloads', loggedIn: true });
 */
export function showBanner(status = {}) {
  console.log('');
  console.log(`  ${c.magenta('♫')}  ${c.bold('喜马拉雅音频下载器')} ${c.cyan(`v${APP_VERSION}`)}`);
  console.log(`     ${c.gray('Ximalaya Audio Downloader')}`);

  if (status.loggedIn) {
    console.log(
      `  ${c.green('●')} 已登录: ${c.bold(status.username || '未知用户')}` +
      (status.path ? `   ${c.gray('下载路径:')} ${status.path}` : '')
    );
  } else {
    console.log(`  ${c.yellow('○')} ${c.yellow('未登录')}（VIP 内容需要登录后才能下载）`);
  }
  console.log('');
}

/**
 * 显示版本号
 * @returns {void}
 */
export function showVersion() {
  console.log(`喜马拉雅音频下载器 v${APP_VERSION}`);
}
