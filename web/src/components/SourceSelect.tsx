import { Select } from "antd";
import type { SelectProps } from "antd/lib";
import { useAtomValue, 全部来源原子 } from "~/atoms";

interface SourceSelectProps extends SelectProps<string[]> {
  value?: string[];
  onChange?: (value: string[]) => void;
}

export default function SourceSelect(props: SourceSelectProps) {
  const sources = useAtomValue(全部来源原子);
  return (
    <Select
      {...props}
      className="min-w-16"
      mode="multiple"
      options={sources.map((source) => ({ label: source, value: source }))}
    />
  );
}
