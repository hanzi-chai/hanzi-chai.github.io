import { expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";
import ts from "typescript";

it("内置 YAML 完整符合当前配置类型，不包含被运行时忽略的旧字段", () => {
  const 目录 = new URL("../../examples/", import.meta.url);
  const 文件列表 = readdirSync(目录)
    .filter((name) => name.endsWith(".yaml"))
    .sort();
  const 虚拟文件 = fileURLToPath(
    new URL("../../src/__example_contract__.ts", import.meta.url),
  );
  // JSON 不保存 undefined；允许省略类型中值为 undefined 的字段，保留其余严格约束。
  const 源码 = `import type { 配置 } from "./config.js";
type JSON类型<T> = T extends readonly unknown[]
  ? { [K in keyof T]: JSON类型<T[K]> }
  : T extends object
    ? { [K in keyof T as undefined extends T[K] ? never : K]: JSON类型<T[K]> }
      & { [K in keyof T as undefined extends T[K] ? K : never]?: JSON类型<Exclude<T[K], undefined>> }
    : T;
${文件列表.map((name, index) => `const 方案${index} = ${JSON.stringify(load(readFileSync(new URL(name, 目录), "utf8")))} satisfies JSON类型<配置>;`).join("\n")}`;
  const 选项: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.Preserve,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    resolveJsonModule: true,
    allowImportingTsExtensions: true,
    types: [],
  };
  const host = ts.createCompilerHost(选项);
  const 原始获取 = host.getSourceFile;
  host.getSourceFile = (file, languageVersion, ...args) =>
    file === 虚拟文件
      ? ts.createSourceFile(file, 源码, languageVersion, true)
      : 原始获取(file, languageVersion, ...args);
  const program = ts.createProgram([虚拟文件], 选项, host);
  const 错误 = ts
    .getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.file?.fileName === 虚拟文件)
    .map((diagnostic) => {
      const 行号 = diagnostic.file!.getLineAndCharacterOfPosition(
        diagnostic.start!,
      ).line;
      const 方案行 = 源码.split("\n")[行号]?.match(/^const 方案(\d+)/);
      return {
        file: 方案行 ? 文件列表[Number(方案行[1])] : 虚拟文件,
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      };
    });
  expect(错误).toEqual([]);
}, 30_000);
