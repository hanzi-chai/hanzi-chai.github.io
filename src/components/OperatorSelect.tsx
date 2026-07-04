import { Select } from "antd";
import type { SelectProps } from "antd/lib";
import {
  type OperatorVariable,
  type 结构描述字符,
  结构描述字符列表,
} from "hanzi-chai";

interface OperatorSelectProps<T> extends SelectProps<T> {
  includeVariables?: boolean;
}

export default function OperatorSelect<
  T extends 结构描述字符 | OperatorVariable,
>({ includeVariables, ...rest }: OperatorSelectProps<T>) {
  const options = 结构描述字符列表.map((op) => ({ label: op, value: op }));
  return <Select className="w-16!" options={options} {...rest} />;
}
