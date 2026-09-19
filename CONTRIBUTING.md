# 贡献指南

感谢关注喜马拉雅音频下载器！请先阅读以下规范，让协作更顺畅。

## 开发环境

- Node.js >= 18.0.0（建议使用 LTS 版本）
- 无需其他系统依赖

```bash
git clone <repository-url>
cd ximalaya-downloader
npm install

# 验证环境就绪
npm test
npm run lint
```

## 开发流程

1. 从 `master` 创建功能分支：
   ```bash
   git checkout -b feat/your-feature
   ```
2. 实现变更，保持提交信息清晰（推荐 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/) 格式：
   `feat:` / `fix:` / `docs:` / `refactor:` / `test:` / `chore:`）
3. 提交前确保通过全部检查：
   ```bash
   npm run lint
   npm test
   ```
4. 推送分支并创建 Pull Request

## 代码规范

- **零生产依赖**：请勿引入任何运行时依赖；Node.js 内置模块（`https`、
  `fs`、`crypto`、`readline` 等）通常足够。开发依赖（eslint 等）除外。
- **分层单向依赖**：`cli/` → `core/` → `utils/`
  - 所有喜马拉雅接口调用必须封装在 `src/core/api.js`
  - 界面组件（`src/cli/ui/`）不得包含业务逻辑
  - `core/` 不得反向导入 `cli/`
- **ES Modules**：项目使用 `"type": "module"`，统一 `import/export`
- **错误约定**：底层 core 函数抛出异常；下载器返回
  `{ success }` / `{ success: false, error }` 结果对象；CLI 命令层负责
  捕获并展示
- **风格检查**：ESLint 9 flat config，提交前 `npm run lint` 必须零输出

## 测试规范

- 测试框架为 Node.js 内置 `node:test`，断言使用 `node:assert/strict`
- 新功能必须附带测试；修复缺陷时先写复现测试再修复
- 涉及网络的测试一律使用本地 `http.createServer` 模拟，禁止在测试中
  访问 ximalaya.com
- 涉及配置/密钥文件的测试通过环境变量
  （`XIMALAYA_CONFIG_PATH` / `XIMALAYA_KEY_PATH`）重定向到临时目录，
  并在 `after()` 中清理
- 运行覆盖率：`npm run test:coverage`

## 终端 UI 组件

`src/cli/ui/` 下的组件（颜色、菜单、spinner、进度条）全部为零依赖 ANSI
实现，修改时请注意：

- 必须保持非 TTY 降级（管道/CI 环境下不输出 ANSI 序列）
- 尊重 `NO_COLOR` 环境变量
- 组件内不得出现硬编码的 URL 或业务判断

## Pull Request 要求

- PR 描述说明变更动机与方案；界面变更请附终端输出截图或录屏
- CI（lint + Node 18/20/22 测试矩阵）全绿后才会被审阅
- 新增配置项需同步更新 `README.md` 的配置说明表

## 行为准则

请保持友善与尊重。本项目仅供学习研究，请勿提交用于绕过平台
限制或侵犯版权的代码。
