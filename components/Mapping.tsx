import {
  Button,
  Dropdown,
  Flex,
  Form,
  Input,
  List,
  MenuProps,
  Popover,
  Space,
} from "antd";
import { useContext } from "react";
import {
  DispatchContext,
  useDesign,
  useElement,
  useIndex,
  useRoot,
} from "./context";
import Root from "./Root";
import Char from "./Char";
import { MappedInfo, reverse } from "../lib/utils";
import { Select } from "./Utils";
import { Select as AntdSelect } from "antd";

const AdjustableRoot = ({ name, code }: MappedInfo) => {
  const design = useDesign();
  const { alphabet, maxcodelen } = useRoot();
  const alphabetOptions = Array.from(alphabet).map((x) => ({
    label: x,
    value: x,
  }));
  const allOptions = [{ label: "无", value: "" }].concat(alphabetOptions);
  const keys = Array.from(code).concat(
    Array(maxcodelen - code.length).fill(""),
  );
  return (
    <Popover
      trigger={["click"]}
      title="字根编码"
      content={
        <Space>
          {keys.map((key, index) => {
            return (
              <AntdSelect
                key={index}
                value={key}
                onChange={(event) => {
                  keys[index] = event;
                  return design({
                    subtype: "generic-mapping",
                    action: "add",
                    key: name,
                    value: keys.join(""),
                  });
                }}
                options={index ? allOptions : alphabetOptions}
              />
            );
          })}
          <Button
            onClick={() =>
              design({
                subtype: "generic-mapping",
                action: "remove",
                key: name,
              })
            }
          >
            删除
          </Button>
        </Space>
      }
    >
      <Root>
        {name} {code.slice(1)}
      </Root>
    </Popover>
  );
};

const Mapping = () => {
  const { mapping, alphabet, maxcodelen } = useElement();
  const design = useDesign();
  const reversed = reverse(alphabet, mapping!);
  return (
    <>
      <Form.Item label="字母表">
        <Input
          value={alphabet}
          onChange={(event) =>
            design({ subtype: "generic-alphabet", value: event?.target.value })
          }
        />
      </Form.Item>
      <Form.Item label="最大编码长度">
        <Select
          value={maxcodelen}
          onChange={(event) => {
            design({ subtype: "generic-maxcodelen", value: event });
          }}
          options={[1, 2, 3, 4].map((x) => ({ label: x, value: x }))}
        />
      </Form.Item>
      <List
        dataSource={Object.entries(reversed)}
        renderItem={(item: [string, MappedInfo[]]) => {
          const [key, roots] = item;
          return (
            <Flex>
              <Char>{key}</Char>
              <Flex gap="small" wrap="wrap">
                {roots.map(({ name, code }) => (
                  <AdjustableRoot key={name} name={name} code={code} />
                ))}
              </Flex>
            </Flex>
          );
        }}
      ></List>
    </>
  );
};

export default Mapping;
