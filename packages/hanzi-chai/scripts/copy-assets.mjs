import { chmodSync, cpSync, mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });
cpSync("src/data", "dist/data", { recursive: true });
cpSync("../../examples", "dist/examples", { recursive: true });
chmodSync("dist/cli.js", 0o755);
