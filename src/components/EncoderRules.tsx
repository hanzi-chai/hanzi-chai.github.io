import { Button, Cascader, Flex, Form, Input, Space, Typography } from "antd";
import { Select } from "./Utils";
import { Config } from "~/lib/config";
import DeleteOutlined from "@ant-design/icons/DeleteOutlined";
import { useAtom, configEncoderAtom, useAtomValue } from "~/atoms";

const defaultRules: NonNullable<Config["encoder"]["rules"]> = [
  { length_equal: 2, formula: "AaAbBaBb" },
  { length_equal: 3, formula: "AaBaCaCb" },
  { length_in_range: [4, 10], formula: "AaBaCaZa" },
];

const EncoderRules = () => {
  const [encoder, setEncoder] = useAtom(configEncoderAtom);
  const wordLengthArray = [...Array(9).keys()].map((x) => ({
    label: x + 2,
    value: x + 2,
  }));
  return (
    <>
      <Typography.Title level={3}>编码特性</Typography.Title>
      <Flex gap="middle" justify="center">
        <Form.Item label="最大码长">
          <Select
            value={encoder.max_length}
            options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
              .map((x) => ({
                label: x.toString(),
                value: x as number | undefined,
              }))
              .concat([{ label: "不限制", value: undefined }])}
            onChange={(value) => setEncoder({ ...encoder, max_length: value })}
          />
        </Form.Item>
        <Form.Item label="顶屏码长">
          <Select
            value={encoder.max_length}
            options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
              .map((x) => ({
                label: x.toString(),
                value: x as number | undefined,
              }))
              .concat([{ label: "不自动顶屏", value: undefined }])}
            onChange={(value) =>
              setEncoder({ ...encoder, auto_select_length: value })
            }
          />
        </Form.Item>
      </Flex>
      <Flex vertical align="center">
        {(encoder.rules ?? defaultRules).map((rule, index) => {
          return (
            <Flex key={index} gap="middle" justify="center">
              {"length_equal" in rule ? (
                <Form.Item label="词语长度为">
                  <Select value={rule.length_equal} options={wordLengthArray} />
                </Form.Item>
              ) : (
                <Form.Item label="词语长度在范围内">
                  <Cascader
                    value={rule.length_in_range}
                    options={wordLengthArray.map((x) => ({
                      ...x,
                      children: wordLengthArray,
                    }))}
                  />
                </Form.Item>
              )}
              <Form.Item label="规则">
                <Input value={rule.formula} />
              </Form.Item>
              <Button
                shape="circle"
                type="text"
                danger
                onClick={() => {}}
                icon={<DeleteOutlined />}
              />
            </Flex>
          );
        })}
        <Space>
          <Button>添加规则</Button>
          <Button>添加规则（范围）</Button>
        </Space>
      </Flex>
    </>
  );
};

export default EncoderRules;
