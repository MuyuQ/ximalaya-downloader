## 目标概述
- 将命令行下载器改造为可在浏览器直接运行的单页应用（Web UI）。
- 保留核心功能：配置管理、登录凭证输入与校验、解析音频/专辑、选择下载质量、批量/并发下载、进度展示、失败重试。
- 遵守站点的服务与合规要求（服务协议、隐私政策、版权声明等），界面中明确提示仅下载有权限的内容。

## 关键约束与方案选择
- 认证与跨域：浏览器直接请求喜马拉雅域名可能受 CORS 限制；两种方案：
  - 纯前端模式：用户手动输入 Cookie 与 `xm-bid`，请求需站点允许 CORS；若返回为 `opaque`，功能受限。
  - 轻量代理（推荐）：在本地或边缘（如 Cloudflare Workers）部署一个只转发请求的代理，添加允许的 CORS 头；前端使用该代理避免跨域并保护凭证泄露风险。
- 下载保存：浏览器使用 `fetch` + `ReadableStream` 读取数据、生成 `Blob`，通过隐式 `<a download>` 触发保存；展示实时进度。
- 并发与性能：使用 Web Worker 处理解密与批量下载队列，主线程负责 UI 与进度更新。

## 架构设计
### 项目结构
- `web/` 前端：
  - `index.html`：应用容器与脚本引入
  - `src/main.js`：应用入口，挂载 UI
  - `src/App.js`：路由与页面壳
  - `src/pages/`：
    - `HomePage.js`（欢迎与说明）
    - `LoginPage.js`（手动录入 Cookie/BID，并可选测试）
    - `SoundPage.js`（输入单集ID，解析、质量选择、下载）
    - `AlbumPage.js`（输入专辑ID，解析、范围选择、批量并发下载）
    - `SettingsPage.js`（并发、重试、UA、路径前缀等）
  - `src/core/`：迁移并浏览器化核心逻辑
    - `api.js`：封装 API 请求（可选代理前缀），`httpRequest(url, options)` 统一 fetch
    - `audioParser.js`：从 API 数据映射为统一领域对象（`title/duration/type/urls/tracks`）
    - `downloader.js`：单个/批量下载，进度与并发调度（Worker 支持）
    - `decryptor.js`：VIP音频解密算法（可在 Worker 中运行）
    - `configManager.js`：配置持久化到 `localStorage`（不使用文件系统）
  - `src/utils/`：
    - `networkUtils.js`：请求重试、默认 UA、`credentials` 选项、代理拼接
    - `stringUtils.js`：文件名、安全替换、格式化等
    - `fileUtils.js`：浏览器 Blob 下载、文件名生成、路径辅助（无 Node fs）
  - `src/workers/`：
    - `decrypt.worker.js`（批量解密）
    - `download.worker.js`（并发下载队列）
- `vite.config.js`：开发服务器（可配置代理），打包优化与静态资源处理

### 数据与状态
- 配置使用 `localStorage` 键 `ximalaya-downloader-config`，字段：`cookie`, `bid`, `quality`, `concurrency`, `retry`, `userAgent` 等。
- 解析结果在页面级状态中管理；下载队列存储在全局 store（简单可用自定义事件/模块单例）。

### API 调用与认证
- `createAuthHeaders(cookie, bid)` 生成请求头：`Cookie`, `xm-sign`（仍可占位或由后端代理生成），`User-Agent`。
- `httpRequest(url, { method, headers, retries, timeout, credentials })`：
  - 重试与超时控制（AbortController）
  - 若启用代理：`url` 拼接代理前缀（如 `/api/*`）
  - 浏览器模式下 `credentials: 'include'` 可选（与代理同源时生效）

### 解析与下载
- 解析：
  - 单集：`/revision/play/v1/audio?id=...&ptype=1` 映射为 `{id,title,duration,type,urls}`，`urls` 包含不同质量（AI/M4A_128/MP3_64/MP3_32）
  - 专辑：`/revision/album/v1/getTracksList?albumId=...` 映射为 `{id,title,coverUrl,totalCount,tracks:[{id,title,duration,index,isPaid}]}`；分页合并
- 下载：
  - 选择质量时按优先级回退（high → AI/M4A_128/MP3_64；medium → M4A_128/MP3_64/MP3_32；low → MP3_64/MP3_32）
  - 进度：使用 `ReadableStream` 分块读取，计算 `loaded/total`，UI 显示百分比与速度；完成后创建 `Blob` 并 `<a download>` 保存
  - 批量并发：工作线程队列，根据 `concurrency` 启动并发下载，单项完成更新列表，总体进度由 `completed/total` 计算

### 登录与合规
- 登录页仅提供手动输入 `Cookie` 与 `BID` 的表单与校验按钮（调用用户信息接口 `getUserInfo` 验证）
- 界面底部列出官方信息与合规提示（客服热线、证照编号等），提醒用户遵守站点服务协议与版权政策

## UI 交互草图
- 顶部导航：主页｜单集下载｜专辑下载｜设置｜登录
- 登录页：
  - 输入框：Cookie、BID
  - 按钮：保存、验证登录（显示昵称/UID）
- 单集下载页：
  - 输入框：音频ID
  - 展示：标题、时长、类型、可用质量
  - 选择：质量（单选）、文件名前缀、是否编号
  - 按钮：下载；进度条与完成提示
- 专辑下载页：
  - 输入框：专辑ID
  - 展示：专辑信息、曲目表（可选范围）
  - 选择：质量、是否编号、并发数
  - 按钮：批量下载；总体与单项进度
- 设置页：
  - 重试次数、延迟、并发数、UA；导出/导入配置（JSON）

## 渐进迁移计划
### 阶段 1：前端基础与环境
1. 新建 `web/` 目录，初始化 Vite（或原生 ES 模块无需打包亦可）。
2. 复制并改造 `stringUtils/decryptor` 至浏览器模块与 Worker；`networkUtils/httpRequest` 统一到浏览器 fetch。
3. 新建浏览器版 `configManager`（localStorage 持久化），删除文件路径依赖。

### 阶段 2：API 与解析适配
1. 改造 `api.js` 与 `audioParser.js` 为浏览器调用（可选代理）与统一返回结构。
2. 实现分页获取与进度回调。

### 阶段 3：下载与并发
1. 下载器实现 Blob 保存与进度汇报；支持失败重试与取消。
2. Web Worker 下载队列与解密并发；主线程 UI 更新。

### 阶段 4：Web UI
1. 编写各页面与导航；联动配置与解析/下载模块。
2. 登录页的验证功能与错误提示；设置页的导入/导出。
3. 统一错误与权限提示（如需要登录、达到每日限制）。

### 阶段 5：测试与交付
1. 使用 Vitest/Playwright 编写前端单元与端到端测试。
2. 打包与部署（静态托管或本地起服务）；如需代理，提供简易 Node/Workers 代理。

## 风险与替代方案
- CORS 限制：如站点不允许跨域，需启用代理；代理仅做透明转发并添加 CORS 头，不保留用户数据。
- 认证变化：若 `xm-sign` 需动态生成，建议在代理端实现签名生成逻辑；前端持有 Cookie/BID 即可。
- 浏览器存储敏感信息：Cookie/BID 仅存储在本地浏览器环境；提供“清除凭证”与“临时会话”选项。

## 交付物
- `web/` 目录与 Vite 项目，包含页面、核心模块与 Worker。
- 浏览器版核心模块（API/解析/下载/解密/配置/工具）。
- 使用说明：如何填写 Cookie/BID、可选代理、合规提示。

确认后我将按阶段实施（从环境与模块适配开始），并在每个阶段提供可运行的预览与验证。