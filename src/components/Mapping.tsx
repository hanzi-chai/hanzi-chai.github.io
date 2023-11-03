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
import { useContext, useState } from "react";
import { useDesign, useGenericConfig } from "./context";
import { useForm, useGlyph } from "./contants";
import Root from "./Root";
import Char from "./Char";
import { MappedInfo, displayName, reverse } from "~/lib/utils";
import { RootSelect, Select } from "./Utils";
import { Select as AntdSelect } from "antd";

const AdjustableRoot = ({ name, code }: MappedInfo) => {
  const design = useDesign();
  const form = useForm();
  const { alphabet, maxcodelen, grouping, mapping } = useGenericConfig();
  const alphabetOptions = Array.from(alphabet).map((x) => ({
    label: x,
    value: x,
  }));
  const allOptions = [{ label: "无", value: "" }].concat(alphabetOptions);
  const keys = Array.from(code).concat(
    Array(maxcodelen - code.length).fill(""),
  );
  const affiliates = Object.keys(grouping).filter((x) => grouping[x] === name);
  const [main, setMain] = useState(Object.keys(mapping)[0]);
  const safeDisplay = (x: string) => {
    return form[x] || "123456".includes(x)
      ? displayName(x, form[x])
      : "缺失字根" + x.codePointAt(0)!.toString(16);
  };
  return (
    <Popover
      trigger={["click"]}
      title="字根编码"
      content={
        <Flex vertical gap="middle">
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
          {affiliates.length ? (
            <Flex vertical>
              <span>已归并字根</span>
              {affiliates.map((x) => (
                <Flex key={x} justify="space-between">
                  <Root>{safeDisplay(x)}</Root>
                  <Button
                    onClick={() => {
                      design({
                        subtype: "generic-mapping",
                        action: "add",
                        key: x,
                        value: code,
                      });
                      design({
                        subtype: "generic-grouping",
                        action: "remove",
                        key: x,
                      });
                    }}
                  >
                    取消归并
                  </Button>
                </Flex>
              ))}
            </Flex>
          ) : (
            <Space>
              或归并至
              <RootSelect
                char={undefined}
                onChange={(event) => setMain(event)}
                exclude={name}
              />
              <Button
                onClick={() => {
                  design({
                    subtype: "generic-grouping",
                    action: "add",
                    key: name,
                    value: main,
                  });
                  design({
                    subtype: "generic-mapping",
                    action: "remove",
                    key: name,
                  });
                }}
              >
                归并
              </Button>
            </Space>
          )}
        </Flex>
      }
    >
      <Root>
        {safeDisplay(name)}
        <span style={{ fontSize: "0.8em" }}>
          {affiliates.length
            ? `(${affiliates.map(safeDisplay).join(",")})`
            : ""}
        </span>{" "}
        {code.slice(1)}
      </Root>
    </Popover>
  );
};

const Mapping = () => {
  const { mapping, alphabet, maxcodelen } = useGenericConfig();
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
            <Flex gap="small" style={{ margin: "8px 0" }}>
              <Char>{key}</Char>
              <Flex gap="small" wrap="wrap">
                {roots.map(({ name: name, code }) => (
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
