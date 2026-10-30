import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { Resvg } from "@resvg/resvg-js";
import type {
  基本字形数据,
  复合体数据,
  字符数据,
} from "../../packages/hanzi-chai/src/data";
import { 字形渲染器 } from "./render";

const operators = ["⿴", "⿵", "⿶", "⿷", "⿸", "⿹", "⿺", "⿼", "⿽"];
const operatorNames: Record<string, string> = {
  "⿴": "四面包围",
  "⿵": "上三面包围",
  "⿶": "下三面包围",
  "⿷": "左三面包围",
  "⿼": "右三面包围",
  "⿸": "左上包围",
  "⿹": "右上包围",
  "⿺": "左下包围",
  "⿽": "右下包围",
};
const root = resolve(import.meta.dir, "../..");
const { values } = parseArgs({ options: { out: { type: "string" } } });
const out = resolve(values.out ?? "output/glyph-review/enclosure-inventory");
const glyphText = readFileSync(
  join(root, "packages/hanzi-chai/src/data/glyphs.json"),
  "utf8",
);
const characterText = readFileSync(
  join(root, "packages/hanzi-chai/src/data/characters.json"),
  "utf8",
);
const glyphs: 基本字形数据[] = JSON.parse(glyphText);
const characters: 字符数据[] = JSON.parse(characterText);
const map = new Map(glyphs.map((g) => [g.id, g]));
const renderer = new 字形渲染器(map);
const basic = (cp: number) => cp >= 0x4e00 && cp <= 0x9fff;
const unified = (cp: number) =>
  basic(cp) ||
  (cp >= 0x3400 && cp <= 0x4dbf) ||
  (cp >= 0x20000 && cp <= 0x3347f);
type Binding = { unicode: number; character: string; sources: string[] };
const bindings = new Map<number, Binding[]>();
for (const c of characters) {
  for (const ref of c.glyphs) {
    if (!bindings.has(ref.id)) bindings.set(ref.id, []);
    bindings.get(ref.id)!.push({
      unicode: c.unicode,
      character: String.fromCodePoint(c.unicode),
      sources: ref.sources,
    });
  }
}
const rank = (id: number) => {
  const list = bindings.get(id) ?? [];
  const b = [...list].sort(
    (a, b) =>
      Number(!basic(a.unicode)) - Number(!basic(b.unicode)) ||
      Number(!unified(a.unicode)) - Number(!unified(b.unicode)) ||
      Number(!a.sources.includes("G")) - Number(!b.sources.includes("G")) ||
      a.unicode - b.unicode,
  )[0];
  return b
    ? [basic(b.unicode) ? 0 : unified(b.unicode) ? 1 : 2, b.unicode]
    : [3, id];
};
const sortGlyph = (a: 基本字形数据, b: 基本字形数据) => {
  const ra = rank(a.id),
    rb = rank(b.id);
  return ra[0]! - rb[0]! || ra[1]! - rb[1]! || a.id - b.id;
};
const grouped = new Map<number, 复合体数据[]>();
const byOperator = Object.fromEntries(operators.map((op) => [op, 0]));
for (const g of glyphs) {
  if (g.type !== "compound" || !operators.includes(g.operator)) continue;
  const outer = g.references[0];
  if (!outer || !map.has(outer.id))
    throw new Error(`包围复合体 ${g.id} 的外框引用无效`);
  if (!grouped.has(outer.id)) grouped.set(outer.id, []);
  grouped.get(outer.id)!.push(g);
  byOperator[g.operator]!++;
}
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const panelFont = [
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
].find(existsSync);
const write = (p: string, value: unknown) =>
  writeFileSync(p, `${JSON.stringify(value, null, 2)}\n`);
mkdirSync(join(out, "images"), { recursive: true });
mkdirSync(join(out, "panels"), { recursive: true });
const issues: { glyphId: number; error: string }[] = [];
const rendered = new Map<
  number,
  { image: string; svg: string; error: string | null }
>();
function render(g: 基本字形数据) {
  if (rendered.has(g.id)) return rendered.get(g.id)!;
  let svg: string,
    error: string | null = null;
  try {
    svg = renderer.渲染(g);
  } catch (e) {
    error = String(e);
    issues.push({ glyphId: g.id, error });
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320" fill="#fff3f3"/><text x="10" y="155" fill="red">Render error: glyph ${g.id}</text></svg>`;
  }
  const image = `images/${g.id}.svg`;
  writeFileSync(join(out, image), svg);
  const value = { image, svg, error };
  rendered.set(g.id, value);
  return value;
}
const uri = (svg: string) =>
  `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
const items = [...grouped]
  .sort((a, b) => b[1].length - a[1].length || a[0] - b[0])
  .map(([id, uses], index) => {
    const outer = map.get(id)!;
    const single = render(outer);
    const sorted = [...uses].sort(sortGlyph);
    const examples = operators.flatMap((operator) => {
      const example = sorted.find((g) => g.operator === operator);
      if (!example) return [];
      const result = render(example);
      return [
        {
          glyphId: example.id,
          operator,
          bindings: bindings.get(example.id) ?? [],
          references: example.references,
          strokes: example.strokes,
          image: result.image,
          error: result.error,
        },
      ];
    });
    const preferred = sorted[0]!;
    const compound = render(preferred);
    const panel = `panels/${id}.png`;
    const panelSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="410"><rect width="100%" height="100%" fill="white"/><g font-family="Arial" font-size="20" fill="#222"><text x="20" y="30">${index + 1}. Outer glyph ${id}</text><text x="410" y="30">Compound glyph ${preferred.id}</text><text x="20" y="395">Standalone</text><text x="410" y="395">IDS U+${preferred.operator.codePointAt(0)!.toString(16).toUpperCase()} | Outer reference: ${id}</text></g><image x="20" y="50" width="320" height="320" href="${uri(single.svg)}"/><image x="410" y="50" width="320" height="320" href="${uri(compound.svg)}"/></svg>`;
    writeFileSync(
      join(out, panel),
      new Resvg(panelSvg, {
        font: {
          loadSystemFonts: !panelFont,
          fontFiles: panelFont ? [panelFont] : [],
          defaultFontFamily: "Arial",
        },
      })
        .render()
        .asPng(),
    );
    if ((index + 1) % 100 === 0)
      console.log(`已生成 ${index + 1}/${grouped.size} 个外框`);
    return {
      id,
      name: outer.name ?? "",
      type: outer.type,
      bindings: bindings.get(id) ?? [],
      usageCount: uses.length,
      basicUsageCount: uses.filter((g) =>
        (bindings.get(g.id) ?? []).some((b) => basic(b.unicode)),
      ).length,
      operators: examples.map((e) => e.operator),
      image: single.image,
      error: single.error,
      preferredExampleId: preferred.id,
      examples,
      panel,
      allUsages: sorted.map((g) => ({
        glyphId: g.id,
        operator: g.operator,
        bindings: bindings.get(g.id) ?? [],
        references: g.references,
      })),
    };
  });
const summary = {
  generatedAt: new Date().toISOString(),
  definition:
    "全字形数据库中，operator 属于九种包围 IDS 的复合体，其 references[0].id；按外框 ID 去重，不限定字符范围，不合并外观相似 ID。包括没有字符直接关联的复合体。",
  operators,
  glyphCount: glyphs.length,
  characterCount: characters.length,
  enclosingGlyphCount: items.length,
  compoundCount: [...grouped.values()].reduce((n, uses) => n + uses.length, 0),
  basicUsedOuterCount: items.filter((i) => i.basicUsageCount > 0).length,
  componentOuters: items.filter((i) => i.type === "component").length,
  compoundOuters: items.filter((i) => i.type === "compound").length,
  examplesRendered: items.reduce((n, i) => n + i.examples.length, 0),
  byOperator,
  issues,
  inputHashes: { glyphs: hash(glyphText), characters: hash(characterText) },
};
write(join(out, "inventory.json"), { summary, items });
const publicItems = items.map(({ allUsages, ...i }) => i);
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>包围外框字形全量对照</title>
<style>body{font:16px system-ui;margin:0;background:#f4f5f7;color:#20242b}header{position:sticky;top:0;background:white;padding:16px 24px;box-shadow:0 1px 5px #bbb;z-index:1}h1{font-size:24px;margin:0 0 8px}.muted{color:#626976;font-size:14px}input,select,button{font:inherit;padding:7px;margin:4px;border:1px solid #bbb;border-radius:5px}main{max-width:1200px;margin:auto;padding:20px}.card{background:white;border:1px solid #ddd;border-radius:8px;margin-bottom:22px;padding:18px}.title{font-size:20px;font-weight:650}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}.figure{text-align:center;background:#fafafa;padding:10px}.figure img{width:min(100%,320px);height:320px;object-fit:contain;display:block;margin:auto;background:white}.tag{display:inline-block;padding:2px 8px;background:#edf1ff;border-radius:12px;margin:3px}.error{color:#b00020}details{margin-top:12px}#counts{margin-top:6px}textarea{width:95%;min-height:45px;font:inherit}.actions{border-top:1px solid #ddd;padding-top:10px;margin-top:12px}a{color:#245ac6}@media(max-width:650px){header{position:static}.pair{grid-template-columns:1fr}.figure img{height:auto}main{padding:8px}}</style>
<header><h1>包围外框字形：单独与复合体对照</h1><div class="muted">按实际外框 ID 穷举，共 ${items.length} 项；${summary.compoundCount} 个包围复合体。左图为外框独立渲染，右图为数据库中真实引用它的复合体。使用当前渲染规则，未调整布局。</div>
<div><input id="search" placeholder="搜索：户、麻、字形 ID、例字" size="28"><select id="scope"><option value="all">全数据库</option><option value="basic">用于 CJK 基本集</option></select><select id="operator"><option value="all">全部包围结构</option>${operators.map((op) => `<option value="${op}">${operatorNames[op]} ${op}</option>`).join("")}</select><select id="kind"><option value="all">全部外框类型</option><option value="component">基本部件</option><option value="compound">复合体</option></select><select id="reviewFilter"><option value="all">全部判断</option><option value="unreviewed">未判断</option><option value="ok">无需调整</option><option value="layout">调整布局参数</option><option value="variant">新增外框字形 ID</option><option value="unsure">待定</option></select><button id="export">导出判断</button></div><div id="counts" class="muted"></div></header>
<main><p>范围包含四面包围，上、下、左、右三面包围，以及左上、右上、左下、右下两面包围。同一外框用于多种结构时，可切换每种结构的例子。所有 ID 均保留；没有直接关联字符的字形以名称或 ID 标识。按被包围复合体引用的数量排序。</p><div id="cards"></div><div><button id="prev">上一页</button><span id="page"></span><button id="next">下一页</button></div></main>
<script>
const items=${JSON.stringify(publicItems).replaceAll("<", "\\u003c")};
const operatorNames=${JSON.stringify(operatorNames)};
const datasetHash=${JSON.stringify(summary.inputHashes.glyphs)};
const $=id=>document.getElementById(id), esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const storageKey='enclosure-review-'+datasetHash;let reviews={};try{reviews=JSON.parse(localStorage.getItem(storageKey)||'{}')}catch{}let page=0;const size=20;
const label=bs=>[...bs].sort((a,b)=>(a.unicode<0x4e00||a.unicode>0x9fff)-(b.unicode<0x4e00||b.unicode>0x9fff)||a.unicode-b.unicode).slice(0,5).map(b=>b.character+' U+'+b.unicode.toString(16).toUpperCase()+' ['+b.sources.join('')+']').join('；')||'无直接关联字符';
const statusOptions=[['','未判断'],['ok','无需调整'],['layout','调整布局参数'],['variant','新增外框字形 ID'],['unsure','待定']];
function save(){try{localStorage.setItem(storageKey,JSON.stringify(reviews))}catch{alert('浏览器无法保存，请导出判断以免丢失')}}
function show(){const q=$('search').value.trim().toLowerCase(),op=$('operator').value,scope=$('scope').value,kind=$('kind').value,review=$('reviewFilter').value;const filtered=items.filter(i=>(scope!=='basic'||i.basicUsageCount>0)&&(op==='all'||i.operators.includes(op))&&(kind==='all'||i.type===kind)&&(review==='all'||(review==='unreviewed'?!reviews[i.id]?.status:reviews[i.id]?.status===review))&&(!q||[i.id,i.name,...i.bindings.map(b=>b.character),...i.examples.flatMap(e=>[e.glyphId,...e.bindings.map(b=>b.character)])].join(' ').toLowerCase().includes(q)));const pages=Math.max(1,Math.ceil(filtered.length/size));page=Math.min(page,pages-1);const counts=Object.fromEntries(statusOptions.filter(x=>x[0]).map(([key])=>[key,items.filter(i=>reviews[i.id]?.status===key).length]));$('counts').textContent='筛选 '+filtered.length+'/'+items.length+' 项；已判断 '+Object.values(counts).reduce((a,b)=>a+b,0)+'；无需调整 '+counts.ok+'；布局 '+counts.layout+'；新增 ID '+counts.variant+'；待定 '+counts.unsure;
$('cards').innerHTML=filtered.slice(page*size,(page+1)*size).map(i=>{const preferred=i.examples.find(e=>op==='all'?e.glyphId===i.preferredExampleId:e.operator===op)||i.examples[0],r=reviews[i.id]||{};return '<article class="card" id="glyph-'+i.id+'"><div class="title">#'+i.id+' '+esc(i.name||i.bindings.find(b=>b.unicode>=0x4e00&&b.unicode<=0x9fff)?.character||'')+'</div><div class="muted">'+esc(label(i.bindings))+'</div><div>'+i.operators.map(o=>'<span class="tag">'+operatorNames[o]+'</span>').join('')+'<span class="tag">'+(i.type==='compound'?'复合外框':'基本部件')+'</span> '+i.usageCount+' 个复合体，其中 '+i.basicUsageCount+' 个关联基本集字符</div><div class="pair"><div class="figure"><div>单独字形 #'+i.id+'</div><img loading="lazy" src="'+i.image+'">'+(i.error?'<p class="error">'+esc(i.error)+'</p>':'')+'</div><div class="figure"><div>复合体例子 <select class="example" data-id="'+i.id+'">'+i.examples.map(e=>'<option value="'+e.glyphId+'" '+(e===preferred?'selected':'')+'>'+operatorNames[e.operator]+' #'+e.glyphId+' '+esc(label(e.bindings))+'</option>').join('')+'</select></div><img loading="lazy" class="compound-image" src="'+preferred.image+'"><div class="muted compound-info">'+esc(JSON.stringify(preferred.references))+'</div></div></div><details><summary>外框关联字符与来源</summary>'+esc(label(i.bindings))+'</details><div class="actions">判断：<select class="status" data-id="'+i.id+'">'+statusOptions.map(([key,label])=>'<option value="'+key+'" '+(r.status===key?'selected':'')+'>'+label+'</option>').join('')+'</select><a href="'+i.panel+'" target="_blank">打开对照 PNG</a><br><textarea class="note" data-id="'+i.id+'" placeholder="记录需要变形的位置、适用结构或新增字形计划">'+esc(r.note||'')+'</textarea></div></article>'}).join('');$('page').textContent='第 '+(page+1)+' / '+pages+' 页';$('prev').disabled=page===0;$('next').disabled=page>=pages-1;}
for(const id of ['search','scope','operator','kind','reviewFilter'])$(id).addEventListener(id==='search'?'input':'change',()=>{page=0;show()});
$('cards').addEventListener('change',e=>{const el=e.target,id=Number(el.dataset.id);if(el.classList.contains('example')){const item=items.find(i=>i.id===id),ex=item.examples.find(x=>x.glyphId===Number(el.value)),card=el.closest('.card');card.querySelector('.compound-image').src=ex.image;card.querySelector('.compound-info').textContent=JSON.stringify(ex.references)}else if(el.classList.contains('status')){reviews[id]={...reviews[id],status:el.value};save();show()}});
$('cards').addEventListener('input',e=>{if(e.target.classList.contains('note')){const id=e.target.dataset.id;reviews[id]={...reviews[id],note:e.target.value};save()}});
$('prev').onclick=()=>{page--;show();window.scrollTo(0,0)};$('next').onclick=()=>{page++;show();window.scrollTo(0,0)};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify({datasetHash,exportedAt:new Date().toISOString(),reviews},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='enclosure-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};show();
</script></html>`;
writeFileSync(join(out, "index.html"), html);
writeFileSync(
  join(out, "README.md"),
  `# 包围外框字形全量对照\n\n打开 index.html 浏览，或运行：\n\n\`bun scripts/glyph-review/cli.ts serve --out ${out} --port 8771\`\n\n访问 http://127.0.0.1:8771/index.html 。共 ${items.length} 个外框 ID，${summary.compoundCount} 个包围复合体，其中 ${summary.basicUsedOuterCount} 个外框用于基本集字符的直接包围结构。未按外观合并 ID，也未限制于基本集。\n\n每个外框单独渲染一次，并为其使用的每种包围操作符选一个真实复合体例子；优先选关联基本集字符的例子。panels/ 中每个外框有一张默认例子的对照 PNG，images/ 保存单独及各结构例子的 SVG。inventory.json 保存全部 ${summary.compoundCount} 个引用关系及来源关联，summary.issues 记录渲染异常（本次 ${issues.length} 项）。\n\n页面支持搜索、结构/范围筛选和调整判断；判断只保存在当前浏览器，可导出 JSON。图像沿用现有渲染规则，未修正数据或创建新字形 ID。\n`,
);
console.log(JSON.stringify({ out, ...summary }, null, 2));
