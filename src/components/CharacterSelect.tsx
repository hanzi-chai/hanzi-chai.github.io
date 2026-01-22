import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { 如字库原子, 如笔顺映射原子, 如排序汉字原子 } from "~/atoms";
import { Display, Select } from "./Utils";
import type { SelectProps } from "antd";
import type { ProFormSelectProps } from "@ant-design/pro-components";
import type { 汉字数据 } from "~/lib";

interface ItemSelectProps extends SelectProps {
  customFilter?: (e: [string, 汉字数据]) => boolean;
  includeVariables?: boolean;
}

export default function CharacterSelect(
  props: ItemSelectProps & ProFormSelectProps,
) {
  const { customFilter, includeVariables, ...rest } = props;
  const sortedCharacters = useAtomValue(如排序汉字原子);
  const repertoire = useAtomValue(如字库原子);
  const [data, setData] = useState<SelectProps["options"]>([]);
  const char: string = props.value;
  const sequenceMap = useAtomValue(如笔顺映射原子);
  useEffect(() => {
    const initial = char
      ? [
          {
            value: char,
            label: char.length === 1 ? <Display name={char} /> : char,
          },
        ]
      : [];
    setData(initial);
  }, [props.value, char]);
  if (!sortedCharacters.ok || !repertoire.ok || !sequenceMap.ok) {
    return null;
  }
  const sortedRepertoire = sortedCharacters.value.map((x) => [
    x,
    repertoire.value.get()[x],
  ]) as [string, 汉字数据][];
  const onSearch = (input: string) => {
    if (input.length === 0) {
      setData([]);
      return;
    }
    const allResults = sortedRepertoire
      .filter(customFilter ?? (() => true))
      .filter(([x, v]) => {
        const char = String.fromCodePoint(v.unicode);
        const name = v.name ?? "";
        return (
          sequenceMap.value.get(x)?.startsWith(input) ||
          char === input ||
          name.includes(input)
        );
      })
      .map(([x]) => ({
        value: x,
        label: (
          <span style={{ display: "flex", gap: "4px" }}>
            <Display name={x} />
            <span style={{ fontSize: "0.8em" }}>
              {x.codePointAt(0)?.toString(16)}
            </span>
          </span>
        ) as React.ReactNode,
      }));
    const minResults = allResults.filter(
      ({ value }) => sequenceMap.value.get(value)?.length === input.length,
    );
    if (includeVariables) {
      const num = parseInt(input, 10);
      if (!Number.isNaN(num) && num > 0) {
        allResults.unshift({
          value: `变量 ${num}`,
          label: `变量 ${num}`,
        });
      }
    }
    setData(allResults.slice(0, Math.max(5, minResults.length)));
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
