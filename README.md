# 汉字自动拆分系统 · 魔改版

基于 [hanzi-chai/hanzi-chai.github.io](https://github.com/hanzi-chai/hanzi-chai.github.io)（[chaifen.app](https://chaifen.app)）的二次开发版本。原系统根据您设计的汉字编码输入方案自动拆分并编码汉字；本版本在其上增加了**智能选根系统**等一系列功能，用于输入方案的字根增删、归并与重码优化的量化分析。

原系统的开发和使用主要在 QQ 群中讨论，欢迎点击[本链接](https://qm.qq.com/q/dcBbtQqLFC)加入，或搜索群号码 627379895 加入。

## 与上游相比新增的功能

### 智能选根系统

本魔改版的核心增量，独立页面（`src/components/RootAdditionAnalyzer.tsx`），三个页签协同工作：

**手动分析**——量化评估每次加根/减根/改根对重码分布的影响：

- **加减根分析器**：支持加根、减根、改根三种操作；模式名采用 `*` 式通配，自动适配任意码长方案（不硬编码 4 码）
- **归并安排（逐码混排）**：加根后每个码位可独立设置为字母键，或归并到已有根的第几码，安排编辑器按码位分色显示
- **悬停组分析**：鼠标悬停任意重码组，显示基线/加根后人数（n→m）、组内成员增减三色标注（黑=不变、绿=新加入、红=离开），可捕捉等量互换组
- **汉字搜索**：各阶重分析与多元分布支持按汉字搜索，命中组高亮定位，可列出该字在全部模式下的重码组
- **变化列展开**：点击查看全部变化组；各阶重分析提供全部合计与展开/收起

**自动搜索**——由引擎自动寻找收益最高的加根序列：

- **增量评分引擎**（`src/lib/智能选根核心.ts`）：基态 + 脏字传播增量评分，每次变体评分约 0.1s，远快于全量重算
- **四类字根表**：字频范围、字内部件、重码组挖掘、手动指定，可组合使用
- **重码组挖掘**：Web Worker 后台运行，全程进度上报，大组计分合并扫描优化
- **根数罚分表达式**：自定义罚分函数（如 `n => n * 50`），惩罚根数膨胀
- **减根范围**：正则过滤可减元素，无效正则直接报错终止而非静默忽略
- **单轮根数 K**：每轮把单加收益降序前 K 个改善加根同时应用并整体合评；轨迹展示各根单加预期与合评真降幅对照（单加预期 ≠ 合评：根间相互作用），K=1 即单步贪心
- **轮轨迹统一**：每轮（含最后没有改进的一轮）都进轨迹，未采用的动作用「（未采用）」标注；搜索结果相对当前方案无变化时「应用到方案」按钮禁用
- **预置归并**：搜索前声明归并意图，作为待执行动作参与搜索（不是初始改写，不会预先篡改字根映射）：
  - 语法（多条用逗号或换行分隔）：`还=人` 为整体归并——「还」放弃自己的键位，编码永远跟随「人」；`你 1=人 2` 为码位归并——「你」保留键位，仅第 1 码改用「人」的第 2 码（码位从 1 起，两边必须成对）
  - 加根即归并：目标在候选池中时，把它加进来的那一轮里，待归并的根以归并形式**同轮随行**进入，不分两轮；目标已经是字根时，归并作为独立动作与其它加减根动作一起按分数竞争，未必会被选中
  - 同进同出：归并关系建立后，后续轮次删除被跟随的根时，跟随根一并移除
  - 前置筛选：根与目标必须在当前字根映射或字根表候选池里，否则该条无法应用，完成后在绿框给出原因（如 `预置归并用不了：还=人（「还」不在字根池）`）

**评分表**——与手动分析双向写回，自动搜索结果直接落表。

> 口径保证：`src/lib/阶重统计.ts` 是阶重统计的唯一权威（一阶以上 n²/2·26^阶 含自身对，零阶精确 Σ(n−1)；分组键按 maxLength 补齐，空位优先 `*`、越界补 `ε`）。手动分析、自动搜索、评分表与官方编码页四者分数精确一致，支持一字多码口径（逐序列统计 + 逐条目 top-N）。

### 其它新增

- **出简让全开关**（`short_code_yield_to_full`）：出简字是否把全码位让给后续同全码字，缺省开启；关闭即「出简不让全」，在 TS 编码器层实现
- **各阶重分析器**：统计一页新增 0~3 阶重码分布的长表视图
- **拆分流水线**：可视化拆分全流程
- **码槽与键位预填**：码槽数量随编码类型联动，键位默认预填键盘首字母（可改）

## 架构与 API

本项目为 monorepo：

- **`packages/hanzi-chai/`** — 核心算法库（TypeScript），负责汉字拆分、组装与编码，是本项目的对外 API 层，可独立发布到 npm。方案配置类型定义见 `packages/hanzi-chai/src/config.ts`
- **`src/`** — 基于算法库构建的 React 网页应用
- **`libchai`** — Rust/wasm 拆分引擎，作为 npm 依赖（`libchai@0.4.0`）引入，无需本地构建

智能选根相关模块：

| 模块 | 说明 |
| --- | --- |
| `src/lib/智能选根核心.ts` | 增量评分引擎（基态 + 脏字传播、搜索调度） |
| `src/lib/智能选根.worker.ts` | Web Worker 消息协议（start / mine / 组挖掘 / stop） |
| `src/lib/阶重统计.ts` | 阶重统计唯一权威口径 |
| `src/lib/标准装配.ts` | 统一方案装配配方 |
| `src/components/RootAdditionAnalyzer.tsx` | 智能选根三页签 UI |

## 开发

### 环境要求

- [Bun](https://bun.sh) 1.0+

### 快速开始

```bash
# 克隆仓库
git clone https://github.com/Richard-Phi/hanzi-chai-autoselect.git
cd hanzi-chai-autoselect

# 安装依赖并下载汉字数据
bun install && bun run fetch

# 启动开发服务器
bun run dev
```

开发服务器启动后，访问 [localhost:5173](http://localhost:5173) 即可查看。

### 常用命令

```bash
bun run lint                      # Biome 代码检查
bun run --filter hanzi-chai test  # 运行算法库测试
bun run format                    # 代码格式化
```

### 构建

```bash
bun run build:PAGES   # GitHub Pages 静态站点
bun run build:CF      # Cloudflare Workers
bun run build:BEX     # 浏览器扩展
bun run build:CLIENT  # 纯客户端静态站
```

本地打包（不复制 public 大文件时）可用：

```bash
NO_COPY_PUBLIC=1 bunx vite build --mode PAGES --emptyOutDir false
```

`dist/` 为构建产物，不入库；如需向他人提供免构建版本，建议通过 GitHub Release 附带打包产物。

## 上游与致谢

- 上游项目：[hanzi-chai/hanzi-chai.github.io](https://github.com/hanzi-chai/hanzi-chai.github.io)
- 拆分引擎：[hanzi-chai/libchai](https://github.com/hanzi-chai/libchai)
- 使用文档：[docs.chaifen.app](https://docs.chaifen.app)
- 在线实例（上游）：[chaifen.app](https://chaifen.app)

## 许可证

[GPL-3.0-only](LICENSE)
