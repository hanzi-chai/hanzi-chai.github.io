# Unicode 18.0 字形核验

离线生成多来源候选，对照 Unicode 码表核验；判定独立保存，不自动修改数据库或加入训练样本。脚本均使用 TypeScript/Bun，PDF 使用 MuPDF，SVG 转 PNG 使用 resvg。

## 当前保留结果

已完成盲选回测中的最高命中率批次为 `output/glyph-review/backtest-100-enclosures-20261030/`。100 字、473 个非 G 来源任务，整字排除训练，拒绝也计错：

| 方法 | 正确 / 总数 | 命中率 |
| --- | ---: | ---: |
| 逐引用统计基线 | 390 / 473 | 82.45% |
| 外框调整后 agent | 412 / 473 | 87.10% |
| 候选覆盖上限 | 431 / 473 | 91.12% |

61 项错误包括候选缺失 42 项、误拒 6 项、覆盖但选错 13 项。严格结构签名命中为 409/473；主口径允许结构签名或冻结 SVG 完全一致。

这是旧样本诊断，外框改进参考过旧错误；不能当作新样本泛化准确率。当前源码和字库已有后续布局、笔画改动，87.10% 仅对应该批冻结图片。后续共享池和递进实验没有超过此结果，已连同早期试验及专用复跑脚本清理。新实验统一从 `backtest.ts prepare` 开始，不依赖历史目录。

- `best-result.json`：进入 Git 的结果摘要及关键文件 SHA-256。
- 批次 `report.md`、`evaluation*.json`：完整报告及逐项结果。
- 批次 `blind/`、`agent-submissions.json`：实际看过的图片、任务和冻结提交。
- 批次 `scoring-renders.json`、`choices-private.json`、`truth-private.json`：评分依据。
- 批次 `error-review.html`：按字符聚类的离线错误复盘，包含原始理由和历史正确候选。

下载数据、图片、私人判定及迁移快照由 `output/glyph-review/.gitignore` 排除，不进入 Git。最佳批次保持原目录及原文件；其中历史对照字段是来源记录，所指的旧实验已清理。重新核对评分无需旧实验或当前字库：

```bash
bun scripts/glyph-review/backtest.ts verify \
  --out output/glyph-review/backtest-100-enclosures-20261030
```

## 下载、生成与人工核验

固定使用 [Unicode 18.0 基本集码表](https://www.unicode.org/Public/18.0.0/charts/PDF/U4E00.pdf) 和 [Unihan.zip](https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip)。输入及来源索引位于 `output/glyph-review/unicode/18.0.0/`，生成和裁图验证 SHA-256。来源标记 KP→N、UK→B，完整来源编号保留。

```bash
bun scripts/glyph-review/cli.ts download --cached --sync
bun scripts/glyph-review/cli.ts index
bun scripts/glyph-review/cli.ts generate \
  --from 6901 --to 7A6F --limit 100 --out output/glyph-review/next-batch
bun scripts/glyph-review/cli.ts serve --out output/glyph-review/next-batch --port 8765
```

`--sync` 同步来源表到算法包及网页缓存；首次下载可省略 `--cached`。每批使用新目录，不覆盖已有任务。`--sources J,T,N` 限定来源，`--candidates 6` 限定每个来源合并前的候选数，`--no-images` 只生成数据。

CLI 默认将同字各来源候选按完整结构签名合并为共享池；`--source-local` 使用来源独立候选。`sourceCandidates` 保存合并前候选，`poolOrigins` 保存生成来源，统计证据不能解释为目标来源的正确概率。

页面可直接打开 `review.html`。先只看原图记录 same/different/uncertain，再展开候选，选择匹配、全部不匹配或暂缓，并填写视觉理由和核验者。导出后导入：

```bash
bun scripts/glyph-review/cli.ts import --out output/glyph-review/next-batch --file /path/to/decisions.json
bun scripts/glyph-review/cli.ts summary --out output/glyph-review/next-batch
```

agent 不能覆盖已有人工判定；其他覆盖会备份。未知候选、缺图或不确定的第一阶段不能导入为匹配。静态码表不能证明笔顺；判断关注笔画和结构，非字体粗细或衬线。

图像生成中断后可以恢复，无需重建任务：

```bash
bun scripts/glyph-review/cli.ts crop \
  --request output/glyph-review/next-batch/crop-request.json \
  --out output/glyph-review/next-batch/images \
  --renders output/glyph-review/next-batch/renders
bun scripts/glyph-review/cli.ts rasterize --renders output/glyph-review/next-batch/renders
```

PDF 定位精确匹配文本层中的完整来源编号，再定位其上方字形；无法定位字形时记录 `source-label-cell` 回退。缺失、歧义和重复项写入索引 issues，不按列号猜测来源。用户已确认切图可用，后续不以 `crop-ink-at-border` 阻止核验。

## 留出与 agent 盲选

历史人工范围为 U+4E00～U+6900、U+7A70～U+9FFF；这不意味着已按 Unicode 18.0 重新审核。候选按来源学习同操作符、同部分数的引用替换，保留布局和笔顺块，始终保留原样参考。候选生成不读取留出字符的目标标签。

```bash
# 全量统计留出：复合体参考字形，至少两个不同字形 ID
bun scripts/glyph-review/cli.ts generate --holdout --from 4E00 --to 68FF \
  --out output/glyph-review/holdout-next
bun scripts/glyph-review/cli.ts score --out output/glyph-review/holdout-next

# 随机抽 100 字进行实际 agent 盲选；可用 --seed 指定可复现种子
bun scripts/glyph-review/backtest.ts prepare --out output/glyph-review/backtest-next
# 完成全部三个分片后冻结提交哈希、评分并自动生成错误复盘
bun scripts/glyph-review/backtest.ts score --out output/glyph-review/backtest-next
bun scripts/glyph-review/backtest.ts verify --out output/glyph-review/backtest-next
```

全量留出和抽取 100 字的训练集不同，不能直接比较命中率。筛选条件、码位、种子保存在 `selection.json`，答案在 `blind/` 之外。

通用两阶段任务为 `agent-stage1.json`（原图观察）和 `agent-stage2.json`（候选核验）。回测统一使用来源独立候选加统计基线组合，随机打乱字母，按字符分为三个分片。任务说明为 `agent-task/AGENTS.md`，实际提交写入 `blind/results/shard-{1,2,3}.json`；盲选者不得读取答案、统计排名、源数据库或其他分片结果。这里不自动调用模型 API。

`prepare` 冻结评分需要的 SVG 哈希；`score` 校验完整任务及已有提交哈希，自动冻结新提交；`verify` 只读重算并对照已保存结果。评分不调用当前渲染器，因此后续代码与字库变化不会污染已有实验。

错误复盘也可独立生成：

```bash
bun scripts/glyph-review/error-review.ts --batch output/glyph-review/backtest-100-enclosures-20261030
```

复盘只使用该次实际看过的 panel 和原始理由，不重画历史输入；报告含答案，必须在 `blind/` 之外。人工备注单独导出，不改写提交。评分分类和 agent 理由都不能代替人工视觉仲裁。

## 外框及字形迁移工具

保留已上线字形的审核与恢复证据，不将其作为冗余实验删除：

| 目录 | 用途 |
| --- | --- |
| `enclosure-inventory/` | 迁移前外框清单，审核方案的输入 |
| `enclosure-profiles-18/` | 171 个外框、268 个例子、判断、拓扑及视觉审核 |
| `enclosure-migration-18/` | 外框迁移前后快照、ID 映射、journal、计划及验证 |
| `overlay-ti-migration-20261030/` | 叠加与提字形迁移的审核、计划、快照及 journal |
| `directional-layout-20261030/`、`hooks-rounding-20261030/` | 当前布局和共用笔画渲染的最终对照与验证证据 |

以上均位于 `output/glyph-review/`。独立模型部署目录属于本地服务资料，不纳入字形实验清理。

```bash
# 新清单使用新目录；不能覆盖迁移前审核输入
bun scripts/glyph-review/enclosure-inventory.ts --out output/glyph-review/enclosure-inventory-next
```

`enclosure-profiles.ts` 提供 prepare/render/verify；`enclosure-topology.ts` 用双向全笔画匹配审计变形；`upload-enclosures.ts` 提供 prepare/apply；`verify-enclosure-migration.ts` 核对迁移计划、回读数据及审核 SVG。`overlay-ti-migration.ts` 和 `apply-overlay-ti.ts` 保留叠加与提字形迁移工具。

这些迁移脚本仍含已完成批次的目录、数量或整表假设，不能直接用于下一批。扩展前须参数化输入、合并已有规则，并保存新的快照和日志。已有批次不可重新 prepare 或以新渲染器覆写审核证据；历史 SVG 与当前渲染器比较可能因后续改动而不同，原验证结果仅对应当时版本。

外框独立字形与变形外框使用不同 ID；仅替换九种包围结构的首引用。内件矩形保存于 `packages/hanzi-chai/src/enclosure-layouts.json`，显式坐标优先，辅助内件替换必须明确列出。拓扑审计需使用该批次原始快照，保持笔画种类、顺序、连接点及分离子图关系。完整迁移约束见仓库 `AGENTS.md`。
