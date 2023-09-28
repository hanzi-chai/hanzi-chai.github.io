import axios from "axios";
import { writeFileSync, mkdirSync } from "fs";

mkdirSync("data", { recursive: true });
const endpoint = "https://chai-data.tansongchen.workers.dev/";

const { data: wen } = await axios.get(endpoint + "components");
writeFileSync("data/wen.json", JSON.stringify(wen));

const { data: zi } = await axios.get(endpoint + "compounds");
writeFileSync("data/zi.json", JSON.stringify(zi));

const { data: yin } = await axios.get(endpoint + "characters");
writeFileSync("data/yin.json", JSON.stringify(yin));

const { data: mswb } = await axios.get(endpoint + "mswb");
writeFileSync("data/mswb.json", JSON.stringify(mswb));
