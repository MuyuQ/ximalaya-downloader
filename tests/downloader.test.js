/**
 * @fileoverview downloader 下载模块单元测试
 * @description 基于本地 HTTP 文件服务器覆盖单文件下载、断点续传跳过、
 *   自动命名、批量并发与专辑下载
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import {
  downloadSound,
  downloadSoundWithNaming,
  downloadSounds,
  downloadAlbum
} from '../src/core/downloader.js';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'xmly-downloader-'));

const server = await new Promise(resolve => {
  const app = http.createServer((req, res) => {
    const body = Buffer.from(`audio-content-of${req.url}`);
    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Content-Length': body.length
    });
    res.end(body);
  });
  app.listen(0, '127.0.0.1', () => resolve(app));
});

const baseUrl = `http://127.0.0.1:${server.address().port}`;

after(async () => {
  server.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('downloadSound', () => {
  it('下载文件到指定路径并触发进度', async () => {
    const filePath = path.join(tmpDir, 'single.mp3');
    const progressCalls = [];

    const result = await downloadSound(`${baseUrl}/a.mp3`, filePath, {
      retries: 1,
      onProgress: (pct, downloaded, total) => progressCalls.push([pct, downloaded, total])
    });

    assert.equal(result.success, true);
    assert.equal(result.skipped, undefined);
    assert.ok(result.fileSize > 0);
    assert.equal(readFileSync(filePath, 'utf8'), 'audio-content-of/a.mp3');
    assert.ok(progressCalls.length > 0);
  });

  it('文件已存在时跳过下载', async () => {
    const filePath = path.join(tmpDir, 'exists.mp3');
    await downloadSound(`${baseUrl}/x.mp3`, filePath, { retries: 1 });

    const result = await downloadSound(`${baseUrl}/x.mp3`, filePath, { retries: 1 });
    assert.equal(result.success, true);
    assert.equal(result.skipped, true);
    assert.equal(result.message, '文件已存在，跳过下载');
  });

  it('参数缺失返回错误对象', async () => {
    assert.deepEqual(
      await downloadSound('', './x.mp3'),
      { success: false, error: '下载链接不能为空' }
    );
    assert.equal((await downloadSound('http://x', '')).success, false);
  });
});

describe('downloadSoundWithNaming', () => {
  it('根据标题生成安全文件名并推断扩展名', async () => {
    const dir = path.join(tmpDir, 'naming');
    const result = await downloadSoundWithNaming(`${baseUrl}/track.m4a`, '第一章: 序章', dir, {
      retries: 1
    });

    assert.equal(result.success, true);
    assert.equal(result.fileName, '第一章_ 序章.m4a');
    assert.equal(existsSync(path.join(dir, result.fileName)), true);
  });

  it('支持序号前缀', async () => {
    const dir = path.join(tmpDir, 'numbering');
    const result = await downloadSoundWithNaming(`${baseUrl}/a.mp3`, '第二集', dir, {
      retries: 1,
      addNumber: true,
      number: 2
    });

    assert.equal(result.success, true);
    assert.equal(result.fileName, '02 第二集.mp3');
  });

  it('空标题返回错误', async () => {
    const result = await downloadSoundWithNaming(`${baseUrl}/a.mp3`, '', path.join(tmpDir, 'x'));
    assert.equal(result.success, false);
    assert.match(result.error, /标题不能为空/);
  });
});

describe('downloadSounds（批量并发）', () => {
  it('批量下载并生成补零序号文件名', async () => {
    const dir = path.join(tmpDir, 'batch');
    const sounds = Array.from({ length: 12 }, (_, i) => ({
      id: String(i + 1),
      title: `第${i + 1}集`,
      url: `${baseUrl}/ep${i + 1}.mp3`
    }));

    const progress = [];
    const result = await downloadSounds(sounds, dir, {
      retries: 1,
      concurrency: 4,
      onProgress: (pct, done, total) => progress.push([pct, done, total])
    });

    assert.equal(result.totalCount, 12);
    assert.equal(result.successCount, 12);
    assert.equal(result.failureCount, 0);
    assert.equal(result.success, true);
    assert.deepEqual(progress[progress.length - 1], [100, 12, 12]);

    const files = readdirSync(dir).sort();
    // 12 个文件 → 序号宽度为 2
    assert.equal(files.length, 12);
    assert.match(files[0], /^01 第1集\.mp3$/);
    assert.match(files[11], /^12 第12集\.mp3$/);
  });

  it('空列表返回错误', async () => {
    const result = await downloadSounds([], path.join(tmpDir, 'empty'));
    assert.equal(result.success, false);
    assert.match(result.error, /音频列表不能为空/);
  });

  it('部分失败时汇总失败计数', async () => {
    const dir = path.join(tmpDir, 'partial');
    const sounds = [
      { id: '1', title: '好的', url: `${baseUrl}/ok1.mp3` },
      { id: '2', title: '坏的', url: 'http://127.0.0.1:1/unreachable.mp3' }
    ];

    const result = await downloadSounds(sounds, dir, { retries: 1, concurrency: 2 });
    assert.equal(result.totalCount, 2);
    assert.equal(result.successCount, 1);
    assert.equal(result.failureCount, 1);
    assert.equal(result.success, false);
  });
});

describe('downloadAlbum（专辑下载）', () => {
  it('按专辑名创建目录并补零命名', async () => {
    const baseDir = path.join(tmpDir, 'album-base');
    const tracks = [
      { id: '1', title: '序章', url: `${baseUrl}/t1.mp3` },
      { id: '2', title: '终章', url: `${baseUrl}/t2.mp3` }
    ];

    const result = await downloadAlbum(tracks, '测试专辑: 第一季', baseDir, {
      retries: 1,
      concurrency: 2
    });

    assert.equal(result.success, true);
    assert.equal(result.albumTitle, '测试专辑: 第一季');
    assert.ok(result.albumDir.includes('测试专辑_ 第一季'));

    const files = readdirSync(result.albumDir).sort();
    assert.deepEqual(files, ['01 序章.mp3', '02 终章.mp3']);
  });

  it('空音轨列表返回错误', async () => {
    const result = await downloadAlbum([], '专辑', path.join(tmpDir, 'y'));
    assert.equal(result.success, false);
    assert.match(result.error, /音轨列表不能为空/);
  });
});
