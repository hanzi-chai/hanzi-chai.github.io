import { read, readFileSync, writeFileSync } from "fs";
import { Config } from "../lib/config";

const wen = JSON.parse(readFileSync("data/wen.json", "utf-8")) as Record<
  string,
  any
>;
const config = JSON.parse(readFileSync("templates/3.json", "utf-8")) as Config;

writeFileSync(
  "wen.json",
  JSON.stringify(Object.assign({}, wen, config.data.component)),
);
