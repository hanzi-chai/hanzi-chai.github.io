import { Button, Divider, List, Typography } from "antd";
import { useContext, useState } from "react";
import styled from "styled-components";
import { ConfigContext, WenContext, DispatchContext } from "./Context";
import Root from "./Root";
import { reverseClassifier } from "../lib/utils";

const Wrapper = styled.div``;

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
  const config = useContext(ConfigContext);
  const dispatch = useContext(DispatchContext);
  const { roots, classifier } = useContext(ConfigContext);
  const reversedClassifier = reverseClassifier(classifier);
  const CHAI = useContext(WenContext);
  // 现在只处理 roots 是某个部件或其切片的情形，其余暂不处理
  const data: string[][] = Object.keys(classifier).map((key) => []);
  for (const root of roots) {
    if (CHAI[root]) {
      const { feature } = CHAI[root].shape[0].glyph[0];
      const featureClass = reversedClassifier.get(feature) || "0";
      data[parseInt(featureClass) - 1].push(root);
    } else if (config.aliaser[root]) {
      const { source, indices } = config.aliaser[root];
      const { feature } = CHAI[source].shape[0].glyph[indices[0]];
      const featureClass = reversedClassifier.get(feature) || "0";
      data[parseInt(featureClass) - 1].push(root);
    } else {
    }
  }
  return (
    <Wrapper>
      <Typography.Title level={2}>字根列表</Typography.Title>
      <List
        dataSource={data}
        renderItem={(items: string[], order: number) => {
          return (
            <div key={order}>
              <Divider orientation="left">
                起笔为&nbsp;
                <Root name={`${order + 1}`} />
              </Divider>
              <RootContainer>
                {items.map((item) => (
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
            rootName && dispatch({ type: "remove-root", content: rootName })
          }
        >
          删除
        </Button>
      </ButtonGroup>
    </Wrapper>
  );
};

export default RootsList;
