import { Button, Popconfirm } from "antd";
import { 字符, type 强类型非空安排 } from "hanzi-chai";
import { useAtomValue, useSetAtom } from "jotai";
import {
  useAtomValueUnwrapped,
  useMapAddAtom,
  全部合法元素原子,
  原始字库原子,
  强类型决策原子,
  当前元素原子,
} from "~/atoms";
import { CharacterDisplay } from "./Utils";

const GROUPS = [
  // 笔顺统一
  "力\ue401",
  "王\ue102",
  "土\ue43a",
  "十\ue452",
  "\ue068\ue443", // 𠂇
  "\ue011\ue43f", // 𠤎
  // 左点
  "八\ue446",
  // 横折弯钩 - 横斜钩
  "几\ue0d6",
  // 拓扑关系
  "人\ue43d",
  "彐\ue432",
  "止\ue451",
  // 匕 35 变 15
  "比\ue839",
  "北\ue822",
  "此\ue807",
  "鹿\ue838",
  // 竖钩变竖
  "小\ue442",
  "氺\ue18e",
  "冂\ue439",
  // 框类
  "木朩\ue04c",
  "大\ue043",
  "禾\ue44b",
  // 竖变撇
  "丰\ue003",
  "羊\ue042",
];

interface RootRecommendationProps {
  value?: 强类型非空安排;
}

/**
 * 在根部件添加时提供推荐建议的包裹组件
 * 如果当前元素是特殊字根（非笔画的字符），则显示 Popconfirm 询问用户是否需要推荐其他字根
 * 否则保留原有的按钮交互
 */
export default function RootRecommendation({
  value,
}: RootRecommendationProps) {
  const 当前元素 = useAtomValue(当前元素原子);
  const { 名称映射 } = useAtomValueUnwrapped(全部合法元素原子);
  const 原始字库 = useAtomValue(原始字库原子);
  const 推荐映射 = new Map<字符, 字符[]>();
  for (const group of GROUPS) {
    const elements: 字符[] = [];
    for (const character of [...group]) {
      const element = 名称映射.get(character);
      if (element && element instanceof 字符) {
        elements.push(element);
      }
    }
    if (elements.length > 0) {
      for (const element of elements) {
        推荐映射.set(
          element,
          elements.filter((e) => e !== element),
        );
      }
    }
  }
  const addMapping = useMapAddAtom(强类型决策原子);
  const 决策快照 = useAtomValueUnwrapped(强类型决策原子);
  const set决策 = useSetAtom(强类型决策原子);

  const children = (
    <Button type="primary" disabled={当前元素 === undefined || value === undefined} onClick={() => addMapping(当前元素!, value!)}>
      添加
    </Button>
  );

  if (!(当前元素 instanceof 字符)) return children;
  const 元素列表 = 推荐映射.get(当前元素);

  if (!元素列表) return children;

  return (
    <Popconfirm
      title="推荐相似字根"
      description={
        <div>
          「
          {元素列表.map((e) => (
            <span key={e.toNumber()}>
              <CharacterDisplay character={e} />
              {e.是私用区() && ` (${原始字库.查询(e)?.name})`}
            </span>
          ))}
          」 与「
          <span>
            <CharacterDisplay character={当前元素} />
            {当前元素.是私用区() && ` (${原始字库.查询(当前元素)?.name})`}
          </span>
          」相似。是否一并添加？
        </div>
      }
      onConfirm={() => {
        const next = new Map(决策快照);
        next.set(当前元素, value!);
        for (const 元素 of 元素列表) {
          next.set(元素, { element: 当前元素 });
        }
        set决策(next);
      }}
      onCancel={() => addMapping(当前元素, value!)}
      okText="是，一并添加"
      cancelText="否，只添加当前"
    >
      <Button type="primary" disabled={当前元素 === undefined || value === undefined}>添加</Button>
    </Popconfirm>
  );
}
