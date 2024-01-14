import styled from "styled-components";
import { Button } from "antd";

const Char = styled(Button)`
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  background-color: ${(props) =>
    props.type === "primary" ? "" : "transparent"};
  border-color: transparent;
  box-shadow: none;
`;

export default Char;
