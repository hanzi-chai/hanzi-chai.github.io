# hanzi-chai：算法库与方案命令行工具

拆分、组装和方案运行流程在本包内实现。浏览器入口不包含文件系统或 WASM 本地加载代码；Node 入口在此基础上提供方案项目、编码评估和运行记录。

## npm 安装与快速开始

```bash
npm install hanzi-chai

# 查看随包发布的示例，并将一个示例导出为自己的方案文件
npx chai examples
npx chai examples snow4 --out ./scheme.yaml

# 默认读取包内数据，无需下载数据或克隆主仓库
npx chai validate ./scheme.yaml --json
npx chai evaluate ./scheme.yaml --json
npx chai explain ./scheme.yaml --text 想 --json

# 按需保存运行结果
npx chai evaluate ./scheme.yaml --out ./runs/baseline --json
```

需要 Node.js 20 或更高版本，也可使用 Bun。数据及示例随 npm 包安装；安装过程不执行下载脚本，安装完成后可以离线运行。`examples <名称> --out <文件>` 只导出一个 YAML 文件，不覆盖已有文件，也不创建方案目录。省略 `--out` 时返回示例配置 JSON。

默认数据固定在安装的包版本中，不会在运行时自动更新。升级包会更新默认快照；需要固定历史输入时，使用运行记录保存的快照，或者通过 `--data-dir` 提供自己的数据。

## 默认数据与文件覆盖

源码 CLI 默认使用 `src/data/`，构建或安装后使用包内的 `dist/data/`。包内仅包含下表的五份运行数据。示例源文件维护在本包的 `examples/`，构建后复制到 `dist/examples/`，无需依赖仓库根目录的资源。运行 `chai --help` 可以查看当前 CLI 的实际路径。直接传方案 YAML 即可共用这套数据。

| 参数 | 默认文件或用途 |
| --- | --- |
| `--data-dir <目录>` | 从指定目录读取下列默认文件名 |
| `--characters <文件>` | `characters.json` |
| `--glyphs <文件>` | `glyphs.json` |
| `--dictionary <文件>` | `dictionary.txt` |
| `--distribution <文件>` | `distribution.txt` |
| `--equivalence <文件>` | `equivalence.txt` |
| `--custom-analysis <类别>=<文件>` | 指定类别的自定义分析 TSV，可重复使用 |

`cjk.txt`、`tygf.txt`、`gf0014.txt` 和 Unicode 来源表不发布。`获取CJK汉字笔画数据`、`获取通用规范汉字笔画数据` 属于开发核验接口，安装包使用时需显式传入自己准备的文件路径。

命令行路径相对于当前工作目录解析。单个文件参数覆盖相应的默认文件，其余文件仍从数据目录读取。字符和字形使用 UTF-8 JSON，词典、键位分布和当量使用制表符分隔。

```bash
npx chai evaluate ./scheme.yml --dictionary ./user/dictionary.tsv \
  --custom-analysis '词性=./user/word-class.tsv' --json
```

自定义分析文件每行为 `汉字<TAB>元素名称（空格分隔）`，方案中的完整元素名称为 `类别-元素名称`。网页中的用户词典、当量、键位分布和自定义分析存于 IndexedDB，可导出为对应文件交给 CLI。

`data.glyph_sources` 选择字符的地区字形。字符没有任何指定来源时，自动按 `GHTJKNVMSBU` 顺序选取一个缺省字形，并保留其真实来源标签。尚未列入该顺序的来源排在其后，同优先级沿用字符记录中的顺序。缺省选择在 `data.character_customization` 补丁之后进行，无来源标签的兼容形也会保留。

`analysis.customize` 和 `dynamic_customize` 直接保存在方案 YAML 中。键与 `form.mapping` 一样支持字符、字形名称（如 `字形-123`）和旧版裸数字字形 ID。字符规则应用于当前来源选择下的所有部件字形，具体字形规则优先于字符规则。使用默认复合体分析器时，也可用字形 ID 直接覆盖复合体的取根序列。

```yaml
analysis:
  customize:
    天: ['1', 大]
    字形-123: ['1', '2']
```

### 字形融合

融合在拆分时把指定复合体的笔画按原笔顺合在一起，交给部件分析器，使字根可以跨越原来的分部边界。字库仍保留字形本来的结构和来源。部件分析器和复合体分析器均为「默认」时自动启用默认集合，使用其他分析器时默认关闭。

`analysis.fusion: true` 启用默认集合，`false` 关闭融合。也可以传入字形 ID 列表来替换默认集合，例如 `analysis.fusion: [910]` 只融合「兆」的这一字形。融合后的字形可以用 `analysis.customize` 或 `analysis.dynamic_customize` 指定拆分。二笔部件分析器也支持这两种自定义，优先于整根和首两笔、末笔规则；对融合复合体的覆盖同样会传播到使用该字形的父级分析。融合支持 1 到 30 笔的复合体。

## 命令与输出

| 命令 | 行为 |
| --- | --- |
| `examples [名称] [--out <新方案.yaml>]` | 列出示例、读取示例配置或导出单个 YAML |
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
npx chai proofread ./scheme.yml --reference ./reference.tsv --json
npx chai proofread ./scheme.yml --reference ./reference.txt \
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

Node、Bun、浏览器和 Worker 的业务代码统一从 `hanzi-chai` 导入；网页 Worker 的编码评估使用轻量入口 `hanzi-chai/evaluation`，避免额外加载拆分组件。根入口通过条件导出自动选择实现：Node/Bun 获得包含文件系统、方案项目和示例读取的完整 API，浏览器/Worker 获得通用算法 API。导出配置只列 JavaScript 路径，TypeScript 自动关联同目录的同名 `.d.ts`；类型声明也随条件选择。Node 项目使用 NodeNext 解析；本仓库 Bun 开发配置通过 `customConditions: ["node"]` 选择 Node 类型，网页和 API 使用默认通用类型。

```ts
import {
  读取方案项目,
  运行方案,
  评估方案项目,
  保存运行记录,
} from "hanzi-chai";

const 项目 = 读取方案项目("./scheme.yml", { dictionary: "./user/dictionary.tsv" });
const { 词列表, 输入 } = 运行方案(项目.上下文);
const 记录 = 评估方案项目(项目);
保存运行记录("./runs/new", 记录, 项目);
```

浏览器从 `hanzi-chai` 导入 `构建字库`、`准备方案`、`分析方案`、`运行方案`、`获取默认目标` 等公共算法。`准备方案` 接受已加载的字库、原始词典、自定义元素集合、键位分布目标和当量映射；`运行方案` 生成供 `libchai` 使用的编码输入。程序构造的配置应先校验，并检查 `检查配置引用`、`检查方案元素` 的诊断。

原有 `/node`、`/core` 子路径已合并到根入口；旧调用方需将这些导入路径改为 `hanzi-chai`。`/evaluation` 保留为 Worker 的轻量评估入口，其函数也从根入口导出。示例 YAML 仍通过 `hanzi-chai/examples/*.yaml` 公开。

随包示例提供稳定的 Node API，无需访问内部 `dist` 路径：

```ts
import {
  列出示例方案,
  读取示例配置,
  获取示例方案路径,
  读取方案项目,
} from "hanzi-chai";

console.log(列出示例方案()); // [{ id: "snow4", name: "冰雪四拼" }, ...]
const 配置 = 读取示例配置("snow4");
const 项目 = 读取方案项目(获取示例方案路径("snow4"));
```

前端构建工具配合 YAML 加载插件，也可以通过公开子路径直接导入示例：

```ts
import snow4 from "hanzi-chai/examples/snow4.yaml";
```

示例名称不含 `.yaml` 扩展名。包内文件作为只读资源使用；需要修改时，先用 CLI 导出单个方案文件。

现有 Node 辅助函数仍从根入口重新导出。浏览器 atom 继续保留分阶段缓存，共用组装配置、优先简码、序列化、默认目标和编码评估约定。

### 模板创建、字形筛选与元数据

Node 用户可以直接使用内置示例组合配置，无需手动加载 YAML：

```ts
import { 读取内置方案模板 } from "hanzi-chai";

const { createConfig } = 读取内置方案模板();
const 配置 = createConfig({
  name: "我的方案",
  data: "国标五分类",
  keyboard: "无",
  encoder: "形音码（米十五笔）",
});
```

浏览器从 `hanzi-chai` 导入 `创建方案模板`，传入已加载的示例配置集合。工厂统一提供 `classifierTypes`、`keyboardTypes`、`encoderTypes`、`createConfig` 和 `defaultConfig`。工厂保存示例的私有副本，每次创建都深拷贝分类器、键盘映射、编码规则和默认分析配置；补全笔画或编辑新方案不会修改示例及其他方案。

`字符字形过滤器`、`过滤器参数`、`GF0014映射`、`GF3001映射`、`歧义字形` 同时从浏览器和 Node 入口导出。过滤器提供 `过滤字符(字符, 字符数据, 字库)` 和 `过滤字形(字形, 字库)`，支持编号、名称、笔顺、结构及分部等条件；字符筛选还支持来源条件。无效笔顺正则沿用网页行为，忽略该条件。

### 当量测量统计

`分析当量数据`、`估计当量测量`、`序列化当量统计` 及 `Pair`、`EquivalenceData` 等类型均为纯算法 API，不联网、不写文件或日志。默认分析「手机五行七列」，支持传入其他实验名称及关系模型。

```ts
import { 分析当量数据, 序列化当量统计 } from "hanzi-chai";

const { 当量 } = 分析当量数据(测量记录);
const TSV表格 = 序列化当量统计(当量);
```

统计保留原有的异常值过滤、基线归一化、误差修正和多人等权汇总口径；常量样本的标准误为 0，无有效基线的记录和缺测分组不参与汇总。没有有效测量时，`估计当量测量` 返回 `length: 0`，`value` 和 `std` 为 `NaN`。

仓库维护者通过独立适配脚本读写文件或访问 API：

```bash
bun run analyze:equivalence --input ./measurements.json --out ./output/equivalence
# 省略 --input 时从 API 读取测量数据
```

输出 `samples.json` 和 `equivalence.tsv`，其中分组的 Set 在 JSON 中转换为数组。

### 共用静态与动态分析规则

所有复合体分析器，以及二笔、张码、逸码、冰雪飞花、首末取大部件分析器，均由基类的 `动态分析()` 执行同一份 `分析(字形, 环境?)` 规则。省略环境时查询当前配置；传入环境时自动探索字根选择和子分析候选。首末取大仍未注册为内置组件。

```ts
import {
  创建静态分析环境,
  推导动态分析,
  ok,
  type 分析执行环境,
} from "hanzi-chai";

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

### 元素离散性与重码分析

浏览器统计页和 Node 脚本共用 `dispersion.ts`（从 `hanzi-chai` 导出），不依赖 React 或编码评估器：

```ts
import { 归并组装结果, 分析原始重码, 估计阶重码, 分析边际重码 } from "hanzi-chai";

const 条目 = 归并组装结果(组装结果, 决策);
const 配置 = { type: "single" as const, position: [0, 1, 2, 3], top: 0 };
const 零阶 = 分析原始重码(配置, 条目, 4);
const 零阶数 = 估计阶重码(零阶, 0, 30);
const 一阶 = 分析原始重码({ ...配置, position: [0, 1, 3] }, 条目, 4);
const 一阶估计 = 估计阶重码(一阶, 1, 30);
// 合并组由强类型元素位构成；结果包含合并前后分布及新进入重码组的对象名称。
const 边际 = 分析边际重码(配置, 条目, 4, 合并组列表);
```

`position` 是保留码位的零基索引，未选码位用通配符，短序列空位单独表示。`top` 按频率取组装条目前 N 项，0 表示全部；过滤不修改输入。`分析元素分组` 返回同样的投影分组，但保留完整组装条目供字频等统计使用；`筛选组装结果` 可单独复用筛选口径。

归并只追踪显式归并及元素位引用，保留码位索引，不把直接安排到同键的独立元素合并。零阶按每组 `n - 1` 计数；高阶沿用统计页的 `n² / (2 × 键数^阶数)` 均匀分配估计，包含已有重码及单项组基线，不能与零阶相加或解释为实际新增冲突。边际分析列出指定合并后新进入重码的对象，已经重码的对象不重复列出；若需要新增非首项数，应对合并前后分别计算零阶再相减。默认保留组装条目口径。按汉字或词条数量统计时，将 `分析原始重码` 的第 5 个参数、`分析边际重码` 的第 6 个参数设为 `true`，每个组内相同对象名称只计一次，包括指定合并后重新产生的同名重复。字频加权应由调用方另行计算，不参与这些计数公式。

## Agent 使用约定

1. 先用 `inspect --components` 和 `inspect --text` 获取真实的组件名称、字形 ID，不猜测字形 ID。
2. 创建基线运行；修改方案文件，保留原始数据快照。
3. 每次修改后执行 `validate`，根据 `diagnostics` 修复错误。
4. 用 `explain` 定位具体汉字的候选、筛选评价及取码分支；必要时分页查看。
5. 保存新运行，用 `compare` 检查指标和受影响字词。只有 `comparable: true` 时才比较指标差值。
6. 对关键汉字维护拆分或编码断言，防止指标改善时破坏必要规则。

当前 CLI 不包含 MCP 或退火优化长任务接口。


## 仓库开发

本仓库以根目录的 npm 包为主体，网页和 API 是本地包的使用方：

```text
hanzi-chai/
├── src/、spec/、examples/   # 算法源码、测试及方案示例
├── scripts/                # 数据准备、构建及校对工具
├── web/                    # React/Vite 网页（chai-web）
└── api/                    # Cloudflare Worker API（chai-data）
```

```bash
bun install
bun run fetch       # 首次准备共享数据；已有数据时不必重复下载
bun run chai --help
bun run test:scheme
bun run build       # 构建 npm 包至根 dist/
bun run dev:web     # 启动网页；源码算法改动实时生效
bun run build:PAGES # 构建包及网页至 web/dist/pages/
bun run start:api   # 构建包后启动本地 API
```

`web` 和 `api` 均以 `file:..` 依赖根包，安装时建立本地链接。网页开发通过局部别名读取算法源码，正式构建及 API 使用根包的公开导出。代码统一从 `hanzi-chai` 导入，包根据运行环境选择通用或 Node 实现。根版本号是发布和网页展示的唯一来源。

网页的其他构建目标为 `build:CF`、`build:BEX` 和 `build:CLIENT`，产物均在 `web/dist/`。`dev`、`start`、`preview` 保留为网页快捷命令；`build:pkg` 是 `build` 的兼容别名。网页说明见 [web/README.md](web/README.md)，部署资源需使用新的 `web/dist/<目标>` 路径。

`bun run typecheck` 统一检查算法源码、测试和脚本；`typecheck:web`、`typecheck:api` 分别检查网页和 API。`lint` 检查算法及仓库脚本，`lint:web` 检查网页。`format` 只格式化，不执行 Git 暂存。版本发布准备使用 `bun run release`，它会修改版本、提交、打标签并推送；npm 发布由 CI 执行。

### 工程配置

各 tsconfig 继承根 `tsconfig.base.json`。根配置使用 Bundler 解析统一检查算法源码、测试和脚本，网页与 API 保留各自环境类型；常规检查默认不生成文件，`tsconfig.build.json` 单独使用 NodeNext 解析并开启包产物输出。TypeScript、Biome 的版本与风格规则统一在根目录维护。Vite 从网页 tsconfig 读取路径映射，开发使用源码，正式构建使用根包公开导出。

已移除 `.editorconfig`，Biome 对纳入范围的代码及配置文件使用两空格缩进、LF 换行。编辑器输入行为及未纳入格式化的 Markdown/YAML/TOML 不受该配置控制。

## 维护者的数据准备与发布

仓库开发仍使用 `bun install && bun run fetch`；根目录下载脚本与算法包共用核心数据下载流程，并额外准备开发核验数据。所有开发数据仅保存在 `src/data/`；前端开发服务器直接读取此目录，前端构建时才把网页所需文件复制到 `web/dist/<目标>/data/`，不再维护 `web/public/data/` 副本。

算法包可以独立准备发布数据，不依赖前端代码或前端依赖。维护脚本统一为 `.ts`，由仓库要求的 Bun 执行；因此以下 npm 生命周期也需要环境中有 Bun。发布后的包仍只需 Node.js 20+：

```bash
npm install --workspaces=false
npm run fetch:data
npm run build
npm run check:package
```

`fetch:data` 严格下载并校验五份必需数据，全部成功后才写入。维护者也可预先放入完整的本地数据；构建检查格式，允许直接替换同名文件，不使用压缩格式或分发哈希清单。

网页使用固定的 `/data/<文件名>` 地址，加载时不使用浏览器缓存。Cloudflare Pages 部署通过 `web/public/_headers` 为数据设置 `Cache-Control: no-store`；HTTP 压缩由托管平台处理。数据重新部署后在刷新页面时生效，已打开的编辑会话继续使用加载完成的数据。

`prepack` 会执行构建，并按白名单复制五份数据和示例 YAML；旧资源目录会先清理。发布工作流在干净环境中准备数据，构建后通过真实 tarball 安装到仓库外的新目录，检查资源范围、Node API、CLI、默认数据加载和示例评估，再执行发布。`check:package` 验证已有构建产物；其安装步骤需要访问 npm registry，安装后运行检查无需访问数据服务器。

## 验证

```bash
bun run test:scheme
bun run build
bunx tsc --noEmit
bun run lint
```

新增测试使用小型独立字库，覆盖静态/动态运行、条件拆分、构词、优先简码、自定义元素、配置诊断、CLI 协议、输入快照复现和结果比较，不依赖在线字库。

完整测试还包含真实字库和历史示例的回归检查；测试范围、回归要求及已有失败的对照方法见 [测试说明](spec/README.md)。
