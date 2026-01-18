import type { Degenerator } from "./config.js";
import type { Feature } from "./classifier.js";
import { 拓扑, 笔画图形 } from "./bezier.js";

export const defaultDegenerator: Degenerator = {
  feature: {
    提: "横",
    捺: "点",
  } as Record<Feature, Feature>,
  no_cross: false,
};

/**
 * 字根认同的另一种算法，和上面的算法等价且更简单，但是效率比较差
 * 这个算法是直接计算出一个部件在某个退化映射下的结果，然后和字根的结果比较
 * 这种方式要求穷举一个部件中所有的笔画取幂集，复杂度为 O(2^n)，所以目前只用于测试
 */
export const degenerate = (degenerator: Degenerator, glyph: 笔画图形[]) => {
  const featureMap = degenerator.feature ?? ({} as Record<Feature, Feature>);
  return [
    glyph.map((x) => x.feature).map((x) => featureMap[x] || x),
    new 拓扑(glyph).matrix,
  ] as const;
};
