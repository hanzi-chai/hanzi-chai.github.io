import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const UNICODE_VERSION = "18.0.0";
export const UNIHAN_URL = `https://www.unicode.org/Public/${UNICODE_VERSION}/ucd/Unihan.zip`;
export const CJK_CHART_URL = `https://www.unicode.org/Public/${UNICODE_VERSION}/charts/PDF/U4E00.pdf`;

/** Unihan 官方按 ZIP 发布；unzip 是此下载步骤唯一额外的系统依赖。 */
export async function fetchIRGSources() {
  const response = await fetch(UNIHAN_URL);
  if (!response.ok) throw new Error(`Unihan 下载失败：${response.status}`);
  const dir = mkdtempSync(join(tmpdir(), "chai-unihan-"));
  try {
    const archive = join(dir, "Unihan.zip");
    const output = join(dir, "Unihan_IRGSources.txt");
    writeFileSync(archive, new Uint8Array(await response.arrayBuffer()));
    const result = spawnSync(
      "unzip",
      ["-p", archive, "Unihan_IRGSources.txt"],
      {
        maxBuffer: 64 * 1024 * 1024,
      },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(result.stderr.toString());
    writeFileSync(output, result.stdout);
    const text = readFileSync(output, "utf8");
    if (!text.includes(`# Unicode Version ${UNICODE_VERSION}\n`)) {
      throw new Error("IRGSources 的 Unicode 版本与固定版本不一致");
    }
    return text;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
