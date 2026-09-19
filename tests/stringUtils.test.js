/**
 * @fileoverview stringUtils 单元测试
 * @description 覆盖文件名清理、格式化、命名转换等纯函数的正常与边界路径
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  replaceInvalidChars,
  formatTime,
  formatFileSize,
  truncateString,
  capitalize,
  toCamelCase,
  toKebabCase,
  toSnakeCase,
  isEmptyOrWhitespace,
  extractFilenameFromUrl,
  getFileExtension,
  removeFileExtension
} from '../src/utils/stringUtils.js';

describe('replaceInvalidChars', () => {
  it('替换非法字符为下划线', () => {
    assert.equal(replaceInvalidChars('a<b>c'), 'a_b_c');
    assert.equal(replaceInvalidChars('con/tain?ers'), 'con_tain_ers');
  });

  it('空输入返回 untitled', () => {
    assert.equal(replaceInvalidChars(''), 'untitled');
  });

  it('非字符串输入返回空字符串', () => {
    assert.equal(replaceInvalidChars(null), '');
    assert.equal(replaceInvalidChars(123), '');
  });

  it('移除首尾的空格和点', () => {
    assert.equal(replaceInvalidChars('  .name. '), 'name');
  });

  it('支持自定义替换字符', () => {
    assert.equal(replaceInvalidChars('a/b', '-'), 'a-b');
  });
});

describe('formatTime', () => {
  it('格式化分秒', () => {
    assert.equal(formatTime(125), '02:05');
    assert.equal(formatTime(0), '00:00');
    assert.equal(formatTime(60), '01:00');
  });

  it('超过一小时自动显示小时', () => {
    assert.equal(formatTime(3665), '01:01:05');
  });

  it('无效输入返回 00:00', () => {
    assert.equal(formatTime(-1), '00:00');
    assert.equal(formatTime(NaN), '00:00');
    assert.equal(formatTime('abc'), '00:00');
  });
});

describe('formatFileSize', () => {
  it('格式化字节与 KB/MB', () => {
    assert.equal(formatFileSize(0), '0 B');
    assert.equal(formatFileSize(512), '512.00 B');
    assert.equal(formatFileSize(1024), '1.00 KB');
    assert.equal(formatFileSize(1048576), '1.00 MB');
  });

  it('支持自定义小数位', () => {
    assert.equal(formatFileSize(1024, 0), '1 KB');
  });

  it('无效输入返回 0 B', () => {
    assert.equal(formatFileSize(-100), '0 B');
    assert.equal(formatFileSize('x'), '0 B');
  });
});

describe('truncateString', () => {
  it('超长字符串截断并加省略号', () => {
    assert.equal(truncateString('Hello World', 5), 'He...');
  });

  it('不超长的字符串原样返回', () => {
    assert.equal(truncateString('Short', 10), 'Short');
  });

  it('非字符串输入返回空字符串', () => {
    assert.equal(truncateString(null), '');
  });
});

describe('capitalize', () => {
  it('首字母大写，其余保持不变', () => {
    assert.equal(capitalize('hello world'), 'Hello world');
    assert.equal(capitalize('HELLO'), 'HELLO');
    assert.equal(capitalize('hELLO'), 'HELLO');
  });

  it('空与非字符串输入返回空字符串', () => {
    assert.equal(capitalize(''), '');
    assert.equal(capitalize(null), '');
  });
});

describe('toCamelCase', () => {
  it('转换下划线、短横线、空格与点号', () => {
    assert.equal(toCamelCase('hello_world'), 'helloWorld');
    assert.equal(toCamelCase('hello-world'), 'helloWorld');
    assert.equal(toCamelCase('Hello World'), 'helloWorld');
    assert.equal(toCamelCase('hello.world'), 'helloWorld');
  });

  it('非字符串输入返回空字符串', () => {
    assert.equal(toCamelCase(null), '');
  });
});

describe('toKebabCase', () => {
  it('转换驼峰、下划线、空格与点号', () => {
    assert.equal(toKebabCase('helloWorld'), 'hello-world');
    assert.equal(toKebabCase('hello_world'), 'hello-world');
    assert.equal(toKebabCase('Hello World'), 'hello-world');
    assert.equal(toKebabCase('hello.world'), 'hello-world');
  });
});

describe('toSnakeCase', () => {
  it('转换驼峰、短横线、空格与点号', () => {
    assert.equal(toSnakeCase('helloWorld'), 'hello_world');
    assert.equal(toSnakeCase('hello-world'), 'hello_world');
    assert.equal(toSnakeCase('Hello World'), 'hello_world');
    assert.equal(toSnakeCase('hello.world'), 'hello_world');
  });
});

describe('isEmptyOrWhitespace', () => {
  it('识别空与空白字符串', () => {
    assert.equal(isEmptyOrWhitespace(''), true);
    assert.equal(isEmptyOrWhitespace('   '), true);
    assert.equal(isEmptyOrWhitespace('hello'), false);
    assert.equal(isEmptyOrWhitespace(null), true);
  });
});

describe('extractFilenameFromUrl', () => {
  it('从 URL 提取文件名并移除查询参数', () => {
    assert.equal(
      extractFilenameFromUrl('https://example.com/path/to/file.mp3?param=value'),
      'file.mp3'
    );
  });

  it('非法 URL 退化处理', () => {
    assert.equal(extractFilenameFromUrl('not-a-url/file.mp3'), 'file.mp3');
  });
});

describe('getFileExtension / removeFileExtension', () => {
  it('提取扩展名（含点）', () => {
    assert.equal(getFileExtension('file.mp3'), '.mp3');
    assert.equal(getFileExtension('archive.tar.gz'), '.gz');
    assert.equal(getFileExtension('noextension'), '');
  });

  it('移除扩展名', () => {
    assert.equal(removeFileExtension('file.mp3'), 'file');
    assert.equal(removeFileExtension('archive.tar.gz'), 'archive.tar');
    assert.equal(removeFileExtension('noextension'), 'noextension');
  });
});
