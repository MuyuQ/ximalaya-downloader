/**
 * @fileoverview 交互式选择菜单与输入提示
 * @description 提供方向键导航的单选菜单、y/n 确认与文本输入；
 *   非交互环境（管道、CI）自动降级为普通问答模式。
 * @module cli/ui/select
 *
 * @example
 * import { select, confirm, input } from './cli/ui/select.js';
 *
 * const value = await select('请选择操作', [
 *   { label: '下载单个音频', value: 'sound' },
 *   { label: '下载专辑', value: 'album' }
 * ]);
 * // 返回所选选项的 value；用户按 Esc 取消时返回 null
 */

import readline from 'readline';
import { c, cursor, isInteractive } from './ansi.js';

/**
 * 计算滚动窗口的起始索引
 * @param {number} total - 选项总数
 * @param {number} activeIndex - 当前高亮索引
 * @param {number} visibleCount - 可见数量
 * @returns {number} 起始索引
 * @private
 */
function scrollWindow(total, activeIndex, visibleCount) {
  const half = Math.floor(visibleCount / 2);
  let start = activeIndex - half;
  if (start < 0) {
    start = 0;
  }
  if (start + visibleCount > total) {
    start = Math.max(0, total - visibleCount);
  }
  return start;
}

/**
 * 计算可见选项数量（长列表限制为 10 项）
 * @param {number} total - 选项总数
 * @returns {number} 可见数量
 * @private
 */
function visibleCountFor(total) {
  return Math.min(total, 10);
}

/**
 * 渲染菜单并返回打印的行数
 * @param {string} message - 提示信息
 * @param {Array<Object>} options - 选项列表 [{ label, value, hint? }]
 * @param {number} activeIndex - 当前高亮索引
 * @param {number} startIndex - 渲染窗口起始索引
 * @returns {number} 打印的行数（供重绘时回退光标）
 * @private
 */
function render(message, options, activeIndex, startIndex) {
  const visible = visibleCountFor(options.length);
  const endIndex = Math.min(startIndex + visible, options.length);

  console.log(`${c.cyan('?')} ${c.bold(message)} ${c.gray('(↑/↓ 移动, Enter 确认, Esc 取消)')}`);

  for (let i = startIndex; i < endIndex; i++) {
    const option = options[i];
    const isActive = i === activeIndex;
    const prefix = isActive ? c.cyan('❯ ') : '  ';
    const label = isActive ? c.cyan(c.bold(option.label)) : option.label;
    const hint = option.hint ? ` ${c.gray(option.hint)}` : '';
    console.log(`${prefix}${label}${hint}`);
  }

  if (options.length > visible) {
    console.log(c.gray(`  共 ${options.length} 项，当前 ${activeIndex + 1}/${options.length}`));
    return 1 + visible + 1;
  }

  return 1 + visible;
}

/**
 * 显示单选菜单并等待用户选择
 * @description 交互式终端中支持方向键（↑/↓ 或 k/j）移动、Enter 确认、Esc 取消，
 *   行内原地刷新；长列表自动滚动。非交互环境降级为"输入编号"模式。
 * @param {string} message - 提示信息
 * @param {Array<{ label: string, value: *, hint?: string }>} options - 选项列表
 * @param {Object} [config] - 配置
 * @param {number} [config.initial=0] - 初始选中索引
 * @returns {Promise<*|null>} 所选选项的 value；取消时返回 null
 *
 * @example
 * const quality = await select('选择音质', [
 *   { label: '高质量', value: 'high' },
 *   { label: '中质量', value: 'medium' }
 * ]);
 */
export function select(message, options, { initial = 0 } = {}) {
  return new Promise(resolve => {
    if (!options || options.length === 0) {
      resolve(null);
      return;
    }

    // 非交互环境（管道、CI）：降级为数字输入
    if (!isInteractive()) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      console.log(`${c.cyan('?')} ${c.bold(message)}`);
      options.forEach((option, i) => {
        console.log(`  ${i + 1}. ${option.label}${option.hint ? ` ${c.gray(option.hint)}` : ''}`);
      });
      rl.question('请输入编号: ', answer => {
        rl.close();
        const index = parseInt(answer, 10);
        resolve(Number.isInteger(index) && index >= 1 && index <= options.length
          ? options[index - 1].value
          : null);
      });
      return;
    }

    let activeIndex = Math.min(Math.max(initial, 0), options.length - 1);
    let startIndex = scrollWindow(options.length, activeIndex, visibleCountFor(options.length));
    let printedLines = 0;

    console.log('');
    printedLines = render(message, options, activeIndex, startIndex);
    cursor.hide();

    const rl = readline.createInterface({ input: process.stdin, terminal: true });
    readline.emitKeypressEvents(process.stdin, rl);
    if (process.stdin.isTTY && process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }

    const cleanup = () => {
      if (process.stdin.isTTY && process.stdin.setRawMode) {
        process.stdin.setRawMode(false);
      }
      process.stdin.removeListener('keypress', onKeypress);
      rl.close();
      cursor.show();
      // 回退到菜单起点并清除全部菜单行
      cursor.up(printedLines + 1);
      cursor.clearDown();
    };

    const redraw = () => {
      cursor.up(printedLines);
      cursor.clearDown();
      startIndex = scrollWindow(options.length, activeIndex, visibleCountFor(options.length));
      printedLines = render(message, options, activeIndex, startIndex);
    };

    const onKeypress = (str, key) => {
      if (!key) {
        return;
      }

      if (key.name === 'up' || str === 'k') {
        activeIndex = (activeIndex - 1 + options.length) % options.length;
        redraw();
      } else if (key.name === 'down' || str === 'j') {
        activeIndex = (activeIndex + 1) % options.length;
        redraw();
      } else if (key.name === 'return' || key.name === 'enter') {
        const chosen = options[activeIndex];
        cleanup();
        console.log(`${c.cyan('✔')} ${chosen.label}`);
        resolve(chosen.value);
      } else if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        cleanup();
        console.log(c.gray('已取消'));
        resolve(null);
      }
    };

    process.stdin.on('keypress', onKeypress);
  });
}

/**
 * 显示 y/n 确认框
 * @param {string} message - 确认信息
 * @param {Object} [config] - 配置
 * @param {boolean} [config.initial=true] - 默认值（直接回车时采用）
 * @returns {Promise<boolean>} 用户是否确认
 *
 * @example
 * if (await confirm('确认开始下载?')) {
 *   await startDownload();
 * }
 */
export function confirm(message, { initial = true } = {}) {
  return new Promise(resolve => {
    const hint = initial ? c.gray('(Y/n)') : c.gray('(y/N)');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${c.cyan('?')} ${c.bold(message)} ${hint} `, answer => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      if (normalized === '') {
        resolve(initial);
      } else {
        resolve(normalized === 'y' || normalized === 'yes');
      }
    });
  });
}

/**
 * 提示用户输入文本
 * @param {string} message - 提示信息
 * @param {Object} [config] - 配置
 * @param {string} [config.defaultValue=''] - 默认值（直接回车时采用）
 * @returns {Promise<string>} 用户输入（已 trim）
 *
 * @example
 * const albumId = await input('请输入专辑ID或链接: ');
 */
export function input(message, { defaultValue = '' } = {}) {
  return new Promise(resolve => {
    const suffix = defaultValue ? c.gray(` (${defaultValue})`) : '';
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${c.cyan('?')} ${c.bold(message)}${suffix} `, answer => {
      rl.close();
      const value = answer.trim();
      resolve(value || defaultValue);
    });
  });
}
