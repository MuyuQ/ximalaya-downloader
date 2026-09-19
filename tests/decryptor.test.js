/**
 * @fileoverview decryptor 单元测试
 * @description 覆盖 URL 解密模块的输入校验、辅助函数与批量接口。
 *   注意：解密算法依赖平台私有映射表，无法在无真实密文的情况下构造
 *   成功路径测试向量，因此成功路径以结构化断言为主。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  decryptUrl,
  batchDecryptUrls,
  batchDecryptUrlsAsync,
  isUrlEncrypted,
  decryptUrlIfNeeded
} from '../src/core/decryptor.js';

describe('decryptUrl 输入校验', () => {
  it('空字符串抛出错误', () => {
    assert.throws(() => decryptUrl(''), /加密URL不能为空/);
  });

  it('null 抛出错误', () => {
    assert.throws(() => decryptUrl(null), /加密URL不能为空/);
  });

  it('undefined 抛出错误', () => {
    assert.throws(() => decryptUrl(undefined), /加密URL不能为空/);
  });

  it('非字符串抛出错误', () => {
    assert.throws(() => decryptUrl(123), /加密URL不能为空/);
  });

  it('非法 Base64 内容抛出解密失败错误', () => {
    assert.throws(() => decryptUrl('!!!not-base64!!!'), /解密失败/);
  });
});

describe('isUrlEncrypted', () => {
  it('http/https URL 不需要解密', () => {
    assert.equal(isUrlEncrypted('https://example.com/audio.mp3'), false);
    assert.equal(isUrlEncrypted('http://example.com/audio.mp3'), false);
  });

  it('Base64 形式的字符串判定为需要解密', () => {
    assert.equal(isUrlEncrypted('SGVsbG9Xb3JsZA=='), true);
  });

  it('非法输入返回 false', () => {
    assert.equal(isUrlEncrypted(''), false);
    assert.equal(isUrlEncrypted(null), false);
    assert.equal(isUrlEncrypted(123), false);
  });
});

describe('decryptUrlIfNeeded', () => {
  it('明文 URL 原样返回', () => {
    assert.equal(decryptUrlIfNeeded('https://example.com/a.mp3'), 'https://example.com/a.mp3');
  });

  it('空输入抛出错误', () => {
    assert.throws(() => decryptUrlIfNeeded(''), /URL不能为空/);
  });

  it('null 输入抛出错误', () => {
    assert.throws(() => decryptUrlIfNeeded(null), /URL不能为空/);
  });
});

describe('batchDecryptUrls', () => {
  it('返回带 success 标记的结果对象数组', () => {
    const results = batchDecryptUrls(['!!!bad!!!', '']);
    assert.equal(Array.isArray(results), true);
    assert.equal(results.length, 2);
    assert.equal(results[0].success, false);
    assert.ok(results[0].error);
    assert.equal(results[1].success, false);
  });

  it('非数组输入抛出错误', () => {
    assert.throws(() => batchDecryptUrls('not-array'), /必须是数组/);
  });
});

describe('batchDecryptUrlsAsync', () => {
  it('结果按原始索引排列', async () => {
    const results = await batchDecryptUrlsAsync(['!!!bad!!!', '!!!bad2!!', '!!!bad3!!'], 2);
    assert.equal(results.length, 3);
    results.forEach((result, index) => {
      assert.equal(result.index, index);
      assert.equal(result.success, false);
    });
  });

  it('非数组输入抛出错误', async () => {
    await assert.rejects(() => batchDecryptUrlsAsync(null), /必须是数组/);
  });
});
