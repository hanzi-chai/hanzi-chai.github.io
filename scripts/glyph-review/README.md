# Unicode 18.0 离线字形核验原型

使用已有人工多来源标注生成候选，再由 agent 或人工对照 Unicode 18.0 码表核验。整个流程离线运行，不调用数据库写入 API，也不会把 agent 判定自动加入训练样本。

## 已生成的数据

本次下载和首批产物位于仓库根目录：

- `output/glyph-review/unicode/18.0.0/`：官方基本集码表、IRGSources、输入 SHA-256、全部来源字形的位置索引。
- `output/glyph-review/pilot-18/`：U+6901 起的首批 100 字，共 520 个字符来源任务及 607 个候选。
- 打开 `output/glyph-review/pilot-18/review.html` 开始核验，页面支持本地文件直接打开。

固定来源为 [Unicode 18.0 基本集码表](https://www.unicode.org/Public/18.0.0/charts/PDF/U4E00.pdf) 和 [Unihan.zip](https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip)。当前索引含 20,992 个字符、108,493 个来源字形，没有未定位项；其中 18 项使用来源编号字格定位，仍需按正常流程视觉核验。

已另行生成 `output/glyph-review/holdout-18/` 的 300 字历史标注留出批次。1,211 个非参考来源中，前一候选命中 1,166 项，候选覆盖 1,184 项（97.8%）；历史数据有差异的 347 项中覆盖 320 项（92.2%）。这些数字仅反映旧标注的候选覆盖，不代表 Unicode 18.0 视觉准确率。首批新字中还保存了两条实际 agent 核验示例：一项匹配、一项暂缓，尚未进行整批 agent 核验。

下载数据、裁图、个人核验结果由 `output/glyph-review/.gitignore` 排除，不进入 Git。`scripts/fetch.ts` 也已固定从官方 Unicode 18.0 下载 IRGSources，避免下一次 fetch 退回 assets 服务器上的旧版本。

## 准备和重新生成

需要 Bun、Python 3.14、uv；项目正常 fetch 额外使用系统 `unzip`。PyMuPDF 固定为 2.0，图像生成时采用已安装的离线环境。

```bash
# 下载官方固定版本，验证并同步来源表到算法包和 public/data/<版本>/
python3 scripts/glyph-review/unicode_pdf.py download --sync

# 已下载文件可加 --cached 复用；不传 --sync 则只准备原型的数据
python3 scripts/glyph-review/unicode_pdf.py download --cached --sync

# 第一次运行会安装 Python 图像依赖，并建立整个基本集的来源索引
uv run --python 3.14 --with pymupdf==2.0 python scripts/glyph-review/unicode_pdf.py index

# 生成新批次；--limit 是字符数，每个字符按 18.0 的实际来源展开任务
bun scripts/glyph-review/cli.ts generate \
  --from 6901 --to 7A6F --limit 100 \
  --out output/glyph-review/next-batch
```

每次生成使用新的输出目录；已存在 `tasks.json` 的批次不会被覆盖。支持 `--sources J,T,N`、`--candidates 6`、`--no-images`。来源使用项目标记：KP→N，UK→B。原图同时记录 Unicode 的完整来源编号。

仅生成数据时可使用 `--no-images`。若图像步骤中断，数据和 SVG 已保存，可用下面的命令恢复裁图；再通过 CLI 的 `import` 导入空数组 `[]`，即可从保存的任务重建核验页面：

```bash
uv run --offline --python 3.14 --with pymupdf==2.0 python \
  scripts/glyph-review/unicode_pdf.py crop \
  --request output/glyph-review/next-batch/crop-request.json \
  --out output/glyph-review/next-batch/images \
  --renders output/glyph-review/next-batch/renders
```

页面可直接打开，也可用仅本机可访问的服务器预览：

```bash
python3 -m http.server 8765 --bind 127.0.0.1 --directory output/glyph-review
```

## 核验流程

1. 只看 Unicode 18.0 的参考来源和目标来源原图，记录 `same` / `different` / `uncertain`；有差异时描述具体位置。需要时展开原始码表整行核对来源编号。
2. 保存观察后，查看候选渲染，选择匹配项、全部不匹配或暂缓。必须填写视觉依据和核验者身份。
3. 页面将结果保存在当前浏览器，点击“导出核验记录”保存到磁盘。CLI 导入后将结果写入独立的 `decisions.json`，并更新页面的初始核验记录。

```bash
bun scripts/glyph-review/cli.ts import \
  --out output/glyph-review/pilot-18 --file /path/to/exported-decisions.json
bun scripts/glyph-review/cli.ts summary --out output/glyph-review/pilot-18
```

来源原图缺失、第一阶段不确定、候选键不存在时，CLI 不接受“候选匹配”的判定。agent 结果不能覆盖已有人工判定；覆盖其他判定前会备份旧文件。浏览器导入提供相同的人工作业保护。

观察中的“相同”指影响本项目字形表达的笔画和结构相同，不要求匹配字体粗细、衬线、收笔风格或字面比例。静态码表不能证明笔顺，相关歧义应暂缓。

## 交给 agent

每批生成两个任务包：

- `agent-stage1.json`：仅提供来源原图、整行图片及来源编号。先完成独立观察；此时不读取候选、`tasks.json` 或留出答案。
- `agent-stage2.json`：提供候选 PNG、候选键和统计证据。完成第一阶段后再读取，根据目标原图逐项核验，允许 `none` 和 `uncertain`。

图片路径为本机绝对路径，agent 可以直接调用图像查看工具。这里不自动调用收费模型 API；可由当前编码 agent 或其他具有视觉能力的 agent 消费任务包。建议每次处理少量任务，避免把整批图片缩进一个上下文。

agent 的输出采用以下 JSON，`batchId`、`taskId` 和候选键必须来自当前批次。示例中的占位值需要替换，不应直接导入：

```json
{
  "decisions": [{
    "batchId": "当前批次 ID",
    "taskId": "6902-J",
    "phase1": {
      "relation": "different",
      "difference": "描述实际观察到的部件位置及笔画差异"
    },
    "verdict": "candidate",
    "candidateKey": "A",
    "reason": "描述候选与目标逐项一致的视觉依据",
    "reviewer": { "kind": "agent", "name": "核验 agent 的名称" },
    "reviewedAt": "2026-10-28T13:00:00.000Z"
  }]
}
```

`verdict` 为 `none` 或 `uncertain` 时，`candidateKey` 必须为 `null`。导入只保存核验记录，不生成数据库补丁。

## 候选的构造与限制

- 人工范围冻结自现有 `GlyphRecommendation.tsx`：U+4E00～U+6900、U+7A70～U+9FFF。范围只是历史样本来源，不能视为已按 Unicode 18.0 重新核验。
- 为本批次选中的整字排除所有来源统计；候选生成不读取该字目标来源的标签。
- 优先使用相同原引用、结构操作符、部分数量和部分位置的统计；上下文至少有 3 票时使用上下文统计，否则退回全局统计。按字符对各替代项去重计票，并保存支持实例码位。
- 只有结构操作符与部分数量一致的人工字形对才用于按位置学习引用替换；结构变化可通过已知“整字字形→目标来源字形”映射复用，否则交给人工处理。
- 每个部分最多保留 3 个统计替代项及原引用，用有限宽度组合生成候选；始终保留参考字形原样候选。排序分数不是正确概率。
- 保留原引用布局和笔画块数据，按完整结构签名复用已有字形 ID。原型复用应用的仿射合并和笔画路径渲染，检查缺失引用、循环、非有限坐标和笔画块越界。
- 未知基本部件目前主要提供原样字形或已有整字映射，不自动画新笔画；候选遗漏时应选择“全部不匹配”。
- PDF 定位同时匹配码位所在行和 Unihan 来源编号。少量字形在 PDF 文本层不可见，此时按来源编号定位字格并检查非空，记录 `localization: source-label-cell`。定位数量完整不等于视觉内容已经逐项核验。

## 可选的历史标注留出

```bash
bun scripts/glyph-review/cli.ts generate --holdout --limit 300 --seed unicode18 \
  --out output/glyph-review/holdout-18
bun scripts/glyph-review/cli.ts score --out output/glyph-review/holdout-18
```

按种子确定性抽取历史人工范围内的字符，整字排除训练；答案独立放在 `heldout-private.json`，不嵌入核验页面或 agent 包。`score` 输出前一候选命中和候选覆盖数，分别统计历史数据中“有变化”和“无变化”的非参考来源。

这是对旧数据结构签名的回看，不是 Unicode 18.0 视觉准确率，也不是按部件族隔离的泛化评估。若存在重复但等价的字形 ID，结构签名可能低估视觉覆盖率。最终应以码表核验结果和人工耗时衡量实际收益。

按本轮要求，没有添加、修改或运行测试套件。
