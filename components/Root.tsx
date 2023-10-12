import styled from "styled-components";
import { blue } from "@ant-design/colors";
import { Button } from "antd";

const Wrapper = styled(Button)<{ $size: 1 | 2 }>`
  width: ${(props) => props.$size * 32}px;
  height: 32px;
  padding: 0;

  &:focus {
    background-color: ${blue.primary};
  }
`;

interface RootProps {
  name: string;
}

export const Root2 = ({ name }: RootProps) => {
  return <Wrapper $size={name.length as 1 | 2}>{name}</Wrapper>;
};

const Root = styled(Button)`
  min-width: 32px;
  padding: 0 8px;
  height: 32px;
`;

export default Root;
