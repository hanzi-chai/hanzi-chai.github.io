import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";
import { getLocalDataPath, webDataFiles } from "../scripts/data-path";

/** 开发时直接读取核心包数据，构建时才将网页所需文件写入 dist。 */
export function localDataPlugin(): Plugin {
  const prefix = "/data/";
  return {
    name: "local-data",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split("?")[0] ?? "";
        if (!pathname.startsWith("/data/")) return next();
        const filename = pathname.slice(prefix.length);
        if (!webDataFiles.some((file) => file === filename)) {
          res.statusCode = 404;
          res.end("未知数据文件");
          return;
        }
        if (req.method !== "GET" && req.method !== "HEAD") {
          res.statusCode = 405;
          res.setHeader("Allow", "GET, HEAD");
          res.end();
          return;
        }
        void readFile(path.join(getLocalDataPath(), filename)).then(
          (bytes) => {
            res.setHeader("Cache-Control", "no-store");
            res.setHeader(
              "Content-Type",
              filename.endsWith(".json")
                ? "application/json; charset=utf-8"
                : "text/plain; charset=utf-8",
            );
            res.setHeader("Content-Length", bytes.length);
            res.end(req.method === "HEAD" ? undefined : bytes);
          },
          (error: NodeJS.ErrnoException) => {
            if (error.code !== "ENOENT") return next(error);
            res.statusCode = 404;
            res.end(`缺少 ${filename}，请先运行 bun run fetch`);
          },
        );
      });
    },
    async generateBundle() {
      for (const file of webDataFiles) {
        const source = path.join(getLocalDataPath(), file);
        this.addWatchFile(source);
        this.emitFile({
          type: "asset",
          fileName: `data/${file}`,
          source: await readFile(source),
        });
      }
    },
  };
}
