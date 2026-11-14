import { existsSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dataDirectory, dataSources, validateData } from "./assets.js";

// 仅维护者执行；安装发布包不运行脚本，也不访问数据服务器。
export async function fetchDataFiles(directory = dataDirectory) {
  const buffers = Object.fromEntries(
    await Promise.all(
      Object.entries(dataSources).map(
        async ([file, source]): Promise<[string, Buffer]> => {
          const response = await fetch(source, {
            signal: AbortSignal.timeout(120_000),
          });
          if (!response.ok)
            throw new Error(`${source}: HTTP ${response.status}`);
          const bytes = Buffer.from(await response.arrayBuffer());
          validateData(file, bytes);
          return [file, bytes];
        },
      ),
    ),
  );
  // 所有下载和格式检查成功后才写入，避免发布部分更新的数据。
  mkdirSync(directory, { recursive: true });
  for (const [file, bytes] of Object.entries(buffers)) {
    writeFileSync(new URL(file, directory), bytes);
  }
  return buffers;
}

if (
  process.argv[1] &&
  existsSync(process.argv[1]) &&
  realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])
) {
  const buffers = await fetchDataFiles();
  console.log(`已准备 ${Object.keys(buffers).length} 份运行数据`);
}
