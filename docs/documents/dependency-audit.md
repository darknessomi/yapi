# 依赖维护性审计 — 后续计划

PR1（死依赖清理 + 低成本内联替换）与 PR2（ldapjs / safeify / swagger-client）已完成。

## 已完成变更摘要

### PR1

| 移除依赖 | 替换方式 |
|----------|----------|
| `deref`, `deep-extend`, `yapi-plugin-qsso` | 直接删除（零引用） |
| `events` | [common/events-shim.js](../../common/events-shim.js) + vite alias |
| `moment` | `Intl` / 原生 Date 格式化（`client/common.js`） |
| `cpu-load` | `process.cpuUsage()` 差分 |
| `compare-versions` | 内联 semver 比较（swagger 导入） |
| `extend` | `Object.assign` |
| `core-decorators` | [common/autobind.js](../../common/autobind.js) |
| `sha1` | `node:crypto` |
| `redux-promise` | 内联 middleware（`client/reducer/create.js`） |

### PR2

| 原依赖 | 新方案 |
|--------|--------|
| `ldapjs`（deprecated） | `ldapts`（[server/utils/ldap.js](../../server/utils/ldap.js)） |
| `safeify`（停更） | `worker_threads` + `vm`（[server/utils/sandbox.js](../../server/utils/sandbox.js)） |
| `swagger-client <3.19.0` | 升级至 `^3.37.4` |

**PR1 补充**：`events` npm 包虽无源码引用，但 [vite.config.js](../vite.config.js) 将其 alias 给浏览器 bundle；已改为 [common/events-shim.js](../../common/events-shim.js) 自维护 shim，无需保留 `events` 依赖。

---

以下为 PR3–PR5 待办，按优先级排列。

## PR3 — Markdown 编辑器（预计 3–7 天）

**问题**：`@toast-ui/editor` 自 2023-02 停更，传递依赖 `dompurify` 存在多个 XSS CVE（npm audit moderate）。

**使用位置**：

- `client/components/MarkdownEditor/createEditor.js`
- `exts/yapi-plugin-wiki/wikiPage/Editor.js`
- `client/index.js`（viewer CSS）

**方案**：

| 方案 | 说明 | 工作量 |
|------|------|--------|
| A（短期） | 社区 fork [Drenso/tui.editor](https://github.com/Drenso/tui.editor)，升级 DOMPurify | medium |
| B（中期） | `@uiw/react-md-editor` 或 `md-editor-v3` | large |
| C（长期） | TipTap / ProseMirror | large |

**验证**：接口描述编辑、Wiki 编辑/预览、Markdown 导入导出回归。

---

## PR4 — 前端工具与 UI 组件（预计 2–4 周，可拆分）

### 4.1 `brace` → `ace-builds`

- **文件**：`client/components/AceEditor/mockEditor.js`
- mock 模板语法高亮与占位符补全
- **工作量**：medium

### 4.2 首页动画三件套

- **文件**：`client/components/Intro/Intro.js`
- 移除 `rc-scroll-anim`、`rc-queue-anim`、`rc-tween-one`
- 替换为 CSS + `IntersectionObserver` / Web Animations API
- **工作量**：medium（仅营销页）

### 4.3 测试集合拖拽表格

- **文件**：`client/containers/Project/Interface/InterfaceCol/InterfaceColContent.js`
- 移除 `reactabular-table`、`reactabular-dnd`、`react-dnd@2`、`table-resolver`
- 替换为 antd Table + `@dnd-kit/sortable`
- **工作量**：large

### 4.4 JSON Schema 可视化编辑器

- **文件**：`InterfaceEditForm.js`，`vite.config.js` 中 `json-schema-editor-visual-esm` 插件
- 移除 `json-schema-editor-visual`（2022 停更，绑定 antd 3 + draft-js 漏洞链）
- 替换为 `@rjsf/core` 或基于现有 `SchemaTable` 自研
- **工作量**：large

### 4.5 redux-devtools 三件套

- npm 已 deprecated，迁移至 `@redux-devtools/core` 等，或 dev 环境直接移除
- **工作量**：trivial

---

## PR5 — 生态大升级（独立立项）

**根因**：React 16 + antd 3 绑定 draft-js、recharts 1 等传递依赖漏洞，PR4 部分替换的前提。

| 包 | 当前 | 目标 | 影响面 |
|----|------|------|--------|
| react / react-dom | 16.14 | 18+ | 全站 |
| antd | 3.26 | 5.x | 全站 UI |
| recharts | 1.8 | 3.x | 统计图表 |
| mongoose | 6.x | 9.x | 服务端 ORM |
| less | 3.x | 4.x | 样式构建 |
| vite | 5.x | 8.x | 构建工具 |

**不宜与 PR3/PR4 混做**，需单独分支与完整 UI 回归。

---

## 核心能力 — 暂保留

以下包版本旧或为产品核心，勿为「停更」贸然替换：

- **mockjs** — Mock DSL 核心（8 文件）
- **json5@0.5** — 注释式 mock 模板，升级需 API 回归
- **jsondiffpatch@0.3** — 接口/Wiki 版本 diff
- **underscore** — 26 文件，可渐进迁移原生 API

---

## 决策规则

```
零引用 → 直接移除
安全边界（LDAP/沙箱）→ 换 maintained 包，不自维护协议/隔离
<50 行工具函数 → 内联自维护
富文本/Mock DSL/OpenAPI → 换包或 fork，不自写引擎
React/antd 大版本 → 独立立项
```
