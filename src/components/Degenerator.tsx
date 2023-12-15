import { Button, Checkbox, Dropdown, Flex, Space, Typography } from "antd";
import { useDesign, useFormConfig } from "./context";
import { Select } from "./Utils";
import classifier, { Feature } from "~/lib/classifier";
import { useState } from "react";
import { defaultDegenerator } from "~/lib/degenerator";

const Degenerator = () => {
  const degenerator =
    useFormConfig().analysis?.degenerator ?? defaultDegenerator;
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
        {Object.entries(degenerator.feature ?? {}).map(([from, to]) => (
          <Flex justify="center" align="center" gap="small" key={from}>
            认为
            <span>{from as Feature}</span>
            与
            <Select<Feature>
              value={to}
              options={options}
              onChange={(value) => {
                design({
                  subtype: "root-degenerator",
                  action: "add",
                  key: from as Feature,
                  value,
                });
              }}
            />
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
          checked={degenerator.no_cross}
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
