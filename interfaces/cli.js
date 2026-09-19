/**
 * @fileoverview 命令行接口模块
 * @description 负责处理用户输入、显示菜单和调用核心模块的功能
 * @module interfaces/cli
 *
 * @description
 * 本模块是应用程序的用户界面层，提供两种使用方式：
 *
 * 1. 交互式界面：直接运行程序，通过菜单选择操作
 * 2. 命令行参数：通过参数直接执行特定功能
 *
 * 支持的命令：
 * - 无参数：启动交互式界面
 * - --help, -h：显示帮助信息
 * - --version, -v：显示版本信息
 * - --download, -d <ID>：下载单个音频
 * - --download, -d <ID> --album：下载专辑
 *
 * @example
 * // 交互式使用
 * node index.js
 *
 * // 命令行参数使用
 * node index.js --download 12345678        // 下载单个音频
 * node index.js --download 87654321 --album // 下载专辑
 */

import { readConfig, updateConfig, checkConfig } from '../core/configManager.js';
import { analyzeSound, analyzeAlbum, judgeAlbum } from '../core/audioParser.js';
import { downloadSoundWithNaming, downloadSounds, downloadAlbum } from '../core/downloader.js';
import { login } from '../core/login.js';
import { formatTime, formatFileSize } from '../utils/stringUtils.js';
import readline from 'readline';

/**
 * 应用版本号
 * @type {string}
 * @private
 * @description 当前应用程序的版本号，显示在欢迎界面和 --version 命令输出中
 */
const APP_VERSION = '2.0.0';

/**
 * 主菜单选项配置
 * @type {Array<Object>}
 * @private
 * @description 定义主菜单的选项列表，每个选项包含id、name和action属性
 */
const MAIN_MENU_OPTIONS = [
  { id: '1', name: '下载单个音频', action: 'downloadSingleSound' },
  { id: '2', name: '下载专辑', action: 'downloadAlbum' },
  { id: '3', name: '修改下载路径', action: 'changeDownloadPath' },
  { id: '4', name: '登录账号', action: 'login' },
  { id: '5', name: '查看配置', action: 'viewConfig' },
  { id: '0', name: '退出程序', action: 'exit' }
];

/**
 * 音频质量选项
 * @type {Array<Object>}
 * @private
 */
const QUALITY_OPTIONS = [
  { id: '1', name: '高质量 (AI)', value: 'high' },
  { id: '2', name: '中等质量 (M4A_128)', value: 'medium' },
  { id: '3', name: '低质量 (MP3_64)', value: 'low' }
];

/**
 * 启动CLI应用
 * @returns {Promise<void>} 无返回值
 *
 * @example
 * // 启动应用
 * await startApp();
 */
export async function startApp() {
  console.log(`\n喜马拉雅下载器 v${APP_VERSION}`);
  console.log('=====================\n');

  try {
    // 检查配置
    const config = await readConfig();
    const configCheck = await checkConfig(config);

    if (!configCheck.valid) {
      console.log(`配置无效: ${configCheck.error}`);
      console.log('请先登录账号或修改配置。\n');
    } else {
      console.log(`当前用户: ${configCheck.username}`);
      console.log(`下载路径: ${config.path}\n`);
    }

    // 显示主菜单
    await showMainMenu();
  } catch (error) {
    console.error('启动应用失败:', error.message);
    process.exit(1);
  }
}

/**
 * 显示主菜单
 * @returns {Promise<void>} 无返回值
 * @private
 */
async function showMainMenu() {
  let running = true;
  while (running) {
    console.log('请选择操作:');

    // 显示菜单选项
    MAIN_MENU_OPTIONS.forEach(option => {
      console.log(`${option.id}. ${option.name}`);
    });

    // 获取用户输入
    const choice = await promptInput('\n请输入选项编号: ');

    // 处理用户选择
    const option = MAIN_MENU_OPTIONS.find(opt => opt.id === choice);

    if (!option) {
      console.log('无效的选项，请重新选择。\n');
      continue;
    }

    // 执行对应操作
    if (option.action === 'exit') {
      console.log('感谢使用，再见！');
      running = false;
      break;
    } else {
      await handleMenuAction(option.action);
      console.log('');
    }
  }
}

/**
 * 处理菜单操作
 * @param {string} action - 操作类型
 * @returns {Promise<void>} 无返回值
 * @private
 */
async function handleMenuAction(action) {
  try {
    switch (action) {
    case 'downloadSingleSound':
      await handleDownloadSingleSound();
      break;
    case 'downloadAlbum':
      await handleDownloadAlbum();
      break;
    case 'changeDownloadPath':
      await handleChangeDownloadPath();
      break;
    case 'login':
      await handleLogin();
      break;
    case 'viewConfig':
      await handleViewConfig();
      break;
    default:
      console.log('未知操作');
    }
  } catch (error) {
    console.error(`操作失败: ${error.message}`);
  }
}

/**
 * 处理下载单个音频
 * @returns {Promise<void>} 无返回值
 * @private
 */
async function handleDownloadSingleSound() {
  console.log('\n=== 下载单个音频 ===');

  // 获取音频ID
  const soundId = await promptInput('请输入音频ID: ');

  if (!soundId) {
    console.log('音频ID不能为空');
    return;
  }

  try {
    // 分析音频信息
    console.log('正在获取音频信息...');
    const soundInfo = await analyzeSound(soundId);

    if (!soundInfo) {
      console.log('获取音频信息失败，请检查音频ID是否正确');
      return;
    }

    // 显示音频信息
    console.log('\n音频信息:');
    console.log(`标题: ${soundInfo.title}`);
    console.log(`时长: ${formatTime(soundInfo.duration)}`);
    console.log(`类型: ${soundInfo.type === 'vip' ? 'VIP' : '免费'}`);

    // 检查是否有可用的下载链接
    const qualities = Object.keys(soundInfo.urls);
    if (qualities.length === 0) {
      console.log('无法获取下载链接，可能需要VIP权限');
      return;
    }

    // 选择音频质量
    const selectedQuality = await selectQuality();
    const qualityIndex = parseInt(selectedQuality, 10) - 1;
    const quality = qualities[Math.min(qualityIndex, qualities.length - 1)];

    // 确认下载
    const confirm = await promptInput('\n确认下载? (y/n): ');

    if (confirm.toLowerCase() !== 'y') {
      console.log('已取消下载');
      return;
    }

    // 开始下载
    console.log('\n开始下载...');
    const config = await readConfig();
    const url = soundInfo.urls[quality];
    const result = await downloadSoundWithNaming(url, soundInfo.title, config.path, {
      skipExisting: true,
      timeout: 30000,
      retries: config.maxRetries || 3
    });

    if (result.success) {
      console.log(`下载完成: ${result.filePath || result.fileName}`);
    } else {
      console.log(`下载失败: ${result.error}`);
    }
  } catch (error) {
    console.error(`下载失败: ${error.message}`);
  }
}

/**
 * 处理下载专辑
 * @description 交互式专辑下载流程，包括获取专辑信息、选择下载范围、执行下载
 * @returns {Promise<void>} 无返回值
 * @private
 *
 * @description
 * 完整流程：
 * 1. 获取并验证专辑ID
 * 2. 获取专辑信息和音轨列表
 * 3. 检查VIP权限
 * 4. 用户选择下载范围
 * 5. 获取各音轨的下载链接
 * 6. 执行批量下载
 */
async function handleDownloadAlbum() {
  console.log('\n=== 下载专辑 ===');

  // 步骤1：获取专辑ID
  const albumId = await promptInput('请输入专辑ID: ');
  if (!albumId) {
    console.log('专辑ID不能为空');
    return;
  }

  try {
    // 步骤2：获取专辑信息
    const albumInfo = await fetchAndDisplayAlbumInfo(albumId);
    if (!albumInfo) return;

    // 步骤3：检查VIP权限
    if (!await checkAlbumAccess(albumId)) return;

    // 步骤4：选择下载范围
    const downloadRange = await selectDownloadRange(albumInfo.tracks.length);
    if (!downloadRange) {
      console.log('已取消下载');
      return;
    }

    // 步骤5：确认下载
    const addSequence = await promptInput('\n是否添加序号? (y/n): ');
    const shouldAddSequence = addSequence.toLowerCase() === 'y';

    const confirm = await promptInput('\n确认下载? (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('已取消下载');
      return;
    }

    // 步骤6：执行下载
    await executeAlbumDownload(albumInfo, downloadRange, shouldAddSequence);

  } catch (error) {
    console.error(`下载失败: ${error.message}`);
  }
}

/**
 * 获取并显示专辑信息
 * @description 获取专辑详情并打印到控制台
 * @param {string} albumId - 专辑ID
 * @returns {Promise<Object|null>} 专辑信息对象，失败返回null
 * @private
 */
async function fetchAndDisplayAlbumInfo(albumId) {
  console.log('正在获取专辑信息...');
  const albumInfo = await analyzeAlbum(albumId);

  if (!albumInfo) {
    console.log('获取专辑信息失败，请检查专辑ID是否正确');
    return null;
  }

  // 显示专辑信息
  console.log('\n专辑信息:');
  console.log(`标题: ${albumInfo.title}`);
  console.log(`音频数量: ${albumInfo.tracks.length}`);

  // 显示音频列表
  console.log('\n音频列表:');
  albumInfo.tracks.forEach((sound, index) => {
    console.log(`${index + 1}. ${sound.title} (${formatTime(sound.duration)})`);
  });

  return albumInfo;
}

/**
 * 检查专辑访问权限
 * @description 检查用户是否有权限下载该专辑
 * @param {string} albumId - 专辑ID
 * @returns {Promise<boolean>} 是否有访问权限
 * @private
 */
async function checkAlbumAccess(albumId) {
  const albumType = await judgeAlbum(albumId);

  if (albumType === 'vip' && !await isUserLoggedIn()) {
    console.log('该专辑为VIP专辑，请先登录');
    return false;
  }

  return true;
}

/**
 * 执行专辑下载
 * @description 获取下载链接并执行批量下载
 * @param {Object} albumInfo - 专辑信息对象
 * @param {Object} downloadRange - 下载范围 {start, end}
 * @param {boolean} addSequence - 是否添加序号
 * @returns {Promise<void>} 无返回值
 * @private
 */
async function executeAlbumDownload(albumInfo, downloadRange, addSequence) {
  console.log('\n开始下载...');
  const config = await readConfig();

  // 获取选中范围内的音轨
  const selectedTracks = albumInfo.tracks.slice(downloadRange.start - 1, downloadRange.end);

  // 获取每个音轨的下载链接
  console.log('正在获取下载链接...');
  const tracks = await fetchTracksDownloadUrls(selectedTracks);

  if (tracks.length === 0) {
    console.log('没有可下载的音频');
    return;
  }

  // 执行下载
  const result = await downloadAlbum(tracks, albumInfo.title, config.path, {
    skipExisting: true,
    timeout: 30000,
    retries: config.maxRetries || 3,
    concurrency: config.concurrentDownloads || 3,
    addNumber: addSequence
  });

  // 显示下载结果
  displayDownloadResult(result);
}

/**
 * 获取音轨下载链接
 * @description 批量获取音轨的下载URL
 * @param {Array<Object>} selectedTracks - 选中的音轨列表
 * @returns {Promise<Array<Object>>} 包含下载URL的音轨列表
 * @private
 */
async function fetchTracksDownloadUrls(selectedTracks) {
  const tracks = [];

  for (let i = 0; i < selectedTracks.length; i++) {
    const track = selectedTracks[i];
    const soundInfo = await analyzeSound(String(track.id));

    if (soundInfo && Object.keys(soundInfo.urls).length > 0) {
      const qualities = Object.keys(soundInfo.urls);
      tracks.push({
        id: track.id,
        title: soundInfo.title,
        url: soundInfo.urls[qualities[0]]
      });
    }

    // 显示进度
    process.stdout.write(`\r获取进度: ${i + 1}/${selectedTracks.length}`);
  }
  console.log('');

  return tracks;
}

/**
 * 显示下载结果
 * @description 打印下载结果摘要到控制台
 * @param {Object} result - 下载结果对象
 * @private
 */
function displayDownloadResult(result) {
  if (result.success) {
    console.log(`下载完成: ${result.successCount}/${result.totalCount} 个音频`);

    if (result.failureCount > 0) {
      console.log(`失败: ${result.failureCount} 个音频`);
    }
  } else {
    console.log(`下载失败: ${result.error}`);
  }
}

/**
 * 处理修改下载路径
 * @returns {Promise<void>} 无返回值
 * @private
 */
async function handleChangeDownloadPath() {
  console.log('\n=== 修改下载路径 ===');

  // 显示当前路径
  const config = await readConfig();
  console.log(`当前下载路径: ${config.path}`);

  // 获取新路径
  const newPath = await promptInput('请输入新的下载路径: ');

  if (!newPath) {
    console.log('路径不能为空');
    return;
  }

  try {
    // 更新配置
    await updateConfig({ path: newPath });
    console.log('下载路径已更新');
  } catch (error) {
    console.error(`更新路径失败: ${error.message}`);
  }
}

/**
 * 处理登录
 * @returns {Promise<void>} 无返回值
 * @private
 */
async function handleLogin() {
  console.log('\n=== 登录账号 ===');

  try {
    // 调用新的登录流程
    const result = await login();

    if (result.success) {
      console.log('登录成功');
      console.log(`用户名: ${result.username}`);
    } else {
      console.log(`登录失败: ${result.error}`);
    }
  } catch (error) {
    console.error(`登录失败: ${error.message}`);
  }
}

/**
 * 处理查看配置
 * @returns {Promise<void>} 无返回值
 * @private
 */
async function handleViewConfig() {
  console.log('\n=== 当前配置 ===');

  try {
    const config = await readConfig();
    const configCheck = await checkConfig(config);

    console.log(`用户名: ${configCheck.valid ? configCheck.username : '未登录'}`);
    console.log(`下载路径: ${config.path}`);
    console.log(`音频质量: ${config.quality}`);
    console.log(`添加序号: ${config.addSequenceNumber ? '是' : '否'}`);
    console.log(`最大重试次数: ${config.maxRetries}`);
    console.log(`重试延迟(ms): ${config.retryDelay}`);
    console.log(`并发下载数: ${config.concurrentDownloads}`);
  } catch (error) {
    console.error(`获取配置失败: ${error.message}`);
  }
}

/**
 * 选择音频质量
 * @returns {Promise<string>} 音频质量
 * @private
 */
async function selectQuality() {
  console.log('\n请选择音频质量:');

  QUALITY_OPTIONS.forEach(option => {
    console.log(`${option.id}. ${option.name}`);
  });

  const choice = await promptInput('\n请输入选项编号: ');

  const option = QUALITY_OPTIONS.find(opt => opt.id === choice);

  if (!option) {
    console.log('无效的选项，使用默认质量');
    return 'high';
  }

  return option.value;
}

/**
 * 选择下载范围
 * @param {number} totalCount - 总数量
 * @returns {Promise<Object|null>} 下载范围
 * @private
 */
async function selectDownloadRange(totalCount) {
  console.log('\n请选择下载范围:');
  console.log('1. 下载全部');
  console.log('2. 下载指定范围');
  console.log('3. 仅查看列表');

  const choice = await promptInput('\n请输入选项编号: ');

  switch (choice) {
  case '1':
    return { start: 1, end: totalCount };
  case '2': {
    const start = await promptInput('请输入起始序号: ');
    const end = await promptInput('请输入结束序号: ');

    const startIndex = parseInt(start, 10);
    const endIndex = parseInt(end, 10);

    if (isNaN(startIndex) || isNaN(endIndex) || startIndex < 1 || endIndex > totalCount || startIndex > endIndex) {
      console.log('无效的范围');
      return null;
    }

    return { start: startIndex, end: endIndex };
  }
  case '3':
    return null;
  default:
    console.log('无效的选项');
    return null;
  }
}

/**
 * 检查用户是否已登录
 * @returns {Promise<boolean>} 是否已登录
 * @private
 */
async function isUserLoggedIn() {
  try {
    const config = await readConfig();
    const configCheck = await checkConfig(config);
    return configCheck.valid;
  } catch (error) {
    return false;
  }
}

/**
 * 提示用户输入
 * @param {string} message - 提示信息
 * @returns {Promise<string>} 用户输入
 * @private
 */
function promptInput(message) {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(message, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * 显示帮助信息
 * @returns {void} 无返回值
 *
 * @example
 * showHelp();
 */
export function showHelp() {
  console.log('\n喜马拉雅下载器帮助信息');
  console.log('=====================\n');
  console.log('功能说明:');
  console.log('- 下载单个音频');
  console.log('- 下载专辑');
  console.log('- 修改下载路径');
  console.log('- 登录账号');
  console.log('- 查看配置\n');
  console.log('使用说明:');
  console.log('1. 启动程序后，按照提示选择操作');
  console.log('2. 下载音频或专辑时，需要输入对应的ID');
  console.log('3. 可以选择音频质量和下载范围');
  console.log('4. VIP内容需要登录账号才能下载\n');
  console.log('注意事项:');
  console.log('- 请确保网络连接正常');
  console.log('- 下载路径需要有写入权限');
  console.log('- 请遵守相关法律法规，仅下载有权限的内容\n');
}

/**
 * 显示版本信息
 * @returns {void} 无返回值
 *
 * @example
 * showVersion();
 */
export function showVersion() {
  console.log(`喜马拉雅下载器 v${APP_VERSION}`);
}

/**
 * 处理命令行参数
 * @param {Array<string>} args - 命令行参数
 * @returns {Promise<void>} 无返回值
 *
 * @example
 * // 处理命令行参数
 * await handleCommandLineArgs(process.argv.slice(2));
 */
export async function handleCommandLineArgs(args) {
  if (args.length === 0) {
    await startApp();
    return;
  }

  const command = args[0];

  switch (command) {
  case '--help':
  case '-h':
    showHelp();
    break;
  case '--version':
  case '-v':
    showVersion();
    break;
  case '--download':
  case '-d': {
    if (args.length < 2) {
      console.error('请指定要下载的音频或专辑ID');
      process.exit(1);
    }

    const id = args[1];
    const isAlbum = args.includes('--album') || args.includes('-a');

    if (isAlbum) {
      await handleDownloadAlbumById(id);
    } else {
      await handleDownloadSoundById(id);
    }
    break;
  }
  default:
    console.error(`未知命令: ${command}`);
    console.error('使用 --help 查看帮助信息');
    process.exit(1);
  }
}

/**
 * 通过ID下载音频
 * @param {string} soundId - 音频ID
 * @returns {Promise<void>} 无返回值
 * @private
 */
async function handleDownloadSoundById(soundId) {
  try {
    // 获取音频信息
    console.log('正在获取音频信息...');
    const soundInfo = await analyzeSound(soundId);

    if (!soundInfo) {
      console.error('获取音频信息失败，请检查音频ID是否正确');
      process.exit(1);
    }

    console.log(`音频标题: ${soundInfo.title}`);
    console.log(`音频时长: ${formatTime(soundInfo.duration)}`);

    // 获取下载链接
    const qualities = Object.keys(soundInfo.urls);
    if (qualities.length === 0) {
      console.error('无法获取下载链接，可能需要VIP权限');
      process.exit(1);
    }

    // 选择最高质量的链接
    const url = soundInfo.urls[qualities[0]];
    const config = await readConfig();

    // 执行下载
    const result = await downloadSoundWithNaming(url, soundInfo.title, config.path, {
      skipExisting: true,
      timeout: 30000,
      retries: config.maxRetries || 3
    });

    if (result.success) {
      console.log(`下载完成: ${result.filePath || result.fileName}`);
    } else {
      console.error(`下载失败: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`下载失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * 通过ID下载专辑（命令行模式）
 * @description 非交互式的专辑下载，直接通过命令行参数执行
 * @param {string} albumId - 专辑ID
 * @returns {Promise<void>} 无返回值
 * @private
 *
 * @description
 * 与交互式下载不同，此函数：
 * - 自动下载全部音轨
 * - 使用配置文件中的默认设置
 * - 错误时直接退出进程
 */
async function handleDownloadAlbumById(albumId) {
  try {
    // 获取专辑信息
    console.log('正在获取专辑信息...');
    const albumInfo = await analyzeAlbum(albumId);

    if (!albumInfo) {
      console.error('获取专辑信息失败，请检查专辑ID是否正确');
      process.exit(1);
    }

    console.log(`专辑标题: ${albumInfo.title}`);
    console.log(`音频数量: ${albumInfo.tracks.length}`);

    // 获取所有音频的下载链接（复用已有函数）
    console.log('正在获取下载链接...');
    const tracks = await fetchTracksDownloadUrls(albumInfo.tracks);

    if (tracks.length === 0) {
      console.error('没有可下载的音频');
      process.exit(1);
    }

    const config = await readConfig();

    // 执行下载
    const result = await downloadAlbum(tracks, albumInfo.title, config.path, {
      skipExisting: true,
      timeout: 30000,
      retries: config.maxRetries || 3,
      concurrency: config.concurrentDownloads || 3,
      addNumber: config.addSequenceNumber
    });

    // 显示结果并退出
    displayDownloadResult(result);

    if (!result.success) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`下载失败: ${error.message}`);
    process.exit(1);
  }
}
