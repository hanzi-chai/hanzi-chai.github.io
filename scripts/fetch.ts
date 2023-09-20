import axios from "axios";
import { writeFileSync, mkdirSync } from "fs";

const { data } = await axios.get("https://chai-data.tansongchen.workers.dev/");
mkdirSync("data", { recursive: true });
writeFileSync("data/Wen.json", JSON.stringify(data));
