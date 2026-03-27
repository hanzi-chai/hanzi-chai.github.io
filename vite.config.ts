import path from "node:path";
import { defineConfig, type UserConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import yaml from "@modyfi/vite-plugin-yaml";
import Pages from "vite-plugin-pages";
import wasm from "vite-plugin-wasm";
import { visualizer } from "rollup-plugin-visualizer";
import mdx from "@mdx-js/rollup";
import packageJson from "./package.json";

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

// 动态注入版本化的 prefetch 链接
const injectPrefetchPlugin = {
  name: "inject-prefetch",
  transformIndexHtml(html: string) {
    const dataFiles = [
      "cjk.txt",
      "dictionary.txt",
      "distribution.txt",
      "equivalence.txt",
      "tygf.txt",
      "repertoire.json.deflate",
    ];

    const prefetchLinks = dataFiles
      .map(
        (file) =>
          `  <link rel="prefetch" href="/data/${APP_VERSION}/${file}" as="fetch" />`,
      )
      .join("\n");

    return html.replace(
      /(<meta charset="UTF-8" \/>)/,
      `$1\n  <link rel="icon" href="/favicon.ico" />\n${prefetchLinks}`,
    );
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
          codeSplitting: {
            groups: [
              {
                name: "js-yaml",
                test: /node_modules[\\/]js-yaml/,
              },
              {
                name: "react",
                test: /node_modules[\\/]react.*/,
              },
              {
                name: "antd",
                test: /node_modules[\\/](antd|@ant-design.*)/,
              },
            ],
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
      wasmContentTypePlugin,
      injectPrefetchPlugin,
      { enforce: "pre", ...mdx() },
      react(),
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
      plugins: () => [wasm()],
    },
    server: {
      fs: {
        // Allow serving files from one level up to the project root
        allow: [".."],
      },
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
