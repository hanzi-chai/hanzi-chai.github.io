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
bun run --filter hanzi-chai test:scheme # 独立字库的方案运行与 CLI 测试

# 无界面方案开发（完整用法见 packages/hanzi-chai/README.md）
bun run chai --help
bun run chai init --dir ./my-scheme
bun run chai evaluate --project ./my-scheme --out ./runs/baseline --json

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

## 包围外框维护经验与复用流程

### Agent 回测错误复盘

每次实际 agent 盲选提交冻结并评分后，生成按字符聚类的离线 HTML 错误复盘页。`backtest.ts score` 已自动调用 `scripts/glyph-review/error-review.ts`；独立生成使用 `bun scripts/glyph-review/error-review.ts --batch <冻结批次目录>`，默认输出该批次的 `error-review.html`。页面须使用该次实际看过的冻结 panel/候选图和原始理由，展示来源、所选候选、历史正确候选及评分错误类型；同字多个来源错误归为一组；若来自不同递进轮次，逐任务保留其实际看过的轮次 panel，不能用最终候选池替代旧轮输入。不得用当前渲染器重画旧 panel，不得将评分类型或 agent 理由当作已经人工确认的视觉根因。报告包含答案，放在 `blind/` 之外，不供尚未提交的盲选 agent 读取。人工分析独立保存，不改写原提交、历史标注或训练数据。相关个人技能为 `hanzi-glyph-error-review`。

维护大字集的包围外框时，先阅读 `scripts/glyph-review/README.md`，复用其中的清单、离线调整、拓扑审计和迁移工具。脚本均使用 TypeScript/Bun。当前码表及 IRGSources 基准为 Unicode 18.0；本轮用户已确认切图可用，后续沿用“切图成功”的约定，不再以 `crop-ink-at-border` 阻止核验。

### 字形与布局的表达

- 独立字形 A 与作为外框而发生非线性形变的字形 B 使用不同字形 ID；保留 A，不为改善显示而覆盖它。仅需移动或缩放内件时，可保留外框 ID，只增加矩形规则。
- 包围操作符为 `⿴⿵⿶⿷⿸⿹⿺⿼⿽`，其 `references[0]` 是外框。A→B 的迁移遍历整个字形数据库，但只替换这些位置；不能全局替换所有 A 引用或改变字符绑定。
- `packages/hanzi-chai/src/enclosure-layouts.json` 是全局矩形表，按实际外框 ID 查询；`enclosure.ts` 提供查询，共用的 `utils.ts` 中 `仿射合并` 自动采用内件范围，网页和 Node.js 共用。未命中时保留旧布局，显式内件坐标按坐标字段优先于全局默认值；外框本身有缩放平移时，矩形随之变换。
- 矩形将内件的原始 0–100 坐标映射到整个复合体的局部坐标，原点在左上角；它不是墨迹边界。普通复合体无需逐条保存同样的矩形；新增变形外框内部已审核的显式引用坐标应保留。
- 同一外框不一定适用同一种形变或布局。离线方案按原内件 ID 的 `innerVariants`、按操作符的 `contextVariants`、默认定义依次选择；不同形变分配不同 ID，各自进入全局表。单一外框 ID 的不同操作符布局可用 `rectangles`。需要留中缝或连接横画的内件替换必须显式列入 `innerGlyphOverrides`，不能静默改变构字部件。

### 扩大字集时的工作顺序

1. 冻结最新字符、字形、码表和 IRGSources 快照及哈希。用 `enclosure-inventory.ts --out <新目录>` 重新枚举外框，以真实 ID 去重，保留不同包围操作符的实例和没有直接字符绑定的外框。旧清单的 804 个外框是迁移前统计，扩大字集应重新计算，并识别已入全局表的外框与新需求。
2. 复用 `enclosure-profiles.ts` 的离线方案格式，在新的批次目录中准备判断、独立外框图、实际复合体图和对应 Unicode 来源图。当前脚本的筛选、171 项完整性要求及部分目录/页面文案针对基本集，扩展前须参数化，不能只修改数量断言或直接重跑旧批次。
3. 先分“只调内件矩形”与“新建变形外框”。非线性变形可复用分段坐标映射 `warpStroke`，必要时调整个别笔画或复合外框的引用参数；处理贝塞尔控制点及相对坐标，保持连接点精确一致。不要把固定 50% 缩放当作通用布局。
4. 保持笔画数量、种类、笔顺和复合体笔顺块。默认定义、结构变体、内件变体、辅助部件和内件替换，都须按引用路径递归落到基本部件做双向拓扑审计，见下一节。
5. 用真正的共用渲染器生成对照图，逐图检查留白、避让、相交及各来源特征，尤其核验内外层同时使用新规则的组合。对每种结构及特殊内件提供实例。保存判断理由、图像哈希及看图记录；坐标有限、引用合法或“能渲染”均不能代替视觉核验。修改方案后重新生成并复核变化的图，未变化的图可用逐字节一致证明沿用已有复核。
6. 审核通过后生成可检查的迁移计划，再在已有上传授权的范围内执行。新批次必须使用独立的快照、日志和输出目录，并合并保留现有全局表规则；当前 `upload-enclosures.ts` 和 `verify-enclosure-migration.ts` 含本次固定目录、数量和整表生成逻辑，不能原样用于下一批覆盖现有规则。

### 拓扑验证的硬性条件

`enclosure-topology.ts` 使用 `部件.生成新二进制切片列表`：原部件与变形部件互为字根，两方向都必须返回全笔画掩码，不启用笔画种类退化。审计时用原部件的语义 ID 构造比较对象，避免临时负 ID 或新 ID 干扰口/囗等特殊字根检查；正式字形仍保留独立 ID。应覆盖所有新增基本部件，不能只检查外框根节点。

仅比较笔画交连矩阵不够：分离子图的左右关系也会影响匹配；相同连接点的小数误差也可能造成失配。本轮曾发现 18 项需修正，最终 121 项变形、255 处部件出现位置、161 组去重比较全部通过。发现问题应修正几何数据，不能放宽匹配容差或退化规则来掩盖问题。

### 上传、恢复与验证

- 先保存服务器 `before-glyphs.json`、`before-characters.json`，核对待用源字形未发生并发修改；准备前后记录差异和完整 ID 映射。按依赖顺序逐个 POST 新字形，以服务器返回的正 ID 重映射所有临时负 ID，回读确认后再更新原复合体引用。不能假定离线 ID 或批量 POST 的返回值就是新 ID。
- 使用可恢复的 `journal.json` 记录每次创建、未确认请求及批次进度；本次 PUT 每批 50 条。创建响应不明确时，先回读并核对唯一匹配，不能盲目重试 POST。恢复更新时，记录须与迁移前或计划后的值一致，否则先解决并发改动。上传开始后不能重新 `prepare` 覆盖真实 ID。
- 替换外框引用时保留原复合体 ID、其他元数据及笔顺块；迁移普通内件的布局到全局表时，移除会遮蔽新默认范围的旧显式坐标。新建外框内部已审核的显式坐标不做同样清理。
- 最终回读全部记录，逐条核对新增、更新以及计划外未变记录，检查 ID 唯一性、引用完整性和字符表未变。使用正式 ID 与实际回读数据重新渲染，与冻结的审核 SVG 对比，再检查所有相关复合体。若有失败，以迁移前快照复现区分原有错误和新增回归，不能把原有错误算成成功，也不能漏掉新增错误。
- 同步算法包和 `public/data/<版本>/` 的 JSON 与 `.deflate` 缓存，确认全局表随包编译导出；运行相关测试、类型检查和所需前端构建。数据库上传、缓存同步与线上前端部署是不同状态，交接时分别说明。
- 保留迁移前审核产物，不用更新后的字库重跑它们的 `render`。后续验证使用实际迁移回读数据；拓扑审计显式使用该批次的原始快照，避免把已经改过的源数据当作基线。

### 本轮完成状态（2026-10-30，供后续会话定位）

- 基本集审核产物：`output/glyph-review/enclosure-profiles-18/`，171 个外框、268 个例子；50 项只调矩形，121 项还新建变形外框。`decisions.json`、`final-audit.json`、`topology-audit.json` 保存判断与验证，`topology-baseline/` 保留拓扑修正前版本。
- 已完成远程迁移：创建 171 个字形（含辅助及变体），写入 176 条全局矩形规则，更新 4,572 条原字形记录，其中 4,571 条替换外框，另有已审核的 5 处内件引用替换；字符表未变。171 个外框方案和 171 个新增字形的计数含义不同。
- 迁移证据：`output/glyph-review/enclosure-migration-18/` 的 `journal.json`、`resolved-plan.json`、前后快照、`result.json`、`render-verification.json`。重新核验命令：`bun scripts/glyph-review/verify-enclosure-migration.ts`。
- 268 个审核 SVG 逐字节一致；10,564 个相关复合体中 10,562 个可渲染，`101082`、`101713` 在迁移前后均有笔画块越界，没有新增渲染错误。相关 8 项测试、类型检查、算法包和 CF 前端构建通过，本地缓存已同步，线上前端尚未部署。
- 当前保留的最佳盲选结果为 `output/glyph-review/backtest-100-enclosures-20261030/`：100 字、473 个非 G 来源任务，agent 412/473（87.10%），统计基线 390/473（82.45%），候选覆盖 431/473（91.12%）。结果摘要及关键哈希在 `scripts/glyph-review/best-result.json`。这是冻结图片上的旧样本诊断，不代表当前渲染器或新样本准确率。
- 2026-10-30 按用户要求清理早期试验、较差的共享池/递进回测及专用脚本；最佳批次、已执行迁移的恢复证据和当前渲染审核保留。旧批次引用只保留为历史来源记录。新实验使用 `backtest.ts prepare --out <新目录>`；已有最佳结果使用 `backtest.ts verify --out <批次目录>` 只读核对，无需被删除的旧实验或当前字库。
