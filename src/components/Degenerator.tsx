import { Button, Checkbox, Dropdown, Flex, Space, Typography } from "antd";
import { useDesign, useFormConfig } from "./context";
import { Select } from "./Utils";
import classifier, { Feature } from "~/lib/classifier";
import { useState } from "react";

const Degenerator = () => {
  const {
    analysis: { degenerator },
  } = useFormConfig();
  const design = useDesign();
  const [feature, setFeature] = useState<Feature>("横");
  const options = Object.keys(classifier).map((feature) => ({
    label: feature,
    value: feature,
  }));
  return (
    <>
      <Typography.Title level={3}>字根认同</Typography.Title>
      <Flex vertical gap="small" align="center">
        {Object.entries(degenerator.feature).map(([from, to]) => (
          <Flex justify="center" align="center" gap="small">
            认为
            <Select<Feature> value={from as Feature} options={options} />
            与
            <Select<Feature> value={to} options={options} />
            相同
            <Button
              onClick={() => {
                design({
                  subtype: "root-degenerator",
                  action: "remove",
                  key: from as Feature,
                });
              }}
            >
              删除
            </Button>
          </Flex>
        ))}
        <Flex gap="middle">
          <Select value={feature} options={options} onChange={setFeature} />
          <Button
            type="primary"
            onClick={() => {
              design({
                subtype: "root-degenerator",
                action: "add",
                key: feature,
                value: "横",
              });
            }}
          >
            添加
          </Button>
        </Flex>
        <Checkbox
          checked={degenerator.nocross}
          onChange={() => {
            design({ subtype: "root-degenerator-nocross", action: "toggle" });
          }}
        >
          相交不拆
        </Checkbox>
      </Flex>
    </>
  );
};

export default Degenerator;
