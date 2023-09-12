import styled from "styled-components";
import RootPicker from "./RootPicker";
import RootsList from "./RootsList";

const Main = styled.main`
  display: flex;
`;

const Roots = () => {
  return <Main>
    <RootPicker />
    <RootsList />
  </Main>
}

export default Roots;
