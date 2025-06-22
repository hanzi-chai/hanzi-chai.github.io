import { readFileSync, writeFileSync } from "node:fs";
import { dump } from "js-yaml";
import { sumBy } from "lodash-es";
import type { Reading } from "~/lib";

const data = readFileSync("public/cache/export.txt", "utf-8")
  .trim()
  .split("\n")
  .map((line) => {
    const [char, pinyin, importance, flag] = line.split("\t") as [
      string,
      string,
      string,
      string,
    ];
    return { char, pinyin, importance, flag };
  });

const userList = data
  .filter((item) => item.flag === "0")
  .map((item) => item.char);

const dedupedList = Array.from(new Set(userList));

writeFileSync("public/cache/user.txt", dedupedList.join("\n"), "utf-8");

const maybeReadingCustomizations = new Map<string, Reading[]>();
const initialCountMap = new Map<string, number>();
for (const { char, pinyin, importance, flag } of data) {
  initialCountMap.set(char, (initialCountMap.get(char) ?? 0) + 1);
  if (flag === "0") {
    if (!maybeReadingCustomizations.has(char)) {
      maybeReadingCustomizations.set(char, []);
    }
    maybeReadingCustomizations.get(char)!.push({
      pinyin,
      importance: Number(importance),
    });
  }
}

for (const char of dedupedList) {
  const count = initialCountMap.get(char)!;
  const readings = maybeReadingCustomizations.get(char)!;
  if (readings.length !== count) {
    const sum = sumBy(readings, "importance");
    maybeReadingCustomizations.set(
      char,
      readings.map((reading) => {
        const importance = Math.round((reading.importance / sum) * 100);
        return {
          ...reading,
          importance: Number.isNaN(importance) ? 100 : importance,
        };
      }),
    );
  } else {
    maybeReadingCustomizations.delete(char);
  }
}

const yaml = dump(Object.fromEntries(maybeReadingCustomizations));
writeFileSync("public/cache/readings.yaml", yaml, "utf-8");
