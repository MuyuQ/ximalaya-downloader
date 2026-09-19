/**
 * @fileoverview 设置命令
 * @description 实现配置查看与修改（下载路径、音质、并发数、重试策略等）
 * @module cli/commands/settings
 *
 * @example
 * import { viewConfigFlow, changePathFlow } from './cli/commands/settings.js';
 * await viewConfigFlow();
 */

import { readConfig, updateConfig } from '../../core/configManager.js';
import { ensureWritableDirectory } from '../../utils/fileUtils.js';
import { select, confirm, input } from '../ui/select.js';
import { c } from '../ui/ansi.js';

/**
 * 质量选项（与配置项 quality 对应）
 * @type {Array<{ label: string, value: string }>}
 * @private
 */
const QUALITY_OPTIONS = [
  { label: '高质量（AI / M4A）', value: 'high' },
  { label: '中等质量（M4A 128kbps）', value: 'medium' },
  { label: '低质量（MP3 64kbps）', value: 'low' }
];

/**
 * 查看当前配置
 * @returns {Promise<void>}
 *
 * @example
 * await viewConfigFlow();
 */
export async function viewConfigFlow() {
  const config = await readConfig();

  console.log(`\n${c.bold('=== 当前配置 ===')}`);
  const rows = [
    ['下载路径', config.path],
    ['音质偏好', (QUALITY_OPTIONS.find(q => q.value === config.quality) || { label: config.quality }).label],
    ['序号前缀', config.addSequenceNumber ? '开启' : '关闭'],
    ['并发下载数', String(config.concurrentDownloads)],
    ['重试次数', String(config.maxRetries)],
    ['重试延迟', `${config.retryDelay}ms`]
  ];
  for (const [key, value] of rows) {
    console.log(`  ${c.gray(key.padEnd(8, '　'))} ${value}`);
  }
  console.log('');
}

/**
 * 修改下载路径
 * @description 输入新路径并验证可写后保存
 * @returns {Promise<void>}
 */
export async function changePathFlow() {
  const config = await readConfig();
  console.log(`\n${c.bold('=== 修改下载路径 ===')}`);
  console.log(`  ${c.gray('当前路径')} ${config.path}`);

  const newPath = await input('请输入新的下载路径');
  if (!newPath) {
    console.log(c.yellow('路径不能为空'));
    return;
  }

  if (!(await ensureWritableDirectory(newPath))) {
    console.log(c.red('路径无效或不可写，未保存'));
    return;
  }

  await updateConfig({ path: newPath });
  console.log(`${c.green('✔')} 下载路径已更新为 ${newPath}`);
}

/**
 * 修改默认音质
 * @returns {Promise<void>}
 */
export async function changeQualityFlow() {
  const selected = await select('请选择默认音质', QUALITY_OPTIONS);
  if (!selected) {
    return;
  }

  await updateConfig({ quality: selected });
  const label = QUALITY_OPTIONS.find(q => q.value === selected).label;
  console.log(`${c.green('✔')} 默认音质已更新为 ${label}`);
}

/**
 * 修改并发下载数
 * @returns {Promise<void>}
 */
export async function changeConcurrencyFlow() {
  const config = await readConfig();
  const value = await input('请输入并发下载数 (1-10)', { defaultValue: String(config.concurrentDownloads) });
  const concurrency = parseInt(value, 10);

  if (Number.isNaN(concurrency) || concurrency < 1 || concurrency > 10) {
    console.log(c.red('无效的并发数（应为 1-10）'));
    return;
  }

  await updateConfig({ concurrentDownloads: concurrency });
  console.log(`${c.green('✔')} 并发下载数已更新为 ${concurrency}`);
}

/**
 * 修改重试策略
 * @returns {Promise<void>}
 */
export async function changeRetryFlow() {
  const config = await readConfig();
  const value = await input('请输入下载失败最大重试次数 (0-10)', { defaultValue: String(config.maxRetries) });
  const retries = parseInt(value, 10);

  if (Number.isNaN(retries) || retries < 0 || retries > 10) {
    console.log(c.red('无效的重试次数（应为 0-10）'));
    return;
  }

  await updateConfig({ maxRetries: retries });
  console.log(`${c.green('✔')} 最大重试次数已更新为 ${retries}`);
}

/**
 * 切换序号前缀开关
 * @returns {Promise<void>}
 */
export async function toggleSequenceFlow() {
  const config = await readConfig();
  const enabled = !config.addSequenceNumber;

  if (!(await confirm(`确认${enabled ? '开启' : '关闭'}文件名序号前缀?`, { initial: enabled }))) {
    return;
  }

  await updateConfig({ addSequenceNumber: enabled });
  console.log(`${c.green('✔')} 序号前缀已${enabled ? '开启' : '关闭'}`);
}
