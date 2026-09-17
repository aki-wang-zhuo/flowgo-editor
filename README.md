# FlowGo Editor

[中文文档](./README_ZH.md)

**FlowGo Editor** is the visual low-code flow designer for FlowGo. It is a Vue 3 + TypeScript + Vite single-page application that talks to [flowgo-server](https://github.com/aki-wang-zhuo/flowgo-server) over REST and WebSocket. The canvas is powered by **LogicFlow** (Node-RED–style nodes), with Element Plus UI and full **zh-CN / en-US** internationalization.

> This repository contains **frontend only**. Engine execution, auth, MCP, and persistence are provided by the server. Built-in nodes live in [flowgo](https://github.com/aki-wang-zhuo/flowgo).

| Related project | Role |
| --- | --- |
| [flowgo-server](https://github.com/aki-wang-zhuo/flowgo-server) | Backend API / WS / MCP |
| [flowgo](https://github.com/aki-wang-zhuo/flowgo) | Core engine & built-in nodes |
| [flowgo-node](https://github.com/aki-wang-zhuo/flowgo-node) | Importable plugin nodes |

---

## Features

- **Multi-tab workspace** — edit several flows at once; dirty indicators; restore last active flow
- **LogicFlow canvas** — drag-and-drop nodes, Bezier edges, Alt box-select, minimap, auto-layout (dagre), selection toolbar
- **Left dock** — “My Flows” list + component palette (from `GET /api/components`)
- **Property panel** — dynamic forms from `configFields`; CodeMirror for scripts/JSON; Documentation tab (Markdown)
- **Draft / publish** — save draft, publish, discard draft, publish history / rollback (server-backed)
- **Flow lock** — prevent concurrent edits when locked
- **Debug console** — run from node / edge; optional debug I/O in the console
- **WebSocket sync** — live updates and MCP-driven `editor.query` / `editor.patch` when MCP is enabled
- **Settings** — language, MCP permission UI, node/plugin management
- **i18n** — vue-i18n with modular locale files; Element Plus locale follows the UI language; `Accept-Language` on API calls

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Vue 3 (`<script setup>`) + TypeScript |
| Bundler | Vite 7 |
| Canvas | **@logicflow/core** + extension (**not** Vue Flow) |
| UI | Element Plus |
| State / Router | Pinia, Vue Router |
| i18n | vue-i18n |
| HTTP / WS | axios, native WebSocket |
| Editors | CodeMirror via vue-codemirror |
| Markdown | marked + github-markdown-css |

Package: `flowgo-editor` **v0.1.0** (`private: true`).

---

## Requirements

- **Node.js 20 LTS or 22+** recommended (Vite 7)
- **npm** (lockfile present)
- Running **flowgo-server** on `http://127.0.0.1:8090` (or adjust the Vite proxy)

---

## Quick start (development)

1. Start the server (sibling repo):

```powershell
cd ../flowgo-server
.\build.ps1
```

Default login: `admin` / `admin`.

2. Start the editor:

```bash
cd flowgo-editor
npm install
npm run dev
```

Open: **http://localhost:5173/editor/**

Vite proxies `/api` (including WebSocket) to `http://127.0.0.1:8090`. The client uses relative `/api` and same-origin WS — no `VITE_*` env vars are required for the default setup.

---

## Scripts

| Script | Command | Description |
| --- | --- | --- |
| `dev` | `vite` | Dev server on port **5173**, base `/editor/` |
| `build` | `vue-tsc -b && vite build` | Typecheck + production build → `dist/` |
| `preview` | `vite preview` | Preview production build |

### Deploy into flowgo-server

```powershell
.\build.ps1
```

This runs `npm run build` and copies `dist/*` into `../flowgo-server/editor/`. Then restart/open the server and visit:

```text
http://127.0.0.1:8090/editor/
```

The server mounts `./editor` at `/editor/` when the directory exists. That folder is gitignored on the server side (build artifact).

---

## Configuration

### Vite (`vite.config.ts`)

| Setting | Value |
| --- | --- |
| `base` | `/editor/` (must match server static mount) |
| Dev port | `5173` |
| Proxy | `/api` → `http://127.0.0.1:8090` (`ws: true`) |
| Alias | `@` → `./src` |

There is **no** frontend `.env` / `VITE_API_BASE` in the current codebase. To point at another backend during development, change the proxy `target` in `vite.config.ts`.

### Server-side variables (reference)

| Variable | Default | Relevance to editor |
| --- | --- | --- |
| `FLOWGO_ADDR` | `:8090` | API / WS listen address |
| `FLOWGO_CORS_ORIGIN` | `*` | CORS (dev-friendly) |
| `FLOWGO_MCP_ENABLED` | `true` | WS upgrade / MCP features |

---

## Project structure

```text
src/
  api/              # REST clients (auth, flow, components, settings, …)
  canvas/           # LogicFlow setup, nodes/edges, layout, DSL adapters
  components/       # UI: dock, palette, property forms, console, settings, topbar
  i18n/locales/     # zh-CN / en-US modular messages
  router/           # Login + Workspace
  run/              # Canvas-side debug runners
  stores/           # Pinia (auth, …)
  types/            # FlowDSL and shared types
  views/            # LoginView, WorkspaceView
  workspace/        # Tabs, WS, hotkeys, MCP patch handling
```

---

## Internationalization

- Locales: **`zh-CN`** (default) and **`en-US`**
- Switch language from the top bar; Element Plus locale switches with it
- **Do not** hard-code user-visible Chinese or English strings in templates/scripts (debug logs excepted). Add keys under `src/i18n/locales/{zh-CN,en-US}/`.

---

## Architecture

```text
flowgo-editor  --HTTP /api + WS-->  flowgo-server  -->  flowgo
                                         |
                                         +--> flowgo-node (plugins)
```

The editor never embeds the Go engine. All execution and persistence go through the server.

---

## License

License file is not yet published in this repository. Contact the maintainers if you need redistributable terms.

---

## Contributing

1. Keep UI strings bilingual (zh-CN + en-US).
2. Prefer small, focused Vue SFCs; extract complex logic into sibling modules under `src/`.
3. Preserve `base: '/editor/'` and `/api` relative paths unless you intentionally change server hosting.
4. Run `npm run build` before submitting UI that must ship inside the server binary layout.
