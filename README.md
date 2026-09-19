# 喜马拉雅音频下载器

一个**零生产依赖**的 Node.js 命令行工具，用于下载喜马拉雅平台的音频内容。

- ♫ 下载单个音频或整个专辑
- ♫ 支持直接粘贴网页链接，无需手动提取 ID
- ♫ VIP 音频解密下载（需要有效登录凭证）
- ♫ 现代化终端界面：方向键菜单、实时进度条、加载动画
- ♫ 断点续传（自动跳过已下载文件）
- ♫ Cookie AES-256-GCM 加密存储，凭证不出本机

## 系统要求

- Node.js >= 18.0.0

## 安装

```bash
git clone <repository-url>
cd ximalaya-downloader
npm install
```

可选：全局链接后在任意目录使用 `xmly` 命令：

```bash
npm link
xmly --help
```

## 快速开始

### 交互式界面（推荐）

```bash
npm start
# 或
node index.js
```

启动后进入方向键导航的主菜单，支持 `↑/↓` 移动、`Enter` 确认、`Esc` 取消。

### 命令行模式

```bash
# 查看帮助
xmly --help

# 下载单个音频（支持 ID 或链接）
xmly download 12345678
xmly download https://www.ximalaya.com/sound/12345678

# 下载整个专辑
xmly download https://www.ximalaya.com/album/987654 -a

# 账号管理
xmly login
xmly status
xmly logout

# 查看配置
xmly config
```

### 首次使用

1. 运行 `xmly login`（或交互界面 → 登录账号）
2. 在浏览器中登录喜马拉雅，按 F12 打开控制台，输入 `document.cookie` 并复制
3. 将 Cookie 粘贴到程序中完成验证
4. 开始下载（VIP 内容需登录且有相应会员权限）

## 配置说明

配置文件位于 `./config.json`（首次运行自动创建），可在交互界面「设置」中修改：

```json
{
  "path": "./downloads",
  "quality": "high",
  "addSequenceNumber": true,
  "maxRetries": 3,
  "retryDelay": 1000,
  "concurrentDownloads": 3
}
```

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `path` | 下载目录 | `./downloads` |
| `quality` | 音质偏好（`high`/`medium`/`low`） | `high` |
| `addSequenceNumber` | 文件名序号前缀（如 `01 第一章.mp3`） | `true` |
| `maxRetries` | 下载失败重试次数 | `3` |
| `retryDelay` | 首次重试延迟（指数退避） | `1000` |
| `concurrentDownloads` | 并发下载数 | `3` |

> 登录 Cookie 使用 AES-256-GCM 加密后存储，密钥保存在 `.encryption.key`。
> **请妥善备份该密钥文件**，丢失后需重新登录。也可通过环境变量
> `XIMALAYA_ENCRYPTION_KEY`（64 位 hex）直接提供密钥。

## 项目结构

```
ximalaya-downloader/
├── bin/
│   └── xmly.js            # 可执行入口（npm bin）
├── src/
│   ├── index.js           # 参数解析与命令分发
│   ├── cli/               # 界面层
│   │   ├── app.js         # 交互式主循环
│   │   ├── commands/      # 下载 / 账号 / 设置命令
│   │   └── ui/            # 零依赖终端组件
│   │       ├── ansi.js    #   颜色与光标控制
│   │       ├── select.js  #   方向键菜单 / 确认 / 输入
│   │       ├── spinner.js #   加载动画
│   │       ├── progress.js#   进度条
│   │       └── banner.js  #   欢迎横幅
│   ├── core/              # 业务逻辑层
│   │   ├── api.js         # 喜马拉雅 API 客户端（唯一接口入口）
│   │   ├── audioParser.js # 音频/专辑信息解析
│   │   ├── configManager.js # 配置管理（加密存储）
│   │   ├── decryptor.js   # VIP 音频 URL 解密
│   │   ├── downloader.js  # 并发下载（工作池）
│   │   └── login.js       # 登录流程
│   └── utils/             # 通用工具
│       ├── fileUtils.js   # 文件系统操作
│       ├── networkUtils.js# HTTP 请求（指数退避重试）
│       ├── stringUtils.js # 字符串处理
│       └── crypto.js      # AES-256-GCM 加密
├── tests/                 # node:test 单元测试
└── docs/                  # 项目文档
    └── RETROSPECTIVE.md   # 项目复盘报告
```

**分层原则**：`cli/` → `core/` → `utils/` 单向依赖；所有平台接口调用
集中在 `core/api.js`，界面组件不包含业务逻辑。

## 开发

```bash
# 运行测试（Node.js 内置测试运行器，无需安装测试框架）
npm test

# 带覆盖率测试
npm run test:coverage

# 代码检查
npm run lint

# 自动修复代码风格
npm run lint:fix
```

## 设计说明

- **零生产依赖**：仅使用 Node.js 内置模块（`https`、`fs`、`crypto`、
  `readline` 等），无供应链风险，安装即用
- **测试即文档**：`tests/` 使用本地 HTTP 模拟服务器覆盖全部核心模块，
  不依赖外部网络
- **环境变量覆盖**：`XIMALAYA_CONFIG_PATH`、`XIMALAYA_KEY_PATH`、
  `XIMALAYA_API_BASE` 便于测试与高级部署场景

## 注意事项

- 请遵守喜马拉雅平台的服务协议
- 仅下载您有权限访问的内容
- 本项目仅供学习研究使用
- 登录凭证仅加密存储在本地，不会上传到任何服务器

## 许可证

MIT License
