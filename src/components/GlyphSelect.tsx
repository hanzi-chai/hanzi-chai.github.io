import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { displayAtom, sequenceAtom, sortedCustomFormAtom } from "~/atoms";
import { Select } from "./Utils";
import { SelectProps } from "antd";
import { Glyph } from "~/lib/data";

interface ItemSelectProps extends SelectProps {
  customFilter?: (e: [string, Glyph]) => boolean;
}

export const GlyphSelect = (props: ItemSelectProps) => {
  const { customFilter, ...rest } = props;
  const sortedForm = useAtomValue(sortedCustomFormAtom);
  const [data, setData] = useState<SelectProps["options"]>([]);
  const char = props.value;
  const display = useAtomValue(displayAtom);
  const sequenceMap = useAtomValue(sequenceAtom);
  useEffect(() => {
    const initial = char ? [{ value: char, label: display(char) }] : [];
    setData(initial);
  }, [props.value]);
  const onSearch = (input: string) => {
    if (input.length === 0) {
      setData([]);
      return;
    }
    const allResults = sortedForm
      .filter(props.customFilter ?? ((_) => true))
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
  const commonProps: SelectProps = {
    showSearch: true,
    placeholder: "输入笔画搜索",
    options: data,
    filterOption: false,
    onSearch,
  };
  return <Select {...rest} {...commonProps} />;
};
