import path from "node:path";
import { defineConfig, type UserConfig, type PluginOption } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import yaml from "@modyfi/vite-plugin-yaml";
import Pages from "vite-plugin-pages";
import wasm from "vite-plugin-wasm";
import { visualizer } from "rollup-plugin-visualizer";
import mdx from "@mdx-js/rollup";
import packageJson from "../package.json";
import tsconfig from "./tsconfig.json";
import { localDataPlugin } from "./vite-data";

const APP_VERSION = packageJson.version;

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

export default defineConfig(({ mode, command }) => {
  const isDev = command === "serve";
  // https://vitejs.dev/config/
  const sharedConfig: UserConfig = {
    resolve: {
      alias: Object.entries(tsconfig.compilerOptions.paths)
        .filter(([alias]) => isDev || !alias.startsWith("hanzi-chai"))
        .map(([alias, targets]) => ({
          find: new RegExp(
            `^${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace("\\*", "(.+)")}$`,
          ),
          replacement: path.resolve(__dirname, targets[0]!.replace("*", "$1")),
        })),
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
        output: {
          manualChunks: (id) => {
            if (id.includes("lodash")) return "lodash";
            if (id.includes("js-yaml")) return "yaml";
            if (id.includes("js-md5")) return "md5";
            if (id.includes("@xyflow")) return "xyflow";
            if (id.includes("antd")) return "antd";
            if (id.includes("@antv/g2")) return "g2";
            if (id.includes("@antv/g")) return "g";
            if (
              id.includes("node_modules/react") ||
              id.includes("node_modules/react-dom") ||
              id.includes("node_modules/react-router")
            )
              return "react";
          },
        },
      },
    },
    esbuild: {
      supported: {
        "top-level-await": true,
      },
    },
    define: {
      APP_VERSION: JSON.stringify(APP_VERSION),
      "import.meta.env.APP_VERSION": JSON.stringify(APP_VERSION),
    },
    optimizeDeps: {
      exclude: ["libchai"],
    },
    plugins: [
      tailwindcss(),
      localDataPlugin(),
      wasmContentTypePlugin,
      { enforce: "pre", ...mdx() },
      react({
        // plugins: [["@swc-jotai/react-refresh", {}]],
      }),
      wasm(),
      yaml(),
      Pages({
        importMode: "async",
      }),
    ],
    worker: {
      format: "es",
      plugins: () => [wasm()],
    },
    server: {
      fs: {
        // Allow serving files from one level up to the project root
        allow: [".."],
      },
      watch: {
        ignored: ["**/scripts/**", "**/node_modules/**", "**/.git/**"],
      },
    },
  };

  if (mode === "BEX") {
    sharedConfig.build!.outDir = "dist/pages";
    sharedConfig.plugins?.push(
      visualizer({
        title: "打包产物分析",
        filename: "dist/visualizer.html",
      }) as PluginOption,
    );
  }

  return sharedConfig;
});
