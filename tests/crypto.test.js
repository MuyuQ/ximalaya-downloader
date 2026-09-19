/**
 * @fileoverview crypto 加密模块单元测试
 * @description 覆盖 AES-256-GCM 加解密往返、错误密钥、密钥文件管理。
 *   使用环境变量将密钥文件重定向到临时目录，避免污染项目目录。
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'xmly-crypto-'));
process.env.XIMALAYA_KEY_PATH = path.join(tmpDir, '.encryption.key');

const { encryptCookie, decryptCookie, isEncryptedCookie, getEncryptionKey, resetKeyCache } = await import('../src/utils/crypto.js');

after(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.XIMALAYA_KEY_PATH;
  delete process.env.XIMALAYA_ENCRYPTION_KEY;
});

describe('encryptCookie / decryptCookie 往返', () => {
  it('加密后可正确解密', () => {
    const key = Buffer.alloc(32, 7);
    const plain = '1&_token=abcdef123456; xm_sg=xyz';
    const encrypted = encryptCookie(plain, key);
    assert.equal(decryptCookie(encrypted, key), plain);
  });

  it('相同明文每次加密结果不同（随机 salt 与 IV）', () => {
    const key = Buffer.alloc(32, 7);
    const plain = 'same-cookie';
    assert.notEqual(encryptCookie(plain, key), encryptCookie(plain, key));
  });

  it('使用错误密钥解密应失败', () => {
    const keyA = Buffer.alloc(32, 1);
    const keyB = Buffer.alloc(32, 2);
    const encrypted = encryptCookie('secret', keyA);
    assert.throws(() => decryptCookie(encrypted, keyB));
  });
});

describe('输入校验', () => {
  it('加密空字符串抛出错误', () => {
    assert.throws(() => encryptCookie('', Buffer.alloc(32)), /不能为空/);
  });

  it('解密空字符串抛出错误', () => {
    assert.throws(() => decryptCookie('', Buffer.alloc(32)), /不能为空/);
  });

  it('密钥长度无效抛出错误', () => {
    assert.throws(() => encryptCookie('x', Buffer.alloc(16)), /密钥无效/);
    assert.throws(() => decryptCookie('x', Buffer.alloc(16)), /密钥无效/);
  });
});

describe('isEncryptedCookie', () => {
  it('明文 Cookie 返回 false', () => {
    assert.equal(isEncryptedCookie('plain-cookie-value'), false);
  });

  it('加密结果返回 true', () => {
    const key = Buffer.alloc(32, 3);
    const encrypted = encryptCookie('some-cookie', key);
    assert.equal(isEncryptedCookie(encrypted), true);
  });

  it('非法输入返回 false', () => {
    assert.equal(isEncryptedCookie(''), false);
    assert.equal(isEncryptedCookie(null), false);
  });
});

describe('getEncryptionKey', () => {
  it('首次调用生成密钥文件', async () => {
    const keyPath = path.join(tmpDir, '.encryption.key');
    assert.equal(existsSync(keyPath), false);

    const key = await getEncryptionKey();
    assert.equal(key.length, 32);
    assert.equal(existsSync(keyPath), true);
  });

  it('支持通过 XIMALAYA_ENCRYPTION_KEY 环境变量提供密钥', async () => {
    resetKeyCache();
    process.env.XIMALAYA_ENCRYPTION_KEY = 'ab'.repeat(32);

    const key = await getEncryptionKey();
    assert.equal(key.length, 32);
    assert.deepEqual(key, Buffer.from('ab'.repeat(32), 'hex'));

    delete process.env.XIMALAYA_ENCRYPTION_KEY;
    resetKeyCache();
  });
});
