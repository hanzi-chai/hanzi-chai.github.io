import { useAtomValue } from "jotai";
import React, { useEffect, useState } from "react";
import { repertoireAtom, sequenceAtom, sortedCharactersAtom } from "~/atoms";
import { Display, Select } from "./Utils";
import type { SelectProps } from "antd";
import type { Character } from "~/lib";
import type { ProFormSelectProps } from "@ant-design/pro-components";

interface ItemSelectProps extends SelectProps {
  customFilter?: (e: [string, Character]) => boolean;
  includeVariables?: boolean;
}

export default function CharacterSelect(
  props: ItemSelectProps & ProFormSelectProps,
) {
  const { customFilter, includeVariables, ...rest } = props;
  const sortedCharacters = useAtomValue(sortedCharactersAtom);
  const repertoire = useAtomValue(repertoireAtom);
  const sortedRepertoire = sortedCharacters.map((x) => [x, repertoire[x]]) as [
    string,
    Character,
  ][];
  const [data, setData] = useState<SelectProps["options"]>([]);
  const char: string = props.value;
  const sequenceMap = useAtomValue(sequenceAtom);
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
          sequenceMap.get(x)?.startsWith(input) ||
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
      ({ value }) => sequenceMap.get(value)?.length === input.length,
    );
    if (includeVariables) {
      const num = parseInt(input, 10);
      if (!isNaN(num) && num > 0) {
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
