/**
 * @fileoverview 测试运行器
 * @description 集中管理和运行所有测试文件
 * @module tests/runner
 *
 * @description
 * 本模块是测试系统的入口点，负责：
 * - 导入所有测试文件
 * - 运行所有测试
 * - 输出测试结果
 *
 * 使用方法：
 * ```bash
 * npm test
 * # 或
 * node tests/runner.js
 * ```
 *
 * 添加新测试：
 * 1. 创建新的测试文件（如 moduleName.test.js）
 * 2. 在本文件中导入测试文件
 * 3. 测试会自动被框架收集并运行
 */

// 导入测试框架
import { runAllTests } from './testFramework.js';

// 导入所有测试文件（导入即注册测试到全局套件）
import './stringUtils.test.js';
import './fileUtils.test.js';
import './networkUtils.test.js';
import './configManager.test.js';
import './decryptor.test.js';
import './crypto.test.js';

/**
 * 运行所有测试
 * @description 执行所有已注册的测试套件并输出结果
 * @returns {Promise<boolean>} 所有测试是否通过
 */
async function runTests() {
  console.log('开始运行所有测试...');

  const success = await runAllTests();

  if (success) {
    console.log('\n所有测试通过！');
  } else {
    console.log('\n有测试失败！');
  }

  return success;
}

// 如果直接运行此文件，则执行所有测试
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { runTests };
