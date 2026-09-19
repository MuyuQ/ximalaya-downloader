/**
 * @fileoverview 简易测试框架
 * @description 提供类似于 Jest 的测试API，支持测试套件、断言和模拟函数
 * @module tests/testFramework
 *
 * @description
 * 本模块实现了一个轻量级的测试框架，主要功能包括：
 * - 测试套件管理（describe）
 * - 测试用例定义（test）
 * - 断言函数（expect）
 * - 生命周期钩子（beforeEach, afterEach）
 * - 模拟函数（jest.fn）
 *
 * 使用方法：
 * 1. 使用 describe 创建测试套件
 * 2. 在套件中使用 test 定义测试用例
 * 3. 使用 expect 进行断言
 *
 * @example
 * describe('字符串工具测试', ({ test }) => {
 *   test('formatTime 应该正确格式化时间', () => {
 *     expect(formatTime(125)).toBe('02:05');
 *   });
 *
 *   test('formatFileSize 应该正确格式化大小', () => {
 *     expect(formatFileSize(1024)).toBe('1 KB');
 *   });
 * });
 */

/**
 * 测试套件类
 * @class TestSuite
 * @description 管理一组相关的测试用例
 */
/**
 * 测试套件类
 * @class TestSuite
 * @description 管理一组相关的测试用例
 */
class TestSuite {
  /**
   * 创建测试套件实例
   * @param {string} name - 测试套件名称
   */
  constructor(name) {
    /** @type {string} 测试套件名称 */
    this.name = name;
    /** @type {Array<Object>} 测试用例数组 */
    this.tests = [];
    /** @type {Array<Function>} 每个测试前执行的回调 */
    this.beforeEachCallbacks = [];
    /** @type {Array<Function>} 每个测试后执行的回调 */
    this.afterEachCallbacks = [];
  }

  /**
   * 添加测试用例
   * @param {string} name - 测试名称
   * @param {Function} fn - 测试函数
   */
  test(name, fn) {
    this.tests.push({ name, fn });
  }

  /**
   * 添加 beforeEach 钩子
   * @param {Function} fn - 在每个测试前执行的回调函数
   */
  beforeEach(fn) {
    this.beforeEachCallbacks.push(fn);
  }

  /**
   * 添加 afterEach 钩子
   * @param {Function} fn - 在每个测试后执行的回调函数
   */
  afterEach(fn) {
    this.afterEachCallbacks.push(fn);
  }

  /**
   * 运行测试套件中的所有测试
   * @returns {Promise<Object>} 测试结果，包含 passed 和 failed 计数
   */
  async run() {
    console.log(`\n运行测试套件: ${this.name}`);

    let passed = 0;
    let failed = 0;

    for (const test of this.tests) {
      try {
        // 运行beforeEach回调
        for (const callback of this.beforeEachCallbacks) {
          await callback();
        }

        // 运行测试
        await test.fn();

        console.log(`  ✓ ${test.name}`);
        passed++;
      } catch (error) {
        console.log(`  ✗ ${test.name}`);
        console.log(`    错误: ${error.message}`);
        failed++;
      } finally {
        // 运行afterEach回调
        for (const callback of this.afterEachCallbacks) {
          try {
            await callback();
          } catch (error) {
            console.error(`    afterEach错误: ${error.message}`);
          }
        }
      }
    }

    console.log(`  通过: ${passed}, 失败: ${failed}`);

    return { passed, failed };
  }
}

/**
 * 全局测试套件集合
 */
const testSuites = [];

/**
 * 创建测试套件
 */
function describe(name, fn) {
  const suite = new TestSuite(name);
  testSuites.push(suite);

  // 提供测试API
  const testAPI = {
    test: (testName, testFn) => suite.test(testName, testFn),
    beforeEach: (fn) => suite.beforeEach(fn),
    afterEach: (fn) => suite.afterEach(fn)
  };

  // 运行测试套件定义函数
  fn(testAPI);
}

/**
 * 创建测试
 */
function test(name, fn) {
  // 如果没有测试套件，创建一个默认的
  if (testSuites.length === 0) {
    describe('默认测试套件', () => {});
  }

  // 添加到最后一个测试套件
  testSuites[testSuites.length - 1].test(name, fn);
}

/**
 * 运行所有测试套件
 */
async function runAllTests() {
  console.log('开始运行所有测试...');

  let totalPassed = 0;
  let totalFailed = 0;

  for (const suite of testSuites) {
    const { passed, failed } = await suite.run();
    totalPassed += passed;
    totalFailed += failed;
  }

  console.log(`\n测试结果: 总共 ${totalPassed + totalFailed} 个测试, 通过 ${totalPassed}, 失败 ${totalFailed}`);

  return totalFailed === 0;
}

/**
 * 断言函数
 */
const expect = (actual) => ({
  toBe: (expected) => {
    if (actual !== expected) {
      throw new Error(`期望 ${expected}, 但得到 ${actual}`);
    }
  },

  toEqual: (expected) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`期望 ${JSON.stringify(expected)}, 但得到 ${JSON.stringify(actual)}`);
    }
  },

  toHaveProperty: (property) => {
    if (!(property in actual)) {
      throw new Error(`期望对象有属性 ${property}, 但没有找到`);
    }
  },

  toHaveLength: (length) => {
    if (actual.length !== length) {
      throw new Error(`期望长度为 ${length}, 但得到 ${actual.length}`);
    }
  },

  toBeInstanceOf: (constructor) => {
    if (!(actual instanceof constructor)) {
      throw new Error(`期望是 ${constructor.name} 的实例, 但不是`);
    }
  },

  toBeTruthy: () => {
    if (!actual) {
      throw new Error(`期望为真值, 但得到 ${actual}`);
    }
  },

  toBeFalsy: () => {
    if (actual) {
      throw new Error(`期望为假值, 但得到 ${actual}`);
    }
  },

  toContain: (expected) => {
    if (!actual.includes(expected)) {
      throw new Error(`期望包含 ${expected}, 但没有找到`);
    }
  },

  toThrow: () => {
    let threw = false;
    try {
      actual();
    } catch (e) {
      threw = true;
    }

    if (!threw) {
      throw new Error('期望抛出错误, 但没有抛出');
    }
  }
});

/**
 * 模拟函数
 */
function jest() {
  return {
    fn: (implementation) => {
      const mockFn = (...args) => {
        mockFn.calls.push(args);
        return implementation ? implementation(...args) : undefined;
      };

      mockFn.calls = [];
      mockFn.mockReturnValue = (value) => {
        mockFn.returnValue = value;
        return mockFn;
      };

      mockFn.mockResolvedValue = (value) => {
        mockFn.resolvedValue = value;
        return mockFn;
      };

      return mockFn;
    }
  };
}

// 将测试函数添加到全局作用域
global.describe = describe;
global.test = test;
global.expect = expect;
global.jest = jest;
global.fail = (message) => {
  throw new Error(message);
};

export { runAllTests, describe, test, expect, jest };
