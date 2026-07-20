import { encryptCookie, decryptCookie, isEncryptedCookie } from '../utils/crypto.js';
import { randomBytes } from 'crypto';

const testKey = randomBytes(32);

describe('加密模块测试', () => {
  test('加密和解密往返应该成功', () => {
    const originalCookie = 'test_cookie_value_12345';
    const encrypted = encryptCookie(originalCookie, testKey);
    const decrypted = decryptCookie(encrypted, testKey);
    expect(decrypted).toBe(originalCookie);
  });

  test('加密后的值应该与原始值不同', () => {
    const originalCookie = 'secret_cookie_data';
    const encrypted = encryptCookie(originalCookie, testKey);
    expect(encrypted).not.toBe(originalCookie);
  });

  test('使用错误的密钥解密应该失败', () => {
    const originalCookie = 'test_cookie';
    const encrypted = encryptCookie(originalCookie, testKey);
    const wrongKey = randomBytes(32);
    expect(() => decryptCookie(encrypted, wrongKey)).toThrow();
  });

  test('isEncryptedCookie应该正确识别加密的Cookie', () => {
    const originalCookie = 'plain_cookie';
    const encrypted = encryptCookie(originalCookie, testKey);
    expect(isEncryptedCookie(encrypted)).toBe(true);
    expect(isEncryptedCookie(originalCookie)).toBe(false);
  });

  test('加密空字符串应该抛出错误', () => {
    expect(() => encryptCookie('', testKey)).toThrow();
    expect(() => encryptCookie(null, testKey)).toThrow();
    expect(() => encryptCookie(undefined, testKey)).toThrow();
  });

  test('解密空字符串应该抛出错误', () => {
    expect(() => decryptCookie('', testKey)).toThrow();
    expect(() => decryptCookie(null, testKey)).toThrow();
  });

  test('使用无效密钥应该抛出错误', () => {
    expect(() => encryptCookie('test', Buffer.alloc(16))).toThrow();
    expect(() => decryptCookie('dGVzdA==', Buffer.alloc(16))).toThrow();
  });

  test('相同明文每次加密结果应该不同（因为随机salt和iv）', () => {
    const originalCookie = 'same_cookie';
    const encrypted1 = encryptCookie(originalCookie, testKey);
    const encrypted2 = encryptCookie(originalCookie, testKey);
    expect(encrypted1).not.toBe(encrypted2);
    expect(decryptCookie(encrypted1, testKey)).toBe(originalCookie);
    expect(decryptCookie(encrypted2, testKey)).toBe(originalCookie);
  });

  test('加密后的Cookie应该是Base64格式', () => {
    const originalCookie = 'test_cookie';
    const encrypted = encryptCookie(originalCookie, testKey);
    expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
  });
});
