/**
 * @fileoverview networkUtils 单元测试
 * @description 使用本地 HTTP 服务器测试请求、重试与文件下载（无外部网络依赖）
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { mkdtempSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import {
  httpRequest,
  createAuthHeaders,
  generateXmSign,
  downloadFile
} from '../src/utils/networkUtils.js';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'xmly-network-'));

/**
 * 请求计数器（按路径统计）
 * @type {Map<string, number>}
 */
const requestCounts = new Map();

/**
 * 启动本地测试服务器
 * @type {Promise<http.Server>}
 */
const server = await new Promise(resolve => {
  const app = http.createServer((req, res) => {
    const key = `${req.method} ${req.url}`;
    requestCounts.set(key, (requestCounts.get(key) || 0) + 1);
    const count = requestCounts.get(key);

    if (req.url === '/json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ret: 200, data: { hello: 'world' } }));
    } else if (req.url === '/text') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('plain text');
    } else if (req.url === '/flaky-500') {
      // 前两次返回 500，第三次成功（验证指数退避重试）
      if (count <= 2) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'server error' }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ret: 200, data: 'recovered' }));
      }
    } else if (req.url === '/not-found') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    } else if (req.url === '/file') {
      const body = Buffer.from('audio-bytes-0123456789');
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': body.length
      });
      res.end(body);
    } else if (req.url === '/echo-cookie') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ cookie: req.headers.cookie || '', sign: req.headers['xm-sign'] || '' }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  app.listen(0, '127.0.0.1', () => resolve(app));
});

const baseUrl = `http://127.0.0.1:${server.address().port}`;

after(() => {
  server.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('httpRequest', () => {
  it('解析 JSON 响应', async () => {
    const data = await httpRequest(`${baseUrl}/json`, { retries: 1 });
    assert.deepEqual(data, { ret: 200, data: { hello: 'world' } });
  });

  it('非 JSON 响应返回原始文本', async () => {
    const data = await httpRequest(`${baseUrl}/text`, { retries: 1 });
    assert.equal(data, 'plain text');
  });

  it('5xx 错误自动重试并最终成功', async () => {
    const data = await httpRequest(`${baseUrl}/flaky-500`, { retries: 3, retryDelay: 10 });
    assert.deepEqual(data, { ret: 200, data: 'recovered' });
    // 验证确实重试了 3 次
    assert.ok(requestCounts.get('GET /flaky-500') >= 3);
  });

  it('4xx 错误立即失败（不重试）', async () => {
    await assert.rejects(
      () => httpRequest(`${baseUrl}/not-found`, { retries: 3, retryDelay: 10 }),
      /HTTP 404/
    );
    assert.equal(requestCounts.get('GET /not-found'), 1);
  });
});

describe('createAuthHeaders', () => {
  it('包含 Cookie 与 xm-sign', () => {
    const headers = createAuthHeaders('session=abc', 'mybid');
    assert.equal(headers.Cookie, 'session=abc');
    assert.ok(headers['xm-sign'].startsWith('mybid:'));
  });

  it('空 Cookie 时不添加 Cookie 头', () => {
    const headers = createAuthHeaders('', 'bid');
    assert.equal('Cookie' in headers, false);
  });

  it('空 BID 时不添加 xm-sign 头', () => {
    const headers = createAuthHeaders('cookie', '');
    assert.equal('xm-sign' in headers, false);
  });
});

describe('generateXmSign', () => {
  it('格式为 bid:timestamp:nonce', () => {
    const sign = generateXmSign('testbid');
    assert.match(sign, /^testbid:\d+:[0-9a-f]{8}$/);
  });

  it('连续生成 1000 次 nonce 无重复', () => {
    const nonces = new Set();
    for (let i = 0; i < 1000; i++) {
      nonces.add(generateXmSign('b').split(':')[2]);
    }
    assert.equal(nonces.size, 1000);
  });
});

describe('downloadFile', () => {
  it('下载文件并写入磁盘，触发进度回调', async () => {
    const filePath = path.join(tmpDir, 'downloaded.bin');
    const progressCalls = [];

    const result = await downloadFile(`${baseUrl}/file`, filePath, {
      retries: 1,
      onProgress: (pct, downloaded, total) => progressCalls.push([pct, downloaded, total])
    });

    assert.equal(result.success, true);
    assert.equal(readFileSync(filePath, 'utf8'), 'audio-bytes-0123456789');
    assert.ok(progressCalls.length > 0);
    assert.equal(progressCalls[progressCalls.length - 1][0], 100);
  });

  it('下载失败返回错误信息', async () => {
    const result = await downloadFile(`${baseUrl}/not-found`, path.join(tmpDir, 'fail.bin'), {
      retries: 1
    });
    assert.equal(result.success, false);
    assert.match(result.error, /HTTP 404/);
  });
});
