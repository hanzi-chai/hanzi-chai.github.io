import { Button, Cascader, Flex, Form } from "antd";
import { DeleteButton, Select } from "./Utils";
import { Config, ShortCodeRule, wordLengthArray } from "~/lib";
import { useListAtom } from "~/atoms";
import { shortCodeConfigAtom } from "~/atoms/encoder";

const defaultRules: ShortCodeRule[] = [
  {
    length_equal: 1,
    schemes: [
      { prefix: 1, count: 1 },
      { prefix: 2, count: 1 },
      { prefix: 3, count: 1 },
    ],
  },
  {
    length_in_range: [2, 4],
    schemes: [{ prefix: 2, count: 1 }],
  },
];

export default function ShortCodeRules() {
  const [shortCodeConfig, appendRule, excludeRule, modifyRule] =
    useListAtom(shortCodeConfigAtom);
  return (
    <>
      <Flex vertical align="center">
        {shortCodeConfig.map((rule, ruleIndex) => {
          const schemes = rule.schemes;
          return (
            <Flex vertical key={ruleIndex}>
              <Flex gap="middle">
                {"length_equal" in rule ? (
                  <Form.Item label="长度等于">
                    <Select
                      style={{ width: 96 }}
                      value={rule.length_equal}
                      options={wordLengthArray}
                      onChange={(value) => {
                        modifyRule(ruleIndex, { ...rule, length_equal: value });
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
                        modifyRule(ruleIndex, {
                          ...rule,
                          length_in_range: value as [number, number],
                        });
                      }}
                    />
                  </Form.Item>
                )}
                <Button
                  onClick={() =>
                    modifyRule(ruleIndex, {
                      ...rule,
                      schemes: schemes.concat({ prefix: 1, count: 1 }),
                    })
                  }
                >
                  添加出简方式
                </Button>
                <Button onClick={() => excludeRule(ruleIndex)}>删除规则</Button>
              </Flex>
              {schemes.map((scheme, schemeIndex) => {
                return (
                  <Flex gap="small">
                    <Form.Item label="前缀">
                      <Select
                        value={scheme.prefix}
                        options={[1, 2, 3, 4].map((x) => ({
                          label: `前 ${x} 码`,
                          value: x,
                        }))}
                        onChange={(value) => {
                          modifyRule(ruleIndex, {
                            ...rule,
                            schemes: schemes.map((x, index) =>
                              index === index ? { ...x, prefix: value } : x,
                            ),
                          });
                        }}
                      />
                    </Form.Item>
                    <Form.Item label="数量">
                      <Select
                        value={scheme.count ?? 1}
                        options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((x) => ({
                          label: `${x} 重`,
                          value: x,
                        }))}
                        onChange={(value) => {
                          modifyRule(ruleIndex, {
                            ...rule,
                            schemes: schemes.map((x, index) =>
                              index === index ? { ...x, count: value } : x,
                            ),
                          });
                        }}
                      />
                    </Form.Item>
                    <DeleteButton
                      onClick={() =>
                        modifyRule(ruleIndex, {
                          ...rule,
                          schemes: schemes.filter((x, i) => i !== schemeIndex),
                        })
                      }
                    />
                  </Flex>
                );
              })}
            </Flex>
          );
        })}
      </Flex>
      <Flex justify="center" gap="middle">
        <Button onClick={() => appendRule(defaultRules[0]!)}>添加规则</Button>
        <Button onClick={() => appendRule(defaultRules[1]!)}>
          添加规则（范围）
        </Button>
      </Flex>
    </>
  );
}
