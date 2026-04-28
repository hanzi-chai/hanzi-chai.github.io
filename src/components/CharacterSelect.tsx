import type { ProFormSelectProps } from "@ant-design/pro-components";
import type { SelectProps } from "antd";
import { useEffect, useState } from "react";
import {
  useAtomValue,
  useAtomValueUnwrapped,
  原始字库原子,
  如排序字库数据原子,
  如笔顺映射原子,
} from "~/atoms";
import type { 汉字 } from "~/lib";
import { Display, Select } from "./Utils";

interface ItemSelectProps extends SelectProps {
  customFilter?: (e: [string, 汉字]) => boolean;
  includeVariables?: boolean;
}

function getLabel(value: { id: number }) {
  return `变量 ${value.id}`;
}

export default function CharacterSelect(
  props: ItemSelectProps & ProFormSelectProps,
) {
  const { customFilter, includeVariables, ...rest } = props;
  const sortedCharacters = useAtomValueUnwrapped(如排序字库数据原子);
  const [data, setData] = useState<SelectProps["options"]>([]);
  const value: string | undefined = props.value;
  const sequenceMap = useAtomValueUnwrapped(如笔顺映射原子);
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
      label = <Display name={character.character} />;
    }
    const initial = [{ value, label }];
    setData(initial);
  }, [value]);
  const onSearch = (input: string) => {
    if (input.length === 0) {
      setData([]);
      return;
    }
    const allResults = sortedCharacters
      .filter((char) => {
        // FIXME: 这里已经获取不到 name 了，先放着
        const name = "";
        return (
          sequenceMap.get(char)?.startsWith(input) ||
          char.toString() === input ||
          name.includes(input)
        );
      })
      .map((char) => ({
        value: char.toString(),
        label: (
          <span style={{ display: "flex", gap: "4px" }}>
            <Display name={char} />
            <span style={{ fontSize: "0.8em" }}>{char.十六进制()}</span>
          </span>
        ) as React.ReactNode,
      }));
    let minResults = allResults.filter(({ value }) => {
      const ch = 原始字库.校验(value);
      if (!ch) return false;
      return sequenceMap.get(ch.character)?.length === input.length;
    }).length;
    if (includeVariables) {
      const num = parseInt(input, 10);
      if (!Number.isNaN(num) && num > 0) {
        allResults.unshift({
          value: JSON.stringify({ id: num }),
          label: getLabel({ id: num }),
        });
        minResults += 1;
      }
    }
    setData(allResults.slice(0, Math.max(5, minResults)));
  };
  const commonProps: SelectProps & ProFormSelectProps = {
    showSearch: true,
    placeholder: "输入笔画搜索",
    options: data,
    filterOption: false,
    onSearch,
  };
  return <Select {...rest} {...commonProps} />;
}
