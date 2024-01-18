import { describe, expect, it } from "vitest";
import { listToObject } from "~/lib";
import rawrepertoire from "../public/cache/repertoire.json";
import type { PrimitiveCharacter, PrimitiveRepertoire } from "~/lib";
import { determine } from "~/lib";

describe("recursive render component", () => {
  const repertoire: PrimitiveRepertoire = listToObject(rawrepertoire);
  const rendered = determine(repertoire);
  it("has nong", () => {
    expect(rendered["农"]).toBeDefined();
  });
});
