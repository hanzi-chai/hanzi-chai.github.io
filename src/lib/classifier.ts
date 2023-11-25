import type { SVGCommand } from "./data";

const classifier = {
  横: 1,
  提: 1,
  竖: 2,
  竖钩: 2,
  撇: 3,
  平撇: 3,
  点: 4,
  平点: 4,
  捺: 4,
  平捺: 4,
  横钩: 5,
  横撇: 5,
  横折: 5,
  横折钩: 5,
  横斜钩: 5,
  横折提: 5,
  横折折: 5,
  横折弯: 5,
  横撇弯钩: 5,
  横折弯钩: 5,
  横折折撇: 5,
  横折折折: 5,
  横折折折钩: 5,
  竖提: 5,
  竖折: 5,
  竖弯: 5,
  竖弯钩: 5,
  竖折撇: 5,
  竖折折钩: 5,
  竖折折: 5,
  撇点: 5,
  撇折: 5,
  弯钩: 5,
  斜钩: 5,
};

export type Feature = keyof typeof classifier;

export type Classifier = typeof classifier;

export const schema: Record<Feature, SVGCommand[]> = {
  横: ["h"],
  提: ["h"],
  竖: ["v"],
  竖钩: ["v"],
  撇: ["c"],
  平撇: ["z"],
  点: ["c"],
  平点: ["z"],
  捺: ["c"],
  平捺: ["z"],
  横钩: ["h"],
  横撇: ["h", "c"],
  横折: ["h", "v"],
  横折钩: ["h", "v"],
  横斜钩: ["h", "c"],
  横折提: ["h", "v", "h"],
  横折折: ["h", "v", "h"],
  横折弯: ["h", "v", "h"],
  横撇弯钩: ["h", "c", "v"],
  横折弯钩: ["h", "v", "h"],
  横折折撇: ["h", "v", "h", "c"],
  横折折折: ["h", "v", "h", "v"],
  横折折折钩: ["h", "v", "h", "v"],
  竖提: ["v", "h"],
  竖折: ["v", "h"],
  竖弯: ["v", "h"],
  竖弯钩: ["v", "h"],
  竖折撇: ["v", "h", "c"],
  竖折折钩: ["v", "h", "v"],
  竖折折: ["v", "h", "v"],
  撇点: ["c", "c"],
  撇折: ["c", "h"],
  弯钩: ["v"],
  斜钩: ["c"],
};

export default classifier;
