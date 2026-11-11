# hanzi-chai：算法库与方案命令行工具

拆分、组装和方案运行流程在本包内实现。浏览器入口不包含文件系统或 WASM 本地加载代码；Node 入口在此基础上提供方案项目、编码评估和运行记录。

仓库内使用 Bun；构建后的 CLI 也已在 Node.js 24 下验证。

## 快速开始

在仓库根目录执行：

```bash
# 首次安装或缺少字库数据时执行
bun install
bun run fetch

# 在子命令后指定方案 YAML
bun run chai evaluate ./examples/snow4.yaml --json
bun run chai validate ./examples/snow4.yaml --json
bun run chai explain ./examples/snow4.yaml --text 想 --json

# 显式保存基线，修改自己的方案后再保存候选运行
bun run chai evaluate ./scheme.yml --out ./runs/baseline --json
bun run chai evaluate ./scheme.yml --out ./runs/candidate --json
bun run chai compare ./runs/baseline ./runs/candidate --json
```

旧方案的字段或字形 ID 如果已经失效，可根据 `validate` 的诊断更新。

发布包安装后，命令名为 `chai`。本地也可以先 `bun run build:pkg`，再执行 `node packages/hanzi-chai/dist/cli.js`。

## 默认数据与文件覆盖

源码 CLI 默认使用 `packages/hanzi-chai/src/data/`，构建或安装后使用包内的 `dist/data/`。运行 `chai --help` 可以查看当前 CLI 的实际路径。直接传方案 YAML 即可共用这套数据。

| 参数 | 默认文件或用途 |
| --- | --- |
| `--data-dir <目录>` | 从指定目录读取下列默认文件名 |
| `--characters <文件>` | `characters.json.deflate` |
| `--glyphs <文件>` | `glyphs.json.deflate` |
| `--dictionary <文件>` | `dictionary.txt` |
| `--distribution <文件>` | `distribution.txt` |
| `--equivalence <文件>` | `equivalence.txt` |
| `--custom-analysis <类别>=<文件>` | 指定类别的自定义分析 TSV，可重复使用 |

命令行路径相对于当前工作目录解析。单个文件参数覆盖相应的默认文件，其余文件仍从数据目录读取。字符和字形使用 deflate 压缩的 JSON，词典、键位分布和当量使用制表符分隔。

```bash
bun run chai evaluate ./scheme.yml --dictionary ./user/dictionary.tsv \
  --custom-analysis '词性=./user/word-class.tsv' --json
```

自定义分析文件每行为 `汉字<TAB>元素名称（空格分隔）`，方案中的完整元素名称为 `类别-元素名称`。网页中的用户词典、当量、键位分布和自定义分析存于 IndexedDB，可导出为对应文件交给 CLI。

`analysis.customize` 和 `dynamic_customize` 直接保存在方案 YAML 中。键与 `form.mapping` 一样支持字符、字形名称（如 `字形-123`）和旧版裸数字字形 ID。字符规则应用于当前来源选择下的所有部件字形，具体字形规则优先于字符规则。使用默认复合体分析器时，也可用字形 ID 直接覆盖复合体的取根序列。

```yaml
analysis:
  customize:
    天: ['1', 大]
    字形-123: ['1', '2']
```

### 字形融合

融合在拆分时把指定复合体的笔画按原笔顺合在一起，交给部件分析器，使字根可以跨越原来的分部边界。字库仍保留字形本来的结构和来源。部件分析器和复合体分析器均为「默认」时自动启用默认集合，使用其他分析器时默认关闭。

`analysis.fusion: true` 启用默认集合，`false` 关闭融合。也可以传入字形 ID 列表来替换默认集合，例如 `analysis.fusion: [910]` 只融合「兆」的这一字形。融合后的字形可以用 `analysis.customize` 或 `analysis.dynamic_customize` 指定拆分。融合支持 1 到 30 笔的复合体。

## 命令与输出

| 命令 | 行为 |
| --- | --- |
| `validate <方案.yml>` | 检查基础结构、Rust 配置类型、组件名称、节点引用、元素引用，并实际拆分和组装 |
| `inspect --components` | 列出当前注册的分析器、组装器和筛选器 |
| `inspect <方案.yml> --text <汉字>` | 查询字形 ID、来源和笔顺 |
| `analyze <方案.yml> [--text <汉字>]` | 输出静态或动态拆分，指定字符时可独立于评估词典分析 |
| `explain <方案.yml> --text <字词>` | 输出候选拆分评价、默认组装器的逐节点取码轨迹、组装结果和编码 |
| `proofread <方案.yml> --reference <码表路径>` | 生成方案全码并与参考码表逐字校对，输出统计和差异条目 |
| `build <方案.yml> --out <新目录>` | 生成码表、评估结果及可复现输入 |
| `evaluate <方案.yml> [--out <新目录>]` | 评估并返回指标和主要重码组，指定 `--out` 时保存完整运行 |
| `compare <基线> <候选>` | 比较拆分、编码、排名和指标；可传目录或 run.json |
| `schema` | 输出基础结构 JSON Schema |

所有数据命令输出 `{formatVersion: 1, ok: true, result: ...}`。`--json` 使用紧凑格式，省略该参数则缩进显示。错误输出 `{formatVersion: 1, ok: false, diagnostics: [{code, path, message}]}`。stdout 只输出结果，运行器日志使用 stderr。`--help` 返回人类可读的帮助。

退出码：`0` 成功，`1` 配置、数据或运行错误，`2` 命令参数错误。校验错误中的路径使用 JSON Pointer；文件读取错误消息包含实际路径。Schema 仅描述基础结构，完整校验应执行 `validate`。

列表默认返回前 20 项，使用 `--limit 50 --offset 20` 分页（limit 最大 1000）。候选评价取决于分析器：默认部件分析提供全部候选及其评价，其他分析器返回它们实际保存的结果。逐节点取码轨迹目前支持默认组装器；其他组装器返回 `trace.supported: false`，仍可查看拆分、组装和最终编码。

`explain` 的最终编码取自整个方案的评估范围，保留真实频率和重码排名。若查询字符不在该范围或词典中，拆分仍可查看，但编码列表可能为空。多字词按配置的构词公式组装，不输出单一的逐节点多字词轨迹。未被构词规则覆盖的词长不生成编码。

## 校对参考码表

```bash
bun run chai proofread ./scheme.yml --reference ./reference.tsv --json
bun run chai proofread ./scheme.yml --reference ./reference.txt \
  --format code_space_char --direction reverse --scope components --status all \
  --limit 50 --offset 0 --json
```

参考码表每行前两列为单字和编码。默认使用 `char_tab_code`（单字、制表符、编码），也支持 `char_space_code`、`code_tab_char` 和 `code_space_char`。空格格式允许连续空白分隔列。已有运行目录中的 `codes.tsv` 可以直接作为参考码表。

`--direction forward` 以方案生成的全码为主体，`reverse` 以外部码表为主体。只校对方案字库能识别的单字，同字有多个参考编码时，匹配任意一个就记为 `correct`。有参考编码但未匹配时记为 `incorrect`，对侧缺少该字时记为 `unknown`。默认的 `--scope maximal` 包含字库中的全部单字。`components` 只看方案汉字集合中的成字部件，也可使用 `minimal`、`gb2312`、`general`、`basic`、`extended`、`supplement` 或 `panlingual`。校对范围仅筛选结果，方案仍按自身配置生成码表。

`result.summary` 统计三种状态，`result.accuracy` 是正确数占已知条目数的比例（0 到 1），没有已知条目时为 `null`。`result.entries` 默认仅列出错误，可用 `--status all`、`--status correct` 或 `--status unknown` 切换。分页作用于筛选后的列表，统计始终覆盖整个校对范围。条目带有主体编码、参考编码列表和方案组装元素序列，动态方案也带有候选序列的条件。发现编码差异时退出码仍为 0。

## 运行记录与比较

保存的运行目录包含：

```text
baseline/
  run.json        # 配置、输入哈希、拆分、完整码表、全部指标
  codes.tsv       # 词、全码、全码排名、简码、简码排名；无表头
  project/        # 方案、项目清单与实际使用的数据
```

运行快照和已有项目可以通过 `chai evaluate ./runs/baseline/project/chai.project.yaml --json` 复现，也可直接传项目目录 `chai evaluate ./runs/baseline/project --json`。清单中的路径相对于清单本身解析，命令行的单文件参数可以覆盖清单中的对应文件。

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

const 项目 = 读取方案项目("./scheme.yml", { dictionary: "./user/dictionary.tsv" });
const { 词列表, 输入 } = 运行方案(项目.上下文);
const 记录 = 评估方案项目(项目);
保存运行记录("./runs/new", 记录, 项目);
```

浏览器可以从 `hanzi-chai`（或显式 `hanzi-chai/core`）导入 `构建字库`、`准备方案`、`分析方案`、`运行方案`、`获取默认目标` 等公共算法。`准备方案` 接受已加载的字库、原始词典、自定义元素集合、键位分布目标和当量映射；`运行方案` 生成供 `libchai` 使用的编码输入。程序构造的配置应先校验，并检查 `检查配置引用`、`检查方案元素` 的诊断。

现有 Node 辅助函数仍从根入口重新导出。浏览器 atom 继续保留分阶段缓存，共用组装配置、优先简码、序列化、默认目标和编码评估约定。

### 共用静态与动态分析规则

所有复合体分析器，以及二笔、张码、逸码、冰雪飞花、首末取大部件分析器，均由基类的 `动态分析()` 执行同一份 `分析(字形, 环境?)` 规则。省略环境时查询当前配置；传入环境时自动探索字根选择和子分析候选。首末取大仍未注册为内置组件。

```ts
import {
  创建静态分析环境,
  推导动态分析,
  ok,
  type 分析执行环境,
} from "hanzi-chai/core";

const 规则 = (环境: 分析执行环境) => {
  if (环境.判断({ element: "木", op: "不是", value: null })) {
    return ok({ 字根名称: ["木"] });
  }
  return ok({ 字根名称: ["1", "2", "3", "4"] });
};
const 静态 = 规则(创建静态分析环境(() => true)); // 示例：木已选用
const 动态 = 推导动态分析(规则); // 木存在时取木，否则取笔画
```

具体分析器通过 `字根存在(配置, 字根, 环境)`、`查找字根(字形, 环境)` 和 `查找部件分析结果(部件, 环境)` 查询状态；递归调用时继续传递环境，不再编写对应的“动态取根”方法。固定字根无需分支。

`环境.选择(优先表)` 返回首个满足全部条件的候选，找不到时返回 `undefined`。子分析必须存在时使用 `选择分析(优先表, 环境)`，无匹配项会排除当前动态路径。`环境.缓存(配置对象, 输入对象, 计算)` 在一次推导的所有重跑之间复用几何匹配、候选排序等准备结果；不同配置隔离缓存，不能缓存依赖当前分支的选择。

默认部件分析器保留直接枚举有序拆分候选的底层实现，避免用条件重跑重新枚举拆分。它与派生部件分析器共用自定义覆盖逻辑；张码、逸码和首末取大通过 `基本分析(部件, 环境)` 选择候选，再计算补码等附加信息。

执行器遇到未知条件后分别假设成立、不成立，再重跑同一规则；相同条件及其反条件共享决定。内部保留完整路径，输出转换成首个匹配生效的优先表：前面的成立分支覆盖完整时才省略回退的否定条件。完整覆盖的规则会产生无条件末项，以兼容 `libchai` 编码输入。

规则必须同步、确定，不修改共享状态；候选数据必须可重复读取。不要捕获并吞掉环境抛出的内部控制信号。静态、动态选择无匹配项时均返回 `undefined`，规则可以自行回退，或返回 `ok(undefined)` 表示该路径没有结果。分析规则返回的错误使整个推导失败，意外异常原样抛出。存在缺口的优先表不能直接作为要求无条件末项的编码输入，调用方需要提供有意义的回退。

冰雪飞花的小集合判断先检查字根存在性，再判断集合归属，确保不存在的根不会进入小集合。动态部件候选同时包含小集合和全集合的拆分字段，复合体直接读取同一个候选，不再通过 `__magic` 附加另一张优先表。执行器本身只识别相同条件及其反条件，其他领域约束仍应在规则中表达，最坏路径数仍可能指数增长。

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
