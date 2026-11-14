import "dotenv/config";
import { createClient } from "../api/src/client";

const { get, post, put, del } = createClient(() => {
  return process.env.JWT ?? null;
});

export { del, get, post, put };

import packageJson from "../package.json" with { type: "json" };

export const VERSION = packageJson.version;

export { getLocalDataPath } from "./data-path";
