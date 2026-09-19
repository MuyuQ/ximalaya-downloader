/**
 * @fileoverview 下载进度条
 * @description 提供零依赖的单行进度条渲染，支持百分比、大小与速率显示。
 *   非 TTY 环境降级为按步打印百分比。
 * @module cli/ui/progress
 *
 * @example
 * const bar = createProgressBar('第01集');
 * bar.update(45, 1048576, 2345678);
 * bar.done('已完成');
 */

import { c, cursor, isInteractive } from './ansi.js';
import { formatFileSize } from '../../utils/stringUtils.js';

/**
 * 进度条总格数
 * @type {number}
 * @private
 */
const BAR_WIDTH = 24;

/**
 * 创建进度条
 * @description 在单行内原地刷新进度；调用 done() 换行结束。
 * @param {string} [label=''] - 进度条标签（如文件名）
 * @returns {Object} 进度条实例
 * @returns {Function} returns.update - 更新进度 (percentage, downloaded, total)
 * @returns {Function} returns.done - 以完成状态结束并换行
 * @returns {Function} returns.fail - 以失败状态结束并换行
 *
 * @example
 * const bar = createProgressBar('音频.mp3');
 * bar.update(50, 512, 1024);
 * bar.done();
 */
export function createProgressBar(label = '') {
  let lastRenderedText = '';
  let lastBytes = 0;
  let lastTime = Date.now();

  if (!isInteractive()) {
    let lastPct = -1;
    return {
      update(percentage) {
        // 非交互环境：每 20% 打印一次
        const step = Math.floor((percentage || 0) / 20) * 20;
        if (step > lastPct) {
          lastPct = step;
          console.log(`${label} ${step}%`);
        }
      },
      done(finalText) {
        console.log(finalText || `${label} 完成`);
      },
      fail(finalText) {
        console.log(finalText || `${label} 失败`);
      }
    };
  }

  cursor.hide();

  const render = (percentage, downloaded, total) => {
    const pct = Math.max(0, Math.min(100, percentage || 0));
    const filled = Math.round((pct / 100) * BAR_WIDTH);
    const bar = '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled);

    // 计算速率（滑动窗口：每秒更新）
    const now = Date.now();
    let speedText = '';
    if (downloaded && total) {
      const elapsed = now - lastTime;
      if (elapsed >= 500) {
        const speed = ((downloaded - lastBytes) / elapsed) * 1000;
        lastBytes = downloaded;
        lastTime = now;
        speedText = speed > 0 ? ` ${c.gray(formatFileSize(speed) + '/s')}` : '';
      }
    }

    const sizeText = downloaded && total
      ? ` ${c.gray(`${formatFileSize(downloaded)}/${formatFileSize(total)}`)}`
      : '';

    const line = `${label.padEnd(32, ' ').substring(0, 32)} ${c.cyan(bar)} ${String(pct).padStart(3)}%${sizeText}${speedText}`;
    if (line !== lastRenderedText) {
      lastRenderedText = line;
      cursor.clearLine();
      process.stdout.write(line);
    }
  };

  return {
    update(percentage, downloaded, total) {
      render(percentage, downloaded, total);
    },
    done(finalText) {
      cursor.clearLine();
      console.log(`${c.green('✔')} ${finalText || label} 完成`);
      cursor.show();
    },
    fail(finalText) {
      cursor.clearLine();
      console.log(`${c.red('✗')} ${finalText || label} 失败`);
      cursor.show();
    }
  };
}
