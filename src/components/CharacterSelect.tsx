import type { SelectProps } from "antd";
import { useEffect, useState } from "react";
import {
  useAtomValue,
  useAtomValueUnwrapped,
  原始字库原子,
  如排序字库数据原子,
  如笔顺映射原子,
} from "~/atoms";
import type { 原始汉字数据 } from "~/lib";
import { CharacterDisplay, Select } from "./Utils";

interface ItemSelectProps extends SelectProps<string> {
  customFilter?: (e: [string, 原始汉字数据]) => boolean;
  includeVariables?: boolean;
}

function getLabel(value: { id: number }) {
  return `变量 ${value.id}`;
}

export default function CharacterSelect(props: ItemSelectProps) {
  const { customFilter, includeVariables, ...rest } = props;
  const 字符列表 = useAtomValueUnwrapped(如排序字库数据原子);
  const [data, setData] = useState<SelectProps["options"]>([]);
  const value = props.value;
  const 笔顺映射 = useAtomValueUnwrapped(如笔顺映射原子);
  const 原始字库 = useAtomValue(原始字库原子);
  useEffect(() => {
    if (!value) {
      setData([]);
      return;
    }
    let label: React.ReactNode;
    if (/^\{.+\}$/.test(value)) {
      label = getLabel(JSON.parse(value));
    } else {
      const character = 原始字库.校验(value);
      if (!character) {
        setData([]);
        return;
      }
      label = <CharacterDisplay character={character.character} />;
    }
    const initial = [{ value, label }];
    setData(initial);
  }, [value]);
  const onSearch = (input: string) => {
    if (input.length === 0) {
      setData([]);
      return;
    }
    const allResults = 字符列表
      .filter((字符实例) => {
        const 别名 = 原始字库.查询(字符实例)?.name ?? "";
        return (
          笔顺映射.get(字符实例)?.startsWith(input) ||
          字符实例.toString() === input ||
          别名.includes(input)
        );
      })
      .map((字符实例) => ({
        value: 字符实例.toString(),
        label: (
          <span style={{ display: "flex", gap: "4px" }}>
            <CharacterDisplay character={字符实例} />
            <span style={{ fontSize: "0.8em" }}>{字符实例.十六进制()}</span>
          </span>
        ) as React.ReactNode,
        length: 笔顺映射.get(字符实例)?.length ?? 0,
      }));
    let minResults = allResults.filter(
      ({ length }) => length === input.length,
    ).length;
    if (includeVariables) {
      const num = parseInt(input, 10);
      if (!Number.isNaN(num) && num > 0) {
        allResults.unshift({
          value: JSON.stringify({ id: num }),
          label: getLabel({ id: num }),
          length: 0,
        });
        minResults += 1;
      }
    }
    setData(allResults.slice(0, Math.max(5, minResults)));
  };
  const commonProps: SelectProps = {
    showSearch: true,
    placeholder: "输入笔画搜索",
    options: data,
    filterOption: false,
    onSearch,
  };
  return <Select {...rest} {...commonProps} />;
}
