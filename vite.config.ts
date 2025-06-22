/// <reference types="vitest/config" />
import path from "node:path";
import { defineConfig, type UserConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import yaml from "@modyfi/vite-plugin-yaml";
import Pages from "vite-plugin-pages";
import wasm from "vite-plugin-wasm";
import { visualizer } from "rollup-plugin-visualizer";
import mdx from "@mdx-js/rollup";

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
        output: {
          manualChunks: {
            lodash: ["lodash"],
            yaml: ["js-yaml"],
            md5: ["js-md5"],
            "styled-components": ["styled-components"],
            react: ["react", "react-dom", "react-router-dom"],
            immer: ["immer"],
            reactflow: ["reactflow"],
            antd: ["antd"],
            "pro-form": ["@ant-design/pro-form"],
            g: ["@antv/g"],
            g2: ["@antv/g2"],
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
      APP_VERSION: JSON.stringify(process.env.npm_package_version),
    },
    optimizeDeps: {
      exclude: ["libchai"],
    },
    plugins: [
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

  if (mode === "BEX") {
    sharedConfig.build!.outDir = "dist/pages";
    sharedConfig.plugins?.push(
      visualizer({
        brotliSize: true,
        title: "打包产物分析",
        filename: "dist/visualizer.html",
      }) as PluginOption,
    );
  }

  return sharedConfig;
});
