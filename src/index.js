/**
 * @fileoverview 应用入口与命令行参数分发
 * @description 解析命令行参数并分发到对应命令；无参数时启动交互式界面。
 * @module index
 *
 * 支持的命令：
 *   xmly                        启动交互式界面
 *   xmly download <id|url>      下载单个音频（-a/--album 下载专辑）
 *   xmly login                  登录账号
 *   xmly logout                 退出登录
 *   xmly status                 查看登录状态
 *   xmly config                 查看配置
 *   xmly --help / -h            显示帮助
 *   xmly --version / -v         显示版本
 *
 * 兼容旧版参数：--download <id> [-a/--album]
 *
 * @example
 * // 交互式启动
 * node index.js
 *
 * // 命令行下载
 * node bin/xmly.js download 12345678
 */

import { showVersion } from './cli/ui/banner.js';
import { c } from './cli/ui/ansi.js';
import { startApp } from './cli/app.js';
import { loginFlow, logoutFlow, showLoginStatus } from './cli/commands/account.js';
import { viewConfigFlow } from './cli/commands/settings.js';

/**
 * 显示帮助信息
 * @returns {void}
 *
 * @example
 * showHelp();
 */
export function showHelp() {
  console.log(`
  ${c.bold('喜马拉雅音频下载器')} ${c.gray('- 命令行音频下载工具')}

  ${c.bold('用法')}
    ${c.cyan('xmly')}                         ${c.gray('启动交互式界面')}
    ${c.cyan('xmly download')} ${c.gray('<音频ID|链接>')}    ${c.gray('下载单个音频')}
    ${c.cyan('xmly download')} ${c.gray('<专辑ID|链接>')} ${c.magenta('-a')}  ${c.gray('下载整个专辑')}
    ${c.cyan('xmly login')}                  ${c.gray('登录账号（VIP 内容需要）')}
    ${c.cyan('xmly logout')}                 ${c.gray('退出登录')}
    ${c.cyan('xmly status')}                 ${c.gray('查看登录状态')}
    ${c.cyan('xmly config')}                 ${c.gray('查看当前配置')}

  ${c.bold('选项')}
    ${c.magenta('-a')}, ${c.magenta('--album')}              ${c.gray('以专辑模式下载')}
    ${c.magenta('-h')}, ${c.magenta('--help')}               ${c.gray('显示帮助信息')}
    ${c.magenta('-v')}, ${c.magenta('--version')}            ${c.gray('显示版本号')}

  ${c.bold('示例')}
    ${c.gray('$')} xmly download 12345678
    ${c.gray('$')} xmly download https://www.ximalaya.com/album/987654 -a
    ${c.gray('$')} xmly

  ${c.bold('说明')}
    ${c.gray('·')} 首次使用请先运行 ${c.cyan('xmly login')} 登录
    ${c.gray('·')} 下载路径、音质、并发数等可在交互界面「设置」中调整
    ${c.gray('·')} 已下载的文件会自动跳过（支持断点续传）
`);
}

/**
 * 处理命令行参数
 * @param {Array<string>} args - 命令行参数（不含 node 与脚本路径）
 * @returns {Promise<void>}
 * @throws {Error} 当命令执行出错时抛出
 *
 * @example
 * await handleCommandLineArgs(['download', '12345678']);
 */
export async function handleCommandLineArgs(args) {
  if (args.length === 0) {
    await startApp();
    return;
  }

  const [command, ...rest] = args;

  switch (command) {
  case 'help':
    showHelp();
    break;

  case '--help':
  case '-h':
    showHelp();
    break;

  case '--version':
  case '-v':
    showVersion();
    break;

  case 'download':
  case '--download':
  case '-d': {
    if (rest.length === 0 || rest[0].startsWith('-')) {
      console.error(c.red('请指定要下载的音频或专辑 ID'));
      console.error(c.gray('用法: xmly download <音频ID|链接> [-a]'));
      process.exitCode = 1;
      return;
    }

    const isAlbum = rest.includes('--album') || rest.includes('-a');
    const target = rest.find(arg => !arg.startsWith('-'));

    if (isAlbum) {
      await downloadAlbumFlowById(target);
    } else {
      await downloadSoundFlowById(target);
    }
    break;
  }

  case 'login':
    await loginFlow();
    break;

  case 'logout':
    await logoutFlow();
    break;

  case 'status':
    await showLoginStatus();
    break;

  case 'config':
    await viewConfigFlow();
    break;

  default:
    console.error(c.red(`未知命令: ${command}`));
    console.error(c.gray('使用 --help 查看帮助信息'));
    process.exitCode = 1;
    break;
  }
}

/**
 * 非交互式下载单个音频
 * @description 命令行模式：自动选择最高可用音质，直接下载。
 * @param {string} soundIdOrUrl - 音频 ID 或链接
 * @returns {Promise<void>}
 * @private
 */
async function downloadSoundFlowById(soundIdOrUrl) {
  const { analyzeSound } = await import('./core/audioParser.js');
  const { downloadSoundWithNaming } = await import('./core/downloader.js');
  const { readConfig } = await import('./core/configManager.js');
  const { createSpinner } = await import('./cli/ui/spinner.js');
  const { createProgressBar } = await import('./cli/ui/progress.js');

  const spinner = createSpinner('正在获取音频信息...');

  let soundInfo;
  try {
    soundInfo = await analyzeSound(soundIdOrUrl);
    spinner.succeed(`已获取: ${soundInfo.title}`);
  } catch (error) {
    spinner.fail(`获取音频信息失败: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const qualities = Object.keys(soundInfo.urls);
  if (qualities.length === 0) {
    console.error(c.red('无法获取下载链接，可能需要 VIP 权限'));
    process.exitCode = 1;
    return;
  }

  const config = await readConfig();
  const url = soundInfo.urls[qualities[0]];

  const bar = createProgressBar(soundInfo.title);
  const result = await downloadSoundWithNaming(url, soundInfo.title, config.path, {
    skipExisting: true,
    timeout: 30000,
    retries: config.maxRetries || 3,
    onProgress: (pct, downloaded, total) => bar.update(pct, downloaded, total)
  });

  if (result.success) {
    bar.done();
    console.log(`  ${c.gray('保存至')} ${result.filePath}`);
  } else {
    bar.fail();
    console.error(c.red(`下载失败: ${result.error}`));
    process.exitCode = 1;
  }
}

/**
 * 非交互式下载专辑
 * @description 命令行模式：下载全部音轨，使用配置默认设置。
 * @param {string} albumIdOrUrl - 专辑 ID 或链接
 * @returns {Promise<void>}
 * @private
 */
async function downloadAlbumFlowById(albumIdOrUrl) {
  const { getAllAlbumTracks, resolveTrackUrls } = await import('./core/audioParser.js');
  const { downloadAlbum } = await import('./core/downloader.js');
  const { readConfig } = await import('./core/configManager.js');
  const { createSpinner } = await import('./cli/ui/spinner.js');
  const { createProgressBar } = await import('./cli/ui/progress.js');

  const spinner = createSpinner('正在获取专辑信息...');
  const albumInfo = await getAllAlbumTracks(albumIdOrUrl);

  if (!albumInfo || albumInfo.tracks.length === 0) {
    spinner.fail('获取专辑信息失败或专辑为空，请检查 ID 是否正确');
    process.exitCode = 1;
    return;
  }
  spinner.succeed(`已获取: ${albumInfo.title}（${albumInfo.tracks.length} 个音频）`);

  const config = await readConfig();

  const resolveSpinner = createSpinner('正在解析下载链接...');
  const tracksWithUrls = await resolveTrackUrls(albumInfo.tracks, {
    concurrency: Math.min(config.concurrentDownloads || 3, 5),
    auth: { cookie: config.cookie, bid: config.bid },
    onProgress: (done, total) => resolveSpinner.text(`正在解析下载链接... ${done}/${total}`)
  });

  if (tracksWithUrls.length === 0) {
    resolveSpinner.fail('没有可下载的音频');
    process.exitCode = 1;
    return;
  }
  resolveSpinner.succeed(`已解析 ${tracksWithUrls.length}/${albumInfo.tracks.length} 个链接`);

  const bar = createProgressBar(albumInfo.title);
  const result = await downloadAlbum(tracksWithUrls, albumInfo.title, config.path, {
    skipExisting: true,
    timeout: 30000,
    retries: config.maxRetries || 3,
    concurrency: config.concurrentDownloads || 3,
    onProgress: (pct) => bar.update(pct)
  });

  if (result.success || result.results) {
    bar.done(`${result.successCount}/${result.totalCount} 个音频`);
    console.log(`  ${c.gray('保存至')} ${result.albumDir || config.path}`);
    if (result.failureCount > 0) {
      process.exitCode = 1;
    }
  } else {
    bar.fail();
    console.error(c.red(`下载失败: ${result.error}`));
    process.exitCode = 1;
  }
}
