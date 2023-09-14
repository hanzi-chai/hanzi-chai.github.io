import styled from "styled-components";
import { blue, gray } from "@ant-design/colors";

const Wrapper = styled.div<{ $current: true | undefined, $size: 1 | 2 }>`
  width: ${(props) => (props.$size * 32)}px;
  height: 32px;
  text-align: center;
  line-height: 32px;
  color: ${(props) => (props.$current ? "white" : "inherit")};
  background-color: ${(props) => (props.$current ? blue.primary : "inherit")};

  &:hover {
    background-color: ${(props) => (props.$current ? blue[7] : gray[0])};
    transition: background-color 400ms;
  }
`;

interface CharProps {
  name: string;
  current: boolean;
  change: (s: string | undefined) => void;
}

const Char = ({ name, current, change }: CharProps) => {
  return (
    <Wrapper $current={current || undefined} $size={name.length as 1 | 2} onClick={() => current ? change(undefined) : change(name)}>
      {name}
    </Wrapper>
  );
};

export default Char;
