# 输入方案码表校对手册

用官方发布的码表校对方案时，以每个字的**全码集合**为准。先固定参考版本、字集和字形来源，再按共用字形和字根成批修正。每批同时检查系统多生成的码、漏生成的码，以及先前已经对齐的字。

## 固定参考码表和运行口径

1. 记录官方发布版本、下载地址和压缩包校验值。优先使用随发布包提供的单字全码、兼容码、调整码和拆分注解。先决定哪些表属于本轮目标，再把纳入的条目整理成无表头的 UTF-8 TSV，每行前两列为单字和全码。按「字、全码」去重，保留同字的不同全码。按发布包的定义区分全码和简码，尤其要核对混放在同一文件里的条目。
2. 固定字集和 `data.glyph_sources`。例如星陈用 GB2312 做第一轮，用 G、H、T 分别选大陆、香港、台湾字形。独立核对参考表是否覆盖目标字集，并记录缺字、无可用字形或空码。CLI 只校对字库能识别的单字，覆盖率要单独核对。
3. 保存改动前的 `build` 快照。后续批次沿用同一套字符、字形和词典文件，用 `run.json` 的数据哈希确认输入一致。仓库内 CLI 默认从 `packages/hanzi-chai/src/data/` 取数据。需要锁定另一份快照时，可指定 `--data-dir`，也可用 `--characters`、`--glyphs`、`--dictionary` 分别覆盖。 [CLI 用法和数据文件](../packages/hanzi-chai/README.md)

从仓库根目录执行，先准备按目标字集筛好的 `reference.tsv`。每次 `build` 使用新目录。

```bash
scheme=./examples/yustar.yaml
work=./output/proofread
ref="$work/reference.tsv"

mkdir -p "$work"
bun run chai validate "$scheme" --json
bun run chai build "$scheme" --out "$work/baseline" --json
bun run chai proofread "$scheme" --reference "$ref" --scope gb2312 \
  --direction forward --limit 1000 --json > "$work/baseline-forward.json"
bun run chai proofread "$scheme" --reference "$ref" --scope gb2312 \
  --direction reverse --limit 1000 --json > "$work/baseline-reverse.json"
```

`--scope` 只过滤校对结果。要缩小生成范围，在校对用的方案副本中设置 `data.character_set`，并让每一批使用同一设置。正向以系统全码为主体，反向以参考全码为主体。`unknown` 表示对侧缺这个字。默认只列出 `incorrect`，可用 `--status unknown` 单查缺字。统计覆盖整个范围，明细用 `--limit` 和 `--offset` 分页。发现差异时命令仍以退出码 0 结束。

## 按 Unicode 核实字形来源

参考码表的地区拆分注解可能包含兼容形。校对目标限定为 Unicode 字形时，先在相同版本的 `Unihan_IRGSources.txt` 按码位核对来源。G、H、T 分别查 `kIRG_GSource`、`kIRG_HSource`、`kIRG_TSource`。没有相应来源的字，忽略该来源的拆分注解。码位的简繁身份本身不足以判定有哪些来源。若另一个已启用来源也有该全码，逐栏核对 Unicode 码表上的实际字形，再决定是否保留全码。 [Unicode 基本集码表](https://www.unicode.org/Public/18.0.0/charts/PDF/U4E00.pdf) · [Unihan 来源字段](https://www.unicode.org/reports/tr38/#IRG_Sources)

排除项按「字、全码」记录，同时保留码位、官方收录表、注解来源或归因依据、Unicode 来源编号及排除理由。若不支持的来源和有效来源同码，只排除该来源的注解。只有整对码缺乏有效来源时才从派生参考表删去。来源不明的兼容码和调整码应单列待核。若方案已加入这类字形，也要撤掉对应的方案来源和无其他引用的局部字形。

星陈 v3.12.0 的「鲶」只有 G0-7673。台标注解给出的 `xrfr` 应排除，陆标 `xrkr` 保留。「邻」虽有 H-95D8，但该栏「令」中的笔画是点，不能支撑横形的 `rfby`。另有「绸、调、鲷」三对调整码与港标周框拆分相符，这三个码位均无 H 来源。对 GB2312 共排除 67 对全码。1,739 条无 T 来源的台标注解与陆标同码，对应全码保留。 [逐字排除清单](yustar-gb2312-excluded.tsv)

以下命令从未经来源过滤、已按「字、全码」去重的星陈 v3.12.0 GB2312 参考表生成 GHT 校对目标。

```bash
awk -F '\t' '
  NR == FNR { if (FNR > 1) drop[$1 SUBSEP $3] = 1; next }
  !(($1 SUBSEP $2) in drop)
' ./examples/yustar-gb2312-excluded.tsv "$ref" > "$work/reference-gb2312-ght-unicode18.tsv"
```

## 按共用字形和字根定位

先把差异分为多码、缺码、两者都有，以及整字缺失。每条记录保留字符、码位、系统与官方全码集合、实际字形 ID 和来源、系统字根序列，以及能查到的官方拆分。兼容码或调整码缺少对应拆分时，把码和表名留下，等有可核实的字形或规则再动。

多码优先追到实际生成它的字形和字根。缺码先查官方是哪一套字形或拆分，随后查本地是否选到了相应来源。按共用分部 ID 和字根序列归组，同时数这个分部影响多少差异字、多少已对齐字。优先验证能解释整组的原因，抽查同组的正确字和相似结构作对照。

```bash
bun run chai inspect "$scheme" --text 禹 --json
bun run chai analyze "$scheme" --text 禹 --json
bun run chai explain "$scheme" --text 禹 --limit 100 --json
```

`inspect` 核对字形 ID、来源和笔顺。`analyze` 可查看未进评估词典的字。`explain` 用来区分三种情况。目标拆分从未成为候选时，查字形、分部和字根认定。目标候选存在但没胜出时，查筛选器的评价。拆分正确而全码不同，则沿组装轨迹检查取根位置、末根取码及键位归并。

## 按原因选择修改位置

让方案的自定义尽可能少。先用最新共享字库复现差异，确认字形、来源或拓扑修订是否已经让旧覆盖失效。选择改动最少且范围符合成因的做法。共享数据正确而仅某个字符有例外时，按字符和来源替换该字符的字形，优先复用已有字形。若确需区分一个共用分部的不同用途，就让常见用途沿用原引用，只给例外用途另设字形。每次更新共享字库后，重新试删已被修复的覆盖，并用全量码表确认能否移除。

| 证据 | 处理方式 |
| --- | --- |
| Unicode 某来源的字形在共享字库里缺失或映射有误 | 对照 Unicode 码表相应栏，优先复用现有分部，在共享字库修正该来源。回读确认每个来源恰好映射到一个字形，并核对其余来源的全码。 |
| 方案确认收录同一字形的兼容拆分或笔顺 | 在 `data.character_customization` 用 `type: insert`、`sources: []` 保留额外拆法。复用原字形的分部，按需重组或改变笔顺。 |
| 共用字形在不同结构中承担不同角色 | 先保留共用分部的主要用途，再把例外限定在实际需要的字符和来源。星陈让共用的儿形穴头直接归入「穴」，通过 `data.character_customization` 让港、台标「宂」使用独立字形。「抭、鴧、邉」中按「宂」取根的结构复用这一字形。 |
| 一个字根跨越分部，但能用已有分部重组 | 优先用 `data.glyph_algebra` 按结构和分部 ID 匹配，保留可变内件。星陈用它重组贏框、微框、穀框。 |
| 某个分部是已有字根的形近写法 | 在 `form.mapping` 中给实际字形设键，或用 `{element: 原字根}` 归并。先检查它会匹配到哪些其他部件和切片，再决定是否收入字根表。 |
| 取根确实需要在同一组笔画中跨原分部搜索 | 选择实际被切开的最小字形，加入算法库的全局默认融合集合。核对融合后的笔顺、候选和其他默认分析方案。以「佻」中的「兆」为例，同时回测其他共用「兆」的字。 |
| 官方规则能普遍淘汰某类候选 | 将规则放在适用的分析阶段。新增选项要同时测命中例和相似反例，并把开关打开、关闭各跑一遍。 |
| 证据只支持某个字形的特殊拆法 | 用 `analysis.customize` 按 `字形-ID` 限定。字符名会覆盖已选来源下的多个部件字形，采用前先核对各来源。 |

修改字库前，核对参考字形、笔顺、来源及复用关系。 [仓库字形规范](../DATA.md)

例如「淤、瘀」的 Unicode H 栏确实采用含「𠂉」的「於」，可在共享字库复用已有港标「於」。「阏」只有 G 来源，但星陈确认收录同样的拆法，因此把它作为无来源标签的方案兼容形插入。「垂」的港、台标已有字形，兼容码则需要把其中的「艹」拆成两个「十」，可另插一个分部拆法。

星陈 YAML 依赖全局默认集合，方案内禁止设置 `analysis.fusion`。涉及较多分部时，先检查能否用 `glyph_algebra` 复用已有字根，或只处理发生跨根的小分部。例如「龠」复用已有龠字头，「容」重组为穴、全字头和口。仅为保留某来源的兼容拆法时，可直接按字形 ID 覆盖复合体的取根。融合用于恢复自动搜索所需的跨分部候选。 [全局默认融合集合](../packages/hanzi-chai/src/fusion.ts)

同一组笔画命中多个字根时，逐个核对命中的字形 ID、来源和登记顺序。同码形近根可以试着只保留一个。若某个非 G 字形与另一字根同形，先验证能否在方案里让该来源沿用可区分的字形，再检查宿主是否仍引用被屏蔽的分部。星陈给「壬、曰」选用能和「王、日」区分的字形，同时处理仍引用横起笔「壬」的宿主。删除字根后，分别比对全码集合以及含简码和排名的完整记录。同码的字根名也可能参与筛选和组装。

## 逐批双向回测

每批只改一类原因。重新 `validate`、`build`，并对同一参考表跑两次 `proofread`。正向差异定位多码，反向差异定位缺码。汇总时对「字、全码」去重，因为多个字形可以生成同一全码，CLI 的条目数可能大于去重后的码对数。

逐字比较三个集合。设 `R` 为官方全码，`B` 为上一批全码，`A` 为当前全码。多码是 `A - R`，缺码是 `R - A`。凡 `B == R` 的字都要满足 `A == R`。如果多码或缺码总量上升，或某个未对齐字的差异增加，查看逐字变化再决定是否保留这批。汇总至少记录完全对齐字数、多码数、缺码数、退步字和涉及的分部。用 `compare` 查看拆分及排名变化。仅整理配置、迁移规则或删除冗余自定义时，还可用 `cmp` 检查两份 `codes.tsv`，确认简码和候选排名一起保留。

下面的脚本可核对一批改动。它按参考表限定范围，因此应先完成目标字集覆盖核对。后续批次把 `baseline` 换成上一批通过回测的目录。

```bash
bun run chai build "$scheme" --out "$work/candidate" --json
bun run chai compare "$work/baseline" "$work/candidate" --json

python3 - "$ref" "$work/baseline/codes.tsv" "$work/candidate/codes.tsv" <<'PY'
import sys
from collections import defaultdict

def load_codes(path):
    codes = defaultdict(set)
    with open(path, encoding="utf-8-sig") as source:
        for line in source:
            if line.strip():
                text, code, *_ = line.rstrip("\r\n").split("\t")
                if len(text) == 1:
                    codes[text].add(code)
    return codes

reference, before, after = map(load_codes, sys.argv[1:])
if not reference or any("" in codes for codes in reference.values()):
    raise SystemExit("参考表必须包含有效的单字全码")

def count(codes):
    return (
        sum(codes[char] == expected for char, expected in reference.items()),
        sum(len(codes[char] - expected) for char, expected in reference.items()),
        sum(len(expected - codes[char]) for char, expected in reference.items()),
    )

old, new = count(before), count(after)
regressed = [
    char for char, expected in reference.items()
    if before[char] == expected and after[char] != expected
]
print("完全对齐字数、多码对数、缺码对数", old, "->", new)
print("退步字", " ".join(regressed))
if regressed or new[1] > old[1] or new[2] > old[2]:
    raise SystemExit(1)
PY
```

## 核算能删除的自定义拆分

分别在开关关闭和打开时观察每条自定义所覆盖的自动拆分。比较每个受影响字形的**字根序列**，再删除候选项并跑完整码表。把「打开规则才一致」与「关闭时已一致」分开计数。对会改变候选的通用规则，还要回测方案原本的默认字集，检查小字集之外的共用字形。

星陈的「横间不穿心」需要确认外笔实际穿过两横之间的连笔。只看笔画是否落在两横之间，试跑曾误拆「平」「失」和台标「角」。收窄判定后，「禹」和「夀字头」的自定义可由规则替代，另有 10 条在关掉开关时也已冗余。默认字集和 GB2312 的码表都逐行一致。单靠这条规则时，「再」仍优先选「三、巾」，「垂」的候选仍缺「千」。「再」后来通过分部处理，「垂」则在共享字库修订后自动取到「千」。 [横间不穿心规则原文](https://shurufa.app/learn/prohibition.html#横间不穿心)

### 用实笔画分部和普通字根替代覆盖

1. 先把目标字根与原图上的实笔画对应起来，保留分部坐标及笔顺。遇到交错笔顺，用复合体的 `strokes` 记录分部笔画块。已有相容部件时优先复用。若来源笔顺不同，只调整相应来源。例如台标「樊」先写中间两个「乂」，陆标仍从左边的「木」起笔。 [宇浩字形与笔顺说明](https://shurufa.app/learn/variation)
2. 形近根在完整部件和笔画切片中应遵循同一规则。把形近根加入 `form.mapping` 前，列出它在目标分部以外命中的字形，检查它是否会抢根。星陈用同一个普通戈形匹配「戋」首横以下和「㦮」前两横以下的笔画。「我」「羲」「戠」按同一套普通规则匹配无横戈形，横画仍保存在共用它的左侧分部。 [宇浩断笔规则](https://shurufa.app/learn/division#笔画断开)
3. 断笔留下的形状仍须经得起全库匹配。「重」中的缺竖里形会误中「畢」的分部，使 18 个字的全码集合变化。保留「重」的覆盖，直至能表达「千」和「里」如何共用一竖。类似地，即使形近根归并到了同一键位，也要检查不同来源是否会生成重复候选。「戢」框的另一种无横戈形会让「嶯、擑、艥」重复出码。

### 排查原始字形与认根规则

| 例子 | 证据及处理 |
| --- | --- |
| 「人」#119 与「乂」#118 | Unicode 字形分别是撇捺接合和相交。原库「人」的捺起于 `[49, 24]`，计算结果为相交。试把横坐标改为 50，恢复接合并可去掉「人」的覆盖，但有 25 个单字的全码集合改变。其中「乆、倹、剣」更接近发布包注解，「漢、傼」等共用 #1112 的字则需要另核。 |
| 「主」#793 与横起笔的「壬」#1132 | 陆标「主」上点留隙，港、台标的点贴横，原库共用接合形。试给陆标单独补形，单字全码相同，但「主」「全」的简码互换。「主」下部的「王」与港、台标「壬」还有同拓扑冲突，后者的中横比底横长。仅加横长判据会改变一批王旁字的既有码，需连同这些宿主一起校对。 |
| 港、台标「虱／風」内件 #1144 | 参考字形的顶笔是横。陆标「虱」的该笔呈平撇，并已使用另一内件。港、台标应保留原横画，现有取码用按 ID 限定的覆盖。 |
| 「日」和「曰」 | 星陈只在特定对立字中取「曰」，一般取「日」。这种方案约定无法单靠统一调整字库宽高来表达。 |

按来源对照原图，区分坐标错误、字库允许的接离归一、匹配特征不足和方案自身的取根约定。每批改动后，用默认字集重建完整码表并执行 `cmp`。只比较「字、全码」会漏掉重复候选、简码和排名变更。 [Unicode 基本集码表](https://www.unicode.org/Public/18.0.0/charts/PDF/U4E00.pdf) · [宇浩字根内在属性](https://shurufa.app/learn/intrinsic)

星陈以统一的字根匹配规则删去了原有 108 条覆盖中的 37 条。默认字集的 24,945 条单字记录和 81,236 条词组记录逐字节一致。 [星陈方案](yustar.yaml)

2026 年 11 月 10 日重跑时，共享字库的拓扑和分部更新让 19 条覆盖与自动拆分一致，另有 5 条因目标改成复合体而失效。修复分部变动时，优先复用已有字根和分部，用 `glyph_algebra` 重组可以表达的结构，仅在字根确实跨越字库分部时融合。新增 3 条共用部件的拆分覆盖，方案的 `analysis.customize` 净减至 50 条。GB2312 的全码集合恢复到换库前的结果。 [星陈方案](yustar.yaml)

星陈 GB2312 最初合并 v3.12.0 的单字全码、兼容码和调整码，共 6,763 字、7,209 对去重全码。13 批修正把完全对齐的字从 6,242 增至 6,735，每批均无已对齐字退步。按 Unicode 18.0 核对来源后，参考表收窄到 7,142 对。系统也恰好少生成被排除的 67 对，全码集合完全对齐的字仍为 6,735 个。剩余 28 对全是缺码，其中 15 对来自调整表，13 对来自兼容表。对应拆法未见于发布包随附的陆标、台标注解。 [星陈 v3.12.0 发布包](https://github.com/forfudan/yuhao-ime-release/releases/tag/v3.12.0) · [星陈方案](yustar.yaml)
