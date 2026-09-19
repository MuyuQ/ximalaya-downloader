/**
 * @fileoverview configManager 单元测试
 * @description 使用临时目录隔离配置文件，覆盖读取、写入、更新、验证、
 *   Cookie 加密存储与解密失败处理
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'xmly-config-'));
const configPath = path.join(tmpDir, 'config.json');
process.env.XIMALAYA_CONFIG_PATH = configPath;
process.env.XIMALAYA_KEY_PATH = path.join(tmpDir, '.encryption.key');

const {
  readConfig,
  updateConfig,
  validateConfig,
  checkConfig,
  resetConfig,
  getConfigFilePath,
  getDefaultConfig
} = await import('../src/core/configManager.js');

after(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.XIMALAYA_CONFIG_PATH;
  delete process.env.XIMALAYA_KEY_PATH;
});

describe('readConfig', () => {
  it('配置文件不存在时创建默认配置', async () => {
    const config = await readConfig();
    assert.equal(existsSync(configPath), true);
    assert.equal(config.path, './downloads');
    assert.equal(config.quality, 'high');
    assert.equal(config.concurrentDownloads, 3);
  });

  it('配置缺失项自动以默认值合并', async () => {
    writeFileSync(configPath, JSON.stringify({ path: '/custom' }));
    const config = await readConfig();
    assert.equal(config.path, '/custom');
    assert.equal(config.quality, 'high');
  });
});

describe('writeConfig / updateConfig', () => {
  it('更新配置并持久化', async () => {
    await updateConfig({ path: './my-downloads', concurrentDownloads: 5 });
    const config = await readConfig();
    assert.equal(config.path, './my-downloads');
    assert.equal(config.concurrentDownloads, 5);
  });

  it('Cookie 加密存储（文件中无明文）', async () => {
    const secret = '1&_token=super-secret-cookie-value';
    await updateConfig({ cookie: secret, bid: 'test-bid-value' });

    const raw = JSON.parse(readFileSync(configPath, 'utf8'));
    assert.notEqual(raw.cookie, secret);
    assert.ok(raw.cookie.length > 0);

    const config = await readConfig();
    assert.equal(config.cookie, secret);
  });
});

describe('validateConfig', () => {
  it('非法类型自动修正为默认值', () => {
    const fixed = validateConfig({
      path: 123,
      quality: 'ultra',
      maxRetries: -1,
      concurrentDownloads: 0,
      retryDelay: 'x',
      cookie: null,
      bid: 42
    });

    assert.equal(fixed.path, './downloads');
    assert.equal(fixed.quality, 'high');
    assert.equal(fixed.maxRetries, 3);
    assert.equal(fixed.concurrentDownloads, 3);
    assert.equal(fixed.retryDelay, 1000);
    assert.equal(fixed.cookie, '');
    assert.equal(fixed.bid, '');
  });

  it('非对象输入抛出错误', () => {
    assert.throws(() => validateConfig(null), /配置必须是对象/);
    assert.throws(() => validateConfig('string'), /配置必须是对象/);
  });
});

describe('checkConfig', () => {
  it('未登录时提示需要登录（离线校验）', async () => {
    await resetConfig();
    const config = await readConfig();
    const result = await checkConfig(config, { verifyOnline: false });
    assert.equal(result.valid, false);
    assert.equal(result.needLogin, true);
  });

  it('解密失败时给出明确的重新登录提示', async () => {
    // 写入一个"加密格式"但无法解密的 Cookie（密钥不匹配）
    writeFileSync(configPath, JSON.stringify({
      cookie: Buffer.from('x'.repeat(120)).toString('base64'),
      bid: 'some-bid'
    }));

    const config = await readConfig();
    assert.equal(config.cookieDecryptFailed, true);

    const result = await checkConfig(config, { verifyOnline: false });
    assert.equal(result.valid, false);
    assert.equal(result.needLogin, true);
    assert.match(result.error, /重新登录/);
  });
});

describe('辅助接口', () => {
  it('getConfigFilePath 返回当前配置路径', () => {
    assert.equal(getConfigFilePath(), configPath);
  });

  it('getDefaultConfig 返回默认配置副本', () => {
    const defaults = getDefaultConfig();
    assert.equal(defaults.path, './downloads');
    // 修改副本不影响内部默认值
    defaults.path = 'changed';
    assert.equal(getDefaultConfig().path, './downloads');
  });

  it('resetConfig 恢复默认配置', async () => {
    await updateConfig({ path: '/tmp/custom' });
    await resetConfig();
    const config = await readConfig();
    assert.equal(config.path, './downloads');
  });
});
