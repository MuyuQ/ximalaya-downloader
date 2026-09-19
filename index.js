#!/usr/bin/env node
/**
 * @fileoverview 喜马拉雅音频下载器 - Node.js CLI 入口文件
 * @description 这是应用程序的主入口点，负责启动命令行界面处理用户请求
 * @author ximalaya-downloader
 * @version 2.0.0
 * @license MIT
 *
 * @example
 * // 直接运行启动交互式界面
 * node index.js
 *
 * // 使用命令行参数下载单个音频
 * node index.js --download <音频ID>
 *
 * // 使用命令行参数下载专辑
 * node index.js --download <专辑ID> --album
 *
 * // 查看帮助信息
 * node index.js --help
 */

import { handleCommandLineArgs } from './interfaces/cli.js';

/**
 * 应用程序主入口函数
 * @description 处理命令行参数并启动相应的功能模块
 * @returns {Promise<void>} 无返回值
 *
 * @throws {Error} 当程序发生未捕获的错误时输出错误信息并退出
 *
 * @example
 * // 处理命令行参数
 * handleCommandLineArgs(process.argv.slice(2)).catch(error => {
 *   console.error('程序错误:', error.message);
 *   process.exit(1);
 * });
 */
// 处理命令行参数
handleCommandLineArgs(process.argv.slice(2)).catch(error => {
  console.error('程序错误:', error.message);
  process.exit(1);
});
