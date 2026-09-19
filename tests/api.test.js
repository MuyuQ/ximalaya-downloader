/**
 * @fileoverview api 客户端单元测试
 * @description 通过环境变量将 API 基址指向本地测试服务器，覆盖各端点的
 *   响应校验、错误处理与 ID 提取逻辑（无外部网络依赖）
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'xmly-api-'));
process.env.XIMALAYA_CONFIG_PATH = path.join(tmpDir, 'config.json');
process.env.XIMALAYA_KEY_PATH = path.join(tmpDir, '.encryption.key');

/**
 * 启动模拟喜马拉雅 API 的本地服务器
 */
const server = await new Promise(resolve => {
  const app = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.url.includes('/revision/play/v1/audio')) {
      const id = new URL(req.url, 'http://x').searchParams.get('id');

      if (id === '100') {
        // 免费音频：直接提供 src
        res.end(JSON.stringify({
          ret: 200,
          data: {
            title: '免费音频',
            duration: 180,
            isPaid: false,
            src: 'http://audio.example/free.mp3'
          }
        }));
      } else if (id === '200') {
        // VIP 音频：提供加密的 epInfo
        res.end(JSON.stringify({
          ret: 200,
          data: {
            title: 'VIP音频',
            duration: 240,
            isPaid: true,
            epInfo: {
              M4A_128: Buffer.from('vip-audio-url').toString('base64')
            }
          }
        }));
      } else {
        res.end(JSON.stringify({ ret: 404, msg: '音频不存在' }));
      }
    } else if (req.url.includes('/revision/album/v1/getTracksList')) {
      const pageNum = Number(new URL(req.url, 'http://x').searchParams.get('pageNum') || 1);
      res.end(JSON.stringify({
        ret: 200,
        data: {
          albumTitle: '测试专辑',
          totalCount: 2,
          tracks: pageNum === 1
            ? [
              { trackId: 1, title: '第一集', duration: 100, orderNum: 1, isPaid: false },
              { trackId: 2, title: '第二集', duration: 110, orderNum: 2, isPaid: false }
            ]
            : []
        }
      }));
    } else if (req.url.includes('/revision/album/v1/getSimple')) {
      res.end(JSON.stringify({
        ret: 200,
        data: { isPaid: false, isPurchased: false, title: '测试专辑' }
      }));
    } else if (req.url.includes('/revision/user/v1/getUserInfo')) {
      const cookie = req.headers.cookie || '';
      if (cookie.includes('session=ok')) {
        res.end(JSON.stringify({ ret: 200, data: { nickname: '测试用户' } }));
      } else {
        res.end(JSON.stringify({ ret: 401, msg: '未登录' }));
      }
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ ret: 404 }));
    }
  });

  app.listen(0, '127.0.0.1', () => resolve(app));
});

process.env.XIMALAYA_API_BASE = `http://127.0.0.1:${server.address().port}`;

const {
  getSoundPlayInfo,
  getAlbumTracksPage,
  getAlbumSimple,
  getUserInfo,
  validateCredentials,
  extractIdFromInput,
  getLastApiError
} = await import('../src/core/api.js');

after(async () => {
  server.close();
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.XIMALAYA_API_BASE;
  delete process.env.XIMALAYA_CONFIG_PATH;
  delete process.env.XIMALAYA_KEY_PATH;
});

describe('getSoundPlayInfo', () => {
  it('免费音频返回 src 数据', async () => {
    const data = await getSoundPlayInfo('100', {});
    assert.equal(data.title, '免费音频');
    assert.equal(data.isPaid, false);
    assert.equal(data.src, 'http://audio.example/free.mp3');
  });

  it('VIP 音频返回 epInfo 数据', async () => {
    const data = await getSoundPlayInfo('200', {});
    assert.equal(data.isPaid, true);
    assert.ok(data.epInfo.M4A_128);
  });

  it('不存在的音频抛出业务错误', async () => {
    await assert.rejects(() => getSoundPlayInfo('999', {}), /音频不存在/);
    assert.ok(getLastApiError());
  });
});

describe('getAlbumTracksPage / getAlbumSimple', () => {
  it('返回音轨列表', async () => {
    const data = await getAlbumTracksPage('555', 1, 30, {});
    assert.equal(data.albumTitle, '测试专辑');
    assert.equal(data.totalCount, 2);
    assert.equal(data.tracks.length, 2);
  });

  it('返回专辑简要信息', async () => {
    const data = await getAlbumSimple('555', {});
    assert.equal(data.isPaid, false);
  });
});

describe('getUserInfo / validateCredentials', () => {
  it('有效凭证返回用户信息', async () => {
    const data = await getUserInfo({ cookie: 'session=ok', bid: 'b' });
    assert.equal(data.nickname, '测试用户');
  });

  it('validateCredentials 有效凭证', async () => {
    const result = await validateCredentials('session=ok', 'bid123');
    assert.equal(result.valid, true);
    assert.equal(result.username, '测试用户');
  });

  it('validateCredentials 空凭证直接失败', async () => {
    const result = await validateCredentials('', '');
    assert.equal(result.valid, false);
    assert.match(result.error, /为空/);
  });

  it('validateCredentials 无效凭证返回失败原因', async () => {
    const result = await validateCredentials('session=expired', 'bid');
    assert.equal(result.valid, false);
    assert.ok(result.error);
  });
});

describe('extractIdFromInput', () => {
  it('纯数字识别为音频 ID', () => {
    assert.deepEqual(extractIdFromInput('12345678'), { type: 'sound', id: '12345678' });
  });

  it('从音频链接提取 ID', () => {
    assert.deepEqual(
      extractIdFromInput('https://www.ximalaya.com/sound/987654321'),
      { type: 'sound', id: '987654321' }
    );
  });

  it('从专辑链接提取 ID（含栏目路径）', () => {
    assert.deepEqual(
      extractIdFromInput('https://www.ximalaya.com/album/555666'),
      { type: 'album', id: '555666' }
    );
    assert.deepEqual(
      extractIdFromInput('https://www.ximalaya.com/youshengshu/some-book/album/555666/'),
      { type: 'album', id: '555666' }
    );
  });

  it('无法识别时返回 null', () => {
    assert.equal(extractIdFromInput('hello world'), null);
    assert.equal(extractIdFromInput(''), null);
    assert.equal(extractIdFromInput(null), null);
  });
});
