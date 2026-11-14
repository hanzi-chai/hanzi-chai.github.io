import { fileURLToPath } from "node:url";

/** 前端、Node 算法和开发核验共用的唯一开发数据目录。 */
export function getLocalDataPath(): string {
  return fileURLToPath(new URL("../data/", import.meta.url));
}

/** 网页启动所需的数据；其余文件只供算法包或开发核验使用。 */
export const webDataFiles = [
  "characters.json",
  "glyphs.json",
  "dictionary.txt",
  "distribution.txt",
  "equivalence.txt",
  "gf0014.txt",
] as const;
