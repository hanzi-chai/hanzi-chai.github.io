import axios from "axios";
import { writeFileSync, mkdirSync } from "fs";

mkdirSync("data", { recursive: true });
const endpoint = "https://chai-data.tansongchen.workers.dev/";

for (const item of [
  "font",
  "components",
  "compounds",
  "characters",
  "slices",
  "mswb",
]) {
  const { data } = await axios.get(endpoint + item);
  writeFileSync(`data/${item}.json`, JSON.stringify(data));
}
