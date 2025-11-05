/**
 * @fileoverview 测试运行器
 */

// 导入测试框架
import { runAllTests } from './testFramework.js';

// 导入所有测试文件
import './stringUtils.test.js';
import './fileUtils.test.js';
import './networkUtils.test.js';
import './configManager.test.js';
import './decryptor.test.js';

/**
 * 运行所有测试
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