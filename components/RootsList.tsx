import { Divider, List, Typography } from "antd";
import { useContext } from "react";
import styled from "styled-components";
import { ConfigContext, DataContext } from "./Context";

const Wrapper = styled.div``;

export const Root = styled.div`
  width: 32px;
  height: 32px;
  line-height: 32px;
  border-radius: 8px;
  border: 1px solid black;
  display: inline-block;
  text-align: center;
`;

const RootContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const Group = (items: string[], order: number) => {
  return (
    <div key={order}>
      <Divider orientation="left">
        起笔为&nbsp;<Root>{ order + 1 }</Root>
      </Divider>
      <RootContainer>
        {items.map((item) => (
          <Root>{item}</Root>
        ))}
      </RootContainer>
    </div>
  );
};

const RootsList = () => {
  const { roots, classifier } = useContext(ConfigContext);
  const reverseClassifier = new Map<string, string>();
  for (const [key, value] of Object.entries(classifier)) {
    for (const v of value) {
      reverseClassifier.set(v, key);
    }
  }
  const CHAI = useContext(DataContext);
  // 现在只处理 roots 是某个部件的情形，其余暂不处理
  const data: string[][] = Object.keys(classifier).map(key => []);
  for (const root of roots) {
    if (CHAI[root]) {
      const { feature } = CHAI[root].shape[0].glyph[0];
      const featureClass = reverseClassifier.get(feature) || "0"
      data[parseInt(featureClass) - 1].push(root);
    } else {
      console.log(root)
    }
  }
  return (
    <Wrapper>
      <Typography.Title level={2}>字根列表</Typography.Title>
      <List dataSource={data} renderItem={Group}></List>
    </Wrapper>
  );
};

export default RootsList;
