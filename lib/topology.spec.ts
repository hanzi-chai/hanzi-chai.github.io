import findTopology, { cross } from "./topology";

test("cross", () => {
  expect(cross([1, 0], [0, 2])).toBeCloseTo(2);
});
