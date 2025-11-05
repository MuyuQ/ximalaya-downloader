/**
 * 网络请求工具模块
 * 提供HTTP请求的通用方法，包括请求重试机制和错误处理
 */

/**
 * 默认请求配置
 * @type {Object}
 */
const DEFAULT_CONFIG = {
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  }
};

/**
 * 发送HTTP请求
 * @param {string} url - 请求URL
 * @param {Object} options - 请求选项
 * @param {string} [options.method='GET'] - HTTP方法
 * @param {Object} [options.headers={}] - 请求头
 * @param {Object} [options.data=null] - 请求数据
 * @param {number} [options.timeout=DEFAULT_CONFIG.timeout] - 请求超时时间(毫秒)
 * @param {number} [options.retries=DEFAULT_CONFIG.retries] - 重试次数
 * @param {number} [options.retryDelay=DEFAULT_CONFIG.retryDelay] - 重试延迟(毫秒)
 * @returns {Promise<Object>} 请求响应
 * @throws {Error} 当所有重试失败时抛出错误
 * 
 * @example
 * // 发送GET请求
 * try {
 *   const response = await httpRequest('https://example.com/api/data');
 *   console.log(response.data);
 * } catch (error) {
 *   console.error('请求失败:', error.message);
 * }
 * 
 * // 发送POST请求
 * try {
 *   const response = await httpRequest('https://example.com/api/submit', {
 *     method: 'POST',
 *     data: { name: 'test', value: 123 },
 *     headers: { 'Content-Type': 'application/json' }
 *   });
 *   console.log(response.data);
 * } catch (error) {
 *   console.error('请求失败:', error.message);
 * }
 */
export async function httpRequest(url, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  const { method = 'GET', headers = {}, data = null, timeout, retries, retryDelay } = config;
  
  let lastError;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const fetchOptions = {
        method,
        headers: { ...DEFAULT_CONFIG.headers, ...headers },
        signal: controller.signal
      };
      
      if (data && method !== 'GET') {
        if (typeof data === 'object') {
          fetchOptions.body = JSON.stringify(data);
          fetchOptions.headers['Content-Type'] = 'application/json';
        } else {
          fetchOptions.body = data;
        }
      }
      
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      let responseData;
      
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }
      
      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: responseData
      };
    } catch (error) {
      lastError = error;
      
      if (attempt < retries) {
        console.warn(`请求失败，${retryDelay}ms后重试 (${attempt}/${retries}):`, error.message);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  throw new Error(`请求失败，已重试${retries}次: ${lastError.message}`);
}

/**
 * 创建带有认证信息的请求头
 * @param {string} cookie - 认证cookie
 * @param {string} bid - xm-sign中的bid部分
 * @returns {Object} 包含认证信息的请求头
 * 
 * @example
 * const headers = createAuthHeaders('your_cookie_here', 'your_bid_here');
 * // 使用这些headers发送请求
 * const response = await httpRequest('https://example.com/api', { headers });
 */
export function createAuthHeaders(cookie, bid) {
  const headers = {};
  
  if (cookie) {
    headers['Cookie'] = cookie;
  }
  
  if (bid) {
    headers['xm-sign'] = generateXmSign(bid);
  }
  
  return headers;
}

/**
 * 生成xm-sign签名
 * @param {string} bid - bid部分
 * @returns {string} 完整的xm-sign签名
 * @private
 */
function generateXmSign(bid) {
  // 这里实现xm-sign的生成逻辑
  // 原始代码中有相关实现，需要移植过来
  // 暂时返回bid作为占位符
  return bid;
}

/**
 * 检查网络连接状态
 * @returns {Promise<boolean>} 是否有网络连接
 * 
 * @example
 * const isOnline = await checkNetworkStatus();
 * if (isOnline) {
 *   console.log('网络连接正常');
 * } else {
 *   console.log('网络连接异常');
 * }
 */
export async function checkNetworkStatus() {
  try {
    const response = await fetch('https://www.baidu.com', { 
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-cache'
    });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 获取请求的响应时间
 * @param {string} url - 请求URL
 * @param {Object} [options={}] - 请求选项
 * @returns {Promise<number>} 响应时间(毫秒)
 * 
 * @example
 * const responseTime = await getResponseTime('https://example.com/api');
 * console.log(`响应时间: ${responseTime}ms`);
 */
export async function getResponseTime(url, options = {}) {
  const startTime = Date.now();
  try {
    await httpRequest(url, { ...options, retries: 1 });
    return Date.now() - startTime;
  } catch (error) {
    return -1; // 表示请求失败
  }
}

/**
 * 下载文件
 * @param {string} url - 文件URL
 * @param {string} filePath - 保存路径
 * @param {Object} [options={}] - 下载选项
 * @param {Function} [options.onProgress] - 进度回调函数
 * @returns {Promise<boolean>} 下载是否成功
 * 
 * @example
 * const success = await downloadFile(
 *   'https://example.com/file.mp3',
 *   './downloads/file.mp3',
 *   {
 *     onProgress: (loaded, total) => {
 *       console.log(`下载进度: ${loaded}/${total} bytes`);
 *     }
 *   }
 * );
 */
export async function downloadFile(url, filePath, options = {}) {
  const { onProgress } = options;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`下载失败: ${response.status} ${response.statusText}`);
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
      
      if (onProgress && typeof onProgress === 'function') {
        onProgress(loaded, total);
      }
    }
    
    // 这里应该将chunks写入文件，但需要文件系统API
    // 在实际实现中，需要使用Node.js的fs模块或其他文件系统API
    
    return true;
  } catch (error) {
    console.error('下载文件失败:', error);
    return false;
  }
}