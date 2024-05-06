import { Button, Cascader, Flex, Form, Input, Space, Typography } from "antd";
import { DeleteButton, KeyList, Select } from "./Utils";
import { Config } from "~/lib";
import { useAtom, useAtomValue, keyboardAtom, useListAtom } from "~/atoms";
import {
  autoSelectLengthAtom,
  autoSelectPatternAtom,
  maxLengthAtom,
  selectKeysAtom,
  shortCodeSchemesAtom,
  wordRulesAtom,
} from "~/atoms/encoder";
import { printableAscii } from "~/lib";

const EncoderRules = () => {
  const [maxLength, setMaxLength] = useAtom(maxLengthAtom);
  const [autoSelectLength, setAutoSelectLength] = useAtom(autoSelectLengthAtom);
  const [autoSelectPattern, setAutoSelectPattern] = useAtom(
    autoSelectPatternAtom,
  );
  const [selectKeys, setSelectKeys] = useAtom(selectKeysAtom);
  const [shortCodeSchemes, appendScheme, excludeScheme, modifyScheme] =
    useListAtom(shortCodeSchemesAtom);
  const { alphabet } = useAtomValue(keyboardAtom);
  const allowedSelectKeys = printableAscii.filter((x) => !alphabet.includes(x));
  return (
    <>
      <Typography.Title level={3}>编码特性</Typography.Title>
      <Flex gap="middle">
        <Form.Item label="最大码长">
          <Select
            value={maxLength}
            options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((x) => ({
              label: x.toString(),
              value: x,
            }))}
            onChange={setMaxLength}
          />
        </Form.Item>
        <Form.Item label="顶屏码长">
          <Select
            value={autoSelectLength}
            options={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((x) => ({
              label: x.toString(),
              value: x,
            }))}
            onChange={setAutoSelectLength}
          />
        </Form.Item>
        <Form.Item label="顶屏模式">
          <Flex gap="small">
            <Input
              value={autoSelectPattern}
              onChange={(e) => setAutoSelectPattern(e.target.value)}
              style={{ width: 128 }}
            />
            <Button onChange={() => setAutoSelectPattern(undefined)}>
              清空
            </Button>
          </Flex>
        </Form.Item>
      </Flex>
      <Form.Item label="选择键">
        <KeyList
          keys={selectKeys}
          setKeys={setSelectKeys}
          allKeys={allowedSelectKeys}
        />
      </Form.Item>
      <Typography.Title level={3}>一字词简码</Typography.Title>
      <Flex vertical align="center">
        {shortCodeSchemes.map((scheme, index) => {
          return (
            <Flex key={index} gap="middle">
              <Form.Item label="规则">
                <Select
                  value={scheme.prefix}
                  options={[1, 2, 3, 4].map((x) => ({
                    label: `前 ${x} 码`,
                    value: x,
                  }))}
                  onChange={(value) => {
                    modifyScheme(index, { ...scheme, prefix: value });
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
                    modifyScheme(index, { ...scheme, count: value });
                  }}
                />
              </Form.Item>
              <DeleteButton onClick={() => excludeScheme(index)} />
            </Flex>
          );
        })}
        <Space>
          <Button onClick={() => appendScheme({ prefix: 2 })}>
            添加简码规则
          </Button>
        </Space>
      </Flex>
      <Typography.Title level={3}>多字词简码</Typography.Title>
      <Typography.Paragraph>
        多字词简码功能正在开发中，敬请期待。
      </Typography.Paragraph>
    </>
  );
};

export default EncoderRules;
