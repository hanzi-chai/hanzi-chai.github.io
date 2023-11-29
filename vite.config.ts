/// <reference types="vitest" />
import path from "node:path";
import type { UserConfig } from "vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import yaml from "@modyfi/vite-plugin-yaml";
import { importToCDN, autoComplete } from "vite-plugin-external-cdn";
import { visualizer } from "rollup-plugin-visualizer";
import Pages from "vite-plugin-pages";

export default defineConfig(({ mode }) => {
  // https://vitejs.dev/config/
  const sharedConfig: UserConfig = {
    resolve: {
      alias: {
        "~/": `${path.resolve(__dirname, "src")}/`,
      },
    },
    build: {
      chunkSizeWarningLimit: 700,
      outDir: `dist/${mode.toLowerCase()}`,
      emptyOutDir: true,
      reportCompressedSize: false,
      rollupOptions: {
        output: {
          manualChunks: manualChunksHandler,
        },
      },
    },
    define: {
      APP_VERSION: JSON.stringify(process.env.npm_package_version),
    },
    plugins: [react(), yaml(), Pages()],
    test: {
      globals: true,
      coverage: {
        enabled: true,
        provider: "v8",
        reporter: ["text", "html"],
      },
    },
  };

  if (mode === "BEX") {
    sharedConfig.plugins.push(
      visualizer({
        brotliSize: true,
        title: "打包产物分析",
        filename: "dist/visualizer.html",
      }),
    );
  }

  if (mode === "PAGES") {
    sharedConfig.plugins?.push(
      importToCDN({
        prodUrl: "https://registry.npmmirror.com/{name}/{version}/files/{path}",
        modules: [
          autoComplete("react"),
          autoComplete("react-dom"),
          {
            name: "js-yaml",
            var: "jsyaml",
            path: "dist/js-yaml.min.js",
          },
          {
            name: "decimal.js",
            var: "Decimal",
            path: "decimal.js",
          },
          {
            name: "mathjs",
            var: "math",
            path: "lib/browser/math.js",
          },
          {
            name: "dayjs",
            var: "dayjs",
            path: "dayjs.min.js",
          },
          {
            name: "antd",
            var: "antd",
            path: "dist/antd-with-locales.js",
          },
        ],
      }),
    );
  }

  return sharedConfig;
});

function manualChunksHandler(id: string) {
  const nodeModulesIndex = id.indexOf("node_modules/");
  if (nodeModulesIndex === -1) return;
  const modulePathName = id.slice(nodeModulesIndex + 13);
  /**
   * moduleName 大约是这样：
   *   mathjs
   *   antd
   */
  const moduleName = modulePathName.slice(0, modulePathName.indexOf("/"));

  const patterns = `
  rc- async-validator
  ant babel dayjs emotion toggle-selection @ctrl classnames csstype copy-to-clipboard
  mathjs underscore decimal fraction complex escape-latex seedrandom tiny-emitter typed-function
  dnd
  yaml
  reactflow dagrejs d3- zustand classcat
  redux
  react immer redux tslib scheduler
  `;
  for (let patternsLine of patterns.split("\n")) {
    patternsLine = patternsLine.trim();
    if (!patternsLine) continue;
    const line = patternsLine.split(" ");
    const ret = line[0];
    for (let pat of line) {
      pat = pat.trim();
      if (!pat) continue;
      if (moduleName.includes(pat)) return ret;
    }
  }
  return "vendor";
}
