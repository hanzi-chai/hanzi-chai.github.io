import { Select } from "antd";
import type { DefaultOptionType } from "antd/es/select";
import type { SelectProps } from "antd/lib";
import { type IDVariable, type 字形, 部件 } from "hanzi-chai";
import { useEffect, useState } from "react";
import { useAtomValue, 字库原子 } from "~/atoms";
import GlyphView from "./GlyphView";

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

  useEffect(() => {
    if (typeof value === "object" && value !== null && "variable" in value) {
      setOptions([
        {
          value: JSON.stringify(value),
          label: `变量 ${value.variable}`,
        },
      ]);
      return;
    }
    if (typeof value !== "number") return;
    const 字形 = 字库.获取字形(value);
    if (!字形) return;
    setOptions([
      {
        value: value,
        label: (
          <span>
            <GlyphView glyph={字形.图形盒子} />
            <span className="text-xs">
              ({value}, {字形 instanceof 部件 ? "部件" : "复合体"})
            </span>
          </span>
        ),
      },
    ]);
  }, [value, 字库]);

  const makeOption = (x: 字形) => ({
    value: x.id,
    label: (
      <span>
        <GlyphView glyph={x.图形盒子} />
        <span className="text-xs">
          ({x.id}, {x instanceof 部件 ? "部件" : "复合体"})
        </span>
      </span>
    ),
  });

  const rawValue = typeof value === "number" ? value : JSON.stringify(value);

  return (
    <Select
      {...rest}
      options={options}
      value={rawValue as any}
      onChange={(newValue) => {
        if (typeof newValue === "number") {
          onChange?.(newValue as T);
        } else {
          onChange?.(JSON.parse(newValue as any) as T);
        }
      }}
      showSearch
      placeholder="输入笔画或字符搜索"
      filterOption={false}
      onSearch={(input) => {
        const 选项列表: DefaultOptionType[] = [];
        if (input.length === 0) {
        } else if (/^\d+$/.test(input)) {
          const 选项笔顺列表: (DefaultOptionType & { strokes: string })[] = [];
          for (const [_, 字形] of 字库.字形迭代器()) {
            if (字形.标准笔顺.startsWith(input)) {
              选项笔顺列表.push({
                ...makeOption(字形),
                strokes: 字形.标准笔顺,
              });
            }
          }
          选项笔顺列表.sort((a, b) => a.strokes.length - b.strokes.length);
          for (const [index, item] of 选项笔顺列表.entries()) {
            if (item.strokes.length === input.length || index < 5) {
              选项列表.push(item);
            }
          }
          if (includeVariables) {
            const num = Number(input);
            if (!Number.isNaN(num)) {
              选项列表.unshift({
                value: JSON.stringify({ variable: num }),
                label: `变量 ${num}`,
              });
            }
          }
        } else {
          const 字符数据 = 字库.校验字符(input);
          if (字符数据) {
            const 字形列表 = 字库.查询字符的字形(字符数据.character) ?? [];
            for (const 字形 of 字形列表) {
              选项列表.push(makeOption(字形));
            }
          }
          for (const [_, 字形] of 字库.字形迭代器()) {
            if ((字形.name ?? "").includes(input)) {
              选项列表.push(makeOption(字形));
            }
          }
        }
        setOptions(选项列表);
      }}
    />
  );
}
