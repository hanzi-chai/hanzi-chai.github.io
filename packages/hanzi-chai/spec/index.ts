import { 字符, 获取原始字库, 获取原始词典, 部件 } from "../src/index.js";

export const 获取数据 = () => {
  const 原始字库 = 获取原始字库();
  const 原始词典 = 获取原始词典(undefined);
  const 词典 = 原始字库.校验词典(原始词典);
  const 字库 = 原始字库.确定({}, [], ["G"]);
  const 部件图形库: Map<字符, 部件> = new Map();
  for (const [字符] of 字库) {
    for (const 字形 of 字库.查询字形(字符) ?? []) {
      if (字形 instanceof 部件) {
        部件图形库.set(字符, 字形);
        break;
      }
    }
  }
  return { 原始字库, 字库, 词典, 部件图形库 }
}
