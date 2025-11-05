# 喜马拉雅下载器模块化架构设计

## 1. 模块化架构概述

本项目将重构为模块化架构，遵循单一职责原则，提高代码可维护性和可扩展性。整体架构分为核心模块、工具模块和接口模块三层。

## 2. 模块划分与职责

### 2.1 核心模块 (core/)

#### 2.1.1 API请求模块 (api.js)
- **职责**: 处理与喜马拉雅API的所有交互
- **主要功能**:
  - 发送HTTP请求获取音频信息
  - 处理API响应数据
  - 管理请求头和认证信息
- **接口**:
  ```javascript
  /**
   * 获取音频基本信息
   * @param {string} soundId - 音频ID
   * @param {Object} headers - 请求头
   * @param {string} bid - xm-sign中的bid部分
   * @returns {Promise<Object>} 音频信息对象
   */
  async function getSoundInfo(soundId, headers, bid);
  
  /**
   * 获取专辑信息
   * @param {string} albumId - 专辑ID
   * @param {Object} headers - 请求头
   * @returns {Promise<Object>} 专辑信息对象
   */
  async function getAlbumInfo(albumId, headers);
  ```

#### 2.1.2 音频解析模块 (parser.js)
- **职责**: 解析音频和专辑数据，提取关键信息
- **主要功能**:
  - 解析单个音频信息
  - 解析专辑列表
  - 判断专辑类型（免费/已购/未购）
- **接口**:
  ```javascript
  /**
   * 解析单个音频信息
   * @param {string} soundId - 音频ID
   * @param {Object} headers - 请求头
   * @param {string} bid - xm-sign中的bid部分
   * @returns {Promise<Object>} 解析后的音频信息
   */
  async function parseSound(soundId, headers, bid);
  
  /**
   * 解析专辑信息
   * @param {string} albumId - 专辑ID
   * @param {Object} headers - 请求头
   * @returns {Promise<Object>} 解析后的专辑信息
   */
  async function parseAlbum(albumId, headers);
  ```

#### 2.1.3 下载模块 (downloader.js)
- **职责**: 处理音频文件的下载逻辑
- **主要功能**:
  - 单个音频下载
  - 批量音频下载
  - 下载进度跟踪
  - 断点续传支持
- **接口**:
  ```javascript
  /**
   * 下载单个音频文件
   * @param {Object} soundInfo - 音频信息对象
   * @param {string} outputPath - 输出路径
   * @param {Object} options - 下载选项
   * @returns {Promise<boolean>} 下载是否成功
   */
  async function downloadSound(soundInfo, outputPath, options);
  
  /**
   * 批量下载音频文件
   * @param {Array<Object>} soundList - 音频信息列表
   * @param {string} outputPath - 输出路径
   * @param {Object} options - 下载选项
   * @returns {Promise<Array<Object>>} 下载结果列表
   */
  async function downloadSounds(soundList, outputPath, options);
  ```

#### 2.1.4 解密模块 (decryptor.js)
- **职责**: 处理VIP音频的解密逻辑
- **主要功能**:
  - 解密VIP音频URL
  - 处理不同格式的加密数据
- **接口**:
  ```javascript
  /**
   * 解密VIP音频URL
   * @param {string} encryptedUrl - 加密的URL
   * @returns {string} 解密后的URL
   */
  function decryptVipUrl(encryptedUrl);
  ```

#### 2.1.5 配置管理模块 (config.js)
- **职责**: 管理应用配置和用户设置
- **主要功能**:
  - 读取和写入配置文件
  - 验证配置有效性
  - 管理用户登录状态
- **接口**:
  ```javascript
  /**
   * 读取配置文件
   * @returns {Object} 配置对象
   */
  function loadConfig();
  
  /**
   * 保存配置到文件
   * @param {Object} config - 配置对象
   * @returns {boolean} 保存是否成功
   */
  function saveConfig(config);
  
  /**
   * 验证配置有效性
   * @param {Object} config - 配置对象
   * @returns {Promise<boolean>} 配置是否有效
   */
  async function validateConfig(config);
  ```

### 2.2 工具模块 (utils/)

#### 2.2.1 文件操作工具 (fileUtils.js)
- **职责**: 提供文件和目录操作的通用方法
- **主要功能**:
  - 创建目录
  - 检查文件存在性
  - 文件名处理
- **接口**:
  ```javascript
  /**
   * 确保目录存在，不存在则创建
   * @param {string} dirPath - 目录路径
   * @returns {boolean} 操作是否成功
   */
  function ensureDirectoryExists(dirPath);
  
  /**
   * 清理文件名中的非法字符
   * @param {string} fileName - 原始文件名
   * @returns {string} 清理后的文件名
   */
  function sanitizeFileName(fileName);
  ```

#### 2.2.2 字符串处理工具 (stringUtils.js)
- **职责**: 提供字符串处理的通用方法
- **主要功能**:
  - 字符串格式化
  - 特殊字符处理
- **接口**:
  ```javascript
  /**
   * 替换字符串中的非法字符
   * @param {string} str - 原始字符串
   * @returns {string} 处理后的字符串
   */
  function replaceInvalidChars(str);
  ```

#### 2.2.3 网络请求工具 (networkUtils.js)
- **职责**: 提供网络请求的通用方法
- **主要功能**:
  - HTTP请求封装
  - 请求重试机制
  - 错误处理
- **接口**:
  ```javascript
  /**
   * 发送HTTP请求
   * @param {string} url - 请求URL
   * @param {Object} options - 请求选项
   * @returns {Promise<Object>} 请求响应
   */
  async function httpRequest(url, options);
  ```

### 2.3 接口模块 (interfaces/)

#### 2.3.1 CLI模块 (cli.js)
- **职责**: 提供命令行界面
- **主要功能**:
  - 处理用户输入
  - 显示菜单和选项
  - 调用核心模块功能
- **接口**:
  ```javascript
  /**
   * 启动CLI界面
   * @returns {Promise<void>}
   */
  async function startCli();
  ```

#### 2.3.2 登录模块 (login.js)
- **职责**: 处理用户登录逻辑
- **主要功能**:
  - 浏览器自动化登录
  - 提取登录凭据
- **接口**:
  ```javascript
  /**
   * 执行登录流程
   * @returns {Promise<Object|boolean>} 登录成功返回用户信息，失败返回false
   */
  async function performLogin();
  ```

## 3. 模块依赖关系

```
cli.js
  ├── login.js
  │   ├── config.js
  │   └── networkUtils.js
  ├── parser.js
  │   ├── api.js
  │   │   └── networkUtils.js
  │   └── decryptor.js
  ├── downloader.js
  │   ├── fileUtils.js
  │   └── stringUtils.js
  └── config.js
```

## 4. 按需加载机制

采用ES6模块的动态导入实现按需加载:

```javascript
// 示例：按需加载下载模块
async function downloadSelectedSounds(soundIds) {
  const { downloadSounds } = await import('./core/downloader.js');
  return await downloadSounds(soundIds);
}
```

## 5. 全局状态管理

使用模块级状态管理，避免全局变量污染:

```javascript
// config.js
let appConfig = null;

export function getConfig() {
  return appConfig;
}

export function setConfig(newConfig) {
  appConfig = newConfig;
}
```

## 6. 错误处理策略

- 统一错误处理机制
- 错误日志记录
- 用户友好的错误提示

## 7. 性能优化

- 异步操作优化
- 资源懒加载
- 内存管理优化

## 8. 安全考虑

- 敏感信息保护
- 输入验证
- 安全的网络请求

## 9. 测试策略

- 单元测试覆盖核心功能
- 集成测试验证模块交互
- 端到端测试验证完整流程

## 10. 部署与维护

- 模块化打包
- 版本管理
- 更新机制