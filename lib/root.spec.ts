import { describe, it, expect } from "vitest";
import { generateSchemes } from "./root";

describe("generate schemes", () => {
  it("works for a simple case", () => {
    expect(generateSchemes(4, [1, 2, 4, 6, 7, 8, 12])).toEqual([
      [8, 4, 2, 1],
      [8, 6, 1],
      [8, 7],
      [12, 2, 1],
    ]);
  });
});

// describe("get component scheme", () => {
//   const config = useXingyin();
//   const [天, 一, 大, 二, 人] = ["天", "一", "大", "二", "人"].map(buildCache);
//   it("works", () => {
//     expect(getComponentScheme(天, [一, 大, 二, 人], config).best).toEqual([
//       "一",
//       "大",
//     ]);
//   });
// });

// describe("disassemble components", () => {
//   const config = useXingyin();
//   const components = getComponents();
//   it("works", () => {
//     expect(disassembleComponents(components, config)).toBeDefined();
//   });
// });

// describe("disassemble compounds", () => {
//   const config = useXingyin();
//   const components = getComponents();
//   const compounds = useCompounds();
//   it("works", () => {
//     const prev = disassembleComponents(components, config);
//     expect(disassembleCompounds(compounds, config, prev)).toBeDefined();
//   });
// });
