import {
  ProForm,
  ProFormDependency,
  ProFormDigit,
  ProFormGroup,
  ProFormSelect,
  ProFormSwitch,
} from "@ant-design/pro-components";
import { Form, Space, Typography } from "antd";
import { useAtomValue } from "jotai";
import { Frequency, maxLengthAtom } from "~/atoms";
import { AssemblyResult, summarize } from "~/lib";
import { Select } from "./Utils";
import { Combined } from "./SequenceTable";

export interface AnalyzerForm {
  type: "single" | "multi" | "all";
  filter: boolean;
  length: number;
  top: number;
}

export const defaultAnalyzer: AnalyzerForm = {
  type: "all",
  filter: false,
  length: 0,
  top: 0,
};

export const analyzePrimitiveDuplication = (
  analyzer: AnalyzerForm,
  characterFrequency: Frequency,
  result: Combined[],
) => {
  const duplicationMap = new Map<string, Combined[]>();
  const topCharacters = Object.fromEntries(
    Object.entries(characterFrequency).slice(0, analyzer.top),
  );
  for (const assembly of result) {
    const { name, sequence: elements } = assembly;
    if (
      (analyzer.type === "single" && [...name].length > 1) ||
      (analyzer.type === "multi" && [...name].length === 1)
    ) {
      continue;
    }

    if (analyzer.top !== 0 && !topCharacters[name]) {
      continue;
    }
    const sliced =
      analyzer.length === 0 ? elements : elements.slice(0, analyzer.length);
    const summary = summarize(sliced);
    duplicationMap.set(
      summary,
      (duplicationMap.get(summary) || []).concat(assembly),
    );
  }

  const filtered: Combined[] = [];
  let selections = 0;
  for (const names of duplicationMap.values()) {
    selections += names.length - 1;
    if (analyzer.filter && names.length > 1) {
      filtered.push(...names);
    }
  }
  return [selections, filtered] as const;
};

export default function ({
  selections,
  setAnalyzer,
}: {
  selections: number;
  setAnalyzer: (d: AnalyzerForm) => void;
}) {
  const maxLength = useAtomValue(maxLengthAtom);
  const [form] = Form.useForm<AnalyzerForm>();

  return (
    <>
      <Typography.Title level={3}>原始重码分析</Typography.Title>
      <ProForm<AnalyzerForm>
        form={form}
        layout="horizontal"
        submitter={false}
        initialValues={defaultAnalyzer}
        onValuesChange={(_, values) => setAnalyzer(values)}
      >
        <ProFormGroup>
          <Form.Item label="原始重码">{selections}</Form.Item>
          <ProFormSwitch label="只看有重码" name="filter" width="xs" />
        </ProFormGroup>
        <ProFormGroup>
          <ProFormSelect
            name="type"
            label="类型"
            width="xs"
            options={[
              { label: "全部", value: "all" },
              { label: "一字词", value: "single" },
              { label: "多字词", value: "multi" },
            ]}
          />
          <ProFormSelect
            name="length"
            label="取码"
            width="xs"
            options={[...Array(maxLength).keys()].map((d) => ({
              label: d === 0 ? "全部" : `前 ${d} 码`,
              value: d,
            }))}
            allowClear={false}
          />
          <ProFormDependency name={["top"]}>
            {({ top }) => (
              <Space>
                <Form.Item label="范围">
                  <Select
                    value={top === 0 ? 0 : 1}
                    options={[
                      { label: "全部", value: 0 },
                      { label: "前", value: 1 },
                    ]}
                    onChange={(value) => {
                      const top = value === 0 ? 0 : 500;
                      form.setFieldValue("top", top);
                      setAnalyzer({ ...form.getFieldsValue(), top });
                    }}
                    style={{ width: 96 }}
                  />
                </Form.Item>
                <ProFormDigit name="top" width="xs" disabled={top === 0} />
              </Space>
            )}
          </ProFormDependency>
        </ProFormGroup>
      </ProForm>
    </>
  );
}
