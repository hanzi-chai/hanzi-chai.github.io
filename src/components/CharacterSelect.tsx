import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { displayAtom, sequenceAtom, sortedRepertoireAtom } from "~/atoms";
import { Select } from "./Utils";
import type { SelectProps } from "antd";
import type { Character } from "~/lib";
import type { ProFormSelectProps } from "@ant-design/pro-components";

interface ItemSelectProps extends SelectProps {
  customFilter?: (e: [string, Character]) => boolean;
}

export const GlyphSelect = (props: ItemSelectProps & ProFormSelectProps) => {
  const { customFilter, ...rest } = props;
  const sortedRepertoire = useAtomValue(sortedRepertoireAtom);
  const [data, setData] = useState<SelectProps["options"]>([]);
  const char = props.value;
  const display = useAtomValue(displayAtom);
  const sequenceMap = useAtomValue(sequenceAtom);
  useEffect(() => {
    const initial = char ? [{ value: char, label: display(char) }] : [];
    setData(initial);
  }, [props.value, char, display]);
  const onSearch = (input: string) => {
    if (input.length === 0) {
      setData([]);
      return;
    }
    const allResults = sortedRepertoire
      .filter(customFilter ?? (() => true))
      .map(([x]) => ({
        value: x,
        label: display(x),
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
};
