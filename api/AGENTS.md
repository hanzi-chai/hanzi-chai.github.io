# API 与共享字库维护指导

**总是用中文回复。** 本文件适用于 `api/`。字符字形规范、分部原则及方案回归方法遵循 [根 AGENTS.md](../AGENTS.md)。

## 目录与服务

Cloudflare Worker，使用 itty-router。目录结构：

- `src/worker.ts` — 入口，CORS 中间件
- `src/router/` — 路由定义（characters、glyphs、equivalence、repertoire、users）
- `src/controller/` — 请求处理逻辑
- `src/model/` — 数据库操作（D1 + KV）
- `src/dto/` — 数据类型定义（context、jwt、list、load、users）
- `src/middleware/` — JWT 认证中间件
- `src/error/` — 错误类型定义
- `src/utils/` — 工具函数

绑定资源：D1 数据库 `CHAI`、KV 命名空间 `REFERENCE`。

## 依赖与命令

服务使用 Cloudflare Workers、itty-router、D1、KV 和 JWT，依赖与配置以本目录 `package.json`、`wrangler.toml` 为准。公开 REST API 位于 `https://api.chaifen.app`，字库写入使用 Bearer token 鉴权。

本包通过 `file:..` 依赖根 `hanzi-chai`，代码统一从 `hanzi-chai` 引入，Worker 的默认条件选择通用算法及对应类型；不要使用 Node 文件系统函数或穿越相对路径访问根包内部模块。共享客户端 `src/client.ts` 供网页和根维护脚本使用，token 由调用者提供：网页读取 localStorage，根脚本通过 `scripts/utils.ts` 使用环境变量 `JWT`。

从仓库根目录执行：

```bash
bun run typecheck:api
bun run start:api       # 先构建根包，再启动 wrangler dev
bun run deploy:api      # 先构建根包，再部署
```

本目录 tsconfig 继承根 `tsconfig.base.json`，只声明 Worker/Node 全局类型及本地文件范围；TypeScript 与 Biome 由根工作区统一提供，不单独声明工具版本。

直接在 `api/` 执行 `start` 或 `deploy` 前，需自行准备根包产物。API 不新增 spec；通过类型检查、构建及实际运行验证。Wrangler 命令先读取对应技能；具体绑定、API 和平台配置以当前源码、安装的配置 schema 及官方文档为准。

## 数据写入约束

- 新字段使用 `snake_case`；字符和字形数据库中的所有数值仅存整数，包括嵌套坐标、曲线参数、索引及 ID。复用根包 `校验字库整数`，批量和单条路径遵循相同约束。布局计算可用小数，落库前将展开的绝对坐标取整。
- 每个字符的每个有效 Unicode 来源，恰好映射到一个与原图相容的字形。只迁移确需修正的来源，保留其余来源；宿主逐个核对，不能把基础字的某来源直接推广到全部引用者。
- 共享库维护真实字形、笔顺与分部；方案兼容取根、无规范来源的另一笔顺和人为重描留在方案补丁中。修改依据不能只是目标编码不同。

## 远程修改与回读

1. 先保存字符和字形快照，核对 Unicode 同版本来源栏、相应地区笔顺及引用树。列出受影响字符、来源、字形、宿主和预期变更，优先复用已有相容字形及中间分部。
2. 在本地应用拟议补丁，核查整数、引用存在性、笔数、笔形、接离、交错笔顺和来源唯一性，并执行方案双向回归。声明纯分部重组时逐项比较展开后的笔画，确认几何与笔顺未变。
3. 新字形先确定实际正式 ID，并用正式 ID 预演全部引用关系；按依赖顺序创建分部与复合体，再更新字符来源。写入前重新确认 ID 未被占用，不把临时预演 ID 留入正式数据。既有维护脚本可能直接批量写入，运行前先核对脚本实际内容、筛选范围及 dry-run 支持情况。
4. 在用户已授权的远程修改范围内执行写入，随后逐条回读字符和字形，核对实际内容、来源映射及引用关系。不能仅以写请求返回成功判定完成。
5. 重新下载线上数据并跑回归，确认本地验证的补丁与真实共享库一致。若同期有其他更新，从回读快照仅恢复本批字形建立旧方案对照，使用相同字符、词典和参考表隔离本批影响。

维护脚本位于根 `scripts/`；不要因为脚本名称或旧注释看似只读就直接执行。通用校对和参考排除清单维护规则见根文档，不在 API 指导中累积具体方案修正记录。
