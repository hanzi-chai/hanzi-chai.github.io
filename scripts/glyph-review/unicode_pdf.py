"""Unicode 18.0 下载、来源字形定位和裁图。依赖 PyMuPDF；不提取字体轮廓。"""

import argparse
import hashlib
import json
import re
import shutil
import urllib.request
import zipfile
from pathlib import Path

VERSION = "18.0.0"
ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "output/glyph-review/unicode" / VERSION
URLS = {
    "U4E00.pdf": f"https://www.unicode.org/Public/{VERSION}/charts/PDF/U4E00.pdf",
    "Unihan.zip": f"https://www.unicode.org/Public/{VERSION}/ucd/Unihan.zip",
}
SOURCE_MAP = {"KP": "N", "UK": "B"}


def digest(path):
    return hashlib.file_digest(path.open("rb"), "sha256").hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def sources():
    result = {}
    path = BASE / "Unihan_IRGSources.txt"
    if f"# Unicode Version {VERSION}\n" not in path.read_text()[:500]:
        raise ValueError("IRGSources 版本错误")
    for line in path.read_text().splitlines():
        fields = line.split("\t")
        if len(fields) != 3:
            continue
        match = re.fullmatch(r"kIRG_(\w+)Source", fields[1])
        if not match:
            continue
        cp = int(fields[0][2:], 16)
        if not 0x4E00 <= cp <= 0x9FFF:
            continue
        source = match[1]
        result.setdefault(cp, {})[SOURCE_MAP.get(source, source)] = {
            "irgSource": source,
            "references": fields[2].split(),
        }
    return result


def download(args):
    BASE.mkdir(parents=True, exist_ok=True)
    for name, url in URLS.items():
        target = BASE / name
        if args.cached and target.exists():
            continue
        if name == "Unihan.zip" and args.cached and (BASE / "Unihan_IRGSources.txt").exists():
            continue
        temp = target.with_suffix(target.suffix + ".part")
        print(f"下载 {url}", flush=True)
        with urllib.request.urlopen(url, timeout=120) as response, temp.open("wb") as out:
            shutil.copyfileobj(response, out)
        temp.replace(target)
    archive = BASE / "Unihan.zip"
    if archive.exists():
        with zipfile.ZipFile(archive) as z:
            (BASE / "Unihan_IRGSources.txt").write_bytes(z.read("Unihan_IRGSources.txt"))
    sources()  # 同步前验证版本及字段。
    if not (BASE / "U4E00.pdf").read_bytes().startswith(b"%PDF-"):
        raise ValueError("下载结果不是 PDF")
    if args.sync:
        version = json.loads((ROOT / "packages/hanzi-chai/package.json").read_text())["version"]
        for folder in [ROOT / "packages/hanzi-chai/src/data", ROOT / "public/data" / version]:
            folder.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(BASE / "Unihan_IRGSources.txt", folder / "Unihan_IRGSources.txt")
    write_json(BASE / "manifest.json", {
        "unicodeVersion": VERSION,
        "files": {name: {"url": URLS.get(name, URLS["Unihan.zip"]), "sha256": digest(BASE / name)}
                  for name in ["U4E00.pdf", "Unihan_IRGSources.txt"]},
    })
    print(f"已准备 Unicode {VERSION}：{BASE}")


def index(_args):
    import pymupdf

    expected = sources()
    doc = pymupdf.open(BASE / "U4E00.pdf")
    if "Version 18.0" not in doc[0].get_text():
        raise ValueError("PDF 版本不是 Unicode 18.0")
    records, issues, seen_codes = {}, [], set()
    for page_no in range(1, len(doc)):
        page = doc[page_no]
        spans = [s for b in page.get_text("dict")["blocks"] if "lines" in b
                 for line in b["lines"] for s in line["spans"] if s["text"].strip()]
        anchors = [s for s in spans if 9 < s["size"] < 11 and s["bbox"][1] > 90
                   and re.fullmatch(r"[4-9][0-9A-F]{3}", s["text"])
                   and s["bbox"][0] < 335]
        for anchor in anchors:
            cp = int(anchor["text"], 16)
            seen_codes.add(cp)
            x, y = anchor["bbox"][:2]
            next_y = min((a["bbox"][1] for a in anchors
                          if abs(a["bbox"][0] - x) < 3 and a["bbox"][1] > y + 2), default=page.rect.height - 40)
            row = [s for s in spans if x + 28 < (s["bbox"][0] + s["bbox"][2]) / 2 < x + 213
                   and y - 2 <= s["bbox"][1] < next_y - 2]
            glyphs = [s for s in row if s["size"] >= 15]
            labels = [s for s in row if s["font"] == "UnihanInfo"]
            for source, info in expected.get(cp, {}).items():
                matches = []
                for label in labels:
                    text = "".join(label["text"].split())
                    box = list(label["bbox"])
                    # JMJ 等来源编号可能折成两行，按中心位置合并。
                    if text.endswith("-"):
                        following = sorted((s for s in labels
                                            if 0 < s["bbox"][1] - box[1] < 9
                                            and abs((s["bbox"][0] + s["bbox"][2] - box[0] - box[2]) / 2) < 8),
                                           key=lambda s: s["bbox"][1])
                        if following:
                            text += "".join(following[0]["text"].split())
                            box[3] = following[0]["bbox"][3]
                    if text not in info["references"]:
                        continue
                    center = (box[0] + box[2]) / 2
                    nearby = [g for g in glyphs if abs((g["bbox"][0] + g["bbox"][2]) / 2 - center) < 6
                              and 7 < box[1] - g["bbox"][1] < 30]
                    localization = "glyph-span"
                    if len(nearby) == 1:
                        g = nearby[0]
                        # 保留原页面字形的完整方框，不把下方来源编号裁进字形。
                        crop = [g["bbox"][0] - 1, min(g["bbox"][1], box[1] - 24),
                                g["bbox"][2] + 1, box[1] - 0.5]
                    elif not nearby:
                        # 少量 U 源字形在文本层不可见；来源编号仍可精确定位其字格。
                        crop = [center - 12.5, box[1] - 25, center + 12.5, box[1] - 0.5]
                        probe = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), clip=pymupdf.Rect(crop), alpha=False)
                        if sum(v < 200 for v in probe.samples) < 12:
                            continue
                        localization = "source-label-cell"
                    else:
                        continue
                    matches.append({"unicode": cp, "source": source, **info,
                                    "reference": text, "page": page_no + 1,
                                    "localization": localization,
                                    "glyphBox": crop, "labelBox": box,
                                    "rowBox": [x - 1, y - 2, x + 214, next_y - 2]})
                key = f"{cp:04X}-{source}"
                if len(matches) == 1:
                    records[key] = matches[0]
                else:
                    issues.append({"key": key, "page": page_no + 1,
                                   "reason": "source-label-or-glyph-not-unique", "matches": len(matches)})
        if page_no % 100 == 0:
            print(f"已索引 {page_no}/{len(doc) - 1} 页", flush=True)
    for cp, entries in expected.items():
        if cp not in seen_codes:
            for source in entries:
                issues.append({"key": f"{cp:04X}-{source}", "reason": "codepoint-not-found"})
    result = {"unicodeVersion": VERSION, "pdfSha256": digest(BASE / "U4E00.pdf"),
              "irgSha256": digest(BASE / "Unihan_IRGSources.txt"),
              "pageCount": len(doc), "characterCount": len(seen_codes),
              "records": records, "issues": issues}
    write_json(BASE / "index.json", result)
    print(f"字形定位成功 {len(records)}，待处理 {len(issues)}；字符 {len(seen_codes)}")


def crop(args):
    import pymupdf

    index_data = json.loads((BASE / "index.json").read_text())
    if index_data["pdfSha256"] != digest(BASE / "U4E00.pdf"):
        raise ValueError("PDF 已变化，请重新生成索引")
    if index_data["irgSha256"] != digest(BASE / "Unihan_IRGSources.txt"):
        raise ValueError("IRGSources 已变化，请重新生成索引")
    request = json.loads(Path(args.request).read_text())
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(BASE / "U4E00.pdf")
    crops, missing = {}, []
    for key in request:
        entry = index_data["records"].get(key)
        if not entry:
            missing.append(key)
            continue
        page = doc[entry["page"] - 1]
        filename = f"{key}.png"
        page.get_pixmap(matrix=pymupdf.Matrix(8, 8), clip=pymupdf.Rect(entry["glyphBox"]), alpha=False).save(out / filename)
        row_name = f"{entry['unicode']:04X}-row.png"
        if not (out / row_name).exists():
            page.get_pixmap(matrix=pymupdf.Matrix(3, 3), clip=pymupdf.Rect(entry["rowBox"]), alpha=False).save(out / row_name)
        crops[key] = {**entry, "image": filename, "rowImage": row_name}
    write_json(out / "crops.json", {"records": crops, "missing": missing})
    if args.renders:
        for path in Path(args.renders).glob("*.svg"):
            with pymupdf.open(path) as svg:
                svg[0].get_pixmap(alpha=False).save(path.with_suffix(".png"))
    print(f"已裁剪 {len(crops)} 个来源字形；缺少定位 {len(missing)}")


parser = argparse.ArgumentParser(description=__doc__)
sub = parser.add_subparsers(dest="command", required=True)
d = sub.add_parser("download")
d.add_argument("--cached", action="store_true", help="复用已下载文件")
d.add_argument("--sync", action="store_true", help="同步 IRGSources 到算法包及 Web 数据目录")
d.set_defaults(run=download)
sub.add_parser("index").set_defaults(run=index)
c = sub.add_parser("crop")
c.add_argument("--request", required=True, help="来源键 JSON 数组，如 [\"6901-G\", \"6901-J\"]")
c.add_argument("--out", required=True)
c.add_argument("--renders", help="同时将目录内候选 SVG 转为 agent 可读取的 PNG")
c.set_defaults(run=crop)
if __name__ == "__main__":
    arguments = parser.parse_args()
    arguments.run(arguments)
