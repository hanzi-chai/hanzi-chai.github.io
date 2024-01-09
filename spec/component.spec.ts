import { describe, expect, it } from "vitest";
import { listToObject } from "~/lib/utils";
import rawrepertoire from "../public/cache/repertoire.json";
import type { Character, Repertoire } from "~/lib/data";
import { determine } from "~/lib/repertoire";

describe("recursive render component", () => {
  const repertoire: Repertoire = listToObject(rawrepertoire);
  const rendered = determine(repertoire);
  it("has nong", () => {
    expect(rendered["农"]).toBeDefined();
  });
});
