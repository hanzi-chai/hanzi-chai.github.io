/** 生成无需联网的纵向结构审查报告；先运行 audit-vertical-structures.ts。 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { 基本字形数据 } from "../src/data.js";
import { 字形库 } from "../src/repertoire.js";
import { 生成笔画路径 } from "../src/stroke-render.js";

const { values } = parseArgs({
  options: {
    "data-dir": { type: "string", default: "data" },
    out: {
      type: "string",
      default: "output/vertical-structure-audit-2026-11-14",
    },
  },
});
const out = values.out!;
const audit = JSON.parse(readFileSync(join(out, "audit.json"), "utf8"));
// 本报告的族级评语对应已审查快照；其他快照可运行扫描，但须重审评语。
for (const [name, expected] of Object.entries({
  characters:
    "ecfc4a00f590994e68daa0b26dad0eb54c4c683079167300b0378571207ea73e",
  glyphs: "9c4c77414ff09dca1cd73629e891b8c9cdd8c0076b6c8652c76d69ac607ad7f2",
})) {
  const hash = createHash("sha256")
    .update(readFileSync(join(values["data-dir"]!, `${name}.json`)))
    .digest("hex");
  if (hash !== expected || audit.summary.hashes[name] !== expected)
    throw new Error("输入快照变化，须重审族级评语后再生成报告");
}
const glyphs: 基本字形数据[] = JSON.parse(
  readFileSync(join(values["data-dir"]!, "glyphs.json"), "utf8"),
);
const map = new Map(glyphs.map((g) => [g.id, g]));
const library = new 字形库(glyphs);
const ids = new Set<number>();
for (const r of audit.rows) {
  ids.add(r.id);
  for (const ref of map.get(r.id)!.references ?? []) ids.add(ref.id);
  for (const id of r.leaves) ids.add(id);
  for (const c of r.candidates.slice(0, 5))
    for (const id of c.references) ids.add(id);
}
for (const r of audit.horizontal) ids.add(r.id);
for (const id of [
  5444, 6247, 6248, 4638, 123460, 136455, 34884, 881350, 108544, 599046, 358158,
  558336, 576899, 576900,
])
  ids.add(id);
const drawings: Record<number, string> = {};
for (const id of ids) {
  const strokes = library.获取字形(id)!.图形盒子.获取笔画列表();
  drawings[id] =
    `<svg viewBox="-5 -5 110 110" aria-label="字形 ${id}"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${生成笔画路径(
      strokes,
    )
      .map((d) => `<path d="${d}"/>`)
      .join("")}</g></svg>`;
}
const escapeHtml = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const delta = (x: number) => `${x >= 0 ? "+" : ""}${(x * 1e6).toFixed(2)}`;
const svg = (id: number) => drawings[id]!;
const caseIds = [
  205873, 296534, 296535, 132692, 5444, 6247, 6248, 136455, 480017, 480524,
  738070, 884999, 576393, 575004, 575151, 6982, 387845, 358422, 558336, 165430,
  165378,
];
const cases = caseIds
  .map((id) => audit.rows.find((r: any) => r.id === id))
  .filter(Boolean);
const notes = [
  {
    title: "优先：帚的写法统一",
    ids: [205873, 58646],
    text: "帚（#32431）目前是（彐＋冖）＋巾，另一字形（#0E516）已是聿三／冖／巾三层。建议把前者也按三个可辨层次表达，保留顶部笔形差异；熵差 −32.24 μbit／字形。调整共享帚，而不是逐一改婦、掃、歸等宿主。仍须在原布局中保全冖与巾的接口。",
  },
  {
    title: "优先：曼的两种顶部一起处理",
    ids: [296534, 296535],
    text: "两形现在都引用曼字底（罒＋又）。两形一起改为顶部／罒／又的三层表示，联合熵差 −35.31 μbit／字形。应同时处理两种顶部，不让来源选择决定分部层级。不能把这一结论扩展为凡有罒、又都拆开，接离和布局另核。",
  },
  {
    title: "允许付出小额熵代价：豆与鬲",
    ids: [5444, 6248, 6247],
    text: "豆和鬲的 GHT 形已经是一／口／下部。鬲的 JKN 形仍为（一＋口）／下部，改成三层需付出 +11.92 μbit／字形；为了同一模板跨来源一致，建议接受这项代价，保留下部形差。反方向把豆、鬲的 GHT 形同时改为（一＋口）／下部，联合熵差仍是 +6.29 μbit／字形。不能只贪图豆单独合并下两层的 −28.53，把同形模板改散。",
  },
  {
    title: "适合三层复核：袁与衣字底家族",
    ids: [132692, 34884, 881350],
    text: "袁目前为土／（口＋衣字底），三层化熵差 −34.53 μbit／字形，与亠／中部／衣字底的表达更接近。袞与蔉内部同一末级 ID 序列，却把儿分别归入中部和上部；优先以袞的亠／（儿＋口）／衣字底模板复核，蔉内分部改过去可降 −11.83。这里的理由是同一图形层次，不能推广为所有衣形字都必须三分。",
  },
  {
    title: "保留共享主体：音、意、菩、蕈",
    ids: [480017, 738070, 884999, 576393],
    text: "这些嵌套有清楚的共享单位。音保留立／曰；意保留音／心；菩保留艹／咅；蕈保留艹／覃。把意改为立／曰／心会增加 +34.14 μbit／字形；菩的 G 形改为艹／立／口增加 +53.70；蕈的 G 形改为艹／要上／早增加 +67.84。不因树深多一层就拆散可复用主体。章保持立／早，改为音／十也不利（+14.57）。",
  },
  {
    title: "三层仍可嵌套：莫及其宿主",
    ids: [575004, 575151, 207105, 297221],
    text: "莫本身是艹／曰／大三层；幕、暮等整体引用莫是另一层次，二者并不冲突。两种莫各自改为艹／旲在数学上有利，但应先把艹来源形、莫的共享用途和相邻家族一起审查，再决定是否把所有同形莫统一改为二层。现阶段保留幕、暮的莫主体；不能为消除嵌套，把它们重新切成局部偶合的三块。",
  },
  {
    title: "熵候选应让位于重复与对称：畺、器、囂",
    ids: [6982, 387845, 744216],
    text: "畺的末级序列是一／田／一／田／一。现状一／田一／田一保留重复子块；最小熵候选把最后一横单列，虽可降 −80.33 μbit／字形，却形成不对称的四层大块＋单横，建议保留现状。器和囂的上下双口也是对称位置；把上双口与中部合成哭或𠽸，需要额外图形和家族依据，不能只看熵值。重复模板优先于罕用中间字形的偶合复用。",
  },
  {
    title: "四层以上：选直属层次，不强制扁平化",
    ids: [124931, 619520, 206142],
    text: "喜展开四层、壹展开五层、帝展开四层，但直属引用仍可有合理的二层或三层。保留壴、豆等完整主体，再在这些共享节点内部统一分部。四至六层只需保证各局部模板一致；不允许改成四操作数或五操作数的 ⿳。畺等重复结构另按重复模板判断。",
  },
  {
    title: "来源形保持同一层次，不能强合不同笔群：害",
    ids: [165430, 165432, 165378, 165382],
    text: "害存在丰、龶等不同中部写法，当前有宀／下部与宀／中部／口并存。建议按每形的真实中部和口的边界核查，再考虑统一为三层；#28602 三层化熵差 +16.23 μbit／字形，可以作为统一成本列出。若长竖贯穿框边，或中部与口实际难以分开，就应保留合法二层，不为形式一致硬切。",
  },
];
for (const note of notes)
  for (const id of note.ids)
    if (!drawings[id] && map.has(id)) {
      const strokes = library.获取字形(id)!.图形盒子.获取笔画列表();
      drawings[id] =
        `<svg viewBox="-5 -5 110 110"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${生成笔画路径(
          strokes,
        )
          .map((d) => `<path d="${d}"/>`)
          .join("")}</g></svg>`;
    }
const noteHtml = notes
  .map(
    (note) =>
      `<article><h3>${note.title}</h3><div class="strip">${note.ids
        .filter((id) => map.has(id))
        .map(
          (id) =>
            `<figure>${svg(id)}<figcaption>#${id.toString(16).toUpperCase().padStart(5, "0")}</figcaption></figure>`,
        )
        .join("")}</div><p>${note.text}</p></article>`,
  )
  .join("");
const groupHtml = audit.consistency_groups
  .map(
    (g: any) =>
      `<article><h3>${escapeHtml(g.labels.join(" · "))}</h3>${g.ids
        .map((id: number) => {
          const r = audit.rows.find((r: any) => r.id === id);
          return `<p>${svg(id)}<strong>${escapeHtml(r.label)}</strong>　${escapeHtml(r.expression)}<br>基本集宿主：${r.hosts}；直接来源：${escapeHtml(JSON.stringify(r.direct))}</p>`;
        })
        .join("")}${audit.scenarios
        .filter(
          (s: any) =>
            s.name.startsWith("一致性组") &&
            s.changes.some((c: any) => g.ids.includes(c.id)),
        )
        .map(
          (s: any) =>
            `<p>${escapeHtml(s.name)}：<b>${delta(s.entropy_delta)}</b> μbit／字形</p>`,
        )
        .join("")}</article>`,
  )
  .join("");
const serial = JSON.stringify({
  rows: audit.rows,
  horizontal: audit.horizontal,
  drawings,
}).replaceAll("<", "\\u003c");
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CJK 基本集纵向结构审查</title><style>
:root{font:16px/1.65 system-ui,sans-serif;color:#243238;background:#f3f5f1}body{margin:0}main{max-width:1180px;margin:auto;padding:40px 28px}h1{font-size:36px;line-height:1.3}h2{margin-top:48px;border-bottom:2px solid #a8b4a1;padding-bottom:10px}h3{font-size:20px}p{max-width:960px}header p{color:#58665e}.stats{display:flex;flex-wrap:wrap;gap:14px}.stats div{background:#fff;border:1px solid #d7ddd4;border-radius:8px;padding:16px;min-width:140px}.stats b{display:block;font-size:30px;color:#275844}article{background:#fff;border:1px solid #d7ddd4;border-radius:8px;padding:20px;margin:16px 0}svg{width:84px;height:84px;vertical-align:middle;color:#263c35}.strip{display:flex;gap:18px;flex-wrap:wrap}figure{margin:0;text-align:center;font-size:12px}figure svg{width:100px;height:100px}.muted,small{color:#68736a}table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:10px;border-bottom:1px solid #d7ddd4;text-align:left;vertical-align:top}th{background:#e8ede4}.mono{font-family:ui-monospace,monospace;font-size:13px}.controls{display:flex;flex-wrap:wrap;gap:12px;padding:14px 0;position:sticky;top:0;background:#f3f5f1;z-index:1}input,select,button{font:inherit;padding:8px;border:1px solid #b8c4b3;border-radius:4px;background:#fff}input{min-width:260px}button{cursor:pointer}a{color:#27654c}.tag{color:#275844;font-weight:600}.rowhead{display:flex;gap:20px;align-items:center}.parts{display:flex;gap:14px;flex-wrap:wrap;margin:12px 0}.parts figure{max-width:140px}.parts svg{width:60px;height:60px}.host{overflow-wrap:anywhere;font-size:14px}.notice{padding:14px;background:#e6eddf;border-left:4px solid #5e7954}.source{overflow-wrap:anywhere;font:12px/1.6 ui-monospace,monospace}.nav{display:flex;gap:18px;flex-wrap:wrap}@media(max-width:650px){main{padding:20px 14px}h1{font-size:28px}.controls{position:static}table{font-size:12px}td{padding:6px}}
</style><main><header><p>固定本地快照 · 2026-11-14 · 审查与候选推演</p><h1>CJK 基本集：纵向嵌套与三分结构</h1><p>先保全实际图形，再选直属分部；同形模板的一致性可以优先于微小的熵差。本报告不改写字库。</p><nav class="nav"><a href="#findings">审查结论</a><a href="#groups">4 组严格匹配</a><a href="#patterns">全部结构类型</a><a href="#inventory">逐字形清单</a><a href="#horizontal">左右三分附录</a></nav></header>
<h2>范围与方法</h2><div class="stats"><div><b>20,992</b>基本集字符，无缺字</div><div><b>33,549</b>全部来源及间接字形</div><div><b>3,373</b>纵向审查对象</div><div><b>57</b>纵向树形类型</div></div><p>严格限定 U+4E00–U+9FFF。保留字符的全部字形记录，包括无来源标签形；递归遍历引用，按字形 ID 去重。基本集外的部件只要被引用也纳入。熵的统计基准是全库 ${audit.summary.global_glyphs.toLocaleString()} 个字形，每 ID 等权，基线 H=${audit.summary.entropy.toFixed(10)} bit／字形；宿主数量仅用于影响范围，不作熵权重。</p>
<p>3,049 个 ⿱ 直属引用包含纵向结构，324 个 ⿳ 中有 111 个也存在纵向嵌套。完全沿纵向展开后，三、四、五、六个末级分部的数量分别是 2,277、854、204、38。另有 205 个 ⿲，列入独立附录。</p>
<p>候选枚举连续纵向末级序列的所有二分、三分，所需中间分部仅复用现有 ID。非纵向结构整体保留；不凭部件名拆笔画，不新增 ID。若多个 ID 有相同末级序列，分别计算。本报告的“相同序列”并不等于几何相容，也不覆盖换用不同 ID 的形近分部。</p>
<div class="notice">230 个字形有数学上熵更低的候选，属于待审核队列。2,064 个三末级分部的二层嵌套中，仅 32 个单独三层化有利；全体三层化的联合熵差为 <b>+103,650.01 μbit／字形</b>（+0.10365001 bit，约基线的 0.486%）。树浅不等于信息熵小。</div>
<p>所有熵差按 AGENTS.md 的 n log₂ n 计数公式，独立更新受影响的结构频数与位置频数。下文用 μbit／字形（10⁻⁶ bit）方便阅读，负值表示降低。独立熵差不可相加；族级方案另算联合差分。例如两个曼单独差分之和约 −20.27，联合为 −35.31。</p>
<h2 id="findings">如何处理不同类型</h2><p>建议把图形合法性视为硬条件，把同形模板统一作为族级约束，再在满足约束的方案中比较熵。先统一被共享的最小节点，宿主继续引用它；不为减少树深逐字拆散。下列为有数值支持的审查方向，尚未生成可写回字库的布局与笔顺补丁。</p>${noteHtml}
<h2 id="groups">4 组严格相同末级 ID 序列的表示差异</h2><p>这是最窄的自动一致性检查：序列中的每个 ID 必须完全相同。需要核对原布局、接点和来源后才能定案。更广泛的同形异 ID、近似分部和不同来源写法仍需按家族审核，不能解读为全库只有这四处不一致。</p>${groupHtml}
<h2>建议的处理次序</h2><ol><li>先审核帚、曼及袁的三层化，核对真实接口、布局和笔顺；两种曼同时处理。</li><li>豆、鬲保持“一／口／下部”模板，将鬲 JKN 形的一致性成本明确记账；不单独追逐豆的最小值。</li><li>䙴／僊字边、舜类、雚类以整族为单位定案。数学上分别偏向复用䙲、爫冖、双口隹；雚还要统一隹的不同写法，避免只改一个地区形。</li><li>莫、害、衣字底、燕字头、重复对称结构单列族级复核；不给罕用中间分部的偶合复用自动授权。</li><li>最后处理纯数学队列。每采纳一族后重算全库计数；写回时保全绝对笔画和笔顺，并检查全部宿主与示例回归。</li></ol>
<p>32 个独立有利三层化候选联合差分为 −388.37 μbit／字形；230 个独立最优候选的联合差分为 −5,373.82 μbit／字形。二者都是未加图形与家族约束的数学情景，不能当作已审核的收益或执行计划。</p>
<h2 id="patterns">全部 57 种纵向树形类型</h2><p>• 表示不再沿纵向展开的字形；可以是部件，也可以是左右、包围等非纵向复合体。下表统计树形，不把它们混称为实际可分的几何层。</p><table><thead><tr><th>纵向树形</th><th>字形数</th><th>操作</th></tr></thead><tbody>${audit.summary.patterns.map((p: any) => `<tr><td class="mono">${p.pattern}</td><td>${p.count}</td><td><button data-pattern="${escapeHtml(p.pattern)}">筛选</button></td></tr>`).join("")}</tbody></table>
<h2 id="inventory">3,373 个字形完整清单</h2><p>可按汉字、宿主、ID（十进制或十六进制）、分部名和树形搜索。原字形及各分部图均由本次快照绘制；候选小图是分部自身的原始形，尚未试排进宿主。界面列前五个数学候选；全部候选见 audit.json。</p><div class="controls"><input id="query" placeholder="搜索字形、宿主、分部或 #ID"><select id="mode"><option value="all">全部纵向字形</option><option value="better">存在熵更低的候选</option><option value="flat">三层化单独有利的 32 个</option><option value="three">现有 ⿳</option><option value="deep">四个及以上纵向末级分部</option></select><button id="clear">重置</button></div><p id="count"></p><div id="list"></div><div class="controls"><button id="prev">上一页</button><span id="page"></span><button id="next">下一页</button></div>
<h2 id="horizontal">左右三部分附录：205 个 ⿲</h2><p>左右三分与本次纵向重组分开统计，未套用纵向候选推演。以下是全部对象及基本集宿主。</p><details><summary>展开全部左右三分清单</summary><table><thead><tr><th>字形</th><th>直属结构</th><th>基本集宿主</th></tr></thead><tbody>${audit.horizontal.map((r: any) => `<tr><td>${svg(r.id)}${escapeHtml(r.label)}</td><td>${escapeHtml(r.expression)}</td><td class="host">${r.hosts}</td></tr>`).join("")}</tbody></table></details>
<h2>复现与数据</h2><p>运行 <code>bun run scripts/audit-vertical-structures.ts</code>，再运行 <code>bun run scripts/render-vertical-audit.ts</code>。可用 --data-dir 和 --out 指定输入、输出目录。全量扫描适用于其他快照；本报告的族级评语绑定上述哈希，输入变化时会要求重审。两份原始 JSON 已压缩保存为 characters.json.deflate 与 glyphs.json.deflate，可用 zlib 解压。未下载数据、未读取 dist、未更改共享库。</p><p><a href="audit.json">完整候选、宿主、来源、一致性组与联合情景 JSON</a> · <a href="inventory.tsv">完整纵向清单 TSV</a> · <a href="summary.json">统计与输入哈希</a></p><p class="source">characters.json SHA-256: ${audit.summary.hashes.characters}<br>glyphs.json SHA-256: ${audit.summary.hashes.glyphs}</p><p class="muted">边界：已完成全量结构扫描和既有 ID 候选计算；重点族给出审查建议。未对 3,373 项逐一完成来源原图比对、候选试排、笔顺一致性和码表回归；本报告不把数学候选标为已确认修复。</p>
</main><script>const data=${serial};
const q=document.getElementById('query'), mode=document.getElementById('mode');let page=0, exactPattern='';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const fmt=x=>(x>=0?'+':'')+(x*1e6).toFixed(2);
const pic=id=>data.drawings[id]||'';
function draw(){const term=q.value.trim().toLowerCase();const result=data.rows.filter(r=>{
if(exactPattern&&r.pattern!==exactPattern)return false;
if(mode.value==='better'&&r.best_delta>=-1e-12)return false;
if(mode.value==='flat'&&!(r.operator==='⿱'&&r.flatten_delta!==null&&r.flatten_delta<0))return false;
if(mode.value==='three'&&r.operator!=='⿳')return false;
if(mode.value==='deep'&&r.leaves.length<4)return false;
return !term||JSON.stringify(r).toLowerCase().includes(term)||r.id.toString(16).padStart(5,'0').includes(term.replace(/^#/,''));});
const pages=Math.max(1,Math.ceil(result.length/30));page=Math.max(0,Math.min(page,pages-1));
document.getElementById('count').textContent='匹配 '+result.length+' 个字形'+(exactPattern?'；树形 '+exactPattern:'');
document.getElementById('page').textContent=(page+1)+' / '+pages;
document.getElementById('prev').disabled=page===0;document.getElementById('next').disabled=page===pages-1;
document.getElementById('list').innerHTML=result.slice(page*30,(page+1)*30).map(r=>'<article><div class="rowhead">'+pic(r.id)+'<div><h3>'+esc(r.label)+'</h3><div>'+esc(r.expression)+'</div><small>'+esc(r.pattern)+' · '+r.leaves.length+' 个纵向末级分部</small></div></div><p class="host">全部基本集宿主（'+[...r.hosts].length+' 字）：'+esc(r.hosts)+'</p><p><small>字符直接映射：'+esc(JSON.stringify(r.direct))+'</small></p><details><summary>纵向末级序列及候选（'+r.candidates.length+' 项）</summary><div class="parts">'+r.leaves.map((id,k)=>'<figure>'+pic(id)+'<figcaption>'+esc(r.leaf_labels[k])+'</figcaption></figure>').join('')+'</div>'+(r.candidates.length?r.candidates.slice(0,5).map(c=>'<p><b>'+fmt(c.entropy_delta)+' μbit／字形</b>　'+esc(c.expression)+'</p><div class="parts">'+c.references.map(id=>'<figure>'+pic(id)+'<figcaption>#'+id.toString(16).toUpperCase().padStart(5,'0')+'</figcaption></figure>').join('')+'</div>').join(''):'<p>当前枚举范围内没有其他可复用的直属组合。</p>')+'</details></article>').join('');}
q.addEventListener('input',()=>{page=0;draw()});mode.addEventListener('change',()=>{page=0;draw()});document.getElementById('clear').onclick=()=>{q.value='';mode.value='all';exactPattern='';page=0;draw()};document.getElementById('prev').onclick=()=>{page--;draw();document.getElementById('inventory').scrollIntoView()};document.getElementById('next').onclick=()=>{page++;draw();document.getElementById('inventory').scrollIntoView()};document.querySelectorAll('[data-pattern]').forEach(b=>b.onclick=()=>{exactPattern=b.dataset.pattern;q.value='';mode.value='all';page=0;draw();document.getElementById('inventory').scrollIntoView()});draw();</script></html>`;
writeFileSync(join(out, "report.html"), html);
writeFileSync(
  join(out, "focus.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${Math.ceil(cases.length / 5) * 230}" viewBox="0 0 1200 ${Math.ceil(cases.length / 5) * 230}"><rect width="100%" height="100%" fill="white"/>${cases.map((r: any, k: number) => `<g transform="translate(${(k % 5) * 240},${Math.floor(k / 5) * 230})"><text x="12" y="24" font-size="15">${escapeHtml(r.label)}</text><g transform="translate(45,35) scale(1.4)">${drawings[r.id]!.replace(/^<svg[^>]*>/, "<g>").replace(/<\/svg>$/, "</g>")}</g><text x="12" y="210" font-size="12">ΔH ${delta(r.best_delta)} μbit</text></g>`).join("")}</svg>`,
);
console.log(
  `已生成 ${join(out, "report.html")}，共 ${ids.size} 个快照字形图。`,
);
