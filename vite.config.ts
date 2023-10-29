/// <reference types="vitest" />
import { defineConfig, UserConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import yaml from "@modyfi/vite-plugin-yaml";
import { importToCDN, autoComplete } from "vite-plugin-external-cdn";

export default defineConfig(({ mode }) => {
  // https://vitejs.dev/config/
  const sharedConfig: UserConfig = {
    build: {
      outDir: `dist/${mode.toLowerCase()}`,
      emptyOutDir: true,
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
    sharedConfig.plugins.push(
      importToCDN({
        prodUrl: "https://registry.npmmirror.com/{name}/{version}/files/{path}",
        modules: [
          autoComplete("react"),
          autoComplete("react-dom"),
          // {
          //   name:'antd',
          //   var:'antd',
          //   path:'dist/antd.min.js'
          // },
          {
            name: "mathjs",
            var: "math",
            path: "lib/browser/math.js",
          },
          {
            name: "js-yaml",
            var: "jsyaml",
            path: "dist/js-yaml.min.js",
          },
          {
            name: "reactflow",
            var: "reactflow",
            path: "dist/umd/index.js",
          },
        ],
      }),
    );
  }
  return sharedConfig;
});
