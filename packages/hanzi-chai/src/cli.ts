#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  保存运行记录,
  内容哈希,
  分析方案,
  初始化方案项目,
  对比运行记录,
  方案结构Schema,
  方案错误,
  本地编码评估,
  查询字符,
  汇总拆分,
  获取注册表,
  获取重码组,
  获取默认目标,
  规范序列化,
  解释取码,
  解释拆分,
  评估方案项目,
  读取方案项目,
  读取运行记录,
  运行方案,
} from "./index.js";

const help = `汉字方案命令行工具

chai init --dir <新目录> [--example <示例名称或 YAML 路径>]
chai validate --project <目录或 YAML> [--json]
chai inspect --project <目录或 YAML> --text <汉字>
chai inspect --components
chai analyze --project <目录或 YAML> [--text <汉字>]
chai explain --project <目录或 YAML> --text <字词>
chai build --project <目录或 YAML> --out <新运行目录>
chai evaluate --project <目录或 YAML> [--out <新运行目录>]
chai compare <基线运行目录> <候选运行目录>
chai schema

查询支持 --limit（默认 20）和 --offset；--json 输出紧凑 JSON。
build/evaluate 写入 run.json、codes.tsv 和完整输入快照 project/。
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
      project: { type: "string" },
      text: { type: "string" },
      out: { type: "string" },
      dir: { type: "string" },
      example: { type: "string" },
      limit: { type: "string", default: "20" },
      offset: { type: "string", default: "0" },
      json: { type: "boolean" },
      help: { type: "boolean", short: "h" },
      components: { type: "boolean" },
    },
  });
  const [command, ...rest] = positionals;
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
  if (command === "schema") return 方案结构Schema;
  if (command === "init") {
    if (!values.dir) 参数错误("init 需要 --dir");
    return { project: 初始化方案项目(values.dir, values.example) };
  }
  if (command === "compare") {
    if (rest.length !== 2) 参数错误("compare 需要两个运行目录或 run.json 路径");
    const result = 对比运行记录(读取运行记录(rest[0]!), 读取运行记录(rest[1]!));
    return {
      ...result,
      metrics: page(result.metrics),
      codes: page(result.codes),
      analysis: page(result.analysis),
    };
  }
  if (rest.length) 参数错误(`多余的位置参数：${rest.join(" ")}`);
  if (command === "inspect" && values.components) {
    const r = 获取注册表();
    return {
      componentAnalyzers: [...r.部件分析器映射.keys()],
      compoundAnalyzers: [...r.复合体分析器映射.keys()],
      assemblers: [...r.组装器映射.keys()],
      selectors: [...r.筛选器映射.keys()],
      pinyinAnalyzers: [...r.拼音分析器映射.keys()],
    };
  }
  if (
    ![
      "validate",
      "inspect",
      "analyze",
      "explain",
      "build",
      "evaluate",
    ].includes(command)
  )
    参数错误(`未知命令：${command}`);
  if (["inspect", "explain"].includes(command) && !values.text)
    参数错误(`${command} 需要 --text`);
  if (command === "build" && !values.out)
    参数错误("build 需要 --out（码表写入运行目录中的 codes.tsv）");
  const 项目 = 读取方案项目(values.project ?? ".");
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
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  process.exitCode = 命令行主程序();
}
