import { writeFileSync, mkdirSync } from "fs";

const endpoint = "https://api.chaifen.app/";
const form = JSON.stringify(
  await fetch(endpoint + "form/all").then((res) => res.json()),
);
const repertoire = JSON.stringify(
  await fetch(endpoint + "repertoire").then((res) => res.json()),
);
mkdirSync("public/cache", { recursive: true });
writeFileSync("public/cache/form.json", form);
writeFileSync("public/cache/repertoire.json", repertoire);
