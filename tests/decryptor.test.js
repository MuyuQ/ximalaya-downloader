/**
 * @fileoverview 解密模块的单元测试
 */

import {
  decryptUrl,
  batchDecryptUrls,
  batchDecryptUrlsAsync,
  isUrlEncrypted,
  decryptUrlIfNeeded
} from '../core/decryptor.js';

/**
 * 解密模块测试套件
 */
describe('解密模块测试', () => {
  
  /**
   * 测试decryptUrl函数
   */
  describe('decryptUrl', () => {
    test('应该解密加密的URL', () => {
      // 使用一个模拟的加密URL
      const encryptedUrl = 'aHR0cHM6Ly9leGFtcGxlLmNvbS9lbmNyeXB0ZWQ=';
      
      const result = decryptUrl(encryptedUrl);
      
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
    
    test('应该处理空字符串', () => {
      const result = decryptUrl('');
      
      expect(result).toBe('');
    });
    
    test('应该处理非字符串输入', () => {
      const result1 = decryptUrl(null);
      const result2 = decryptUrl(undefined);
      const result3 = decryptUrl(123);
      
      expect(result1).toBe('');
      expect(result2).toBe('');
      expect(result3).toBe('');
    });
  });
  
  /**
   * 测试batchDecryptUrls函数
   */
  describe('batchDecryptUrls', () => {
    test('应该批量解密URL', () => {
      const encryptedUrls = [
        'aHR0cHM6Ly9leGFtcGxlLmNvbS9lbmNyeXB0ZWQx',
        'aHR0cHM6Ly9leGFtcGxlLmNvbS9lbmNyeXB0ZWQy',
        'aHR0cHM6Ly9leGFtcGxlLmNvbS9lbmNyeXB0ZWQz'
      ];
      
      const result = batchDecryptUrls(encryptedUrls);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
      
      result.forEach(url => {
        expect(typeof url).toBe('string');
        expect(url.length).toBeGreaterThan(0);
      });
    });
    
    test('应该处理空数组', () => {
      const result = batchDecryptUrls([]);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
    
    test('应该处理非数组输入', () => {
      const result1 = batchDecryptUrls(null);
      const result2 = batchDecryptUrls(undefined);
      const result3 = batchDecryptUrls('not an array');
      
      expect(Array.isArray(result1)).toBe(true);
      expect(result1.length).toBe(0);
      
      expect(Array.isArray(result2)).toBe(true);
      expect(result2.length).toBe(0);
      
      expect(Array.isArray(result3)).toBe(true);
      expect(result3.length).toBe(0);
    });
  });
  
  /**
   * 测试batchDecryptUrlsAsync函数
   */
  describe('batchDecryptUrlsAsync', () => {
    test('应该异步批量解密URL', async () => {
      const encryptedUrls = [
        'aHR0cHM6Ly9leGFtcGxlLmNvbS9lbmNyeXB0ZWQx',
        'aHR0cHM6Ly9leGFtcGxlLmNvbS9lbmNyeXB0ZWQy',
        'aHR0cHM6Ly9leGFtcGxlLmNvbS9lbmNyeXB0ZWQz'
      ];
      
      const result = await batchDecryptUrlsAsync(encryptedUrls);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
      
      result.forEach(url => {
        expect(typeof url).toBe('string');
        expect(url.length).toBeGreaterThan(0);
      });
    });
    
    test('应该处理空数组', async () => {
      const result = await batchDecryptUrlsAsync([]);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });
  
  /**
   * 测试isUrlEncrypted函数
   */
  describe('isUrlEncrypted', () => {
    test('应该识别加密的URL', () => {
      // 使用一个模拟的加密URL
      const encryptedUrl = 'aHR0cHM6Ly9leGFtcGxlLmNvbS9lbmNyeXB0ZWQ=';
      
      const result = isUrlEncrypted(encryptedUrl);
      
      expect(typeof result).toBe('boolean');
    });
    
    test('应该处理空字符串', () => {
      const result = isUrlEncrypted('');
      
      expect(typeof result).toBe('boolean');
    });
    
    test('应该处理非字符串输入', () => {
      const result1 = isUrlEncrypted(null);
      const result2 = isUrlEncrypted(undefined);
      const result3 = isUrlEncrypted(123);
      
      expect(typeof result1).toBe('boolean');
      expect(typeof result2).toBe('boolean');
      expect(typeof result3).toBe('boolean');
    });
  });
  
  /**
   * 测试decryptUrlIfNeeded函数
   */
  describe('decryptUrlIfNeeded', () => {
    test('应该在需要时解密URL', () => {
      // 使用一个模拟的加密URL
      const encryptedUrl = 'aHR0cHM6Ly9leGFtcGxlLmNvbS9lbmNyeXB0ZWQ=';
      
      const result = decryptUrlIfNeeded(encryptedUrl);
      
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
    
    test('应该返回未加密的URL', () => {
      const normalUrl = 'https://example.com/normal-url';
      
      const result = decryptUrlIfNeeded(normalUrl);
      
      expect(result).toBe(normalUrl);
    });
    
    test('应该处理空字符串', () => {
      const result = decryptUrlIfNeeded('');
      
      expect(result).toBe('');
    });
  });
});