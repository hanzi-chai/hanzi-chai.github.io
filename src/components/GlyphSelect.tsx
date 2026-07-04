import { Select } from "antd";
import type { DefaultOptionType } from "antd/es/select";
import type { SelectProps } from "antd/lib";
import type { IDVariable } from "hanzi-chai";
import { useState } from "react";
import { useAtomValue, 如字库原子 } from "~/atoms";

type GlyphValue = number | IDVariable;

interface GlyphSelectProps<T> extends SelectProps<T> {
  includeVariables?: boolean;
}

export default function GlyphSelect<T extends GlyphValue = GlyphValue>({
  value,
  onChange,
  includeVariables,
}: GlyphSelectProps<T>) {
  const 字库 = useAtomValue(如字库原子);
  const [options, setOptions] = useState<DefaultOptionType[]>([]);

  return (
    <Select
      options={options}
      value={value}
      onChange={onChange}
      allowClear={false}
      showSearch
      placeholder="笔画搜索"
      onSearch={(input) => {
        if (input.length === 0) {
          setOptions([]);
          return;
        }
        const currentOptions: DefaultOptionType[] = [];
        for (const [id, 字形] of 字库.字形迭代器()) {
          if (字形.标准笔顺.startsWith(input)) {
            currentOptions.push({ value: id, label: id });
          }
        }
        if (includeVariables) {
          const num = Number(input);
          if (!Number.isNaN(num)) {
            currentOptions.push({
              value: -num,
              label: `变量 ${num}`,
            });
          }
        }
        setOptions(currentOptions);
      }}
    />
  );
}
