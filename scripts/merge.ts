import { readFileSync, writeFileSync } from "fs";
import { Config } from "../lib/config";
import { Components } from "../lib/data";

const components = JSON.parse(
  readFileSync("data/components.json", "utf-8"),
) as Components;
const config = JSON.parse(readFileSync("templates/3.json", "utf-8")) as Config;

writeFileSync(
  "components.json",
  JSON.stringify(Object.assign({}, components, config.data.components)),
);
