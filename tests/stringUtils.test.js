/**
 * @fileoverview 字符串工具模块的单元测试
 */

import {
  replaceInvalidChars,
  formatTime,
  formatFileSize,
  generateRandomString,
  truncateString,
  capitalize,
  toCamelCase,
  toKebabCase,
  toSnakeCase,
  isEmptyOrWhitespace,
  extractFilenameFromUrl,
  getFileExtension,
  removeFileExtension
} from '../utils/stringUtils.js';

/**
 * 字符串工具模块测试套件
 */
describe('字符串工具模块测试', () => {

  /**
   * 测试replaceInvalidChars函数
   */
  describe('replaceInvalidChars', () => {
    test('应该替换文件名中的非法字符', () => {
      expect(replaceInvalidChars('file/name?.txt')).toBe('file_name_.txt');
      expect(replaceInvalidChars('file:name*.txt')).toBe('file_name_.txt');
      expect(replaceInvalidChars('file"name|.txt')).toBe('file_name_.txt');
      expect(replaceInvalidChars('file<name>.txt')).toBe('file_name_.txt');
    });

    test('应该保留合法字符', () => {
      expect(replaceInvalidChars('file-name_123.txt')).toBe('file-name_123.txt');
      expect(replaceInvalidChars('正常文件名.txt')).toBe('正常文件名.txt');
    });

    test('应该处理空字符串', () => {
      expect(replaceInvalidChars('')).toBe('');
    });
  });

  /**
   * 测试formatTime函数
   */
  describe('formatTime', () => {
    test('应该正确格式化秒数为时间字符串', () => {
      expect(formatTime(0)).toBe('00:00');
      expect(formatTime(5)).toBe('00:05');
      expect(formatTime(65)).toBe('01:05');
      expect(formatTime(3665)).toBe('01:01:05');
    });

    test('应该处理非数字输入', () => {
      expect(formatTime('abc')).toBe('00:00');
      expect(formatTime(null)).toBe('00:00');
      expect(formatTime(undefined)).toBe('00:00');
    });
  });

  /**
   * 测试formatFileSize函数
   */
  describe('formatFileSize', () => {
    test('应该正确格式化文件大小', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(1024)).toBe('1.00 KB');
      expect(formatFileSize(1048576)).toBe('1.00 MB');
      expect(formatFileSize(1073741824)).toBe('1.00 GB');
    });

    test('应该处理非数字输入', () => {
      expect(formatFileSize('abc')).toBe('0 B');
      expect(formatFileSize(null)).toBe('0 B');
      expect(formatFileSize(undefined)).toBe('0 B');
    });
  });

  /**
   * 测试generateRandomString函数
   */
  describe('generateRandomString', () => {
    test('应该生成指定长度的随机字符串', () => {
      const str1 = generateRandomString(10);
      const str2 = generateRandomString(10);

      expect(str1).toHaveLength(10);
      expect(str2).toHaveLength(10);
      expect(str1).not.toBe(str2);
    });

    test('应该使用默认长度', () => {
      const str = generateRandomString();
      expect(str).toHaveLength(8);
    });
  });

  /**
   * 测试truncateString函数
   */
  describe('truncateString', () => {
    test('应该截断超过指定长度的字符串', () => {
      expect(truncateString('Hello World', 5)).toBe('Hello...');
      expect(truncateString('Hello World', 8)).toBe('Hello W...');
    });

    test('应该保留不超过指定长度的字符串', () => {
      expect(truncateString('Hello', 10)).toBe('Hello');
      expect(truncateString('', 10)).toBe('');
    });
  });

  /**
   * 测试capitalize函数
   */
  describe('capitalize', () => {
    test('应该将字符串首字母大写', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('HELLO')).toBe('Hello');
      expect(capitalize('hELLO')).toBe('Hello');
    });

    test('应该处理空字符串', () => {
      expect(capitalize('')).toBe('');
    });
  });

  /**
   * 测试命名转换函数
   */
  describe('命名转换函数', () => {
    test('toCamelCase应该转换为驼峰命名', () => {
      expect(toCamelCase('hello-world')).toBe('helloWorld');
      expect(toCamelCase('hello_world')).toBe('helloWorld');
      expect(toCamelCase('hello.world')).toBe('helloWorld');
    });

    test('toKebabCase应该转换为短横线命名', () => {
      expect(toKebabCase('helloWorld')).toBe('hello-world');
      expect(toKebabCase('hello_world')).toBe('hello-world');
      expect(toKebabCase('hello.world')).toBe('hello-world');
    });

    test('toSnakeCase应该转换为下划线命名', () => {
      expect(toSnakeCase('helloWorld')).toBe('hello_world');
      expect(toSnakeCase('hello-world')).toBe('hello_world');
      expect(toSnakeCase('hello.world')).toBe('hello_world');
    });
  });

  /**
   * 测试isEmptyOrWhitespace函数
   */
  describe('isEmptyOrWhitespace', () => {
    test('应该识别空字符串和只包含空白字符的字符串', () => {
      expect(isEmptyOrWhitespace('')).toBe(true);
      expect(isEmptyOrWhitespace('   ')).toBe(true);
      expect(isEmptyOrWhitespace('\n\t')).toBe(true);
    });

    test('应该识别非空字符串', () => {
      expect(isEmptyOrWhitespace('hello')).toBe(false);
      expect(isEmptyOrWhitespace(' hello ')).toBe(false);
    });
  });

  /**
   * 测试文件名相关函数
   */
  describe('文件名相关函数', () => {
    test('extractFilenameFromUrl应该从URL中提取文件名', () => {
      expect(extractFilenameFromUrl('https://example.com/path/to/file.txt'))
        .toBe('file.txt');
      expect(extractFilenameFromUrl('https://example.com/file.mp3?query=123'))
        .toBe('file.mp3');
    });

    test('getFileExtension应该获取文件扩展名', () => {
      expect(getFileExtension('file.txt')).toBe('.txt');
      expect(getFileExtension('file.tar.gz')).toBe('.gz');
      expect(getFileExtension('file')).toBe('');
    });

    test('removeFileExtension应该移除文件扩展名', () => {
      expect(removeFileExtension('file.txt')).toBe('file');
      expect(removeFileExtension('file.tar.gz')).toBe('file.tar');
      expect(removeFileExtension('file')).toBe('file');
    });
  });
});
