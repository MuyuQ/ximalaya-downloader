## 目标
- 提升整体视觉（排版、留白、对比、交互反馈），保持简洁轻量。
- 实现随系统自动适配的白天/黑夜模式，并支持手动切换覆盖系统设置。

## 技术方案
- 使用 CSS 变量定义主题色板与组件样式，在 `@media (prefers-color-scheme: dark)` 中覆写变体，自动跟随系统。
- 在 `html` 上启用 `color-scheme: light dark`，让浏览器原生控件（滚动条、表单）自动适配。
- 提供可选的主题切换按钮（太阳/月亮），通过设置 `document.documentElement.dataset.theme` 和 `localStorage.theme` 进行覆盖：`auto | light | dark`。
- 仅改动现有文件，不引入外部依赖；样式集中在 `index.html` 的 `<style>`，优先复用标签选择器，尽量不要求各页改 class。

## 具体改动
### 1. `web/index.html`
- 扩充现有内联样式（当前 7–13 行）为主题化设计：
  - 基础色板变量：`--bg --surface --text --muted --border --primary --primary-contrast --shadow`。
  - 全局：`html { color-scheme: light dark } body { background: var(--bg); color: var(--text); }`。
  - 布局与排版：更合理的 `font-size/line-height`、容器最大宽度、节距（`gap`/`margin`）。
  - 组件：`header/nav` 使用 `flex`，添加悬停/激活态；`main` 使用更舒适的留白；`button/input/select` 统一风格（圆角、边框、焦点态）。
  - 卡片：为 `#app > div` 添加卡片风格（`background: var(--surface)`、阴影与圆角），无需改各页代码即可生效。
  - 深色模式覆写：在 `@media (prefers-color-scheme: dark)` 中调整变量以确保对比达标。
- 在 `<header>` 中右侧新增主题切换按钮（小图标按钮），不改变导航结构。

### 2. `web/src/main.js`
- 页面加载时读取 `localStorage.theme` 并应用：
  - `auto`（默认）：不设 `data-theme`，由系统 `prefers-color-scheme` 决定。
  - `light` / `dark`：设置 `document.documentElement.dataset.theme` 为对应值，CSS 通过属性选择器强制覆盖变量。
- 绑定切换按钮点击事件，在三态间切换并更新图标。

### 3. `web/src/router.js`
- 在 `render()` 末尾根据 `location.hash` 为导航链接添加 `active` 样式（如 `a[aria-current="page"]` 或 `a.active`），提升当前页可见性。

### 4. 页面细节优化（轻改动）
- `LoginPage.js` 的说明框去除行内浅色背景/边框，改用统一的卡片/信息样式变量，保证深色下也美观。
- 输入宽度尽量用样式统一（例如 `input, select, button` 默认高度与内边距），减少各页行内样式。

## 无障碍与动效
- 使用 `:focus-visible` 明确键盘焦点；颜色对比遵循 WCAG AA。
- 动效节制：按钮与卡片 hover 使用微弱 `box-shadow` 与颜色过渡（`transition`），不增加性能负担。

## 验证与测试
- 在桌面浏览器（Chrome/Edge）切换系统浅/深色，观察自动适配效果；使用 DevTools 强制 `prefers-color-scheme` 覆盖验证。
- 测试导航激活与各页表单控件的可读性与交互反馈。
- 手动切换按钮在三态（auto/light/dark）下持久化工作，刷新后仍生效。

## 交付内容
- 更新 `index.html` 的样式与切换按钮标记。
- 更新 `main.js`（主题状态管理）与 `router.js`（导航激活）。
- 小幅调整 `LoginPage.js` 的说明框为主题变量。

如确认实施，我将按上述步骤完成改造，确保不引入外部依赖并保持现有功能不变。