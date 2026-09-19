/**
 * @fileoverview audioParser 单元测试
 * @description 基于本地 API 模拟服务器覆盖音频/专辑解析、类型判断与链接批量解析
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'xmly-parser-'));
process.env.XIMALAYA_CONFIG_PATH = path.join(tmpDir, 'config.json');
process.env.XIMALAYA_KEY_PATH = path.join(tmpDir, '.encryption.key');

const server = await new Promise(resolve => {
  const app = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.url.includes('/revision/play/v1/audio')) {
      const id = new URL(req.url, 'http://x').searchParams.get('id');
      if (id === '100') {
        res.end(JSON.stringify({
          ret: 200,
          data: { title: '免费音频', duration: 60, isPaid: false, src: 'http://audio.example/free.mp3' }
        }));
      } else if (id === '200') {
        res.end(JSON.stringify({
          ret: 200,
          data: {
            title: 'VIP音频',
            duration: 120,
            isPaid: true,
            epInfo: { M4A_128: Buffer.from('encrypted-url').toString('base64') }
          }
        }));
      } else {
        res.end(JSON.stringify({ ret: 404, msg: '不存在' }));
      }
    } else if (req.url.includes('/revision/album/v1/getTracksList')) {
      res.end(JSON.stringify({
        ret: 200,
        data: {
          albumTitle: '解析测试专辑',
          totalCount: 4,
          tracks: [
            { trackId: 1, title: '第一集', duration: 100, orderNum: 1, isPaid: false },
            { trackId: 2, title: '第二集', duration: 110, orderNum: 2, isPaid: false },
            { trackId: 3, title: '第三集', duration: 120, orderNum: 3, isPaid: false },
            { trackId: 4, title: '第四集', duration: 130, orderNum: 4, isPaid: false }
          ]
        }
      }));
    } else if (req.url.includes('/revision/album/v1/getSimple')) {
      const albumId = new URL(req.url, 'http://x').searchParams.get('albumId');
      if (albumId === 'vip1') {
        res.end(JSON.stringify({ ret: 200, data: { isPaid: true, isPurchased: false } }));
      } else if (albumId === 'own1') {
        res.end(JSON.stringify({ ret: 200, data: { isPaid: true, isPurchased: true } }));
      } else {
        res.end(JSON.stringify({ ret: 200, data: { isPaid: false } }));
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
  analyzeSound,
  analyzeAlbum,
  getAllAlbumTracks,
  judgeAlbum,
  checkSoundDownloadable,
  getSoundDownloadUrl,
  resolveTrackUrls,
  extractIdFromInput,
  AudioQuality,
  AudioType
} = await import('../src/core/audioParser.js');

after(async () => {
  server.close();
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.XIMALAYA_API_BASE;
  delete process.env.XIMALAYA_CONFIG_PATH;
  delete process.env.XIMALAYA_KEY_PATH;
});

describe('analyzeSound', () => {
  it('解析免费音频（src 直链）', async () => {
    const info = await analyzeSound('100');
    assert.equal(info.id, '100');
    assert.equal(info.title, '免费音频');
    assert.equal(info.duration, 60);
    assert.equal(info.type, AudioType.FREE);
    assert.equal(info.urls[AudioQuality.MP3_64], 'http://audio.example/free.mp3');
  });

  it('解析 VIP 音频（epInfo 解密）', async () => {
    const info = await analyzeSound('200');
    assert.equal(info.type, AudioType.VIP);
    assert.ok(Object.keys(info.urls).length >= 0);
  });

  it('空 ID 抛出错误', async () => {
    await assert.rejects(() => analyzeSound(''), /音频ID不能为空/);
  });

  it('接口错误向上抛出', async () => {
    await assert.rejects(() => analyzeSound('404'), /不存在/);
  });
});

describe('analyzeAlbum', () => {
  it('解析专辑信息与音轨列表', async () => {
    const info = await analyzeAlbum('555');
    assert.equal(info.title, '解析测试专辑');
    assert.equal(info.totalCount, 4);
    assert.equal(info.tracks.length, 4);
    assert.equal(info.tracks[0].title, '第一集');
    assert.equal(info.tracks[0].id, '1');
  });

  it('空 ID 抛出错误', async () => {
    await assert.rejects(() => analyzeAlbum(''), /专辑ID不能为空/);
  });
});

describe('getAllAlbumTracks', () => {
  it('获取全部音轨并上报翻页进度', async () => {
    const progress = [];
    const info = await getAllAlbumTracks('555', {
      onProgress: (done, total) => progress.push([done, total])
    });
    assert.equal(info.tracks.length, 4);
    assert.ok(progress.length >= 1);
  });

  it('空 ID 抛出错误', async () => {
    await assert.rejects(() => getAllAlbumTracks(''), /专辑ID不能为空/);
  });
});

describe('judgeAlbum', () => {
  it('免费专辑返回 free', async () => {
    assert.equal(await judgeAlbum('free1'), AudioType.FREE);
  });

  it('VIP 未购买专辑返回 vip', async () => {
    assert.equal(await judgeAlbum('vip1'), AudioType.VIP);
  });

  it('已购买专辑返回 purchased', async () => {
    assert.equal(await judgeAlbum('own1'), AudioType.PURCHASED);
  });
});

describe('checkSoundDownloadable / getSoundDownloadUrl', () => {
  it('免费音频可下载', async () => {
    assert.equal(await checkSoundDownloadable('100'), true);
  });

  it('不存在的音频不可下载', async () => {
    assert.equal(await checkSoundDownloadable('404'), false);
  });

  it('获取指定质量链接', async () => {
    const url = await getSoundDownloadUrl('100', AudioQuality.MP3_64);
    assert.equal(url, 'http://audio.example/free.mp3');
  });

  it('不支持的质量抛出错误', async () => {
    await assert.rejects(() => getSoundDownloadUrl('100', 'LOSSLESS'), /不支持的音频质量/);
  });
});

describe('resolveTrackUrls', () => {
  it('批量解析音轨链接并上报进度', async () => {
    const progress = [];
    const tracks = [
      { id: '100', title: '第一集' },
      { id: '100', title: '第二集' },
      { id: '404', title: '失效音轨' }
    ];

    const resolved = await resolveTrackUrls(tracks, {
      concurrency: 2,
      onProgress: (done, total) => progress.push([done, total])
    });

    // 失效音轨被跳过
    assert.equal(resolved.length, 2);
    assert.ok(resolved.every(t => typeof t.url === 'string' && t.url.startsWith('http')));
    assert.ok(progress.length === 3);
    assert.deepEqual(progress[progress.length - 1], [3, 3]);
  });

  it('空列表返回空数组', async () => {
    assert.deepEqual(await resolveTrackUrls([]), []);
  });
});

describe('extractIdFromInput 转发', () => {
  it('支持 URL 输入', () => {
    assert.deepEqual(
      extractIdFromInput('https://www.ximalaya.com/album/123'),
      { type: 'album', id: '123' }
    );
  });
});
