/// <reference types="vitest" />
import path from "node:path";
import { defineConfig, UserConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import yaml from "@modyfi/vite-plugin-yaml";
import { importToCDN, autoComplete } from "vite-plugin-external-cdn";

export default defineConfig(({ mode }) => {
  // https://vitejs.dev/config/
  const sharedConfig: UserConfig = {
    resolve: {
      alias: {
        "~/": `${path.resolve(__dirname, "src")}/`,
      },
    },
    build: {
      outDir: `dist/${mode.toLowerCase()}`,
      emptyOutDir: true,
      reportCompressedSize: false,
    },
    define: {
      APP_VERSION: JSON.stringify(process.env.npm_package_version),
    },
    plugins: [react(), yaml()],
    test: {
      globals: true,
      coverage: {
        enabled: true,
        provider: "v8",
        reporter: ["text", "html"],
      },
    },
  };

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
            path: "dist/antd.min.js",
          },
        ],
      }),
    );
  }

  return sharedConfig;
});
