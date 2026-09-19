/**
 * @fileoverview 交互式主程序
 * @description 提供交互式主菜单循环，组织各命令模块
 * @module cli/app
 *
 * @example
 * import { startApp } from './cli/app.js';
 * await startApp();
 */

import { readConfig, checkConfig } from '../core/configManager.js';
import { showBanner } from './ui/banner.js';
import { select } from './ui/select.js';
import { c } from './ui/ansi.js';
import { downloadSoundFlow, downloadAlbumFlow } from './commands/download.js';
import { loginFlow, logoutFlow, showLoginStatus } from './commands/account.js';
import {
  viewConfigFlow,
  changePathFlow,
  changeQualityFlow,
  changeConcurrencyFlow,
  changeRetryFlow,
  toggleSequenceFlow
} from './commands/settings.js';

/**
 * 主菜单定义
 * @type {Array<{ label: string, value: string, hint?: string }>}
 * @private
 */
const MAIN_MENU = [
  { label: '下载单个音频', value: 'download-sound', hint: '输入音频 ID 或链接' },
  { label: '下载专辑', value: 'download-album', hint: '支持批量与范围选择' },
  { label: '登录账号', value: 'login', hint: 'VIP 内容需要登录' },
  { label: '登录状态', value: 'status' },
  { label: '退出登录', value: 'logout' },
  { label: '设置', value: 'settings' },
  { label: '退出程序', value: 'exit' }
];

/**
 * 设置子菜单定义
 * @type {Array<{ label: string, value: string }>}
 * @private
 */
const SETTINGS_MENU = [
  { label: '查看配置', value: 'view' },
  { label: '修改下载路径', value: 'path' },
  { label: '修改默认音质', value: 'quality' },
  { label: '修改并发下载数', value: 'concurrency' },
  { label: '修改重试次数', value: 'retry' },
  { label: '切换序号前缀', value: 'sequence' },
  { label: '返回主菜单', value: 'back' }
];

/**
 * 执行主菜单动作
 * @param {string} action - 动作标识
 * @returns {Promise<boolean>} 是否应退出程序
 * @private
 */
async function runMainMenuAction(action) {
  switch (action) {
  case 'download-sound':
    await downloadSoundFlow();
    return false;
  case 'download-album':
    await downloadAlbumFlow();
    return false;
  case 'login':
    await loginFlow();
    return false;
  case 'status':
    await showLoginStatus();
    return false;
  case 'logout':
    await logoutFlow();
    return false;
  case 'settings':
    await runSettingsLoop();
    return false;
  case 'exit':
    console.log(`${c.gray('感谢使用，再见！')}`);
    return true;
  default:
    return false;
  }
}

/**
 * 设置子菜单循环
 * @returns {Promise<void>}
 * @private
 */
async function runSettingsLoop() {
  let back = false;

  while (!back) {
    const action = await select('设置', SETTINGS_MENU);

    if (action === null || action === 'back') {
      back = true;
      break;
    }

    try {
      switch (action) {
      case 'view':
        await viewConfigFlow();
        break;
      case 'path':
        await changePathFlow();
        break;
      case 'quality':
        await changeQualityFlow();
        break;
      case 'concurrency':
        await changeConcurrencyFlow();
        break;
      case 'retry':
        await changeRetryFlow();
        break;
      case 'sequence':
        await toggleSequenceFlow();
        break;
      default:
        break;
      }
    } catch (error) {
      console.error(`${c.red('✗')} 操作失败: ${error.message}`);
    }
  }
}

/**
 * 启动交互式应用
 * @description 显示横幅与登录状态，进入主菜单循环。
 *   凭证失效时仍可进入登录与设置流程（横幅状态获取容错）。
 * @returns {Promise<void>}
 *
 * @example
 * await startApp();
 */
export async function startApp() {
  let status = { loggedIn: false };

  try {
    const config = await readConfig();

    // 在线校验凭证（失败不阻塞启动，仅影响横幅状态）
    const configCheck = await checkConfig(config).catch(() => ({ valid: false }));

    if (configCheck.valid) {
      status = { loggedIn: true, username: configCheck.username, path: config.path };
    } else {
      status = { loggedIn: false, path: config.path };
    }
  } catch {
    status = { loggedIn: false };
  }

  showBanner(status);

  let exit = false;
  while (!exit) {
    const action = await select('请选择操作', MAIN_MENU);

    if (action === null) {
      // Esc 取消视为退出
      console.log(c.gray('感谢使用，再见！'));
      exit = true;
      break;
    }

    try {
      exit = await runMainMenuAction(action);
    } catch (error) {
      console.error(`${c.red('✗')} 操作失败: ${error.message}`);
    }
    console.log('');
  }
}
