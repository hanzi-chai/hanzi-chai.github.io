import axios from "axios";
import { writeFileSync } from "fs";

const { data } = await axios.get("https://chai-data.tansongchen.workers.dev/");
writeFileSync("data/CHAI.json", JSON.stringify(data));
