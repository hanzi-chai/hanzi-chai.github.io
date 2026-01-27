import { useEffect, useState } from "react";
import {
  如笔顺映射原子,
  如排序字库数据原子,
  useAtomValueUnwrapped,
} from "~/atoms";
import { Display, Select } from "./Utils";
import type { SelectProps } from "antd";
import type { ProFormSelectProps } from "@ant-design/pro-components";
import type { 汉字数据 } from "~/lib";

interface ItemSelectProps extends SelectProps {
  customFilter?: (e: [string, 汉字数据]) => boolean;
  includeVariables?: boolean;
}

function getLabel(value: string | { id: number }) {
  if (typeof value === "string") {
    return <Display name={value} />;
  } else {
    return `变量 ${value.id}`;
  }
}

export default function CharacterSelect(
  props: ItemSelectProps & ProFormSelectProps,
) {
  const { customFilter, includeVariables, ...rest } = props;
  const sortedCharacters = useAtomValueUnwrapped(如排序字库数据原子);
  const [data, setData] = useState<SelectProps["options"]>([]);
  const value: string | undefined = props.value;
  const sequenceMap = useAtomValueUnwrapped(如笔顺映射原子);
  useEffect(() => {
    if (!value) {
      setData([]);
      return;
    }
    let label: React.ReactNode = <Display name={value} />;
    if (/^\{.+\}$/.test(value)) {
      label = getLabel(JSON.parse(value));
    }
    const initial = [{ value, label }];
    setData(initial);
  }, [value]);
  const onSearch = (input: string) => {
    if (input.length === 0) {
      setData([]);
      return;
    }
    const allResults = Object.entries(sortedCharacters)
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
    let minResults = allResults.filter(
      ({ value }) => sequenceMap.get(value)?.length === input.length,
    ).length;
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
