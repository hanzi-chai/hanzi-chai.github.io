# 网页开发指导

**总是用中文回复。** 本文件适用于 `web/`，通用算法、字形规范及校对方法遵循 [根 AGENTS.md](../AGENTS.md)。

## 依赖、命令与边界

`chai-web` 是 React/Vite 辅助应用，依赖以本目录 `package.json` 为准。前端交互放在 `src/`；通用拆分、组装、模板、筛选及统计逻辑维护在根算法包。仅核心包保留 spec；网页不新增 spec。

从仓库根目录执行：

```bash
bun run dev:web       # localhost:5173；dev/start 为兼容别名
bun run preview       # 预览 Pages 产物
bun run lint:web
bun run typecheck:web
bun run build:PAGES   # 先构建根包，再构建网页
bun run build:CF
bun run build:BEX
bun run build:CLIENT
```

网页通过 `file:..` 依赖根包，业务代码从 `hanzi-chai` 导入，Worker 的编码评估使用 `hanzi-chai/evaluation` 轻量入口以控制产物大小。开发时 Vite 和本目录 TypeScript 配置将根入口和轻量评估入口解析到根源码。正式构建使用公开包导出；直接在本目录运行 `build:*` 前需准备根包产物。生产构建通过默认条件获得通用算法入口，前端不要直接引用根 `src/index.ts` 或使用 Node 专属函数。

路径别名：`~/` → 本目录 `src/`；`@chai-api/client` → 根 `api/src/client.ts`。Vite 从本目录 `tsconfig.json` 的 `paths` 生成别名；开发时包含根包源码映射，正式构建只保留应用别名，根包通过公开导出解析。修改映射只需编辑 tsconfig。仓库示例通过 `import.meta.glob("../../examples/*.yaml")` 批量加载，界面的分类及展示顺序仍由页面显式定义。glob 保持相对路径写法，生产构建后检查其已展开且全部示例实际入包；不能只凭构建退出成功判断包名前缀 glob 可用。

技术栈为 React 18、Vite 8、TypeScript 6、Tailwind CSS 4、Ant Design 5、Jotai、react-router v7、@xyflow/react、AntV 图表、@dnd-kit 和 MDX。本目录 tsconfig 继承根 `tsconfig.base.json`，只保留 DOM、JSX、网页类型、路径和本地检查选项；TypeScript 与 Biome 依赖由根工作区统一提供。根 Biome 配置已启用 Tailwind 指令解析。

## 状态管理（`src/atoms/`）

使用 Jotai 原子，按领域组织：

- `config.ts` — 主配置对象、URL 位置（通过 `jotai-location`）、撤销/重做历史（10 步，通过 `jotai-history`），聚焦子 atom（基本信息、数据、分析、编码、拼写运算、键盘、优化、图示）
- `cache.ts` — 核心派生状态：字库构建、字形分析、拼音分析、组装配置、编码结果、用户自定义数据。包含本地/远程双模式（admin 页面使用远程可编辑数据）
- `data.ts` — 字集视图、字形覆盖、变换器、分类器选取
- `encoder.ts` — 码长、简码、构词规则
- `analysis.ts` — 退化配置、过滤器、分类器
- `keyboard.ts` — 键盘布局
- `optimization.ts` — 优化器配置
- `index.ts` — 共享工具 hooks（`useAddAtom`、`useRemoveAtom`、`useAppendAtom`、`useExcludeAtom`、`useModifyAtom`、`useListAtom`、`useAtomValueUnwrapped`）和 `repertoireTypeAtom`

配置以 URL 中方案 ID 为键持久化到 localStorage（通过 `atomWithStorage` + `jotai-family` 的 `atomFamily`）。用户自定义词典、键位分布、当量映射使用 `jotai-minidb`（IndexedDB）持久化。

## 路由（`src/pages/`）

使用 `vite-plugin-pages`（基于文件的路由）结合 `react-router` v7。主要路由：

- `/` — 方案管理（列表、示例、上传）
- `/admin` — 管理后台（字库数据的远程 CRUD）
- `/algorithm` — 算法文档页
- `/:id/` — 方案编辑器，包含子页面：`element`、`analysis`、`assembly`、`statistics`、`statistics2`、`optimization`、`diagram`、`debug`、`repertoire`
- `/repertoire` — 字集浏览
- `/equivalence` — 当量测试

路由模式由构建模式决定：`CF` 使用 Browser 路由，其他模式使用 Hash 路由（见 `src/utils.ts` 中的 `useHashRouter`）。

## 重计算任务

`src/worker.ts` 是一个 Web Worker，负责处理 encode、evaluate、optimize 等 CPU 密集型操作，避免阻塞主线程。

`hanzi-chai` 提供 TypeScript 字形分析和组装逻辑。`libchai`（Rust 编译的 WASM 库）除在 `src/utils.ts` 中提供配置校验（`validate`）外，还在 Worker 中通过 `Web.sync`、`Web.encode_evaluate` 和 `Web.optimize` 承担编码评估与优化。

`CLIENT` 模式将任务转发到同源 `/api/sync`、`/api/encode`、`/api/optimize`，并通过 `/sse/status` 接收优化进度；该构建需要配套本地服务。

Worker 通过 `Thread` 类（`src/utils.ts`）管理，使用 `MessageChannel` 进行双向通信。

## 资源与版本

共享数据由根 `scripts/fetch.ts` 准备至根 `data/`，不要另建 `web/public/data/` 副本。`vite-data.ts` 在开发时提供 `/data/` 服务，构建时只复制网页所需的六份文件：`characters.json`、`glyphs.json`、`dictionary.txt`、`distribution.txt`、`equivalence.txt`、`gf0014.txt`。开发核验文件不复制。

`src/preload.ts` 使用固定地址、`no-store` 加载原始 JSON/TXT；`public/_headers` 设置部署数据的缓存响应头，HTTP 压缩由托管平台处理。数据重新部署后在刷新时生效，已打开会话继续使用启动时加载的数据。

网页版本只读取根 `package.json`，通过 Vite `define` 注入 `APP_VERSION`。

## 构建目标

| 模式 | 路由 | 部署目标 |
|------|------|---------|
| PAGES | Hash | GitHub Pages（`web/dist/pages`） |
| CF | Browser | Cloudflare Workers（前端 `web/dist/cf`） |
| BEX | Hash | 浏览器扩展（`web/dist/pages`） |
| CLIENT | Hash | 本地服务客户端前端（`web/dist/client`） |

构建过程：先通过 `build:pkg` 编译算法包，再根据模式调用 Vite 构建。所有构建注入 Tailwind CSS v4、Ant Design v5、MDX 支持。

## 部署与验证

前端改动运行根 `lint:web`、`typecheck:web` 及相应构建，必要时实际运行检查。`static.yml` 在推送 `main` 或手动触发时，从根冻结锁文件安装、准备数据、运行 `build:PAGES`，上传 `web/dist/pages` 并部署 GitHub Pages。外部托管也从仓库根执行相应构建，发布目录使用 `web/dist/<目标>`，默认根 `build` 只构建 npm 包。

管理后台远程编辑遵循 [API 指导](../api/AGENTS.md) 的来源映射、整数校验与回读要求。
