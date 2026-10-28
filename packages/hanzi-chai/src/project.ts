/** 本地方案项目及运行记录。所有文件路径相对于项目清单解析。 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dump, load } from "js-yaml";
import Pako from "pako";
import type { 配置 } from "./config.js";
import type { 基本字形数据, 字符数据 } from "./data.js";
import { 本地编码评估, 校验方案配置 } from "./node-engine.js";
import {
  准备方案,
  方案错误,
  构建字库,
  type 编码结果,
  获取默认目标,
  type 评估指标,
  运行方案,
} from "./scheme.js";
import {
  type 自定义分析,
  解析原始词典,
  解析当量映射,
  解析键位分布目标,
  读取表格,
} from "./utils.js";
import { 是记录, 检查方案元素 } from "./validation.js";

export const 默认数据目录 = fileURLToPath(new URL("./data/", import.meta.url));
const packageInfo = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string; dependencies: { libchai: string } };
const 数据文件 = {
  characters: "characters.json.deflate",
  glyphs: "glyphs.json.deflate",
  dictionary: "dictionary.txt",
  distribution: "distribution.txt",
  equivalence: "equivalence.txt",
} as const;

export interface 方案项目清单 {
  formatVersion: 1;
  config: string;
  data?: {
    directory?: string;
    dictionary?: string;
    distribution?: string;
    equivalence?: string;
    customAnalysis?: Record<string, string>;
  };
}

export const 最小方案: 配置 = {
  version: "0.4",
  source: null,
  info: { name: "笔画方案" },
  data: { character_set: "general", glyph_sources: ["G"] },
  form: {
    alphabet: "abcde",
    mapping: { "1": "a", "2": "b", "3": "c", "4": "d", "5": "e" },
  },
  encoder: {
    max_length: 4,
    sources: {
      s0: { object: null, next: "s1" },
      s1: { object: { type: "字根", rootIndex: 1 }, next: "s2" },
      s2: { object: { type: "字根", rootIndex: 2 }, next: "s3" },
      s3: { object: { type: "字根", rootIndex: 3 }, next: "s4" },
      s4: { object: { type: "字根", rootIndex: 4 }, next: null },
    },
    conditions: {},
  },
};

export function 规范序列化(value: unknown): string {
  const normalize = (x: unknown): unknown => {
    if (x instanceof Map) return normalize(Object.fromEntries(x));
    if (Array.isArray(x)) return x.map(normalize);
    if (是记录(x))
      return Object.fromEntries(
        Object.keys(x)
          .sort()
          .filter((k) => x[k] !== undefined)
          .map((k) => [k, normalize(x[k])]),
      );
    return x;
  };
  return JSON.stringify(normalize(value));
}
export const 内容哈希 = (content: string | Uint8Array) =>
  createHash("sha256").update(content).digest("hex");

export function 读取方案项目(输入路径: string) {
  const resolved = path.resolve(输入路径);
  const file = statSync(resolved).isDirectory()
    ? path.join(resolved, "chai.project.yaml")
    : resolved;
  const value: unknown = load(readFileSync(file, "utf8"));
  let manifest: 方案项目清单;
  let 配置: unknown;
  const root = path.dirname(file);
  if (是记录(value) && "formatVersion" in value) {
    if (
      value.formatVersion !== 1 ||
      typeof value.config !== "string" ||
      (value.data !== undefined && !是记录(value.data))
    ) {
      throw new 方案错误([
        {
          code: "INVALID_PROJECT",
          path: file,
          message: "清单必须指定 formatVersion: 1、config 和可选的 data 对象",
        },
      ]);
    }
    manifest = value as unknown as 方案项目清单;
    for (const key of [
      "directory",
      "dictionary",
      "distribution",
      "equivalence",
    ] as const) {
      const item = manifest.data?.[key];
      if (item !== undefined && typeof item !== "string")
        throw new 方案错误([
          {
            code: "INVALID_PROJECT",
            path: `/data/${key}`,
            message: "必须是文件路径字符串",
          },
        ]);
    }
    const custom = manifest.data?.customAnalysis;
    if (
      custom !== undefined &&
      (!是记录(custom) ||
        !Object.values(custom).every((x) => typeof x === "string"))
    )
      throw new 方案错误([
        {
          code: "INVALID_PROJECT",
          path: "/data/customAnalysis",
          message: "必须是类别名称到文件路径的映射",
        },
      ]);
    配置 = load(readFileSync(path.resolve(root, manifest.config), "utf8"));
  } else {
    manifest = { formatVersion: 1, config: path.basename(file) };
    配置 = value;
  }
  校验方案配置(配置);
  const directory = manifest.data?.directory
    ? path.resolve(root, manifest.data.directory)
    : 默认数据目录;
  const files: Record<string, string> = {};
  const buffers: Record<string, Buffer> = {};
  for (const [role, name] of Object.entries(数据文件)) {
    const override =
      role === "dictionary" || role === "distribution" || role === "equivalence"
        ? manifest.data?.[role]
        : undefined;
    const filename = override
      ? path.resolve(root, override)
      : path.join(directory, name);
    files[role] = filename;
    buffers[role] = readFileSync(filename);
  }
  const 自定义元素集合: Record<string, 自定义分析> = {};
  for (const [name, filename] of Object.entries(
    manifest.data?.customAnalysis ?? {},
  )) {
    const role = `custom:${name}`;
    files[role] = path.resolve(root, filename);
    buffers[role] = readFileSync(files[role]!);
    自定义元素集合[name] = Object.fromEntries(
      读取表格(buffers[role]!.toString("utf8"))
        .filter((r) => r.length >= 2 && r[0])
        .map(([char, elements]) => [
          char!,
          elements!.split(/\s+/).filter(Boolean),
        ]),
    );
  }
  const 字符列表: 字符数据[] = JSON.parse(
    Pako.inflate(buffers.characters!, { to: "string" }),
  );
  const 字形列表: 基本字形数据[] = JSON.parse(
    Pako.inflate(buffers.glyphs!, { to: "string" }),
  );
  const 上下文 = 准备方案(配置, {
    字库: 构建字库(配置, 字符列表, 字形列表),
    原始词典: 解析原始词典(读取表格(buffers.dictionary!.toString("utf8"))),
    键位分布目标: 解析键位分布目标(
      读取表格(buffers.distribution!.toString("utf8")),
    ),
    当量映射: 解析当量映射(读取表格(buffers.equivalence!.toString("utf8"))),
    自定义元素集合,
  });
  const errors = 检查方案元素(上下文);
  if (errors.length) throw new 方案错误(errors);
  const hashes = Object.fromEntries(
    Object.entries(buffers).map(([role, content]) => [role, 内容哈希(content)]),
  );
  return { 配置, 上下文, files, hashes, buffers };
}
export type 本地方案项目 = ReturnType<typeof 读取方案项目>;

/** 快照包含所有实际输入；既可用于 init，也可用于保存运行的复现项目。 */
export function 保存方案项目(
  目录: string,
  配置: 配置,
  buffers: Record<string, Uint8Array>,
) {
  mkdirSync(目录, { recursive: true });
  const manifest: 方案项目清单 = {
    formatVersion: 1,
    config: "scheme.yaml",
    data: { directory: "assets", customAnalysis: {} },
  };
  mkdirSync(path.join(目录, "assets"), { recursive: true });
  let customIndex = 0;
  for (const [role, content] of Object.entries(buffers)) {
    const filename = role.startsWith("custom:")
      ? `custom-${customIndex++}.tsv`
      : 数据文件[role as keyof typeof 数据文件];
    if (!filename) continue;
    writeFileSync(path.join(目录, "assets", filename), content);
    if (role.startsWith("custom:"))
      manifest.data!.customAnalysis![role.slice(7)] = `assets/${filename}`;
  }
  writeFileSync(
    path.join(目录, "scheme.yaml"),
    dump(配置, { noRefs: true, lineWidth: -1 }),
  );
  writeFileSync(path.join(目录, "chai.project.yaml"), dump(manifest));
}

export function 初始化方案项目(目录: string, 示例?: string) {
  // 不覆盖已有项目或其他文件。
  if (existsSync(目录))
    throw new 方案错误([
      {
        code: "OUTPUT_EXISTS",
        path: 目录,
        message: "目标目录已存在，请使用新目录",
      },
    ]);
  let 配置 = structuredClone(最小方案);
  if (示例) {
    const packaged = fileURLToPath(
      new URL(`./examples/${encodeURIComponent(示例)}.yaml`, import.meta.url),
    );
    const file = existsSync(示例)
      ? 示例
      : existsSync(packaged)
        ? packaged
        : fileURLToPath(
            new URL(
              `../../../examples/${encodeURIComponent(示例)}.yaml`,
              import.meta.url,
            ),
          );
    配置 = load(readFileSync(file, "utf8")) as 配置;
    校验方案配置(配置);
  }
  const buffers = Object.fromEntries(
    Object.entries(数据文件).map(([role, filename]) => [
      role,
      readFileSync(path.join(默认数据目录, filename)),
    ]),
  );
  保存方案项目(目录, 配置, buffers);
  return path.resolve(目录);
}

export interface 运行记录 {
  formatVersion: 1;
  metadata: {
    algorithmVersion: string;
    libchaiVersion: string;
    configHash: string;
    dataHashes: Record<string, string>;
    scope: string;
    objective: ReturnType<typeof 获取默认目标>;
  };
  config: 配置;
  codes: 编码结果;
  metrics: 评估指标;
  analysis: ReturnType<typeof 汇总拆分>;
}

export function 汇总拆分(分析: ReturnType<typeof 运行方案>["分析"]) {
  return [...分析.value.分析结果].map(([char, glyphs]) => ({
    character: char.获取名称(),
    glyphs: glyphs.map((glyph) => {
      const entries =
        "字根序列" in glyph ? [{ ...glyph, 条件列表: [] }] : [...glyph];
      return entries.map((x) => ({
        glyph: "部件" in x ? x.部件.id : x.复合体.id,
        roots: x.字根序列.map((root) => root.获取名称()),
        conditions: x.条件列表,
      }));
    }),
  }));
}

export function 评估方案项目(项目: 本地方案项目): 运行记录 {
  const { 配置, 上下文, hashes } = 项目;
  const { 输入, 分析 } = 运行方案(上下文);
  const objective = 获取默认目标(配置.encoder);
  const [codes, metrics] = 本地编码评估(输入, objective);
  const record: 运行记录 = {
    formatVersion: 1,
    metadata: {
      algorithmVersion: packageInfo.version,
      libchaiVersion: packageInfo.dependencies.libchai,
      configHash: 内容哈希(规范序列化(配置)),
      dataHashes: hashes,
      scope: 配置.data?.character_set ?? "general",
      objective,
    },
    config: 配置,
    codes,
    metrics,
    analysis: 汇总拆分(分析),
  };
  // Rust 指标含 Map 和 undefined；统一为可往返的 JSON 数据。
  return JSON.parse(规范序列化(record)) as 运行记录;
}

export function 保存运行记录(目录: string, 记录: 运行记录, 项目: 本地方案项目) {
  if (existsSync(目录))
    throw new 方案错误([
      {
        code: "OUTPUT_EXISTS",
        path: 目录,
        message: "运行目录已存在，请使用新目录",
      },
    ]);
  保存方案项目(path.join(目录, "project"), 记录.config, 项目.buffers);
  writeFileSync(path.join(目录, "run.json"), JSON.stringify(记录, null, 2));
  writeFileSync(
    path.join(目录, "codes.tsv"),
    `${记录.codes.map((x) => [x.词, x.全码, x.全码排名, x.简码, x.简码排名].join("\t")).join("\n")}\n`,
  );
}

export function 读取运行记录(位置: string): 运行记录 {
  const file = statSync(位置).isDirectory()
    ? path.join(位置, "run.json")
    : 位置;
  const value = JSON.parse(readFileSync(file, "utf8"));
  if (
    value?.formatVersion !== 1 ||
    !是记录(value.metadata) ||
    typeof value.metadata.algorithmVersion !== "string" ||
    typeof value.metadata.libchaiVersion !== "string" ||
    typeof value.metadata.configHash !== "string" ||
    typeof value.metadata.scope !== "string" ||
    !是记录(value.metadata.dataHashes) ||
    !是记录(value.metadata.objective) ||
    !Array.isArray(value.codes) ||
    !Array.isArray(value.analysis) ||
    !是记录(value.metrics)
  )
    throw new 方案错误([
      { code: "INVALID_RUN", path: file, message: "不是支持的运行记录" },
    ]);
  return value;
}

export function 对比运行记录(before: 运行记录, after: 运行记录) {
  const reasons: string[] = [];
  for (const field of [
    "algorithmVersion",
    "libchaiVersion",
    "dataHashes",
    "scope",
    "objective",
  ] as const) {
    if (
      规范序列化(before.metadata[field]) !== 规范序列化(after.metadata[field])
    )
      reasons.push(field);
  }
  const group = <T>(entries: T[], key: (x: T) => string) => {
    const map = new Map<string, T[]>();
    for (const x of entries) map.set(key(x), [...(map.get(key(x)) ?? []), x]);
    return map;
  };
  const diff = <T>(a: Map<string, T[]>, b: Map<string, T[]>) =>
    [...new Set([...a.keys(), ...b.keys()])]
      .filter(
        (key) => 规范序列化(a.get(key) ?? []) !== 规范序列化(b.get(key) ?? []),
      )
      .map((word) => ({
        word,
        before: a.get(word) ?? [],
        after: b.get(word) ?? [],
      }));
  const metrics: {
    path: string;
    before: number | null;
    after: number | null;
    delta: number | null;
  }[] = [];
  const walk = (a: unknown, b: unknown, pointer: string) => {
    if ((typeof a === "number" || typeof b === "number") && a !== b)
      metrics.push({
        path: pointer,
        before: typeof a === "number" ? a : null,
        after: typeof b === "number" ? b : null,
        delta: typeof a === "number" && typeof b === "number" ? b - a : null,
      });
    else if (a && b && typeof a === "object" && typeof b === "object") {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)]))
        walk(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
          `${pointer}/${key}`,
        );
    }
  };
  if (!reasons.length) walk(before.metrics, after.metrics, "/metrics");
  return {
    comparable: reasons.length === 0,
    incompatibleFields: reasons,
    metrics,
    codes: diff(
      group(before.codes, (x) => x.词),
      group(after.codes, (x) => x.词),
    ),
    analysis: diff(
      group(before.analysis, (x) => x.character),
      group(after.analysis, (x) => x.character),
    ),
  };
}
