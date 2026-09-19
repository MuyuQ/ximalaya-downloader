#!/usr/bin/env node
/**
 * @fileoverview 喜马拉雅音频下载器可执行入口
 * @description npm bin 入口（package.json 的 bin 字段指向本文件），
 *   负责转发到 src/index.js 的参数分发逻辑。
 *
 * @example
 * // 安装后全局使用
 * xmly --help
 *
 * // 直接运行
 * node bin/xmly.js download 12345678
 */

import { handleCommandLineArgs } from '../src/index.js';

handleCommandLineArgs(process.argv.slice(2)).catch(error => {
  console.error('程序错误:', error.message);
  process.exit(1);
});
