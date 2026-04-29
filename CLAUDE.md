# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目简介

汉字自动拆分系统——一个位于 https://chaifen.app 的网页应用，用于设计和测试中文输入方案。用户定义拆分和编码规则，系统自动分解汉字并生成码表。

## 常用命令

```bash
# 安装依赖并下载字库数据（安装后必须执行 fetch）
bun install && bun run fetch

# 开发
bun run dev          # Vite 开发服务器（localhost:5173）

# 代码检查与格式化
bun run lint         # Biome 检查
bun run fix          # Biome 自动修复（unsafe）
bun run format       # 格式化并 git stage（pre-commit 钩子自动运行）

# 构建目标
bun run build:PAGES  # GitHub Pages 静态站点
bun run build:CF     # Cloudflare Workers
bun run build:BEX    # 浏览器扩展
bun run build:CLIENT # 纯客户端版本

# 测试
bun run --filter hanzi-chai test
```

需要 Bun 1.0+。pre-commit 钩子会自动运行 `bun run format`。

## 架构

### 两层设计

1. **`packages/hanzi-chai/`** — 纯 TypeScript 算法库，负责汉字拆分与编码，无 UI 依赖，有独立的 Vitest 测试套件。
2. **`src/`** — 使用算法库的 React/Vite 网页应用。

路径别名 `~/` 指向 `src/`，`hanzi-chai` 别名在开发模式下直接指向 `packages/hanzi-chai/src/main.ts`。

### 状态管理（`src/atoms/`）

使用 Jotai 原子，按领域组织：
- `config.ts` — 主配置对象、URL 位置、撤销/重做历史（10 步）
- `cache.ts` — 远程数据的异步原子（字库、词典、当量表、键位分布）
- `data.ts` — 字集视图、字形覆盖、变换器
- `encoder.ts` — 码长、简码、构词规则
- `analysis.ts` — 退化配置、过滤器、分类器
- `keyboard.ts` — 键盘布局
- `optimization.ts` — 优化器配置

配置以 URL 中 9 位方案 ID 为键持久化到 localStorage。

### 路由（`src/pages/`）

使用 `vite-plugin-pages` 实现基于文件的路由。主要路由：
- `/` — 方案管理（列表、示例、上传）
- `/:id/` — 方案编辑器，包含子页面：`element`、`analysis`、`assembly`、`statistics`、`optimization`、`diagram`、`debug`
- `/repertoire` — 字集管理
- `/equivalence` — 当量测试

路由模式（hash vs browser）在构建时通过 `version.ts` 中的 `useHashRouter` 决定。

### 重计算任务

`src/worker.ts` 是一个 Web Worker，负责处理 sync、encode、evaluate、optimize、analysis、assembly 等操作，避免阻塞主线程。Rust WASM 库（libchai）在此 Worker 内加载，用于核心算法。优化进度通过后端 API 的 SSE 流式传输。

### 数据管道

1. 字库数据通过版本化 URL 获取并缓存：`/data/{APP_VERSION}/{file}`
2. `.deflate` 文件用 pako 解压
3. 后端 API（`https://api.chaifen.app/`）处理字库的增删改查（Bearer token 鉴权）

### 算法库（`packages/hanzi-chai/src/`）

关键模块：
- `main.ts` — 注册表入口，聚合分析器和组装器
- `component.ts` — 从笔画序列提取部件
- `compound.ts` — 复合字结构分析
- `assembly.ts` — 从拆分结果生成编码
- `selector.ts` — 12 种取码启发式规则（如取大优先、全符笔顺）
- `config.ts` — 配置类型与校验
- `registry.ts` — 可扩展性插件注册表

### 构建目标

| 模式 | 路由 | 部署目标 |
|------|------|---------|
| PAGES | Hash | GitHub Pages（`dist/pages`） |
| CF | Browser | Cloudflare Workers |
| BEX | Hash | 浏览器扩展 |
| CLIENT | Hash | 纯客户端静态站 |

## 领域术语

| 术语 | 含义 |
|------|------|
| 配置 | 方案配置对象 |
| 字库 / 字集 | 汉字字符集 |
| 部件 | 拆分的原子单元（字根） |
| 笔画 | 单笔 |
| 笔顺 | 笔画顺序 |
| 拆分 | 字符分解 |
| 全码 | 完整编码 |
| 简码 | 短码 |
| 码表 | 编码输出表 |
| 当量 | 换手惩罚（优化用） |
| 退火 | 模拟退火优化算法 |
| 分析配置 | 拆分规则配置 |
| 编码配置 | 取码组装规则配置 |

## CI/CD

- **`static.yml`**：推送到 `main` → `bun install` → `bun run fetch` → `bun run build:PAGES` → 部署到 GitHub Pages
- **`test.yml`**：PR 或推送到 `main` → `bun install` → `bun run fetch` → `bun run --filter hanzi-chai test`
