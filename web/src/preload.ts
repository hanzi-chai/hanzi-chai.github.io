import type {
  原始词典,
  基本字形数据,
  字符数据,
  当量映射,
  键位分布目标,
} from "hanzi-chai";
import {
  解析原始词典,
  解析当量映射,
  解析键位分布目标,
  读取表格,
} from "hanzi-chai";
import { getDataPath } from "~/version";

interface 预加载结果 {
  字符列表: 字符数据[];
  字形列表: 基本字形数据[];
  原始词典: 原始词典;
  键位分布目标: 键位分布目标;
  当量映射: 当量映射;
  GF0014: string[][];
}

let _数据: 预加载结果 | null = null;

async function 拉取资源(文件名: string): Promise<string> {
  const 响应 = await fetch(getDataPath(文件名), { cache: "no-store" });
  if (!响应.ok)
    throw new Error(`获取资源失败: ${文件名}, 状态码: ${响应.status}`);
  return 响应.text();
}

export async function 预加载() {
  const [字符内容, 字形内容, 词典内容, 分布内容, 当量内容, GF0014] =
    await Promise.all([
      拉取资源("characters.json"),
      拉取资源("glyphs.json"),
      拉取资源("dictionary.txt"),
      拉取资源("distribution.txt"),
      拉取资源("equivalence.txt"),
      拉取资源("gf0014.txt"),
    ]);

  _数据 = {
    字符列表: JSON.parse(字符内容),
    字形列表: JSON.parse(字形内容),
    原始词典: 解析原始词典(读取表格(词典内容)),
    键位分布目标: 解析键位分布目标(读取表格(分布内容)),
    当量映射: 解析当量映射(读取表格(当量内容)),
    GF0014: 读取表格(GF0014),
  };
}

export function isDataReady() {
  return _数据 !== null;
}

export function get预加载数据(): 预加载结果 {
  if (!_数据) throw new Error("数据未预加载");
  return _数据;
}
