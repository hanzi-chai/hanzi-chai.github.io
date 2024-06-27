import { Button } from "antd";
import type { StarterType } from "~/lib";
import {
  classifierTypes,
  createConfig,
  encoderTypes,
  keyboardTypes,
} from "~/lib";
import type { Updater } from "use-immer";
import type { Config } from "~/lib";
import { nanoid } from "nanoid";
import {
  ModalForm,
  ProFormSelect,
  ProFormText,
} from "@ant-design/pro-components";

export default function Starter({
  setConfigs,
}: {
  setConfigs: Updater<Record<string, Config>>;
}) {
  const required = [{ required: true }];
  const makeOptions = (types: readonly string[]) =>
    types.map((x) => ({ value: x, label: x }));
  return (
    <ModalForm<StarterType>
      layout="horizontal"
      trigger={<Button type="primary">新建</Button>}
      title="方案模板"
      onFinish={async (values) => {
        const config = createConfig(values);
        setConfigs((configs) => {
          configs[nanoid(9)] = config;
          return undefined;
        });
        return true;
      }}
    >
      <ProFormText name="name" label="方案名称" rules={required} />
      <ProFormSelect
        name="data"
        label="笔画分类预设"
        rules={required}
        options={makeOptions(classifierTypes)}
      />
      <ProFormSelect
        name="keyboard"
        label="键盘布局预设"
        rules={required}
        options={makeOptions(keyboardTypes)}
      />
      <ProFormSelect
        name="encoder"
        label="编码规则预设"
        rules={required}
        options={makeOptions(encoderTypes)}
      />
    </ModalForm>
  );
}
