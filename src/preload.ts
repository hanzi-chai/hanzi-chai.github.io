import type {
  原始字库数据,
  原始汉字数据,
  原始词典,
  当量映射,
  键位分布目标,
} from "hanzi-chai";
import {
  解析原始词典,
  解析当量映射,
  解析键位分布目标,
  读取表格,
} from "hanzi-chai";
import pako from "pako";
import { getDataPath } from "~/version";

interface 预加载结果 {
  原始字库数据: 原始字库数据;
  原始词典: 原始词典;
  键位分布目标: 键位分布目标;
  当量映射: 当量映射;
  GF0014: string[][];
}

let _数据: 预加载结果 | null = null;

const 资源缓存: Record<string, string> = {};

async function 拉取资源(文件名: string): Promise<string> {
  if (文件名 in 资源缓存) return 资源缓存[文件名]!;
  const 响应 = await fetch(getDataPath(文件名));
  if (!响应.ok)
    throw new Error(`获取资源失败: ${文件名}, 状态码: ${响应.status}`);
  let 文本: string;
  if (文件名.endsWith(".deflate")) {
    const arrayBuffer = await 响应.arrayBuffer();
    文本 = pako.inflate(arrayBuffer, { to: "string" });
  } else {
    文本 = await 响应.text();
  }
  资源缓存[文件名] = 文本;
  return 文本;
}

export async function 预加载() {
  const [字库内容, 词典内容, 分布内容, 当量内容, GF0014] = await Promise.all([
    拉取资源("repertoire.json.deflate"),
    拉取资源("dictionary.txt"),
    拉取资源("distribution.txt"),
    拉取资源("equivalence.txt"),
    拉取资源("gf0014.txt")
  ]);

  const data: 原始汉字数据[] = JSON.parse(字库内容);
  _数据 = {
    原始字库数据: Object.fromEntries(
      data.map((x) => [String.fromCodePoint(x.unicode), x]),
    ),
    原始词典: 解析原始词典(读取表格(词典内容)),
    键位分布目标: 解析键位分布目标(读取表格(分布内容)),
    当量映射: 解析当量映射(读取表格(当量内容)),
    GF0014: 读取表格(GF0014)
  };
}

export function isDataReady() {
  return _数据 !== null;
}

export function get预加载数据(): 预加载结果 {
  if (!_数据) throw new Error("数据未预加载");
  return _数据;
}
