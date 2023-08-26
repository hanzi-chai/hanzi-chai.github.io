import axios from "axios";
import { writeFileSync } from "fs";

const { data } = await axios.get("https://chai-data.tansongchen.workers.dev/");
writeFileSync("data/chai.json", JSON.stringify(data));
