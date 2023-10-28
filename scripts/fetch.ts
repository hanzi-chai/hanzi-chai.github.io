import { writeFileSync, mkdirSync } from "fs";

const endpoint = "https://api.chaifen.app/";
const form = JSON.stringify(
  await fetch(endpoint + "form/all").then((res) => res.json()),
);
const repertoire = JSON.stringify(
  await fetch(endpoint + "repertoire").then((res) => res.json()),
);
mkdirSync("cache", { recursive: true });
writeFileSync("src/cache/form.json", form);
writeFileSync("src/cache/repertoire.json", repertoire);
