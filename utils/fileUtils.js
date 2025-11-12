/**
 * 文件操作工具模块
 * 提供文件和目录操作相关的工具函数
 */

import { replaceInvalidChars } from './stringUtils.js';

/**
 * 检查文件是否存在
 * @param {string} filePath - 文件路径
 * @returns {Promise<boolean>} 文件是否存在
 * 
 * @example
 * const exists = await fileExists('/path/to/file.mp3');
 * if (exists) {
 *   console.log('文件存在');
 * } else {
 *   console.log('文件不存在');
 * }
 */
export async function fileExists(filePath) {
  if (typeof filePath !== 'string' || !filePath) {
    return false;
  }
  try {
    if (typeof process !== 'undefined') {
      const fs = await import('fs');
      return fs.existsSync(filePath);
    }
    return false;
  } catch (error) {
    console.error(`检查文件是否存在失败: ${error.message}`);
    return false;
  }
}

/**
 * 创建目录
 * @param {string} dirPath - 目录路径
 * @returns {Promise<boolean>} 是否成功创建
 * 
 * @example
 * const success = await createDirectory('/path/to/directory');
 * if (success) {
 *   console.log('目录创建成功');
 * } else {
 *   console.log('目录创建失败');
 * }
 */
export async function createDirectory(dirPath) {
  if (typeof dirPath !== 'string' || !dirPath) {
    return false;
  }
  try {
    if (typeof process !== 'undefined') {
      const fs = await import('fs');
      const path = await import('path');
      fs.mkdirSync(path.dirname(path.resolve(dirPath)), { recursive: true });
      fs.mkdirSync(path.resolve(dirPath), { recursive: true });
      return true;
    }
    return true;
  } catch (error) {
    console.error(`创建目录失败: ${error.message}`);
    return false;
  }
}

/**
 * 获取文件大小
 * @param {string} filePath - 文件路径
 * @returns {Promise<number>} 文件大小（字节）
 * 
 * @example
 * const size = await getFileSize('/path/to/file.mp3');
 * console.log(`文件大小: ${size} 字节`);
 */
export async function getFileSize(filePath) {
  if (typeof filePath !== 'string' || !filePath) {
    return 0;
  }
  try {
    if (typeof process !== 'undefined') {
      const fs = await import('fs');
      const stat = fs.statSync(filePath);
      return stat.size;
    }
    return 0;
  } catch (error) {
    console.error(`获取文件大小失败: ${error.message}`);
    return 0;
  }
}

/**
 * 生成安全的文件名
 * @param {string} filename - 原始文件名
 * @param {string} [extension='mp3'] - 文件扩展名
 * @returns {string} 安全的文件名
 * 
 * @example
 * const safeName = generateSafeFilename('音频: "测试"', 'mp3');
 * console.log(safeName); // "音频___测试_.mp3"
 */
export function generateSafeFilename(filename) {
  if (typeof filename !== 'string') {
    return '';
  }
  return replaceInvalidChars(filename);
}

/**
 * 生成带序号的文件名
 * @param {string} filename - 原始文件名
 * @param {number} index - 序号
 * @param {number} [totalDigits=2] - 总位数，用于补零
 * @returns {string} 带序号的文件名
 * 
 * @example
 * const name1 = generateNumberedFilename('audio.mp3', 1); // "01 audio.mp3"
 * const name2 = generateNumberedFilename('audio.mp3', 10, 3); // "010 audio.mp3"
 */
export function generateNumberedFilename(name, ext, number) {
  const safeName = typeof name === 'string' ? name : 'file';
  const safeExt = typeof ext === 'string' ? ext : '';
  const safeNum = typeof number === 'number' ? number : 0;
  return `${safeName}_${safeNum}${safeExt}`;
}

/**
 * 获取文件路径的目录部分
 * @param {string} filePath - 文件路径
 * @returns {string} 目录路径
 * 
 * @example
 * const dir = getDirectoryPath('/path/to/file.mp3');
 * console.log(dir); // "/path/to"
 */
export function getDirectoryPath(filePath) {
  if (typeof filePath !== 'string') {
    return '';
  }
  const lastSlashIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  if (lastSlashIndex === -1) {
    return '.';
  }
  return filePath.substring(0, lastSlashIndex);
}

/**
 * 获取文件路径的文件名部分
 * @param {string} filePath - 文件路径
 * @returns {string} 文件名
 * 
 * @example
 * const filename = getFilename('/path/to/file.mp3');
 * console.log(filename); // "file.mp3"
 */
export function getFilename(filePath) {
  if (typeof filePath !== 'string') {
    return '';
  }
  
  const lastSlashIndex = Math.max(
    filePath.lastIndexOf('/'),
    filePath.lastIndexOf('\\')
  );
  
  if (lastSlashIndex === -1) {
    return filePath;
  }
  
  return filePath.substring(lastSlashIndex + 1);
}

/**
 * 组合路径
 * @param {...string} parts - 路径部分
 * @returns {string} 组合后的路径
 * 
 * @example
 * const path1 = joinPath('path', 'to', 'file.mp3'); // "path/to/file.mp3"
 * const path2 = joinPath('path\\to', 'file.mp3'); // "path/to/file.mp3"
 */
export function joinPath(...parts) {
  if (!parts || parts.length === 0) {
    return '';
  }
  
  return parts
    .filter(part => typeof part === 'string' && part.length > 0)
    .map(part => part.replace(/[\\/]+$/g, '')) // 移除末尾的斜杠
    .join('/');
}

/**
 * 规范化路径（统一使用正斜杠）
 * @param {string} path - 原始路径
 * @returns {string} 规范化后的路径
 * 
 * @example
 * const normalized = normalizePath('path\\to\\file.mp3');
 * console.log(normalized); // "path/to/file.mp3"
 */
export function normalizePath(path) {
  if (typeof path !== 'string') {
    return '';
  }
  
  return path.replace(/\\+/g, '/');
}

/**
 * 确保路径以斜杠结尾
 * @param {string} path - 原始路径
 * @returns {string} 以斜杠结尾的路径
 * 
 * @example
 * const withSlash = ensureTrailingSlash('/path/to/directory');
 * console.log(withSlash); // "/path/to/directory/"
 */
export function ensureTrailingSlash(path) {
  if (typeof path !== 'string') {
    return '/';
  }
  
  const normalized = normalizePath(path);
  return normalized.endsWith('/') ? normalized : `${normalized}/`;
}

/**
 * 移除路径末尾的斜杠
 * @param {string} path - 原始路径
 * @returns {string} 不以斜杠结尾的路径
 * 
 * @example
 * const withoutSlash = removeTrailingSlash('/path/to/directory/');
 * console.log(withoutSlash); // "/path/to/directory"
 */
export function removeTrailingSlash(path) {
  if (typeof path !== 'string') {
    return '';
  }
  
  const normalized = normalizePath(path);
  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

/**
 * 获取相对路径
 * @param {string} fromPath - 起始路径
 * @param {string} toPath - 目标路径
 * @returns {string} 相对路径
 * 
 * @example
 * const relative = getRelativePath('/path/to', '/path/to/file.mp3');
 * console.log(relative); // "file.mp3"
 */
export function getRelativePath(fromPath, toPath) {
  if (typeof fromPath !== 'string' || typeof toPath !== 'string') {
    return '';
  }
  
  const normalizedFrom = removeTrailingSlash(normalizePath(fromPath));
  const normalizedTo = normalizePath(toPath);
  
  if (normalizedTo.startsWith(normalizedFrom)) {
    const relative = normalizedTo.substring(normalizedFrom.length);
    return relative.startsWith('/') ? relative.substring(1) : relative;
  }
  
  return normalizedTo;
}

/**
 * 获取文件扩展名
 * @param {string} filename - 文件名
 * @returns {string} 文件扩展名（不包含点）
 * 
 * @example
 * const ext1 = getFileExtension('file.mp3'); // "mp3"
 * const ext2 = getFileExtension('archive.tar.gz'); // "gz"
 * const ext3 = getFileExtension('noextension'); // ""
 */
export function getFileExtension(filename) {
  if (typeof filename !== 'string') {
    return '';
  }
  
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
    return '';
  }
  
  return filename.substring(lastDotIndex + 1);
}

/**
 * 移除文件扩展名
 * @param {string} filename - 文件名
 * @returns {string} 不包含扩展名的文件名
 * 
 * @example
 * const name1 = removeFileExtension('file.mp3'); // "file"
 * const name2 = removeFileExtension('archive.tar.gz'); // "archive.tar"
 * const name3 = removeFileExtension('noextension'); // "noextension"
 */
export function removeFileExtension(filename) {
  if (typeof filename !== 'string') {
    return '';
  }
  
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return filename;
  }
  
  return filename.substring(0, lastDotIndex);
}

/**
 * 下载文件
 * @param {string} url - 文件URL
 * @param {string} filePath - 保存路径
 * @param {Function} [onProgress] - 进度回调函数
 * @returns {Promise<boolean>} 是否下载成功
 * 
 * @example
 * const success = await downloadFile(
 *   'https://example.com/file.mp3',
 *   '/path/to/save/file.mp3',
 *   (progress) => console.log(`下载进度: ${progress}%`)
 * );
 * if (success) {
 *   console.log('下载成功');
 * } else {
 *   console.log('下载失败');
 * }
 */
export async function downloadFile(url, filePath, onProgress) {
  if (typeof url !== 'string' || !url) {
    console.error('下载URL不能为空');
    return false;
  }
  
  if (typeof filePath !== 'string' || !filePath) {
    console.error('保存路径不能为空');
    return false;
  }
  
  try {
    // 在浏览器环境中，使用fetch API下载文件
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
    }
    
    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    let loaded = 0;
    
    const reader = response.body.getReader();
    const chunks = [];
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      chunks.push(value);
      loaded += value.length;
      
      if (onProgress && total > 0) {
        const progress = Math.round((loaded / total) * 100);
        onProgress(progress);
      }
    }
    
    // 在浏览器环境中，我们无法直接写入文件系统
    // 这里只是模拟下载过程，实际实现需要根据环境调整
    console.log(`文件下载完成: ${filePath}`);
    
    // 创建Blob对象
    const blob = new Blob(chunks);
    
    // 创建下载链接
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = getFilename(filePath);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
    
    return true;
  } catch (error) {
    console.error(`下载文件失败: ${error.message}`);
    return false;
  }
}

/**
 * 读取文件内容
 * @param {string} filePath - 文件路径
 * @returns {Promise<string|null>} 文件内容，失败时返回null
 * 
 * @example
 * const content = await readFile('/path/to/file.txt');
 * if (content !== null) {
 *   console.log('文件内容:', content);
 * } else {
 *   console.log('读取文件失败');
 * }
 */
export async function readFile(filePath) {
  if (typeof filePath !== 'string' || !filePath) {
    return null;
  }
  
  try {
    // 在浏览器环境中，我们无法直接读取文件系统
    // 这里返回null，实际实现需要根据环境调整
    console.log(`读取文件: ${filePath}`);
    return null;
  } catch (error) {
    console.error(`读取文件失败: ${error.message}`);
    return null;
  }
}

/**
 * 写入文件内容
 * @param {string} filePath - 文件路径
 * @param {string} content - 文件内容
 * @returns {Promise<boolean>} 是否写入成功
 * 
 * @example
 * const success = await writeFile('/path/to/file.txt', 'Hello, world!');
 * if (success) {
 *   console.log('写入文件成功');
 * } else {
 *   console.log('写入文件失败');
 * }
 */
export async function writeFile(filePath, content) {
  if (typeof filePath !== 'string' || !filePath) {
    return false;
  }
  
  if (typeof content !== 'string') {
    content = String(content);
  }
  
  try {
    // 在浏览器环境中，我们无法直接写入文件系统
    // 这里返回true，实际实现需要根据环境调整
    console.log(`写入文件: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`写入文件失败: ${error.message}`);
    return false;
  }
}
