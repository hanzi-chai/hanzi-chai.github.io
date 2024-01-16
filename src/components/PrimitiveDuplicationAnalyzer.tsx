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
import { maxLengthAtom } from "~/atoms";
import { AssemblyResult } from "~/lib/assembly";
import { renderIndexed } from "~/pages/[id]/assembly";
import { Select } from "./Utils";
import { Frequency } from "./Optimizer";

export interface AnalyzerForm {
  filter: boolean;
  length: number;
  top: number;
}

export const defaultAnalyzer: AnalyzerForm = {
  filter: false,
  length: 0,
  top: 0,
};

export const analyzePrimitiveDuplication = (
  analyzer: AnalyzerForm,
  characterFrequency: Frequency,
  result: AssemblyResult,
) => {
  const duplicationMap = new Map<string, string[]>();
  const topCharacters = Object.fromEntries(
    Object.entries(characterFrequency).slice(0, analyzer.top),
  );
  for (const [name, data] of result.entries()) {
    if (analyzer.top !== 0 && !topCharacters[name]) {
      continue;
    }
    for (const sequence of data.slice(0, 1)) {
      const sliced =
        analyzer.length === 0 ? sequence : sequence.slice(0, analyzer.length);
      const hash = sliced.map((x) => renderIndexed(x, (s) => s)).join(", ");
      duplicationMap.set(hash, (duplicationMap.get(hash) || []).concat([name]));
    }
  }
  const groups = [...duplicationMap.values()];
  const selections = groups.reduce((p, c) => p + c.length, 0) - groups.length;
  const involved = new Set(groups.filter((d) => d.length > 1).flat());
  return [selections, involved] as const;
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
