import { 源标签, 获取原始字库, 获取原始词典, 部件 } from "../src/index.js";

export const 获取数据 = () => {
  const 原始字库 = 获取原始字库();
  const 原始词典 = 获取原始词典(undefined);
  const 词典 = 原始字库.校验词典(原始词典);
  const 字库实例 = 原始字库.确定({}, [], ["G" as 源标签]);
  if (!字库实例.ok) {
    console.error(字库实例.error);
    throw new Error("字库加载失败");
  }
  const 字库 = 字库实例.value;
  const 部件图形库: Record<string, 部件> = {};
  for (const { 字符, 字形列表 } of 字库) {
    for (const 字形 of 字形列表) {
      if (字形 instanceof 部件) {
        部件图形库[字符.toString()] = 字形;
        break;
      }
    }
  }
  return { 原始字库, 字库, 词典, 部件图形库 }
}
