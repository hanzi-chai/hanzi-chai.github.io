import { useContext } from "react";
import styled from "styled-components";
import { DataContext } from "./Context";

const Wrapper = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  border: 1px solid black;
  padding: 8px;
  margin: 16px 0;
`;

export const Char = styled.div`
  width: 32px;
  height: 32px;
  text-align: center;
  line-height: 32px;

  &:hover {
    background-color: #ccc;
    transition: background-color 400ms;
  }
`;

const Pool = () => {
  const CHAI = useContext(DataContext);
  return <Wrapper>
    { Object.keys(CHAI).filter(x => x.length === 1).map(x => <Char>{ x }</Char>)}
  </Wrapper>
}

export default Pool;