/**
 * @fileoverview 加载动画（Spinner）
 * @description 提供零依赖的终端加载动画，支持成功/失败/更新文案等状态。
 *   非 TTY 环境自动降级为静态文本输出。
 * @module cli/ui/spinner
 *
 * @example
 * const spinner = createSpinner('正在获取音频信息...');
 * try {
 *   const info = await analyzeSound(id);
 *   spinner.succeed(`已获取: ${info.title}`);
 * } catch (error) {
 *   spinner.fail(`获取失败: ${error.message}`);
 * }
 */

import { c, cursor, isInteractive } from './ansi.js';

/**
 * Braille 风格动画帧
 * @type {string[]}
 * @private
 */
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * 创建加载动画
 * @description 立即开始播放动画；调用 stop/succeed/fail 结束。
 *   非 TTY 环境只打印一次初始文案。
 * @param {string} text - 初始文案
 * @returns {Object} spinner 实例
 * @returns {Function} returns.text - 更新文案
 * @returns {Function} returns.succeed - 以绿色 ✓ 结束
 * @returns {Function} returns.fail - 以红色 ✗ 结束
 * @returns {Function} returns.stop - 静默停止
 *
 * @example
 * const spinner = createSpinner('加载中...');
 * spinner.text('换个文案');
 * spinner.succeed('完成');
 */
export function createSpinner(text) {
  if (!isInteractive()) {
    console.log(text);
    return {
      text: (newText) => {
        console.log(newText);
      },
      succeed: (finalText) => console.log(finalText || text),
      fail: (finalText) => console.log(finalText || text),
      stop: () => {}
    };
  }

  let frameIndex = 0;
  let currentText = text;
  let timer = null;
  let running = true;

  cursor.hide();

  const draw = () => {
    cursor.clearLine();
    const frame = c.cyan(FRAMES[frameIndex % FRAMES.length]);
    process.stdout.write(`${frame} ${currentText}`);
    frameIndex++;
  };

  timer = setInterval(draw, 80);
  draw();

  const finish = (symbol, finalText) => {
    if (!running) {
      return;
    }
    running = false;
    clearInterval(timer);
    cursor.clearLine();
    console.log(`${symbol} ${finalText || currentText}`);
    cursor.show();
  };

  return {
    /** 更新文案 */
    text(newText) {
      currentText = newText;
    },
    /** 成功结束（绿色 ✓） */
    succeed(finalText) {
      finish(c.green('✔'), finalText);
    },
    /** 失败结束（红色 ✗） */
    fail(finalText) {
      finish(c.red('✗'), finalText);
    },
    /** 静默停止（不打印结束文案） */
    stop() {
      if (!running) {
        return;
      }
      running = false;
      clearInterval(timer);
      cursor.clearLine();
      cursor.show();
    }
  };
}
