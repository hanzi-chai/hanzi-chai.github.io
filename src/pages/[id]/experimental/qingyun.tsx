import { Flex, Space, Tag, Typography } from "antd";
import styled from "styled-components";
import { infoAtom, keyboardAtom, useAtomValue, useChaifenTitle } from "~/atoms";
import { ElementLabel } from "~/components/Mapping";
import { Display } from "~/components/Utils";

const PrintArea = styled.div`
  width: 210mm;
  height: 297mm;
  float: left;

  padding: 10mm 10mm;
  border: 1px #d3d3d3 solid;
  border-radius: 5px;
  background: white;
  box-shadow: 0 0 8px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  justify-content: space-between;

  @media print {
    position: fixed;
    top: 0;
    left: 0;
    border: none;
    border-radius: 0;
  }
`;

const Secondary = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1rem;
`;

const Keyboard = styled.div`
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-template-rows: repeat(23, 1fr);
  margin: 1rem 0;
  height: 26cm;
`;

const Box = styled.div`
  text-align: center;
  place-content: center;
  border: 1px solid #d3d3d3;
`;

export default function Schematic() {
  useChaifenTitle("图示");
  const { name, author, version, description } = useAtomValue(infoAtom);
  const { mapping, grouping } = useAtomValue(keyboardAtom);
  const dama = "bpmfdtnlgkhjqxzcsrwyv";
  const xiaoma = "aoeiu;,./_";
  const dama_shengmu = [...dama].map((char) => ({
    key: char,
    elements: Object.entries(mapping)
      .filter(([key, value]) => value == char && key.startsWith("声-"))
      .map(([key]) => key.replace("声-", "")),
  }));
  const xiaoma_yunmu = [...xiaoma].map((char) => ({
    key: char,
    elements: Object.entries(mapping)
      .filter(([_, value]) => value == char)
      .map(([key]) => key.replace("韵-", "")),
  }));
  return (
    <div>
      <PrintArea>
        <Flex justify="center">
          <Secondary>
            <Typography.Text>{description}</Typography.Text>
          </Secondary>
          <Typography.Title style={{ margin: 0 }}>{name}</Typography.Title>
          <Secondary>
            <Space>
              <Tag color="blue">作者：{author}</Tag>
              <Tag color="cyan">版本：{version}</Tag>
            </Space>
          </Secondary>
        </Flex>
        <Keyboard>
          <Box />
          <Box>小码</Box>
          {[...xiaoma].map((char) => (
            <Box key={char}>{char.toUpperCase()}</Box>
          ))}
          <Box>大码</Box>
          <Box>声韵</Box>
          {xiaoma_yunmu.map(({ key, elements }) => (
            <Box key={key}>{elements.join(", ")}</Box>
          ))}
          {dama_shengmu.map(({ key, elements }) => (
            <>
              <Box key={key}>{key.toUpperCase()}</Box>
              <Box key={key}>{elements.join(", ")}</Box>
              {[...xiaoma].map((subChar) => (
                <Box key={`${key}${subChar}`}>
                  {Object.entries(mapping)
                    .filter(([element, value]) => {
                      if (subChar === "_") {
                        return value === key && !element.startsWith("声-");
                      } else {
                        return value == key + subChar;
                      }
                    })
                    .map(([key, value]) => (
                      <Display name={key} />
                    ))}
                </Box>
              ))}
            </>
          ))}
        </Keyboard>
      </PrintArea>
    </div>
  );
}
