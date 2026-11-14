# 汉字自动拆分系统网页版

基于根目录 `hanzi-chai` 算法包的 React/Vite 应用，线上地址为 https://chaifen.app，使用教程见 [docs.chaifen.app](https://docs.chaifen.app)。

在仓库根目录执行：

```bash
bun install
bun run fetch
bun run dev:web
```

开发服务器默认地址为 http://localhost:5173。算法源码、示例及数据由根包维护，网页开发使用源码别名，正式构建使用公开包导出。`web/package.json` 通过 `file:..` 引用根包。

| 根目录命令 | 用途 / 产物 |
| --- | --- |
| `bun run build:PAGES` | GitHub Pages，`web/dist/pages` |
| `bun run build:CF` | Cloudflare 前端，`web/dist/cf` |
| `bun run build:BEX` | 浏览器扩展，`web/dist/pages` |
| `bun run build:CLIENT` | 本地服务客户端，`web/dist/client` |
| `bun run preview` | 预览 Pages 产物 |
| `bun run typecheck:web` | TypeScript 检查 |
| `bun run lint:web` | Biome 检查 |

根目录构建命令会先构建算法包；直接在 `web/` 执行 `build:*` 前需自行准备根包产物。数据从根 `data/` 加载，构建时复制所需文件到网页产物。`vite-data.ts` 提供开发数据服务，`public/_headers` 配置部署后的缓存响应头。

GitHub Pages 工作流从仓库根安装依赖、准备数据、构建，并上传 `web/dist/pages`。外部托管服务也应从仓库根执行构建，并使用对应的 `web/dist/<目标>` 作为发布目录。

算法 API、CLI 及测试说明见 [根 README](../README.md)。
