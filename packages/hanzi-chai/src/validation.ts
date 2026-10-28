import { 字集指示列表, 运算符列表, type 配置 } from "./config.js";
import { 获取注册表 } from "./registry.js";
import { 解析自定义拆分部件 } from "./utils.js";
import { type 方案上下文, type 方案诊断, 方案错误 } from "./scheme.js";

export const 是记录 = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const 指针 = (x: string) => x.replaceAll("~", "~0").replaceAll("/", "~1");

/** 检查进入算法前必需的结构；Rust 配置校验由 Node 入口另行执行。 */
export function 校验配置结构(value: unknown): asserts value is 配置 {
  const errors: 方案诊断[] = [];
  const fail = (path: string, message: string) =>
    errors.push({ code: "INVALID_CONFIG", path, message });
  if (!是记录(value))
    throw new 方案错误([
      { code: "INVALID_CONFIG", path: "/", message: "方案必须是对象" },
    ]);
  if (value.source !== null && typeof value.source !== "string")
    fail("/source", "必须是字符串或 null");
  if (!是记录(value.form) || !是记录(value.form.mapping))
    fail("/form/mapping", "必须是元素到键位安排的映射");
  else {
    for (const [name, arrangement] of Object.entries(value.form.mapping)) {
      const reference = (x: unknown) =>
        是记录(x) && typeof x.element === "string";
      const valid =
        typeof arrangement === "string" ||
        reference(arrangement) ||
        (Array.isArray(arrangement) &&
          arrangement.every(
            (x) =>
              typeof x === "string" ||
              (reference(x) && 是记录(x) && Number.isInteger(x.index)),
          ));
      if (!valid)
        fail(
          `/form/mapping/${指针(name)}`,
          "必须是编码字符串、元素位列表或 {element: 元素名称}；可选字根的空值请放在 mapping_space 中",
        );
    }
  }
  if (!是记录(value.encoder)) fail("/encoder", "必须提供编码配置");
  else {
    if (
      !Number.isInteger(value.encoder.max_length) ||
      Number(value.encoder.max_length) < 1 ||
      Number(value.encoder.max_length) > 32
    )
      fail("/encoder/max_length", "必须是 1 到 32 之间的整数");
    for (const field of ["sources", "conditions"]) {
      if (!是记录(value.encoder[field]))
        fail(`/encoder/${field}`, "必须是节点映射");
    }
  }
  for (const field of [
    "analysis",
    "data",
    "algebra",
    "optimization",
    "info",
    "diagram",
  ]) {
    if (value[field] !== undefined && !是记录(value[field]))
      fail(`/${field}`, "必须是对象");
  }
  if (
    是记录(value.data) &&
    value.data.character_set !== undefined &&
    !字集指示列表.includes(value.data.character_set as never)
  )
    fail("/data/character_set", `必须是 ${字集指示列表.join("、")} 之一`);
  if (
    是记录(value.analysis) &&
    value.analysis.selector !== undefined &&
    (!Array.isArray(value.analysis.selector) ||
      !value.analysis.selector.every((x: unknown) => typeof x === "string"))
  )
    fail("/analysis/selector", "必须是筛选器名称列表");
  if (errors.length) throw new 方案错误(errors);
}

/** 检查算法原来会忽略的组件名称，以及可能让取码器循环的节点引用。 */
export function 检查配置引用(配置: 配置): 方案诊断[] {
  const errors: 方案诊断[] = [];
  const fail = (path: string, message: string) =>
    errors.push({ code: "INVALID_REFERENCE", path, message });
  const registry = 获取注册表();
  for (const [path, name, names] of [
    [
      "/analysis/component_analyzer",
      配置.analysis?.component_analyzer,
      registry.部件分析器映射,
    ],
    [
      "/analysis/compound_analyzer",
      配置.analysis?.compound_analyzer,
      registry.复合体分析器映射,
    ],
    ["/encoder/assembler", 配置.encoder.assembler, registry.组装器映射],
  ] as const) {
    if (name !== undefined && !names.has(name))
      fail(path, `未注册的组件：${name}`);
  }
  配置.analysis?.selector?.forEach((name, i) => {
    if (!registry.筛选器映射.has(name))
      fail(`/analysis/selector/${i}`, `未注册的筛选器：${name}`);
  });
  const { sources, conditions } = 配置.encoder;
  if (!sources.s0) fail("/encoder/sources/s0", "缺少取码起始节点");
  const graph = new Map<string, (string | null)[]>();
  for (const [id, node] of Object.entries(sources)) {
    if (!id.startsWith("s"))
      fail(`/encoder/sources/${指针(id)}`, "源节点 ID 必须以 s 开头");
    if (
      !是记录(node) ||
      !(node.next === null || typeof node.next === "string")
    ) {
      fail(
        `/encoder/sources/${指针(id)}`,
        "节点必须提供 next（节点 ID 或 null）",
      );
      continue;
    }
    graph.set(id, [node.next]);
  }
  for (const [id, node] of Object.entries(conditions)) {
    if (id.startsWith("s"))
      fail(`/encoder/conditions/${指针(id)}`, "条件节点 ID 不能以 s 开头");
    if (
      !是记录(node) ||
      !(node.positive === null || typeof node.positive === "string") ||
      !(node.negative === null || typeof node.negative === "string") ||
      !运算符列表.includes(node.operator)
    ) {
      fail(`/encoder/conditions/${指针(id)}`, "条件节点的分支或运算符无效");
      continue;
    }
    graph.set(id, [node.positive, node.negative]);
  }
  const done = new Set<string>();
  const visiting = new Set<string>();
  const visit = (id: string) => {
    const path = `/encoder/${id.startsWith("s") ? "sources" : "conditions"}/${指针(id)}`;
    if (visiting.has(id)) {
      fail(path, "取码节点存在循环引用");
      return;
    }
    if (done.has(id)) return;
    if (!graph.has(id)) {
      fail(path, `节点不存在：${id}`);
      return;
    }
    visiting.add(id);
    for (const next of graph.get(id)!) if (next !== null) visit(next);
    visiting.delete(id);
    done.add(id);
  };
  for (const id of graph.keys()) visit(id);
  return errors;
}

export function 检查方案元素(上下文: 方案上下文): 方案诊断[] {
  const errors: 方案诊断[] = [];
  const { 配置, 名称映射, 字库 } = 上下文;
  const 编码长度 = new Map(
    [...上下文.线性化决策].map(([element, code]) => [
      element.获取名称(),
      code.length,
    ]),
  );
  for (const [name, value] of Object.entries(配置.form.mapping)) {
    const refs =
      typeof value === "string"
        ? []
        : Array.isArray(value)
          ? value.filter((x) => typeof x !== "string")
          : [value];
    for (const ref of refs) {
      const path = `/form/mapping/${指针(name)}`;
      if (!(ref.element in 配置.form.mapping))
        errors.push({
          code: "UNKNOWN_ELEMENT",
          path,
          message: `引用的元素没有键位安排：${ref.element}`,
        });
      if (
        "index" in ref &&
        (typeof ref.index !== "number" ||
          !Number.isInteger(ref.index) ||
          ref.index < 0)
      )
        errors.push({
          code: "INVALID_REFERENCE",
          path,
          message: "元素位索引必须是非负整数",
        });
      else if (
        "index" in ref &&
        typeof ref.index === "number" &&
        ref.index >= (编码长度.get(ref.element) ?? 0)
      )
        errors.push({
          code: "INVALID_REFERENCE",
          path,
          message: `引用的元素位超出编码长度：${ref.element}.${ref.index}`,
        });
    }
  }
  for (const field of ["strong", "weak"] as const) {
    for (const [i, name] of (配置.analysis?.[field] ?? []).entries()) {
      if (!名称映射.has(name))
        errors.push({
          code: "UNKNOWN_ELEMENT",
          path: `/analysis/${field}/${i}`,
          message: `不存在的字根：${name}`,
        });
    }
  }
  for (const field of ["customize", "dynamic_customize"] as const) {
    for (const [id, roots] of Object.entries(配置.analysis?.[field] ?? {})) {
      const path = `/analysis/${field}/${指针(id)}`;
      if (解析自定义拆分部件(字库, 名称映射, id).length === 0)
        errors.push({
          code: "UNKNOWN_GLYPH",
          path,
          message: 名称映射.has(id)
            ? "该元素没有当前方案可自定义的部件字形；复合体暂不支持自定义拆分"
            : "无法识别自定义拆分目标：请使用字符或部件字形名称（如 字形-123），也兼容裸数字字形 ID",
        });
      for (const root of roots.flat()) {
        if (!名称映射.has(root))
          errors.push({
            code: "UNKNOWN_ELEMENT",
            path,
            message: `不存在的字根：${root}`,
          });
      }
    }
  }
  return errors;
}

/** 基础结构 Schema；语义、图引用及完整 Rust 类型检查请使用 validate。 */
export const 方案结构Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "汉字自动拆分方案（基础结构）",
  type: "object",
  required: ["source", "form", "encoder"],
  properties: {
    version: { type: "string" },
    source: { type: ["string", "null"] },
    info: { type: "object" },
    data: {
      type: "object",
      properties: {
        character_set: { enum: 字集指示列表 },
        glyph_sources: { type: "array", items: { type: "string" } },
      },
    },
    analysis: {
      type: "object",
      properties: {
        dynamic: { type: "boolean" },
        selector: { type: "array", items: { type: "string" } },
        component_analyzer: { type: "string" },
        compound_analyzer: { type: "string" },
        customize: {
          type: "object",
          description: "键为字符或部件字形名称（字形-ID），兼容裸数字 ID",
          additionalProperties: { type: "array", items: { type: "string" } },
        },
        dynamic_customize: {
          type: "object",
          description: "键与 customize 相同，值为按优先级排列的拆分列表",
          additionalProperties: {
            type: "array",
            items: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
    algebra: { type: "object" },
    form: {
      type: "object",
      required: ["mapping"],
      properties: {
        alphabet: { type: "string" },
        mapping: { type: "object" },
        mapping_space: { type: "object" },
      },
    },
    encoder: {
      type: "object",
      required: ["max_length", "sources", "conditions"],
      properties: {
        max_length: { type: "integer", minimum: 1, maximum: 32 },
        sources: { type: "object" },
        conditions: { type: "object" },
      },
    },
    optimization: { type: "object" },
    diagram: { type: "object" },
  },
} as const;
