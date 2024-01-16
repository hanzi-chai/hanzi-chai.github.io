import { writeFileSync, mkdirSync, createWriteStream } from "node:fs";
import axios from "axios";

const endpoint = "https://assets.chaifen.app/";
const outputFolder = "public/cache";
mkdirSync(outputFolder, { recursive: true });

const processFile = async (filename) => {
  const url = `${endpoint}${filename}.txt`;
  const jsonPath = `${outputFolder}/${filename}.json`;
  const response = await axios.get(url);
  const content = response.data;
  const tsv = content
    .trim()
    .split("\n")
    .map((x) => {
      const [key, value] = x.split("\t");
      return [key, Number(value)];
    });
  const object = Object.fromEntries(tsv);
  writeFileSync(jsonPath, JSON.stringify(object));
};

for (const name of [
  "character_frequency",
  "word_frequency",
  "key_distribution",
  "pair_equivalence",
]) {
  await processFile(name);
}
