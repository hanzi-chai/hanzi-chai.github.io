import {
  获取字库,
  获取原始词典,
  最小方案,
  部件,
  type 字符,
} from "../src/index.js";

// 共享只读的字库实例，避免每个测试文件重复解析和构建整套字形。
let 数据: ReturnType<typeof 加载数据> | undefined;
function 加载数据() {
  const 字库 = 获取字库(最小方案);
  const 词典 = 字库.校验词典(获取原始词典());
  const 部件图形库 = new Map<字符, 部件>();
  for (const [, 字符数据] of 字库) {
    const 字符 = 字符数据.character;
    const 部件图形 = 字库.查询字符的字形(字符)?.find((x) => x instanceof 部件);
    if (部件图形) 部件图形库.set(字符, 部件图形);
  }
  return { 字库, 词典, 部件图形库 };
}
export const 获取数据 = () => (数据 ??= 加载数据());
