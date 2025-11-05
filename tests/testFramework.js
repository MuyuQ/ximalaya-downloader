/**
 * @fileoverview 简单的测试框架
 */

/**
 * 测试套件
 */
class TestSuite {
  constructor(name) {
    this.name = name;
    this.tests = [];
    this.beforeEachCallbacks = [];
    this.afterEachCallbacks = [];
  }
  
  /**
   * 添加测试
   */
  test(name, fn) {
    this.tests.push({ name, fn });
  }
  
  /**
   * 添加beforeEach回调
   */
  beforeEach(fn) {
    this.beforeEachCallbacks.push(fn);
  }
  
  /**
   * 添加afterEach回调
   */
  afterEach(fn) {
    this.afterEachCallbacks.push(fn);
  }
  
  /**
   * 运行测试套件
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