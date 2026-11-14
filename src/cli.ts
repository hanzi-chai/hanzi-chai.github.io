#!/usr/bin/env node
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  保存运行记录,
  列出示例方案,
  获取示例方案路径,
  读取示例配置,
  内容哈希,
  分析方案,
  type 字集指示,
  字集过滤查找表,
  对比运行记录,
  按格式解析码表,
  方案结构Schema,
  方案错误,
  本地编码评估,
  校对码表,
  查询字符,
  汇总拆分,
  获取注册表,
  获取重码组,
  获取默认目标,
  规范序列化,
  码表格式列表,
  解释取码,
  解释拆分,
  评估方案项目,
  读取方案项目,
  读取运行记录,
  运行方案,
  默认数据目录,
} from "./index.js";

const 方案命令 = [
  "validate",
  "inspect",
  "analyze",
  "explain",
  "proofread",
  "build",
  "evaluate",
];
const 校对范围列表 = [
  "components",
  ...(Object.keys(字集过滤查找表) as 字集指示[]),
] as const;
const 校对方向列表 = ["forward", "reverse"] as const;
const 校对状态列表 = ["incorrect", "correct", "unknown", "all"] as const;

const help = `汉字方案命令行工具

chai evaluate <方案.yml> [--out <新运行目录>]
chai validate <方案.yml>
chai inspect <方案.yml> --text <汉字>
chai analyze <方案.yml> [--text <汉字>]
chai explain <方案.yml> --text <字词>
chai proofread <方案.yml> --reference <参考码表路径>
                         [--format <码表格式>] [--scope <字集>] [--direction forward|reverse]
                         [--status incorrect|correct|unknown|all]
chai build <方案.yml> --out <新运行目录>
chai inspect --components
chai compare <基线运行目录> <候选运行目录>
chai schema
chai examples [示例名称] [--out <新方案.yaml>]

examples 列出随包示例；指定名称可读取配置，--out 只导出一个 YAML 文件。
默认数据目录为 ${默认数据目录}
命令行路径相对于当前工作目录解析。
  --data-dir <目录>                 更换整套默认数据
  --characters <文件>               字符数据，默认 characters.json
  --glyphs <文件>                   字形数据，默认 glyphs.json
  --dictionary <文件>               词典，默认 dictionary.txt
  --distribution <文件>             键位分布，默认 distribution.txt
  --equivalence <文件>              当量映射，默认 equivalence.txt
  --custom-analysis <类别>=<文件>   自定义分析 TSV，可多次指定

查询支持 --limit（默认 20）和 --offset；--json 输出紧凑 JSON。
proofread 比对单字全码，默认正向、全部字集、仅列出错误。
  --format: ${码表格式列表.join(", ")}（默认 char_tab_code）
  --scope: ${校对范围列表.join(", ")}（默认 maximal）
指定 --out 时写入 run.json、codes.tsv 和完整输入快照 project/。
退出码：0 成功，1 配置或运行错误，2 命令参数错误。`;

function 参数错误(message: string): never {
  throw new 方案错误([
    { code: "INVALID_ARGUMENT", path: "/arguments", message },
  ]);
}

export function 执行命令(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      text: { type: "string" },
      out: { type: "string" },
      "data-dir": { type: "string" },
      characters: { type: "string" },
      glyphs: { type: "string" },
      dictionary: { type: "string" },
      distribution: { type: "string" },
      equivalence: { type: "string" },
      "custom-analysis": { type: "string", multiple: true },
      reference: { type: "string" },
      format: { type: "string" },
      scope: { type: "string" },
      direction: { type: "string" },
      status: { type: "string" },
      limit: { type: "string", default: "20" },
      offset: { type: "string", default: "0" },
      json: { type: "boolean" },
      help: { type: "boolean", short: "h" },
      components: { type: "boolean" },
    },
  });
  const [command, target, ...rest] = positionals;
  if (values.help || !command || command === "help") return help;
  const limit = Number(values.limit),
    offset = Number(values.offset);
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 1000 ||
    !Number.isInteger(offset) ||
    offset < 0
  )
    参数错误("limit 必须为 1–1000 的整数，offset 必须为非负整数");
  const page = <T>(entries: T[]) => ({
    total: entries.length,
    offset,
    limit,
    items: entries.slice(offset, offset + limit),
  });
  if (command === "examples") {
    if (rest.length) 参数错误("examples 最多接收一个示例名称");
    if (!target) {
      if (values.out) 参数错误("导出示例时必须指定示例名称");
      return { examples: 列出示例方案() };
    }
    const config = 读取示例配置(target);
    if (values.out) {
      try {
        writeFileSync(values.out, readFileSync(获取示例方案路径(target)), {
          flag: "wx",
        });
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "EEXIST"
        ) {
          throw new 方案错误([
            {
              code: "OUTPUT_EXISTS",
              path: values.out,
              message: "目标文件已存在",
            },
          ]);
        }
        throw error;
      }
      return { id: target, output: path.resolve(values.out) };
    }
    return { id: target, config };
  }
  if (command === "schema") return 方案结构Schema;
  if (command === "compare") {
    if (!target || rest.length !== 1)
      参数错误("compare 需要两个运行目录或 run.json 路径");
    const result = 对比运行记录(读取运行记录(target), 读取运行记录(rest[0]!));
    return {
      ...result,
      metrics: page(result.metrics),
      codes: page(result.codes),
      analysis: page(result.analysis),
    };
  }
  if (command === "inspect" && values.components) {
    if (target !== undefined) 参数错误("inspect --components 不接收位置参数");
    const r = 获取注册表();
    return {
      componentAnalyzers: [...r.部件分析器映射.keys()],
      compoundAnalyzers: [...r.复合体分析器映射.keys()],
      assemblers: [...r.组装器映射.keys()],
      selectors: [...r.筛选器映射.keys()],
      pinyinAnalyzers: [...r.拼音分析器映射.keys()],
    };
  }
  if (rest.length) 参数错误(`多余的位置参数：${rest.join(" ")}`);
  if (!方案命令.includes(command)) 参数错误(`未知命令：${command}`);
  const 方案文件 = target;
  if (!方案文件) 参数错误(`${command} 需要方案 YAML 路径`);
  if (["inspect", "explain"].includes(command) && !values.text)
    参数错误(`${command} 需要 --text`);
  if (command === "build" && !values.out)
    参数错误("build 需要 --out（码表写入运行目录中的 codes.tsv）");
  const customAnalysis = Object.fromEntries(
    (values["custom-analysis"] ?? []).map((value) => {
      const separator = value.indexOf("=");
      if (separator < 1 || separator === value.length - 1)
        参数错误("--custom-analysis 需要 <类别>=<文件>");
      return [value.slice(0, separator), value.slice(separator + 1)];
    }),
  );
  const 读取方案 = () =>
    读取方案项目(方案文件, {
      directory: values["data-dir"],
      characters: values.characters,
      glyphs: values.glyphs,
      dictionary: values.dictionary,
      distribution: values.distribution,
      equivalence: values.equivalence,
      customAnalysis,
    });
  if (command === "proofread") {
    if (!values.reference) 参数错误("proofread 需要 --reference");
    const 选项 = <T extends string>(
      名称: string,
      值: string,
      可选值: readonly T[],
    ) =>
      可选值.find((x) => x === 值) ??
      参数错误(`--${名称} 必须是以下之一：${可选值.join(", ")}`);
    const format = 选项(
      "format",
      values.format ?? "char_tab_code",
      码表格式列表,
    );
    const scope = 选项("scope", values.scope ?? "maximal", 校对范围列表);
    const direction = 选项(
      "direction",
      values.direction ?? "forward",
      校对方向列表,
    );
    const status = 选项("status", values.status ?? "incorrect", 校对状态列表);

    const 参考码表 = 按格式解析码表(
      readFileSync(values.reference, "utf8"),
      format,
    );
    const { 上下文, 配置 } = 读取方案();
    const { 输入, 词列表 } = 运行方案(上下文);
    const [编码结果] = 本地编码评估(输入, 获取默认目标(配置.encoder));
    const 系统码表 = 编码结果.map(({ 词, 全码 }, i) => {
      const 组装 = 词列表[i];
      return {
        词,
        编码: 全码,
        元素序列: 组装?.词 === 词 ? 组装.全部元素序列 : [],
      };
    });
    const { 条目, 统计, 准确率 } = 校对码表(系统码表, 参考码表, {
      字库: 上下文.字库,
      汉字集合: 上下文.汉字集合,
      范围: scope,
      方向: direction,
    });
    return {
      direction,
      scope,
      status,
      summary: 统计,
      accuracy: 准确率,
      entries: page(
        status === "all" ? 条目 : 条目.filter((x) => x.状态 === status),
      ),
    };
  }
  const 项目 = 读取方案();
  const { 上下文 } = 项目;
  if (command === "inspect")
    return { characters: page(查询字符(上下文, values.text!)) };
  if (command === "analyze") {
    const chars = values.text
      ? new Set(
          [...values.text]
            .map((x) => 上下文.字库.校验字符(x)?.character)
            .filter((x) => x !== undefined),
        )
      : undefined;
    const analysis = 分析方案(上下文, chars);
    return {
      dynamic: analysis.dynamic,
      characters: page(汇总拆分(analysis)),
      missing: values.text
        ? 查询字符(上下文, values.text)
            .filter((x) => !x.found)
            .map((x) => x.character)
        : [],
    };
  }
  if (command === "explain") {
    const explanation = 解释拆分(上下文, values.text!, limit, offset);
    const { 输入, 词列表, 分析 } = 运行方案(上下文);
    const [codes] = 本地编码评估(输入, 获取默认目标(项目.配置.encoder));
    const words = new Set([values.text!, ...values.text!]);
    return {
      ...explanation,
      trace: 解释取码(上下文, 分析, values.text!, limit),
      assembly: page(词列表.filter((x) => words.has(x.词))),
      codes: page(codes.filter((x) => words.has(x.词))),
      scope: 项目.配置.data?.character_set ?? "general",
    };
  }
  // 执行完整链路，以发现实际拆分、取码和引擎同步时才出现的错误。
  if (command === "validate") {
    const { 词列表, 输入 } = 运行方案(上下文);
    本地编码评估(输入, 获取默认目标(项目.配置.encoder));
    return {
      valid: true,
      configHash: 内容哈希(规范序列化(项目.配置)),
      dataHashes: 项目.hashes,
      characters: 上下文.汉字集合.size,
      entries: 词列表.length,
    };
  }
  const result = 评估方案项目(项目);
  if (values.out) 保存运行记录(values.out, result, 项目);
  return {
    metadata: result.metadata,
    entries: result.codes.length,
    metrics: result.metrics,
    collisions: page(获取重码组(result.codes)),
    shortCollisions: page(获取重码组(result.codes, true)),
    output: values.out ? path.resolve(values.out) : undefined,
  };
}

export function 命令行主程序(args = process.argv.slice(2)) {
  try {
    const result = 执行命令(args);
    process.stdout.write(
      typeof result === "string"
        ? `${result}\n`
        : `${JSON.stringify({ formatVersion: 1, ok: true, result }, null, args.includes("--json") ? undefined : 2)}\n`,
    );
    return 0;
  } catch (error) {
    const diagnostics =
      error instanceof 方案错误
        ? error.diagnostics
        : [
            {
              code: "IO_OR_RUNTIME_ERROR",
              path: "/",
              message: error instanceof Error ? error.message : String(error),
            },
          ];
    process.stdout.write(
      `${JSON.stringify({ formatVersion: 1, ok: false, diagnostics })}\n`,
    );
    const argumentError =
      diagnostics.some((x) => x.code === "INVALID_ARGUMENT") ||
      (error instanceof Error &&
        "code" in error &&
        String(error.code).startsWith("ERR_PARSE_ARGS"));
    return argumentError ? 2 : 1;
  }
}

if (
  process.argv[1] &&
  existsSync(process.argv[1]) &&
  realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])
) {
  process.exitCode = 命令行主程序();
}
