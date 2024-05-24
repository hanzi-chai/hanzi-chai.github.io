import { Flex, Select, Form, Cascader, Input, Space, Button } from "antd";
import { useListAtom, wordRulesAtom } from "~/atoms";
import { DeleteButton } from "./Utils";
import { Config, wordLengthArray } from "~/lib";

const defaultRules: NonNullable<Config["encoder"]["rules"]> = [
  { length_equal: 2, formula: "AaAbBaBb" },
  { length_equal: 3, formula: "AaBaCaCb" },
  { length_in_range: [4, 10], formula: "AaBaCaZa" },
];

export default function WordRules() {
  const [wordRules, appendRule, excludeRule, modifyRule] =
    useListAtom(wordRulesAtom);
  return (
    <Flex vertical align="center">
      {wordRules.map((rule, index) => {
        return (
          <Flex key={index} gap="middle" justify="center">
            {"length_equal" in rule ? (
              <Form.Item label="长度等于">
                <Select
                  style={{ width: 96 }}
                  value={rule.length_equal}
                  options={wordLengthArray}
                  onChange={(value) => {
                    modifyRule(index, { ...rule, length_equal: value });
                  }}
                />
              </Form.Item>
            ) : (
              <Form.Item label="长度范围">
                <Cascader
                  style={{ width: 96 }}
                  value={rule.length_in_range}
                  options={wordLengthArray
                    .slice(0, wordLengthArray.length - 1)
                    .map((x) => ({
                      ...x,
                      children: wordLengthArray.filter(
                        (y) => y.value > x.value,
                      ),
                    }))}
                  onChange={(value) => {
                    modifyRule(index, {
                      ...rule,
                      length_in_range: value as [number, number],
                    });
                  }}
                />
              </Form.Item>
            )}
            <Form.Item label="规则">
              <Input
                value={rule.formula}
                onChange={(e) =>
                  modifyRule(index, { ...rule, formula: e.target.value })
                }
              />
            </Form.Item>
            <DeleteButton onClick={() => excludeRule(index)} />
          </Flex>
        );
      })}
      <Space>
        <Button onClick={() => appendRule(defaultRules[0]!)}>添加规则</Button>
        <Button onClick={() => appendRule(defaultRules[2]!)}>
          添加规则（范围）
        </Button>
      </Space>
    </Flex>
  );
}
