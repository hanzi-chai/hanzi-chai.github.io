/// <reference types="vitest" />
import path from "node:path";
import { defineConfig, type UserConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import yaml from "@modyfi/vite-plugin-yaml";
import Pages from "vite-plugin-pages";
import wasm from "vite-plugin-wasm";
import { visualizer } from "rollup-plugin-visualizer";
import { chunkSplitPlugin } from "vite-plugin-chunk-split";

// vite.config.js

const wasmContentTypePlugin = {
  name: "wasm-content-type-plugin",
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      if (req.url.endsWith(".wasm")) {
        res.setHeader("Content-Type", "application/wasm");
      }
      next();
    });
  },
};

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
        treeshake: {
          moduleSideEffects: "no-external",
        },
      },
    },
    esbuild: {
      supported: {
        "top-level-await": true,
      },
    },
    define: {
      APP_VERSION: JSON.stringify(process.env.npm_package_version),
    },
    optimizeDeps: {
      exclude: ["libchai"],
    },
    plugins: [
      wasmContentTypePlugin,
      react({
        // plugins: [["@swc-jotai/react-refresh", {}]],
      }),
      wasm(),
      yaml(),
      Pages({
        importMode: "async",
      }),
      chunkSplitPlugin({
        customSplitting: {
          lodash: [/node_modules\/lodash/],
          antd: [/node_modules\/antd/],
          router: [/node_modules\/react-router/],
          react: [/node_modules\/react(-dom)?\//],
          immer: [/node_modules\/immer/],
          mathjs: [/node_modules\/mathjs/],
          yaml: [/node_modules\/js-yaml/],
          reactflow: [/node_modules\/@reactflow/],
          chart: [/node_modules\/@ant-design/],
          antv: [/node_modules\/@antv/],
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
    worker: {
      format: "es",
    },
  };

  switch (mode) {
    case "CF":
      break;
    case "BEX":
      sharedConfig.plugins?.push(
        visualizer({
          brotliSize: true,
          title: "打包产物分析",
          filename: "dist/visualizer.html",
        }) as PluginOption,
      );
      break;
    case "PAGES":
      break;
  }
  return sharedConfig;
});
