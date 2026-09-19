/**
 * @fileoverview ANSI 终端样式与光标控制
 * @description 提供零依赖的终端颜色与光标控制原语，自动降级：
 *   - 非 TTY 环境（管道、重定向）自动禁用所有 ANSI 序列
 *   - 支持 NO_COLOR 环境变量（https://no-color.org/ 约定）
 * @module cli/ui/ansi
 *
 * @example
 * import { c, cursor } from './cli/ui/ansi.js';
 * console.log(c.green('✓') + ' 下载完成');
 * cursor.clearLine();
 */

/**
 * 颜色输出是否启用
 * @type {boolean}
 * @private
 */
const enabled = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

/**
 * 包裹 ANSI 转义码
 * @param {string} code - 转义码
 * @returns {(text: string) => string} 格式化函数
 * @private
 */
function wrap(code) {
  return text => (enabled ? `\u001B[${code}m${text}\u001B[0m` : String(text));
}

/**
 * 终端颜色与样式集合
 * @type {Object}
 * @property {Function} bold - 加粗
 * @property {Function} dim - 暗淡
 * @property {Function} red - 红色
 * @property {Function} green - 绿色
 * @property {Function} yellow - 黄色
 * @property {Function} blue - 蓝色
 * @property {Function} magenta - 品红
 * @property {Function} cyan - 青色
 * @property {Function} gray - 灰色
 * @property {Function} white - 白色
 */
export const c = {
  bold: wrap('1'),
  dim: wrap('2'),
  red: wrap('31'),
  green: wrap('32'),
  yellow: wrap('33'),
  blue: wrap('34'),
  magenta: wrap('35'),
  cyan: wrap('36'),
  gray: wrap('90'),
  white: wrap('97')
};

/**
 * 光标与行控制
 * @type {Object}
 */
export const cursor = {
  /** 清除当前行 */
  clearLine() {
    if (enabled) {
      process.stdout.write('\u001B[2K\r');
    }
  },
  /** 清除从光标到屏幕末尾的内容 */
  clearDown() {
    if (enabled) {
      process.stdout.write('\u001B[J');
    }
  },
  /** 光标上移 n 行 */
  up(n = 1) {
    if (enabled) {
      process.stdout.write(`\u001B[${n}A`);
    }
  },
  /** 隐藏光标 */
  hide() {
    if (enabled) {
      process.stdout.write('\u001B[?25l');
    }
  },
  /** 显示光标 */
  show() {
    if (enabled) {
      process.stdout.write('\u001B[?25h');
    }
  }
};

/**
 * 判断当前是否为交互式终端
 * @returns {boolean} 是否为 TTY
 */
export function isInteractive() {
  return Boolean(process.stdout.isTTY && process.stdin.isTTY);
}
