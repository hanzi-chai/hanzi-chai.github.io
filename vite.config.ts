/// <reference types="vitest" />
import path from "node:path";
import type { UserConfig } from "vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import yaml from "@modyfi/vite-plugin-yaml";
import Pages from "vite-plugin-pages";
import wasmpack from "vite-plugin-wasm-pack";
import { visualizer } from "rollup-plugin-visualizer";
import { chunkSplitPlugin } from "vite-plugin-chunk-split";
import { importToCDN, autoComplete } from "vite-plugin-external-cdn";

export default defineConfig(({ mode }) => {
  // https://vitejs.dev/config/
  const sharedConfig: UserConfig = {
    resolve: {
      alias: {
        "~/": `${path.resolve(__dirname, "src")}/`,
      },
    },
    optimizeDeps: {
      exclude: ["libchai"],
    },
    build: {
      chunkSizeWarningLimit: 700,
      outDir: `dist/${mode.toLowerCase()}`,
      emptyOutDir: true,
      reportCompressedSize: false,
    },
    define: {
      APP_VERSION: JSON.stringify(process.env.npm_package_version),
    },
    plugins: [
      react({
        // plugins: [["@swc-jotai/react-refresh", {}]],
      }),
      // wasmpack("./libchai"),
      yaml(),
      Pages({
        importMode: "async",
      }),
      chunkSplitPlugin({
        customSplitting: {
          antd: [/node_modules\/antd/],
          router: [/node_modules\/react-router/],
          react: [/node_modules\/react(-dom)?\//],
          "redux-immer": [
            /node_modules\/@?(react-)?redux/,
            /node_modules\/immer/,
          ],
          mathjs: [/node_modules\/mathjs/],
          yaml: [/node_modules\/js-yaml/],
          reactflow: [/node_modules\/@reactflow/],
          tools: [/node_modules\/styled-components/, /node_modules\/js-md5/],
        },
      }),
    ],
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
