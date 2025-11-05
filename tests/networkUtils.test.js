/**
 * @fileoverview 网络工具模块的单元测试
 */

import {
  httpRequest,
  createAuthHeaders,
  generateXmSign
} from '../utils/networkUtils.js';

/**
 * 网络工具模块测试套件
 */
describe('网络工具模块测试', () => {
  
  /**
   * 测试httpRequest函数
   */
  describe('httpRequest', () => {
    test('应该返回Promise', () => {
      const result = httpRequest('https://example.com/api');
      expect(result).toBeInstanceOf(Promise);
    });
    
    test('应该处理GET请求', async () => {
      // 使用mock函数模拟fetch
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })
      );
      
      const result = await httpRequest('https://example.com/api', {
        method: 'GET'
      });
      
      expect(result).toEqual({ success: true });
    });
    
    test('应该处理POST请求', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })
      );
      
      const result = await httpRequest('https://example.com/api', {
        method: 'POST',
        body: JSON.stringify({ data: 'test' })
      });
      
      expect(result).toEqual({ success: true });
    });
    
    test('应该处理网络错误', async () => {
      global.fetch = jest.fn(() =>
        Promise.reject(new Error('Network error'))
      );
      
      try {
        await httpRequest('https://example.com/api');
        fail('应该抛出错误');
      } catch (error) {
        expect(error.message).toBe('Network error');
      }
    });
    
    test('应该处理HTTP错误状态', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found'
        })
      );
      
      try {
        await httpRequest('https://example.com/api');
        fail('应该抛出错误');
      } catch (error) {
        expect(error.message).toContain('404');
      }
    });
  });
  
  /**
   * 测试createAuthHeaders函数
   */
  describe('createAuthHeaders', () => {
    test('应该创建认证头', () => {
      const headers = createAuthHeaders('test_cookie', 'test_sign');
      
      expect(headers).toHaveProperty('Cookie', 'test_cookie');
      expect(headers).toHaveProperty('xm-sign', 'test_sign');
      expect(headers).toHaveProperty('User-Agent');
    });
    
    test('应该处理空参数', () => {
      const headers = createAuthHeaders('', '');
      
      expect(headers).toHaveProperty('Cookie', '');
      expect(headers).toHaveProperty('xm-sign', '');
      expect(headers).toHaveProperty('User-Agent');
    });
  });
  
  /**
   * 测试generateXmSign函数
   */
  describe('generateXmSign', () => {
    test('应该生成xm-sign', () => {
      const sign = generateXmSign();
      
      expect(typeof sign).toBe('string');
      expect(sign.length).toBeGreaterThan(0);
    });
  });
});