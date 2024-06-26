import { Button, Checkbox, Flex, Typography } from "antd";
import {
  useAtomValue,
  useSetAtom,
  useAddAtom,
  degeneratorAtom,
  useRemoveAtom,
  degeneratorFeatureAtom,
  degeneratorNoCrossAtom,
} from "~/atoms";
import { DeleteButton, Select } from "./Utils";
import type { Feature } from "~/lib";
import { classifier } from "~/lib";
import { useState } from "react";

export default function Degenerator() {
  const degenerator = useAtomValue(degeneratorAtom);
  const addFeature = useAddAtom(degeneratorFeatureAtom);
  const removeFeature = useRemoveAtom(degeneratorFeatureAtom);
  const switchNoCross = useSetAtom(degeneratorNoCrossAtom);
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
              onChange={(value) => addFeature(from as Feature, value)}
            />
            相同
            <DeleteButton onClick={() => removeFeature(from as Feature)} />
          </Flex>
        ))}
        <Flex gap="middle">
          <Select value={feature} options={options} onChange={setFeature} />
          <Button type="primary" onClick={() => addFeature(feature, "横")}>
            添加
          </Button>
        </Flex>
        <Checkbox
          checked={degenerator.no_cross}
          onChange={(e) => switchNoCross(e.target.checked)}
        >
          相交不拆
        </Checkbox>
      </Flex>
    </>
  );
}
