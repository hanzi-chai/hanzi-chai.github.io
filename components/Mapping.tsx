import {
  Button,
  Divider,
  Dropdown,
  Form,
  Input,
  List,
  MenuProps,
  Typography,
} from "antd";
import { useContext, useState } from "react";
import styled from "styled-components";
import { DispatchContext, useElement, useIndex, useRoot } from "./Context";
import Root from "./Root";
import Char from "./Char";
import { reverse } from "../lib/utils";

const ElementContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const Line = styled.div`
  display: flex;
  gap: 16px;
  margin: 16px 0;
`;

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
            <Line>
              <Char name={key} />
              <ElementContainer>
                {roots.map((name) => (
                  <AdjustableRoot key={name} name={name} />
                ))}
              </ElementContainer>
            </Line>
          );
        }}
      ></List>
    </>
  );
};

export default Mapping;
