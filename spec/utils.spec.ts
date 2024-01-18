import { describe, it, expect } from "vitest";
import {
  printableAscii,
  unicodeBlock,
  isValidCJKChar,
  isPUA,
  chars,
  getDummyBasicComponent,
  getDummyDerivedComponent,
  getDummyReferenceStroke,
  getDummySVGStroke,
  getDummyCompound,
  isComponent,
  getSupplemental,
  listToObject,
  parseTSV,
} from "~/lib/utils";
import { repertoire } from "./mock";

describe("unicode utils", () => {
  it("isValidCJKChar should return true if the character is a valid CJK character", () => {
    const char = "字"; // Example CJK character
    expect(isValidCJKChar(char)).toBeTruthy();
  });

  it("isPUA should return true if the character is a PUA character", () => {
    const char = ""; // Example PUA character
    expect(isPUA(char)).toBeTruthy();
  });

  it("chars should return an array of characters from a string", () => {
    const s = "𠃌"; // CJK-B
    expect(chars(s)).toBe(1);
  });
});

describe("data utils", () => {
  it("getDummyBasicComponent should return a dummy BasicComponent object", () => {
    const bc = getDummyBasicComponent();
    const dc = getDummyDerivedComponent();
    const c = getDummyCompound("⿰");
    expect(isComponent(bc)).toBeTruthy();
    expect(isComponent(dc)).toBeTruthy();
    expect(isComponent(c)).toBeFalsy();
  });
});

describe("misc", () => {
  it("getSupplemental should return the supplemental data from the repertoire for the given list of characters", () => {
    const characters = Object.entries(repertoire)
      .filter(([, value]) => value.gb2312)
      .map(([x]) => x);
    const result = getSupplemental(repertoire, characters);
    expect(result.length).toBeGreaterThan(200);
  });

  it("parseTSV should parse a TSV string and return a record with the values", () => {
    const text = "A\t1\nB\t2\nC\t3"; // Example TSV string
    expect(parseTSV(text)).toEqual({ A: 1, B: 2, C: 3 });
  });
});
