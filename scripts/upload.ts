import { readFileSync } from "fs";
import { Characters, Components, Compounds } from "../lib/data";
import axios from "axios";
const endpoint = "https://chai-data.tansongchen.workers.dev/";

const characters = JSON.parse(
  readFileSync("data/characters.json", "utf-8"),
) as Characters;

const response1 = await axios.post(
  endpoint + "repertoire",
  Object.entries(characters).map(([char, { tygf, gb2312, pinyin }]) => {
    const unicode = char.codePointAt(0);
    return {
      unicode,
      tygf: +tygf,
      gb2312: +gb2312,
      pinyin: JSON.stringify(pinyin),
    };
  }),
);

let componentCode = 0xf000;

const components = JSON.parse(
  readFileSync("data/components.json", "utf-8"),
) as Components;

const response2 = await axios.post(
  endpoint + "form",
  Object.entries(components).map(([char, item]) => {
    const common = {
      default_type: 0,
      gf0014_id: null,
      component: JSON.stringify(item),
      compound: null,
    };
    if (Array.from(char).length === 1) {
      const unicode = char.codePointAt(0);
      return { unicode, name: null, ...common };
    } else {
      const unicode = componentCode;
      componentCode += 1;
      return { unicode, name: char, ...common };
    }
  }),
);

let compoundCode = 0xe000;

const compounds = JSON.parse(
  readFileSync("data/compounds.json", "utf-8"),
) as Compounds;

const response3 = await axios.post(
  endpoint + "form",
  Object.entries(compounds).map(([char, item]) => {
    const common = {
      default_type: 1,
      gf0014_id: null,
      component: null,
      compound: JSON.stringify(item),
    };
    if (Array.from(char).length === 1) {
      return { unicode: char.codePointAt(0), name: null, ...common };
    } else {
      const unicode = compoundCode;
      compoundCode += 1;
      return { unicode, name: char, ...common };
    }
  }),
);

console.log(response1.status, response2.status, response3.status);
