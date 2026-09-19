/**
 * @fileoverview 配置管理模块的单元测试
 */

import {
  readConfig,
  writeConfig,
  updateConfig,
  validateConfig,
  checkConfig,
  resetConfig,
  getConfigFilePath,
  getDefaultConfig,
  exportConfig,
  importConfig
} from '../core/configManager.js';

/**
 * 配置管理模块测试套件
 */
describe('配置管理模块测试', () => {

  /**
   * 测试readConfig函数
   */
  describe('readConfig', () => {
    test('应该返回配置对象', async () => {
      const config = await readConfig();

      expect(typeof config).toBe('object');
      expect(config).toHaveProperty('cookie');
      expect(config).toHaveProperty('path');
      expect(config).toHaveProperty('bid');
      expect(config).toHaveProperty('quality');
      expect(config).toHaveProperty('maxRetries');
      expect(config).toHaveProperty('concurrentDownloads');
      expect(config).toHaveProperty('userAgent');
    });
  });

  /**
   * 测试writeConfig函数
   */
  describe('writeConfig', () => {
    test('应该写入配置', async () => {
      const testConfig = {
        cookie: 'test_cookie',
        path: '/test/path',
        bid: 'test_bid',
        quality: 2,
        maxRetries: 3,
        concurrentDownloads: 3,
        userAgent: 'test_agent'
      };

      const result = await writeConfig(testConfig);
      expect(result).toBe(true);
    });
  });

  /**
   * 测试updateConfig函数
   */
  describe('updateConfig', () => {
    test('应该更新配置', async () => {
      const updates = {
        cookie: 'updated_cookie',
        quality: 3
      };

      const result = await updateConfig(updates);
      expect(result).toBe(true);
    });
  });

  /**
   * 测试validateConfig函数
   */
  describe('validateConfig', () => {
    test('应该验证有效配置', () => {
      const validConfig = {
        cookie: 'test_cookie',
        path: '/test/path',
        bid: 'test_bid',
        quality: 2,
        maxRetries: 3,
        concurrentDownloads: 3,
        userAgent: 'test_agent'
      };

      const result = validateConfig(validConfig);
      expect(result.isValid).toBe(true);
    });

    test('应该拒绝无效配置', () => {
      const invalidConfig = {
        cookie: '',
        path: '',
        bid: '',
        quality: 5, // 无效的质量值
        maxRetries: -1, // 无效的重试次数
        concurrentDownloads: 0, // 无效的并发数
        userAgent: ''
      };

      const result = validateConfig(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  /**
   * 测试checkConfig函数
   */
  describe('checkConfig', () => {
    test('应该检查配置', async () => {
      const config = await readConfig();
      const result = await checkConfig(config);

      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
    });
  });

  /**
   * 测试resetConfig函数
   */
  describe('resetConfig', () => {
    test('应该重置配置', async () => {
      const result = await resetConfig();
      expect(result).toBe(true);
    });
  });

  /**
   * 测试getConfigFilePath函数
   */
  describe('getConfigFilePath', () => {
    test('应该返回配置文件路径', () => {
      const path = getConfigFilePath();

      expect(typeof path).toBe('string');
      expect(path.length).toBeGreaterThan(0);
    });
  });

  /**
   * 测试getDefaultConfig函数
   */
  describe('getDefaultConfig', () => {
    test('应该返回默认配置', () => {
      const config = getDefaultConfig();

      expect(typeof config).toBe('object');
      expect(config).toHaveProperty('cookie');
      expect(config).toHaveProperty('path');
      expect(config).toHaveProperty('bid');
      expect(config).toHaveProperty('quality');
      expect(config).toHaveProperty('maxRetries');
      expect(config).toHaveProperty('concurrentDownloads');
      expect(config).toHaveProperty('userAgent');
    });
  });

  /**
   * 测试exportConfig函数
   */
  describe('exportConfig', () => {
    test('应该导出配置', async () => {
      const result = await exportConfig('/test/export.json');

      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('success');
    });
  });

  /**
   * 测试importConfig函数
   */
  describe('importConfig', () => {
    test('应该导入配置', async () => {
      const result = await importConfig('/test/import.json');

      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('success');
    });
  });
});
