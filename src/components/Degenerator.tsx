import { Button } from "antd";
import { 退化配置原子, useAtom } from "~/atoms";
import type { Feature } from "~/lib";
import { classifier } from "~/lib";
import {
  ModalForm,
  ProFormGroup,
  ProFormList,
  ProFormSelect,
  ProFormSwitch,
} from "@ant-design/pro-components";

export default function Degenerator() {
  const [degenerator, setDegenerator] = useAtom(退化配置原子);
  const initialValue = {
    no_cross: degenerator.no_cross,
    feature: Object.entries(degenerator.feature ?? {}).map(([from, to]) => ({
      from,
      to,
    })),
  };
  const options = Object.keys(classifier).map((feature) => ({
    label: feature,
    value: feature,
  }));
  return (
    <ModalForm<{ no_cross: boolean; feature: { from: Feature; to: Feature }[] }>
      trigger={<Button>配置字根认同规则</Button>}
      title="字根认同"
      initialValues={initialValue}
      layout="horizontal"
      onFinish={async (values) => {
        const acc = {} as Record<Feature, Feature>;
        values.feature.forEach(({ from, to }) => {
          acc[from] = to;
        });
        setDegenerator({ no_cross: values.no_cross, feature: acc });
        return true;
      }}
    >
      <ProFormList name="feature" alwaysShowItemLabel>
        <ProFormGroup>
          <ProFormSelect
            name="from"
            label="认为"
            options={options}
            fieldProps={{ style: { width: 100 } }}
          />
          <ProFormSelect
            name="to"
            label="等同于"
            options={options}
            fieldProps={{ style: { width: 100 } }}
          />
        </ProFormGroup>
      </ProFormList>
      <ProFormSwitch name="no_cross" label="相交不拆" />
    </ModalForm>
  );
}
