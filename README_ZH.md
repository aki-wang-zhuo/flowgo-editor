# FlowGo Editor

[English](./README.md)

**FlowGo Editor** 是 FlowGo 的可视化低代码流程设计器。基于 Vue 3 + TypeScript + Vite，通过 REST 与 WebSocket 对接 [flowgo-server](https://github.com/aki-wang-zhuo/flowgo-server)。画布使用 **LogicFlow**（Node-RED 风格节点），UI 为 Element Plus，并完整支持 **zh-CN / en-US** 国际化。

> 本仓库**仅含前端**。引擎执行、鉴权、MCP 与持久化由服务端提供。内置节点位于 [flowgo](https://github.com/aki-wang-zhuo/flowgo)。

| 相关项目 | 定位 |
| --- | --- |
| [flowgo-server](https://github.com/aki-wang-zhuo/flowgo-server) | 后端 API / WS / MCP |
| [flowgo](https://github.com/aki-wang-zhuo/flowgo) | 核心引擎与内置节点 |
| [flowgo-node](https://github.com/aki-wang-zhuo/flowgo-node) | 可导入插件节点 |

---

## 特性

- **多 Tab 工作区** — 并行编辑多个流程；脏标记；恢复上次激活流程
- **LogicFlow 画布** — 拖拽节点、贝塞尔连线、Alt 框选、小地图、自动布局（dagre）、选中工具条
- **左侧 Dock** —「我的流程」列表 + 节点面板（来自 `GET /api/components`）
- **属性面板** — 根据 `configFields` 动态表单；CodeMirror 编辑脚本/JSON；文档 Tab（Markdown）
- **草稿 / 发布** — 保存草稿、发布、放弃草稿、发布历史 / 回滚（服务端）
- **流程锁** — 锁定后禁止他人并发编辑
- **调试控制台** — 从节点/边运行；可选将调试 I/O 输出到控制台
- **WebSocket 同步** — MCP 开启时实时推送，并支持 MCP 驱动的 `editor.query` / `editor.patch`
- **设置** — 语言、MCP 权限、节点/插件管理
- **国际化** — vue-i18n 模块化词条；Element Plus 语言随界面切换；API 携带 `Accept-Language`

---

## 技术栈

| 层级 | 选型 |
| --- | --- |
| 框架 | Vue 3（`<script setup>`）+ TypeScript |
| 构建 | Vite 7 |
| 画布 | **@logicflow/core** + extension（**不是** Vue Flow） |
| UI | Element Plus |
| 状态 / 路由 | Pinia、Vue Router |
| i18n | vue-i18n |
| HTTP / WS | axios、原生 WebSocket |
| 代码编辑 | vue-codemirror（CodeMirror） |
| Markdown | marked + github-markdown-css |

包名：`flowgo-editor` **v0.1.0**（`private: true`）。

---

## 环境要求

- 推荐 **Node.js 20 LTS 或 22+**（Vite 7）
- **npm**（仓库含 lockfile）
- 本地已启动 **flowgo-server**（默认 `http://127.0.0.1:8090`，或自行修改 Vite 代理）

---

## 快速开始（开发）

1. 启动服务端（同级仓库）：

```powershell
cd ../flowgo-server
.\build.ps1
```

默认账号：`admin` / `admin`。

2. 启动编辑器：

```bash
cd flowgo-editor
npm install
npm run dev
```

访问：**http://localhost:5173/editor/**

Vite 将 `/api`（含 WebSocket）代理到 `http://127.0.0.1:8090`。前端使用相对路径 `/api` 与同源 WS — 默认场景**无需**配置 `VITE_*` 环境变量。

---

## 脚本

| 脚本 | 命令 | 说明 |
| --- | --- | --- |
| `dev` | `vite` | 开发服务器，端口 **5173**，`base` 为 `/editor/` |
| `build` | `vue-tsc -b && vite build` | 类型检查 + 生产构建 → `dist/` |
| `preview` | `vite preview` | 预览生产构建 |

### 部署到 flowgo-server

```powershell
.\build.ps1
```

会执行 `npm run build`，并将 `dist/*` 复制到 `../flowgo-server/editor/`。然后启动/打开服务端访问：

```text
http://127.0.0.1:8090/editor/
```

服务端在存在 `./editor` 目录时将其挂载到 `/editor/`。该目录在 server 侧被 gitignore（构建产物）。

---

## 配置说明

### Vite（`vite.config.ts`）

| 项 | 值 |
| --- | --- |
| `base` | `/editor/`（须与服务端静态挂载一致） |
| 开发端口 | `5173` |
| 代理 | `/api` → `http://127.0.0.1:8090`（`ws: true`） |
| 别名 | `@` → `./src` |

当前代码**没有**前端 `.env` / `VITE_API_BASE`。开发时若要对接其它后端，请修改 `vite.config.ts` 中的 proxy `target`。

### 服务端相关变量（参考）

| 变量 | 默认值 | 与编辑器的关系 |
| --- | --- | --- |
| `FLOWGO_ADDR` | `:8090` | API / WS 监听 |
| `FLOWGO_CORS_ORIGIN` | `*` | CORS（开发友好） |
| `FLOWGO_MCP_ENABLED` | `true` | WS / MCP 相关能力 |

---

## 目录结构

```text
src/
  api/              # REST 客户端（auth、flow、components、settings 等）
  canvas/           # LogicFlow 初始化、节点/边、布局、DSL 适配
  components/       # UI：Dock、节点面板、属性表单、控制台、设置、顶栏
  i18n/locales/     # zh-CN / en-US 模块化词条
  router/           # 登录 + 工作区
  run/              # 画布侧调试 runner
  stores/           # Pinia（鉴权等）
  types/            # FlowDSL 等共享类型
  views/            # LoginView、WorkspaceView
  workspace/        # Tab、WS、快捷键、MCP patch
```

---

## 国际化

- 语言：**zh-CN**（默认）与 **en-US**
- 顶栏切换语言；Element Plus 语言包同步切换
- **禁止**在模板/脚本中硬编码用户可见的中文或英文（调试日志除外）。请在 `src/i18n/locales/{zh-CN,en-US}/` 下新增词条。

---

## 架构

```text
flowgo-editor  --HTTP /api + WS-->  flowgo-server  -->  flowgo
                                         |
                                         +--> flowgo-node（插件）
```

编辑器不内嵌 Go 引擎。所有执行与持久化均经服务端完成。

---

## 许可证

本仓库尚未发布 LICENSE 文件。如需再分发条款，请联系维护者。

---

## 贡献指南

1. 界面文案保持中英双语（zh-CN + en-US）。
2. 保持 Vue SFC 精简；复杂逻辑拆到 `src/` 同级子模块。
3. 除非有意调整服务端托管方式，否则保持 `base: '/editor/'` 与相对路径 `/api`。
4. 需要随 server 静态资源发布的改动，提交前执行 `npm run build` / `.\build.ps1`。
