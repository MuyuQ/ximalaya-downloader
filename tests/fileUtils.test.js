/**
 * @fileoverview fileUtils 单元测试
 * @description 使用临时目录进行真实文件系统操作测试
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import {
  fileExists,
  createDirectory,
  getFileSize,
  generateSafeFilename,
  generateNumberedFilename,
  joinPath,
  readFile,
  writeFile,
  deleteFile,
  ensureWritableDirectory
} from '../src/utils/fileUtils.js';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'xmly-fileutils-'));

after(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('fileExists', () => {
  it('存在的文件返回 true', async () => {
    const filePath = path.join(tmpDir, 'exists.txt');
    await writeFile(filePath, 'hello');
    assert.equal(await fileExists(filePath), true);
  });

  it('不存在的文件返回 false', async () => {
    assert.equal(await fileExists(path.join(tmpDir, 'no-such-file')), false);
  });

  it('非法输入返回 false', async () => {
    assert.equal(await fileExists(''), false);
    assert.equal(await fileExists(null), false);
  });
});

describe('createDirectory', () => {
  it('递归创建多级目录', async () => {
    const dir = path.join(tmpDir, 'a', 'b', 'c');
    assert.equal(await createDirectory(dir), true);
    assert.equal(existsSync(dir), true);
  });

  it('非法输入返回 false', async () => {
    assert.equal(await createDirectory(''), false);
  });
});

describe('readFile / writeFile', () => {
  it('写入后读取内容一致', async () => {
    const filePath = path.join(tmpDir, 'roundtrip.txt');
    await writeFile(filePath, '测试内容');
    assert.equal(await readFile(filePath), '测试内容');
  });

  it('写入时自动创建父目录', async () => {
    const filePath = path.join(tmpDir, 'nested', 'dir', 'file.txt');
    await writeFile(filePath, 'content');
    assert.equal(readFileSync(filePath, 'utf8'), 'content');
  });

  it('读取不存在的文件返回 null', async () => {
    assert.equal(await readFile(path.join(tmpDir, 'missing.txt')), null);
  });
});

describe('getFileSize / deleteFile', () => {
  it('返回文件字节大小', async () => {
    const filePath = path.join(tmpDir, 'size.bin');
    await writeFile(filePath, '12345');
    assert.equal(await getFileSize(filePath), 5);
  });

  it('删除文件', async () => {
    const filePath = path.join(tmpDir, 'todelete.txt');
    await writeFile(filePath, 'x');
    assert.equal(await deleteFile(filePath), true);
    assert.equal(await fileExists(filePath), false);
  });
});

describe('generateSafeFilename', () => {
  it('替换非法字符', () => {
    assert.equal(generateSafeFilename('audio<>:"/\\|?*name'), 'audio_________name');
  });

  it('压缩连续空白并截断超长名称', () => {
    assert.equal(generateSafeFilename('a   b'), 'a b');
    assert.equal(generateSafeFilename('x'.repeat(300)).length, 200);
  });

  it('非字符串输入返回空字符串', () => {
    assert.equal(generateSafeFilename(null), '');
  });
});

describe('generateNumberedFilename', () => {
  it('默认两位补零', () => {
    assert.equal(generateNumberedFilename('第一集', '.mp3', 1), '01 第一集.mp3');
    assert.equal(generateNumberedFilename('file', '.txt', 10), '10 file.txt');
  });

  it('超过补零宽度时使用实际位数', () => {
    assert.equal(generateNumberedFilename('file', '.txt', 100), '100 file.txt');
  });

  it('支持自定义补零宽度', () => {
    assert.equal(generateNumberedFilename('file', '.txt', 5, 3), '005 file.txt');
  });
});

describe('joinPath', () => {
  it('按平台分隔符组合路径', () => {
    const expected = path.join('path', 'to', 'file.txt');
    assert.equal(joinPath('path', 'to', 'file.txt'), expected);
  });
});

describe('ensureWritableDirectory', () => {
  it('自动创建缺失目录并验证可写', async () => {
    const dir = path.join(tmpDir, 'writable', 'deep');
    assert.equal(await ensureWritableDirectory(dir), true);
    assert.equal(existsSync(dir), true);
  });

  it('不可写路径返回 false', async () => {
    // /dev/null 是文件不是目录，mkdir 失败
    assert.equal(await ensureWritableDirectory('/dev/null/sub'), false);
  });

  it('非法输入返回 false', async () => {
    assert.equal(await ensureWritableDirectory(''), false);
  });
});
