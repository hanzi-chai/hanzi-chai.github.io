import { Button, Checkbox, Flex, Typography } from "antd";
import {
  configAnalysisAtom,
  useAtomValue,
  useSetAtom,
  addRootDegeneratorAtom,
  removeRootDegeneratorAtom,
  switchRootDegeneratorNocross,
} from "~/atoms";
import { Select } from "./Utils";
import classifier, { Feature } from "~/lib/classifier";
import { useState } from "react";
import { defaultDegenerator } from "~/lib/degenerator";

const Degenerator = () => {
  const degenerator =
    useAtomValue(configAnalysisAtom)?.degenerator ?? defaultDegenerator;
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
              onChange={(value) =>
                useSetAtom(addRootDegeneratorAtom)(from as Feature, value)
              }
            />
            相同
            <Button
              onClick={() =>
                useSetAtom(removeRootDegeneratorAtom)(from as Feature)
              }
            >
              删除
            </Button>
          </Flex>
        ))}
        <Flex gap="middle">
          <Select value={feature} options={options} onChange={setFeature} />
          <Button
            type="primary"
            onClick={() => useSetAtom(addRootDegeneratorAtom)(feature, "横")}
          >
            添加
          </Button>
        </Flex>
        <Checkbox
          checked={degenerator.no_cross}
          onChange={() => useSetAtom(switchRootDegeneratorNocross)()}
        >
          相交不拆
        </Checkbox>
      </Flex>
    </>
  );
};

export default Degenerator;
