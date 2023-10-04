import { Button, Divider, List, Typography } from "antd";
import { useContext, useState } from "react";
import styled from "styled-components";
import { DispatchContext, useRoot } from "./Context";
import Root from "./Root";
import { halfToFull } from "./utils";

const RootContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const ButtonGroup = styled.div`
  text-align: center;
  margin: 32px 0;
`;

const RootsList = () => {
  const [rootName, setRootName] = useState(undefined as string | undefined);
  const dispatch = useContext(DispatchContext);
  const { mapping } = useRoot();
  const data: Record<string, string[]> = {};
  const alphabet = "qwertyuiopasdfghjklzxcvbnm";
  [...alphabet].forEach((key) => (data[key] = []));
  for (const [root, key] of Object.entries(mapping)) {
    data[key].push(root);
  }
  return (
    <>
      <Typography.Title level={2}>字根列表</Typography.Title>
      <List
        dataSource={Object.entries(data)}
        renderItem={(item: [string, string[]]) => {
          const [key, roots] = item;
          return (
            <div key={key}>
              <Divider orientation="left">
                {halfToFull(key.toUpperCase())}
              </Divider>
              <RootContainer>
                {roots.map((item) => (
                  <Root
                    key={item}
                    name={item}
                    current={rootName === item}
                    change={setRootName}
                  />
                ))}
              </RootContainer>
            </div>
          );
        }}
      ></List>
      <ButtonGroup>
        <Button
          type="primary"
          onClick={() =>
            rootName &&
            dispatch({
              type: "root",
              element: 0,
              subtype: "remove",
              name: rootName,
            })
          }
        >
          删除
        </Button>
      </ButtonGroup>
    </>
  );
};

export default RootsList;
