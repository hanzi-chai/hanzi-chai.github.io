import { Button, Flex, Form, Input } from "antd";
import { useAtom, useAtomValue } from "jotai";
import {
  alphabetAtom,
  autoSelectLengthAtom,
  autoSelectPatternAtom,
  maxLengthAtom,
  selectKeysAtom,
} from "~/atoms";
import { printableAscii } from "~/lib";
import { KeyList, Select } from "./Utils";

export default function SelectRules() {
  const [maxLength, setMaxLength] = useAtom(maxLengthAtom);
  const [autoSelectLength, setAutoSelectLength] = useAtom(autoSelectLengthAtom);
  const [autoSelectPattern, setAutoSelectPattern] = useAtom(
    autoSelectPatternAtom,
  );
  const [selectKeys, setSelectKeys] = useAtom(selectKeysAtom);
  const alphabet = useAtomValue(alphabetAtom);
  const allowedSelectKeys = printableAscii.filter((x) => !alphabet.includes(x));
  return (
    <Flex vertical gap="middle">
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
    </Flex>
  );
}
