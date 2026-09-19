/**
 * @fileoverview 下载命令
 * @description 实现单个音频与专辑的交互式下载流程，包括信息展示、
 *   音质选择、范围选择与进度显示
 * @module cli/commands/download
 *
 * @example
 * import { downloadSoundFlow, downloadAlbumFlow } from './cli/commands/download.js';
 * await downloadSoundFlow();
 */

import { readConfig } from '../../core/configManager.js';
import {
  analyzeSound,
  getAllAlbumTracks,
  judgeAlbum,
  resolveTrackUrls,
  AudioQuality,
  AudioType
} from '../../core/audioParser.js';
import { downloadSoundWithNaming, downloadAlbum } from '../../core/downloader.js';
import { extractIdFromInput } from '../../core/api.js';
import { formatTime, formatFileSize } from '../../utils/stringUtils.js';
import { select, confirm, input } from '../ui/select.js';
import { createSpinner } from '../ui/spinner.js';
import { createProgressBar } from '../ui/progress.js';
import { c } from '../ui/ansi.js';

/**
 * 音质显示名称映射
 * @type {Object}
 * @private
 */
const QUALITY_LABELS = {
  [AudioQuality.AI]: 'AI 高清',
  [AudioQuality.M4A_128]: 'M4A 128kbps',
  [AudioQuality.MP3_64]: 'MP3 64kbps',
  [AudioQuality.MP3_32]: 'MP3 32kbps'
};

/**
 * 解析用户输入的 ID（支持直接 ID 或网页链接）
 * @param {string} message - 输入提示语
 * @param {string} expectedType - 期望类型 'sound' | 'album'
 * @returns {Promise<string|null>} 提取的 ID，取消或无法识别时返回 null
 * @private
 */
async function promptForId(message, expectedType) {
  const raw = await input(message);
  if (!raw) {
    console.log(c.yellow('输入为空，已取消'));
    return null;
  }

  const parsed = extractIdFromInput(raw);
  if (!parsed) {
    console.log(c.red('无法识别的输入，请输入数字 ID 或喜马拉雅网页链接'));
    return null;
  }

  if (parsed.type !== expectedType) {
    const typeLabel = parsed.type === 'album' ? '专辑' : '音频';
    console.log(c.yellow(`检测到这是${typeLabel}链接，请使用对应的下载菜单`));
    return null;
  }

  return parsed.id;
}

/**
 * 展示键值信息面板
 * @param {string} title - 面板标题
 * @param {Array<[string, string]>} rows - 键值行
 * @private
 */
function showPanel(title, rows) {
  console.log('');
  console.log(`  ${c.bold(c.cyan(title))}`);
  for (const [key, value] of rows) {
    console.log(`  ${c.gray(key.padEnd(8, '　'))} ${value}`);
  }
  console.log('');
}

/**
 * 单个音频下载流程
 * @description 完整交互流程：输入 ID/链接 → 展示音频信息 → 选择音质 →
 *   确认 → 带进度条下载。
 * @returns {Promise<void>}
 *
 * @example
 * await downloadSoundFlow();
 */
export async function downloadSoundFlow() {
  const soundId = await promptForId('请输入音频 ID 或链接', 'sound');
  if (!soundId) {
    return;
  }

  const config = await readConfig();

  // 获取音频信息
  const spinner = createSpinner('正在获取音频信息...');
  let soundInfo;
  try {
    soundInfo = await analyzeSound(soundId);
    spinner.succeed(`已获取: ${soundInfo.title}`);
  } catch (error) {
    spinner.fail(`获取音频信息失败: ${error.message}`);
    return;
  }

  const qualities = Object.keys(soundInfo.urls);
  showPanel('音频信息', [
    ['标题', soundInfo.title],
    ['时长', formatTime(soundInfo.duration, true)],
    ['类型', soundInfo.type === AudioType.VIP ? c.yellow('VIP') : c.green('免费')]
  ]);

  if (qualities.length === 0) {
    console.log(c.yellow('无法获取下载链接，该音频可能需要 VIP 权限，请先登录'));
    return;
  }

  // 选择音质（仅列出实际可用的音质）
  const qualityValue = await select('请选择音质', qualities.map(q => ({
    label: QUALITY_LABELS[q] || q,
    value: q
  })));

  if (!qualityValue) {
    return;
  }

  if (!(await confirm('确认开始下载?'))) {
    console.log(c.gray('已取消下载'));
    return;
  }

  // 下载（带进度条）
  const bar = createProgressBar(soundInfo.title);
  const result = await downloadSoundWithNaming(
    soundInfo.urls[qualityValue],
    soundInfo.title,
    config.path,
    {
      skipExisting: true,
      timeout: 30000,
      retries: config.maxRetries || 3,
      onProgress: (pct, downloaded, total) => bar.update(pct, downloaded, total)
    }
  );

  if (result.success) {
    bar.done(result.skipped ? '（文件已存在，已跳过）' : undefined);
    if (result.skipped) {
      console.log(c.gray(`文件已存在: ${result.filePath}`));
    } else {
      console.log(`  ${c.gray('保存至')} ${result.filePath}  ${c.gray(formatFileSize(result.fileSize || 0))}`);
    }
  } else {
    bar.fail();
    console.log(c.red(`下载失败: ${result.error}`));
  }
}

/**
 * 获取专辑概览并检查权限
 * @param {string} albumId - 专辑 ID
 * @param {Object} config - 当前配置
 * @returns {Promise<Object|null>} 专辑信息对象；权限不足或获取失败返回 null
 * @private
 */
async function fetchAlbumOverview(albumId, config) {
  // 检查专辑类型（VIP 检查）
  const typeSpinner = createSpinner('正在检查专辑权限...');
  let albumType;
  try {
    albumType = await judgeAlbum(albumId);
    typeSpinner.succeed(albumType === AudioType.VIP ? '该专辑为 VIP 专辑' : '权限检查通过');
  } catch (error) {
    typeSpinner.fail(`权限检查失败: ${error.message}`);
    return null;
  }

  if (albumType === AudioType.VIP && (!config.cookie || !config.bid)) {
    console.log(c.yellow('该专辑为 VIP 专辑，请先登录账号（主菜单 → 登录账号）'));
    return null;
  }

  // 获取专辑信息与全部音轨
  const spinner = createSpinner('正在获取专辑信息...');
  const albumInfo = await getAllAlbumTracks(albumId);

  if (!albumInfo) {
    spinner.fail('获取专辑信息失败，请检查专辑 ID 是否正确');
    return null;
  }

  spinner.succeed(`已获取: ${albumInfo.title}`);

  showPanel('专辑信息', [
    ['标题', albumInfo.title],
    ['数量', `${albumInfo.tracks.length} 个音频`]
  ]);

  if (albumInfo.tracks.length === 0) {
    console.log(c.yellow('该专辑没有可下载的音频'));
    return null;
  }

  return albumInfo;
}

/**
 * 选择专辑下载范围
 * @param {Object} albumInfo - 专辑信息
 * @returns {Promise<Array<Object>|null>} 选中的音轨列表；查看模式或取消返回 null
 * @private
 */
async function chooseAlbumRange(albumInfo) {
  const rangeChoice = await select('请选择下载范围', [
    { label: '下载全部', value: 'all', hint: `${albumInfo.tracks.length} 个` },
    { label: '下载指定范围', value: 'range' },
    { label: '仅查看列表，不下载', value: 'view' }
  ]);

  if (!rangeChoice) {
    return null;
  }

  if (rangeChoice === 'view') {
    albumInfo.tracks.forEach((track, i) => {
      console.log(`  ${c.gray(String(i + 1).padStart(3))}. ${track.title} ${c.gray(formatTime(track.duration, true))}`);
    });
    return null;
  }

  if (rangeChoice === 'range') {
    const start = await input(`请输入起始序号 (1-${albumInfo.tracks.length})`);
    const end = await input(`请输入结束序号 (${start || 1}-${albumInfo.tracks.length})`);
    const startIndex = parseInt(start, 10);
    const endIndex = parseInt(end, 10);

    if (Number.isNaN(startIndex) || Number.isNaN(endIndex)
      || startIndex < 1
      || endIndex > albumInfo.tracks.length
      || startIndex > endIndex) {
      console.log(c.red('无效的范围，已取消'));
      return null;
    }

    return albumInfo.tracks.slice(startIndex - 1, endIndex);
  }

  return albumInfo.tracks;
}

/**
 * 解析音轨链接并执行下载
 * @param {Object} albumInfo - 专辑信息
 * @param {Array<Object>} selectedTracks - 选中的音轨
 * @param {Object} config - 当前配置
 * @param {boolean} addSequence - 是否添加序号前缀
 * @returns {Promise<void>}
 * @private
 */
async function downloadSelectedTracks(albumInfo, selectedTracks, config, addSequence) {
  // 解析各音轨的下载链接
  const resolveSpinner = createSpinner('正在解析下载链接...');
  const tracksWithUrls = await resolveTrackUrls(selectedTracks, {
    concurrency: Math.min(config.concurrentDownloads || 3, 5),
    auth: { cookie: config.cookie, bid: config.bid },
    onProgress: (done, total) => {
      resolveSpinner.text(`正在解析下载链接... ${done}/${total}`);
    }
  });

  if (tracksWithUrls.length === 0) {
    resolveSpinner.fail('没有可下载的音频（可能需要 VIP 权限或音轨已失效）');
    return;
  }

  resolveSpinner.succeed(`已解析 ${tracksWithUrls.length}/${selectedTracks.length} 个链接`);

  // 并发下载（聚合进度）
  const bar = createProgressBar(albumInfo.title);
  const result = await downloadAlbum(tracksWithUrls, albumInfo.title, config.path, {
    skipExisting: true,
    timeout: 30000,
    retries: config.maxRetries || 3,
    concurrency: config.concurrentDownloads || 3,
    addNumber: addSequence,
    onProgress: (pct, completed, total) => {
      bar.update(pct, completed, total);
    }
  });

  if (result.success || result.results) {
    bar.done(`${result.successCount}/${result.totalCount} 个音频`);
    if (result.failureCount > 0) {
      console.log(c.yellow(`  ${result.failureCount} 个音频下载失败，可重新运行以续传`));
    }
    console.log(`  ${c.gray('保存至')} ${result.albumDir || config.path}`);
  } else {
    bar.fail();
    console.log(c.red(`下载失败: ${result.error}`));
  }
}

/**
 * 专辑下载流程
 * @description 完整交互流程：输入专辑 ID/链接 → 获取专辑信息与全部音轨 →
 *   VIP 权限检查 → 选择下载范围 → 确认 → 解析链接 → 并发下载（聚合进度）。
 * @returns {Promise<void>}
 *
 * @example
 * await downloadAlbumFlow();
 */
export async function downloadAlbumFlow() {
  const albumId = await promptForId('请输入专辑 ID 或链接', 'album');
  if (!albumId) {
    return;
  }

  const config = await readConfig();

  const albumInfo = await fetchAlbumOverview(albumId, config);
  if (!albumInfo) {
    return;
  }

  const selectedTracks = await chooseAlbumRange(albumInfo);
  if (!selectedTracks || selectedTracks.length === 0) {
    return;
  }

  // 序号前缀（默认取配置值，可在此覆盖）
  const addSequence = await confirm('文件名添加序号前缀?（如 "01 第一章.mp3"）', {
    initial: config.addSequenceNumber
  });

  if (!(await confirm(`确认下载 ${selectedTracks.length} 个音频?`))) {
    console.log(c.gray('已取消下载'));
    return;
  }

  await downloadSelectedTracks(albumInfo, selectedTracks, config, addSequence);
}
