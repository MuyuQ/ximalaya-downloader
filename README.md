# 喜马拉雅音频下载器

一个基于 Node.js 的命令行工具，用于下载喜马拉雅平台的音频内容。

## 特性

- 下载单个音频文件
- 批量下载专辑内容
- VIP 音频解密下载（需要有效登录凭证）
- 支持多种音质选择
- 并发下载，支持进度显示
- 断点续传（跳过已下载文件）

## 系统要求

- Node.js >= 16.0.0

## 安装

```bash
# 克隆仓库
git clone <repository-url>
cd ximalaya-downloader

# 安装依赖
npm install
```

## 使用方法

### 启动交互式 CLI

```bash
npm start
# 或
node index.js
```

### 命令行参数

```bash
# 查看帮助
node index.js --help

# 查看版本
node index.js --version

# 下载单个音频
node index.js --download <audio-id>

# 下载专辑
node index.js --download <album-id> --album
```

### 首次使用

1. 运行程序并选择"登录账号"
2. 按提示在浏览器中登录喜马拉雅
3. 复制浏览器中的 Cookie 到程序中
4. 配置下载路径（默认为 `./downloads`）
5. 开始使用

## 配置说明

配置文件位于 `./config.json`，包含以下选项：

```json
{
  "cookie": "你的登录Cookie",
  "bid": "从Cookie中提取的BID",
  "path": "./downloads",
  "quality": "high",
  "addSequenceNumber": true,
  "maxRetries": 3,
  "retryDelay": 1000,
  "concurrentDownloads": 3
}
```

## 项目结构

```
ximalaya-downloader/
├── core/               # 核心业务逻辑
│   ├── api.js         # API 请求封装
│   ├── audioParser.js # 音频信息解析
│   ├── configManager.js # 配置管理
│   ├── decryptor.js   # VIP 音频解密
│   ├── downloader.js  # 下载逻辑
│   └── login.js       # 登录流程
├── utils/              # 工具函数
│   ├── fileUtils.js   # 文件操作
│   ├── networkUtils.js # 网络请求
│   └── stringUtils.js # 字符串处理
├── interfaces/         # 用户界面
│   └── cli.js         # 命令行界面
├── tests/              # 测试
│   ├── testFramework.js
│   └── *.test.js
├── index.js           # 入口文件
└── package.json
```

## 开发

```bash
# 运行测试
npm test

# 代码检查
npm run lint

# 修复代码风格
npm run lint:fix
```

## 注意事项

- 请遵守喜马拉雅平台的服务协议
- 仅下载您有权限访问的内容
- 本项目仅供学习研究使用
- 登录凭证仅存储在本地，不会上传到任何服务器

## 许可证

MIT License
