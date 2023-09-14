import styled from "styled-components";
import { blue, gray } from "@ant-design/colors";

const Wrapper = styled.div<{ $current: true | undefined, $size: 1 | 2 }>`
  width: ${(props) => (props.$size * 32)}px;
  height: 32px;
  line-height: 32px;
  border-radius: 8px;
  border: 1px solid black;
  display: inline-block;
  text-align: center;
  color: ${(props) => (props.$current ? "white" : "inherit")};
  background-color: ${(props) => (props.$current ? blue.primary : "inherit")};

  &:hover {
    background-color: ${(props) => (props.$current ? blue[7] : gray[0])};
    transition: background-color 400ms;
  }
`;

interface RootProps {
  name: string,
  current?: boolean,
  change?: (s: string | undefined) => void
}

const Root = ({ name, current, change }: RootProps) => {
  return <Wrapper $current={current || undefined} $size={name.length as 1 | 2} onClick={change && (() => current ? change(undefined) : change(name))}>
    { name }
  </Wrapper>
}

export default Root;
