import { Select } from "antd";
import type { DefaultOptionType } from "antd/es/select";
import type { SelectProps } from "antd/lib";
import { type IDVariable, 部件 } from "hanzi-chai";
import { useState } from "react";
import { useAtomValue, 字库原子 } from "~/atoms";
import { StrokesView } from "./GlyphView";

type GlyphValue = number | IDVariable;

interface GlyphSelectProps<T> extends SelectProps<T> {
  includeVariables?: boolean;
}

export default function GlyphSelect<T extends GlyphValue = GlyphValue>({
  value,
  onChange,
  includeVariables,
  ...rest
}: GlyphSelectProps<T>) {
  const 字库 = useAtomValue(字库原子);
  const [options, setOptions] = useState<DefaultOptionType[]>([]);

  return (
    <Select
      {...rest}
      options={options}
      value={value}
      onChange={onChange}
      allowClear={false}
      showSearch
      placeholder="笔画搜索"
      filterOption={false}
      onSearch={(input) => {
        if (input.length === 0) {
          setOptions([]);
          return;
        }
        const 选项笔顺列表: (DefaultOptionType & { strokes: string })[] = [];
        for (const [id, 字形] of 字库.字形迭代器()) {
          const typename = 字形 instanceof 部件 ? "部件" : "复合体";
          if (字形.标准笔顺.startsWith(input)) {
            选项笔顺列表.push({
              value: id,
              strokes: 字形.标准笔顺,
              label: (
                <span>
                  <StrokesView glyph={字形.图形盒子} />
                  <span className="text-xs">
                    ({id}, {typename})
                  </span>
                </span>
              ),
            });
          }
        }
        选项笔顺列表.sort((a, b) => a.strokes.length - b.strokes.length);
        const 选项列表: DefaultOptionType[] = 选项笔顺列表.filter(
          (item, index) => item.strokes.length === input.length || index < 5,
        );
        if (includeVariables) {
          const num = Number(input);
          if (!Number.isNaN(num)) {
            选项列表.unshift({
              value: -num,
              label: `变量 ${num}`,
            });
          }
        }
        setOptions(选项列表);
      }}
    />
  );
}
