# hanzi-chai：算法库与方案命令行工具

拆分、组装和方案运行流程在本包内实现。浏览器入口不包含文件系统或 WASM 本地加载代码；Node 入口在此基础上提供方案项目、编码评估和运行记录。

仓库内使用 Bun；构建后的 CLI 也已在 Node.js 24 下验证。

## 快速开始

在仓库根目录执行：

```bash
# 首次安装或缺少字库数据时执行
bun install
bun run fetch

# 创建一个可直接运行的笔画方案，同时复制本次使用的数据
bun run chai init --dir ./my-scheme
bun run chai validate --project ./my-scheme --json
bun run chai explain --project ./my-scheme --text 想 --json
bun run chai evaluate --project ./my-scheme --out ./runs/baseline --json

# 修改 my-scheme/scheme.yaml 后再次评估
bun run chai evaluate --project ./my-scheme --out ./runs/candidate --json
bun run chai compare ./runs/baseline ./runs/candidate --json
```

`init --example snow4` 可以从仓库示例创建项目，也可以传入已有方案 YAML 的路径。示例名称与 `examples/` 中的文件名一致。旧方案的字段或字形 ID 如果已经失效，需要根据 `validate` 的诊断更新。

发布包安装后，命令名为 `chai`。本地也可以先 `bun run build:pkg`，再执行 `node packages/hanzi-chai/dist/cli.js`。

## 文件化方案

`init` 生成：

```text
my-scheme/
  chai.project.yaml
  scheme.yaml
  assets/
    characters.json.deflate
    glyphs.json.deflate
    dictionary.txt
    distribution.txt
    equivalence.txt
```

清单中的所有路径相对于清单文件解析，与执行命令时的工作目录无关。可以修改清单来指定用户词典、自定义分析、当量和键位分布：

```yaml
formatVersion: 1
config: scheme.yaml
data:
  directory: assets
  dictionary: user/dictionary.tsv
  distribution: user/distribution.tsv
  equivalence: user/equivalence.tsv
  customAnalysis:
    词性: user/word-class.tsv
```

三个 TSV 覆盖项都可省略，默认从 `directory` 读取对应文件。`customAnalysis` 的键是自定义元素类别，文件每行是 `汉字<TAB>元素名称（空格分隔）`；配置中的完整元素名称为 `类别-元素名称`。

`analysis.customize` 和 `dynamic_customize` 是另一种功能：它们直接保存在方案 YAML 中，键与 `form.mapping` 一样支持字符或字形名称（如 `字形-123`），也兼容旧版裸数字字形 ID。字符规则应用于当前来源选择下的所有部件字形，具体字形规则优先于字符规则。示例：

```yaml
analysis:
  customize:
    天: ['1', 大]
    字形-123: ['1', '2']
```

`--project` 也接受单独的方案 YAML，此时使用包内数据。需要复现或分享时，建议使用带数据快照的项目。网页中的用户词典、当量、键位分布和自定义分析仍由 IndexedDB 保存；CLI 不会自动读取浏览器存储，需要将这些数据导出为上述文件。

## 命令与输出

| 命令 | 行为 |
| --- | --- |
| `init --dir <新目录>` | 创建方案及数据快照；已有目录不覆盖 |
| `validate --project <路径>` | 检查基础结构、Rust 配置类型、组件名称、节点引用、元素引用，并实际拆分和组装 |
| `inspect --components` | 列出当前注册的分析器、组装器和筛选器 |
| `inspect --project <路径> --text <汉字>` | 查询字形 ID、来源和笔顺 |
| `analyze --project <路径> [--text <汉字>]` | 输出静态或动态拆分；指定字符可独立于评估词典分析 |
| `explain --project <路径> --text <字词>` | 输出候选拆分评价、默认组装器的逐节点取码轨迹、组装结果和编码 |
| `build --project <路径> --out <新目录>` | 生成码表、评估结果及可复现输入 |
| `evaluate --project <路径> [--out <新目录>]` | 评估并返回指标、主要重码组；指定 out 时保存完整运行 |
| `compare <基线> <候选>` | 比较拆分、编码、排名和指标；可传目录或 run.json |
| `schema` | 输出基础结构 JSON Schema |

所有数据命令输出 `{formatVersion: 1, ok: true, result: ...}`。`--json` 使用紧凑格式，省略该参数则缩进显示。错误输出 `{formatVersion: 1, ok: false, diagnostics: [{code, path, message}]}`。stdout 只输出结果，运行器日志使用 stderr。`--help` 返回人类可读的帮助。

退出码：`0` 成功，`1` 配置、数据或运行错误，`2` 命令参数错误。校验错误中的路径使用 JSON Pointer；文件读取错误消息包含实际路径。Schema 仅描述基础结构，完整校验应执行 `validate`。

列表默认返回前 20 项，使用 `--limit 50 --offset 20` 分页（limit 最大 1000）。候选评价取决于分析器：默认部件分析提供全部候选及其评价，其他分析器返回它们实际保存的结果。逐节点取码轨迹目前支持默认组装器；其他组装器返回 `trace.supported: false`，仍可查看拆分、组装和最终编码。

`explain` 的最终编码取自整个方案的评估范围，保留真实频率和重码排名。若查询字符不在该范围或词典中，拆分仍可查看，但编码列表可能为空。多字词按配置的构词公式组装，不输出单一的逐节点多字词轨迹。未被构词规则覆盖的词长不生成编码。

## 运行记录与比较

保存的运行目录包含：

```text
baseline/
  run.json        # 配置、输入哈希、拆分、完整码表、全部指标
  codes.tsv       # 词、全码、全码排名、简码、简码排名；无表头
  project/        # 方案与实际使用的数据，可直接再次 --project 运行
```

指标使用与网页统计页相同的默认评估目标，区别于退火优化的 `optimization.objective`。运行记录保存算法版本、libchai 版本、配置哈希、输入数据哈希、字集范围和评估目标。Map 指标保存为 JSON 对象，避免序列化丢失键位分布。

`compare` 对口径相同的运行输出数值差 `delta = after - before`。数据、版本、字集或目标不同会返回 `comparable: false` 及 `incompatibleFields`，此时不输出指标差值，拆分和编码变化仍可查看。它不会自动把差值判定为“改善”，不同指标的意义由使用者判断。

## 程序调用

Node/Bun 中可以使用完整入口；在本仓库中建议使用显式的 `hanzi-chai/node` 子路径，避免前端路径别名把它解析到浏览器入口：

```ts
import {
  读取方案项目,
  运行方案,
  评估方案项目,
  保存运行记录,
} from "hanzi-chai/node";

const 项目 = 读取方案项目("./my-scheme");
const { 词列表, 输入 } = 运行方案(项目.上下文);
const 记录 = 评估方案项目(项目);
保存运行记录("./runs/new", 记录, 项目);
```

浏览器可以从 `hanzi-chai`（或显式 `hanzi-chai/core`）导入 `构建字库`、`准备方案`、`分析方案`、`运行方案`、`获取默认目标` 等公共算法。`准备方案` 接受已加载的字库、原始词典、自定义元素集合、键位分布目标和当量映射；`运行方案` 生成供 `libchai` 使用的编码输入。程序构造的配置应先校验，并检查 `检查配置引用`、`检查方案元素` 的诊断。

现有 Node 辅助函数仍从根入口重新导出。浏览器 atom 继续保留分阶段缓存，共用组装配置、优先简码、序列化、默认目标和编码评估约定。

## Agent 使用约定

1. 先用 `inspect --components` 和 `inspect --text` 获取真实的组件名称、字形 ID，不猜测字形 ID。
2. 创建基线运行；修改方案文件，保留原始数据快照。
3. 每次修改后执行 `validate`，根据 `diagnostics` 修复错误。
4. 用 `explain` 定位具体汉字的候选、筛选评价及取码分支；必要时分页查看。
5. 保存新运行，用 `compare` 检查指标和受影响字词。只有 `comparable: true` 时才比较指标差值。
6. 对关键汉字维护拆分或编码断言，防止指标改善时破坏必要规则。

当前 CLI 不包含 MCP 或退火优化长任务接口。

## 验证

```bash
bun run --filter hanzi-chai test:scheme
bun run build:pkg
bunx tsc --noEmit
bun run lint
```

新增测试使用小型独立字库，覆盖静态/动态运行、条件拆分、构词、优先简码、自定义元素、配置诊断、CLI 协议、输入快照复现和结果比较，不依赖在线字库。

完整测试还包含真实字库和历史示例的回归检查；已修复的接口迁移及仍待确认的算法、数据差异见 [测试维护记录](spec/README.md)。
