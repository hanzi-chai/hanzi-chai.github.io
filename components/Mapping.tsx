import { Dropdown, Form, Input, List, MenuProps } from "antd";
import { useContext } from "react";
import styled from "styled-components";
import { DispatchContext, useElement, useIndex } from "./context";
import Root from "./Root";
import Char from "./Char";
import { reverse } from "../lib/utils";
import { FlexContainer } from "./Utils";

const AdjustableRoot = ({ name }: { name: string }) => {
  const dispatch = useContext(DispatchContext);
  const index = useIndex();
  const items: MenuProps["items"] = [
    {
      label: "删除",
      key: "remove",
      onClick: () => {
        dispatch({
          type: "element",
          index,
          subtype: "generic-mapping",
          action: "remove",
          key: name,
        });
      },
    },
  ];
  return (
    <Dropdown menu={{ items }} trigger={["contextMenu"]}>
      <Root>{name}</Root>
    </Dropdown>
  );
};

const Mapping = () => {
  const { mapping, alphabet } = useElement();
  const index = useIndex();
  const dispatch = useContext(DispatchContext);
  const reversed = reverse(alphabet, mapping!);
  return (
    <>
      <Form.Item label="字母表">
        <Input
          value={alphabet}
          onChange={(event) =>
            dispatch({
              type: "element",
              index,
              subtype: "generic-alphabet",
              value: event?.target.value,
            })
          }
        />
      </Form.Item>
      <List
        dataSource={Object.entries(reversed)}
        renderItem={(item: [string, string[]]) => {
          const [key, roots] = item;
          return (
            <FlexContainer>
              <Char name={key} />
              <FlexContainer>
                {roots.map((name) => (
                  <AdjustableRoot key={name} name={name} />
                ))}
              </FlexContainer>
            </FlexContainer>
          );
        }}
      ></List>
    </>
  );
};

export default Mapping;
