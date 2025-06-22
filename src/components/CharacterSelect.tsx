import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { repertoireAtom, sequenceAtom, sortedCharactersAtom } from "~/atoms";
import { Display, Select } from "./Utils";
import type { SelectProps } from "antd";
import type { Character } from "~/lib";
import type { ProFormSelectProps } from "@ant-design/pro-components";

interface ItemSelectProps extends SelectProps {
  customFilter?: (e: [string, Character]) => boolean;
}

export default function CharacterSelect(
  props: ItemSelectProps & ProFormSelectProps,
) {
  const { customFilter, ...rest } = props;
  const sortedCharacters = useAtomValue(sortedCharactersAtom);
  const repertoire = useAtomValue(repertoireAtom);
  const sortedRepertoire = sortedCharacters.map((x) => [x, repertoire[x]]) as [
    string,
    Character,
  ][];
  const [data, setData] = useState<SelectProps["options"]>([]);
  const char = props.value;
  const sequenceMap = useAtomValue(sequenceAtom);
  useEffect(() => {
    const initial = char
      ? [{ value: char, label: <Display name={char} /> }]
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
      .map(([x]) => ({
        value: x,
        label: (
          <span style={{ display: "flex", gap: "4px" }}>
            <Display name={x} />
            <span style={{ fontSize: "0.8em" }}>
              {x.codePointAt(0)?.toString(16)}
            </span>
          </span>
        ),
      }))
      .filter(({ value }) => {
        return sequenceMap.get(value)?.startsWith(input);
      });
    const minResults = allResults.filter(
      ({ value }) => sequenceMap.get(value)?.length === input.length,
    );
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
