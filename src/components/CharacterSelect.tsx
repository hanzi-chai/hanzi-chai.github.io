import type { SelectProps } from "antd";
import { 字符, type 元素, type 原始汉字数据 } from "hanzi-chai";
import { useEffect, useState } from "react";
import {
  useAtomValue,
  useAtomValueUnwrapped,
  原始字库原子,
  如按笔顺排序字符原子,
  如笔顺映射原子,
} from "~/atoms";
import { CharacterDisplay, ElementDisplay, Select } from "./Utils";

interface ItemSelectProps extends SelectProps<string> {
  customFilter?: (e: [string, 原始汉字数据]) => boolean;
  includeVariables?: boolean;
  /** 提供时用该元素列表替代字符列表作为候选池（二笔/结构/拼音/自定义类别）；
   *  其中的字符仍走笔画序列搜索，其余按名称子串匹配。不传 = 原行为（仅字符） */
  候选元素?: 元素[];
}

function getLabel(value: { id: number }) {
  return `变量 ${value.id}`;
}

export default function CharacterSelect(props: ItemSelectProps) {
  const { customFilter, includeVariables, 候选元素, ...rest } = props;
  const 字符列表 = useAtomValueUnwrapped(如按笔顺排序字符原子);
  const [data, setData] = useState<SelectProps["options"]>([]);
  const value = props.value;
  const 笔顺映射 = useAtomValueUnwrapped(如笔顺映射原子);
  const 原始字库 = useAtomValue(原始字库原子);
  // 小类别（≤200 项）聚焦即全列；大类别（字根数千）保持输入才出，避免刷屏难找
  const 全量可显示 = 候选元素 !== undefined && 候选元素.length <= 200;
  const 构建选项 = (input: string) =>
    (候选元素 ?? 字符列表)
      .filter((元素实例) => {
        const 名 = 元素实例.获取名称();
        if (元素实例 instanceof 字符) {
          const 别名 = 原始字库.查询(元素实例)?.name ?? "";
          return (
            笔顺映射.get(元素实例)?.some((s) => s.startsWith(input)) ||
            名 === input ||
            别名.includes(input)
          );
        }
        return 名.includes(input);
      })
      .map((元素实例) => {
        const 名 = 元素实例.获取名称();
        const 是字符 = 元素实例 instanceof 字符;
        return {
          value: 名,
          label: (是字符 ? (
            <span className="flex gap-1">
              <CharacterDisplay character={元素实例 as 字符} />
              <span className="text-[0.8em]">{(元素实例 as 字符).十六进制()}</span>
            </span>
          ) : (
            <span className="flex gap-1">
              <ElementDisplay element={元素实例} />
            </span>
          )) as React.ReactNode,
          strokes: 笔顺映射.get(元素实例 as never) ?? [],
        };
      });
  useEffect(() => {
    if (!value) {
      setData(全量可显示 ? 构建选项("") : []);
      return;
    }
    let label: React.ReactNode;
    if (/^\{.+\}$/.test(value)) {
      label = getLabel(JSON.parse(value));
    } else {
      const character = 原始字库.校验(value);
      if (!character) {
        // 非字符元素（如拼音元素）：显示名称本身
        setData([{ value, label: <span>{value}</span> }]);
        return;
      }
      label = <CharacterDisplay character={character.character} />;
    }
    const initial = [{ value, label }];
    setData(initial);
    // 依赖 候选元素：切换元素类别时即使 value 未变也要重建候选（否则新类别聚焦无列表）
  }, [value, 候选元素]);
  const onSearch = (input: string) => {
    if (input.length === 0) {
      setData(全量可显示 ? 构建选项("") : []);
      return;
    }
    const allResults = 构建选项(input);
    let minResults = allResults.filter(({ strokes }) =>
      strokes.some((x) => x === input),
    ).length;
    if (includeVariables) {
      const num = parseInt(input, 10);
      if (!Number.isNaN(num) && num > 0) {
        allResults.unshift({
          value: JSON.stringify({ id: num }),
          label: getLabel({ id: num }),
          strokes: [],
        });
        minResults += 1;
      }
    }
    setData(allResults.slice(0, Math.max(5, minResults)));
  };
  const commonProps: SelectProps = {
    showSearch: true,
    placeholder: props.placeholder ?? "输入笔画搜索",
    options: data,
    filterOption: false,
    onSearch,
  };
  return <Select {...rest} {...commonProps} />;
}
