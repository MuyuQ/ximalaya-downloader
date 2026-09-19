# 更新日志

本项目的所有重要变更记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [3.0.0] - 2026-09-19

界面与结构现代化大版本：`src/` 分层架构、零依赖终端 UI、
测试迁移至 Node.js 内置运行器并修复全部历史遗留问题。

### 新增

- 现代化终端界面：方向键导航菜单、加载动画（spinner）、实时下载进度条
  （含速率显示）、彩色横幅与状态面板（零依赖 ANSI 实现，支持 `NO_COLOR`
  与非 TTY 自动降级）
- `download` 子命令：支持直接粘贴喜马拉雅网页链接（自动提取音频/专辑 ID），
  不再必须手动输入数字 ID
- `login` / `logout` / `status` / `config` 子命令与 `xmly` 全局命令
  （`npm link` 后可用）
- `core/api.js`：集中化 API 客户端，统一请求头、业务码校验与错误记录，
  修复文档与代码不一致问题（此前文档引用了不存在的 `core/api.js`）
- Cookie 解密失败时的明确提示与 `cookieDecryptFailed` 标记（不再静默清空
  Cookie）
- 环境变量覆盖支持：`XIMALAYA_CONFIG_PATH`、`XIMALAYA_KEY_PATH`、
  `XIMALAYA_API_BASE`
- GitHub Actions CI：Node 18/20/22 矩阵运行 lint 与测试
- CHANGELOG 与 CONTRIBUTING 文档、项目复盘报告（`docs/RETROSPECTIVE.md`）

### 变更

- **目录结构**：迁移至 `src/` 布局（`core/`、`utils/`、`cli/`、`bin/`），
  界面层按 commands/ui 拆分
- **测试框架**：从存在断言缺陷的自研框架迁移至 Node.js 内置
  `node:test`；测试从 73 个（35 个失败）增加到 135 个（全部通过），
  新增 api / audioParser / downloader 测试（基于本地 HTTP 模拟服务器，
  无外部网络依赖）
- **界面语言**：确认框、范围选择等交互流程重构为 select/confirm 组件
- ESLint 从 v8（.eslintrc.cjs）迁移至 v9（flat config `eslint.config.js`）
- Node.js 最低版本要求从 16 提升至 18（`node:test` 需要）
- 专辑/批量下载序号宽度自适应且至少两位（修复 100 集以上文件排序错乱）

### 修复

- 网络请求重试改为**指数退避 + 抖动**，且仅对网络错误与 5xx/429 重试
  （原实现固定延迟、4xx 也盲目重试）
- `xm-sign` 签名 nonce 改用 `crypto.randomBytes`（原 `Math.random()`
  非加密安全）
- 并发下载池重写为固定 worker 池（消除原 Promise.race + Map 清理逻辑的
  内存泄漏风险）
- 下载失败时清理未完成的残留文件（避免下次被误判为"已下载"而跳过）
- 专辑音轨数为 0 时的空指针崩溃
- 批量/专辑下载默认带补零序号前缀，保证长标题截断后文件名仍唯一
  （不同音频截断后同名互相覆盖的问题随序号前缀消除）
- 测试运行器在 Windows 上 `npm test` 无输出的触发条件问题
  （`pathToFileURL`，随 node:test 迁移一并消除）
- 加密密钥文件权限收紧为 600，并提示备份
- 下载进度回调按 1% 节流（原每 chunk 触发）

### 移除

- 自研测试框架 `tests/testFramework.js`（由 `node:test` 取代）
- 不可靠的每日下载限制探测函数 `isDailyLimitReached`
- decryptor 中无用的浏览器环境兼容分支（项目为纯服务端）
- 仓库中误跟踪的 `node_modules/`、`file.txt` 与过期审查报告
  （移至 `docs/history-code-review-2026-05.md` 归档）

## [2.0.0] - 2026 早期

- 纯 Node.js CLI 重构版本：移除浏览器扩展与 Web 界面
- Cookie AES-256-GCM 加密存储
- 无外部生产依赖

## [1.0.0] 及更早

- 初始版本：单音频/专辑下载、VIP 解密、交互式菜单
