import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const packageRoot = new URL("../", import.meta.url);
export const dataDirectory = new URL("data/", packageRoot);
export const dataSources = {
  "characters.json": "https://api.chaifen.app/characters",
  "glyphs.json": "https://api.chaifen.app/glyphs",
  "dictionary.txt": "https://assets.chaifen.app/dictionary.txt",
  "distribution.txt": "https://assets.chaifen.app/distribution.txt",
  "equivalence.txt": "https://assets.chaifen.app/equivalence.txt",
};

/** 发布必需文件不能沿用下载失败时的空文件或错误响应。 */
export type DataFilename = keyof typeof dataSources;

export function validateData(filename: string, bytes: Buffer): void {
  const fail = (): never => {
    throw new Error(`数据格式无效：${filename}`);
  };
  if (filename.endsWith(".json")) {
    const records = JSON.parse(bytes.toString("utf8"));
    if (!Array.isArray(records) || records.length === 0) fail();
    const characters = filename === "characters.json";
    const ids = new Set<number>();
    for (const record of records) {
      const id = record?.[characters ? "unicode" : "id"];
      if (!Number.isSafeInteger(id) || ids.has(id)) fail();
      ids.add(id);
      if (characters) {
        if (!Array.isArray(record.glyphs)) fail();
      } else if (
        !["component", "compound"].includes(record.type) ||
        !Array.isArray(
          record.type === "component" ? record.strokes : record.references,
        )
      ) {
        fail();
      }
    }
  } else {
    const text = bytes.toString("utf8").trim();
    if (!text) fail();
    const columns =
      filename === "distribution.txt"
        ? 4
        : filename === "dictionary.txt"
          ? 3
          : 2;
    for (const line of text.split(/\r?\n/)) {
      const fields = line.split("\t");
      if (fields.length !== columns || !fields[0]) fail();
      const numbers =
        filename === "dictionary.txt" ? fields.slice(2) : fields.slice(1);
      if (numbers.some((x) => !x.trim() || !Number.isFinite(Number(x)))) fail();
    }
  }
}

export function readDataFiles(directory = dataDirectory) {
  const buffers = Object.fromEntries(
    (Object.keys(dataSources) as DataFilename[]).map((file) => {
      const url = new URL(file, directory);
      let bytes: Buffer;
      try {
        bytes = readFileSync(url);
      } catch (cause) {
        throw new Error(
          `缺少必需数据 ${fileURLToPath(url)}；请先运行 npm run fetch:data`,
          { cause },
        );
      }
      validateData(file, bytes);
      return [file, bytes];
    }),
  ) as Record<DataFilename, Buffer>;
  return { buffers };
}
