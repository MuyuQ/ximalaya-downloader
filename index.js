#!/usr/bin/env node
/**
 * @fileoverview 兼容入口
 * @description 保留项目根目录的 index.js 以兼容 `node index.js` 与 `npm start`
 *   等旧用法；真正的入口逻辑位于 src/index.js，可执行入口为 bin/xmly.js。
 *
 * @example
 * node index.js --help
 * npm start
 */

import { handleCommandLineArgs } from './src/index.js';

handleCommandLineArgs(process.argv.slice(2)).catch(error => {
  console.error('程序错误:', error.message);
  process.exit(1);
});
