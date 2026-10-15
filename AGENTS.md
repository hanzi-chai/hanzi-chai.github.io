# AGENTS.md

**总是用中文回复。**

本文件为在此仓库工作的编码代理提供指导。命令、依赖版本和注册组件以各包的 `package.json`、`vite.config.ts` 和算法注册入口为准。

## 项目简介

汉字自动拆分系统——一个位于 https://chaifen.app 的网页应用，用于设计和测试中文输入方案。用户定义拆分和编码规则，系统自动分解汉字并生成码表。版本 0.4.0。

## 常用命令

```bash
# 安装依赖并下载字库数据（安装后必须执行 fetch）
bun install && bun run fetch

# 开发
bun run dev          # Vite 开发服务器（localhost:5173），等同 bun run start
bun run preview      # 预览构建产物

# 代码检查与格式化
bun run lint         # Biome 检查（仅 ./src）
bun run fix          # Biome 自动修复（unsafe）
bun run format       # 按 Biome 配置格式化，并执行 git add .（会暂存所有改动）
bunx tsc --noEmit    # 根项目 TypeScript 类型检查

# 构建
bun run build:pkg    # 仅构建算法包（hanzi-chai）
bun run build:PAGES  # GitHub Pages 静态站点 → dist/pages
bun run build:CF     # Cloudflare Workers 前端 → dist/cf
bun run build:BEX    # 浏览器扩展 → dist/pages
bun run build:CLIENT # 本地服务客户端前端 → dist/client
bun run build        # 完整构建（fetch + build:CF）

# API 后端（packages/api/）
bun run start:api    # 本地启动 wrangler dev
bun run deploy:api   # 部署到 Cloudflare Workers

# 测试
bun run --filter hanzi-chai test       # 运行核心算法测试
bun run --filter hanzi-chai test:all   # 运行全部测试（含 spec/ 下所有文件）

# 发布
bun run publish      # 版本 bump + git tag + commit + push
bun run version      # 类型检查并构建 BEX、PAGES、CF（不含 CLIENT）
```

`package.json` 声明需要 Bun 1.0+，CI 使用最新版 Bun。当前根 `package.json` 未配置 `pre-commit` / `precommit`，不能假定提交前会自动格式化。

### 修改与验证

- 优先沿用现有中文领域命名和模块划分。前端交互改动放在 `src/`，拆分与组装规则放在 `packages/hanzi-chai/`。
- 算法改动运行相关 Bun 测试；需要覆盖示例方案时运行 `test:all`。前端改动运行 `bun run lint` 和 `bunx tsc --noEmit`，构建验证选择对应目标。
- 首次安装或缺少字库文件时运行 `bun run fetch`；该命令需要联网，已有可用数据时不必每次重复下载。单独的 `build:*` 脚本不会自动 fetch。
- 局部格式化优先使用 `bunx biome format --write <文件路径>`；`bun run format` 会执行 `git add .`，可能暂存用户已有改动。

## 架构

### 三层 Monorepo

```
chai (root)
├── packages/
│   ├── hanzi-chai/   # 纯 TypeScript 算法库，汉字拆分与编码核心
│   └── api/          # Cloudflare Worker 后端（chai-data），提供字库 CRUD API
└── src/              # React/Vite 前端网页应用
```

1. **`packages/hanzi-chai/`** — 纯 TypeScript 算法库，负责汉字拆分与编码，无 UI 依赖，有独立的 Bun 测试套件（`bun:test`）。发布到 npm 为 `hanzi-chai`。
2. **`packages/api/`** — Cloudflare Worker 后端（基于 itty-router），使用 D1（SQLite）和 KV 存储字库数据，提供 REST API（`https://api.chaifen.app`）供前端和 fetch 脚本调用。共享客户端代码在 `packages/api/src/client.ts`。
3. **`src/`** — React/Vite 前端应用，消费算法库和后端 API。

路径别名：
- `~/` → `src/`
- `hanzi-chai`（开发模式）→ `packages/hanzi-chai/src/main.ts`
- `@chai-api/client` → `packages/api/src/client.ts`

### 状态管理（`src/atoms/`）

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

### 路由（`src/pages/`）

使用 `vite-plugin-pages`（基于文件的路由）结合 `react-router` v7。主要路由：
- `/` — 方案管理（列表、示例、上传）
- `/admin` — 管理后台（字库数据的远程 CRUD）
- `/algorithm` — 算法文档页
- `/:id/` — 方案编辑器，包含子页面：`element`、`analysis`、`assembly`、`statistics`、`statistics2`、`optimization`、`diagram`、`debug`、`repertoire`
- `/repertoire` — 字集浏览
- `/equivalence` — 当量测试

路由模式由构建模式决定：`CF` 使用 Browser 路由，其他模式使用 Hash 路由（见 `src/utils.ts` 中的 `useHashRouter`）。

### 重计算任务

`src/worker.ts` 是一个 Web Worker，负责处理 encode、evaluate、optimize 等 CPU 密集型操作，避免阻塞主线程。

`hanzi-chai` 提供 TypeScript 字形分析和组装逻辑。`libchai`（Rust 编译的 WASM 库）除在 `src/utils.ts` 中提供配置校验（`validate`）外，还在 Worker 中通过 `Web.sync`、`Web.encode_evaluate` 和 `Web.optimize` 承担编码评估与优化。

`CLIENT` 模式将任务转发到同源 `/api/sync`、`/api/encode`、`/api/optimize`，并通过 `/sse/status` 接收优化进度；该构建需要配套本地服务。

Worker 通过 `Thread` 类（`src/utils.ts`）管理，使用 `MessageChannel` 进行双向通信。

### 数据管道

1. **数据源**：`api.chaifen.app`（JSON 数据）和 `assets.chaifen.app`（TXT 数据文件）
2. **下载脚本**：`scripts/fetch.ts` — 从 API 拉取字库和字形数据，保存到两处：
   - `packages/hanzi-chai/src/data/`（Node.js 环境，含 `.json` 和 `.json.deflate`）
   - `public/data/{APP_VERSION}/`（Web 端，版本化以避免缓存）
3. **数据文件**：`characters.json.deflate`、`glyphs.json.deflate`、`cjk.txt`、`dictionary.txt`、`distribution.txt`、`equivalence.txt`、`tygf.txt`、`gf0014.txt`、`Unihan_IRGSources.txt`。字符与字形也保存未压缩 JSON 供调试；TXT 下载失败时脚本仅警告并跳过
4. **前端加载**：`src/preload.ts` 在应用启动时预加载并解压数据（pako 解压 `.deflate` 文件）
5. **版本管理**：版本号取自 `packages/hanzi-chai/package.json` 的 `version` 字段，通过 Vite `define` 注入为 `APP_VERSION`
6. **后端 API**：`packages/api/`（Cloudflare Worker）处理字库、字形、当量数据的 CRUD（Bearer token 鉴权）

### 算法库（`packages/hanzi-chai/src/`）

关键模块：
- `main.ts` — 浏览器入口及内置组件注册；当前注册 5 个部件分析器、8 个复合体分析器、2 个组装器、1 个拼音分析器和 14 个筛选器。首末取大部件/复合体分析器虽有实现，但注册被注释
- `index.ts` — Node.js 入口，重新导出 `main.ts`，并提供基于 `node:fs` 的数据加载及配置处理；前端代码不要直接引入此入口
- `component.ts` — 从笔画序列提取部件（默认、二笔、张码、逸码、冰雪飞花、首末取大）
- `compound.ts` — 复合字结构分析（默认、二笔、张码、逸码、真码、星空键道、首右、冰雪飞花、首末取大）
- `assembly.ts` — 从拆分结果生成编码（默认组装器、星空键道组装器）
- `selector.ts` — 14 种取码启发式规则（全符笔顺、取大优先、取小优先、倒序取大、首末取大、同向笔画、多强字根、少弱字根、根少优先、结构完整、能散不连、能连不交、连续笔顺、非形近根）
- `config.ts` — 配置类型定义与校验
- `registry.ts` — 可扩展性插件注册表
- `classifier.ts` — 字根分类器
- `data.ts` — 数据加载与解析（原始字库、词典、当量映射、键位分布）
- `element.ts` — 元素操作
- `pinyin.ts` — 拼音分析
- `affine.ts` — 仿射变换相关
- `bezier.ts` — 贝塞尔曲线工具
- `math.ts` — 数学工具
- `unicode.ts` — Unicode 相关工具
- `repertoire.ts` — 字集管理
- `utils.ts` — 通用工具函数

测试位于 `packages/hanzi-chai/spec/`，覆盖 affine、bezier、component、degenerator、element、pinyin、primitive、repertoire、selector、unicode、utils 及 e2e。

### 构建目标

| 模式 | 路由 | 部署目标 |
|------|------|---------|
| PAGES | Hash | GitHub Pages（`dist/pages`） |
| CF | Browser | Cloudflare Workers（前端 `dist/cf`） |
| BEX | Hash | 浏览器扩展（`dist/pages`） |
| CLIENT | Hash | 本地服务客户端前端（`dist/client`） |

构建过程：先通过 `build:pkg` 编译算法包，再根据模式调用 Vite 构建。所有构建注入 Tailwind CSS v4、Ant Design v5、MDX 支持。

### API 后端（`packages/api/src/`）

Cloudflare Worker，使用 itty-router。目录结构：
- `worker.ts` — 入口，CORS 中间件
- `router/` — 路由定义（characters、glyphs、equivalence、repertoire、users）
- `controller/` — 请求处理逻辑
- `model/` — 数据库操作（D1 + KV）
- `dto/` — 数据类型定义（context、jwt、list、load、users）
- `middleware/` — JWT 认证中间件
- `error/` — 错误类型定义
- `utils/` — 工具函数

绑定资源：D1 数据库 `CHAI`、KV 命名空间 `REFERENCE`。

## 技术栈

**前端**：React 18、Vite 8、TypeScript 6、Tailwind CSS 4、Ant Design 5、Jotai（状态管理）、react-router v7、@xyflow/react（流程图）、@ant-design/charts / @antv/s2（图表）、@dnd-kit（拖拽）、MDX（文档）

**算法**：TypeScript、libchai（Rust WASM，npm 包）、pako（压缩）

**后端**：Cloudflare Workers（itty-router）、D1（SQLite）、KV、JWT 认证

**工具链**：Bun、Biome 2.5（格式化 + lint）、Bun 内置测试运行器（`bun:test`）

## 领域术语

| 术语 | 含义 |
|------|------|
| 配置 / 方案 | 方案配置对象（含分析、编码、优化等子配置） |
| 字库 / 字集 | 汉字字符集及其元数据 |
| 字形 | 字符的具体图形表示（可能有多个字形对应同一字符） |
| 部件 / 字根 | 拆分的原子单元 |
| 笔画 | 单笔 |
| 笔顺 | 笔画顺序 |
| 拆分 | 字符分解过程 |
| 结构描述字符 | IDS（Ideographic Description Sequence）操作符，如 ⿰⿱⿺ |
| 元素 | 参与编码的基本单位（字根或笔画） |
| 全码 | 完整编码 |
| 简码 | 短码（取前几码） |
| 码表 | 编码输出表 |
| 当量 | 按键组合的输入代价映射（评估与优化用） |
| 退火 | 模拟退火优化算法 |
| 筛选器 / 启发式 | 取码规则（Selector） |
| 分析配置 | 拆分规则配置 |
| 编码配置 / 组装配置 | 取码组装规则配置 |
| 拼写运算 | 拼音到元素序列的映射规则 |
| 复合体 | 由多个部件组成的字形 |
| 变换器 | 字形变换操作（如笔画变形） |
| 归类 | 将多个字根归并为一个编码元素 |

## CI/CD

- **`static.yml`**：推送到 `main` 或手动触发 → `bun install` → `bun run fetch` → `bun run build:PAGES` → 部署到 GitHub Pages
- **`test.yml`**：PR 或推送到 `main` → `bun install` → `bun run fetch` → `bun run --filter hanzi-chai test:all`
- **`publish.yml`**：推送到 `main`，比较 `packages/hanzi-chai/package.json` 版本与 npm 已发布版本，不同则安装算法包依赖、构建并发布到 npm
