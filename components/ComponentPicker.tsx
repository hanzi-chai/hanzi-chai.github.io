import styled from "styled-components";

export default function ComponentPicker({
  setCurrentComponent,
  components,
}: {
  setCurrentComponent: (s: string) => void;
  components: string[];
}) {
  return (
    <List>
      <h2>选择汉字</h2>
      <Selector
        size={20}
        onChange={(event) => setCurrentComponent(event.target.value)}
      >
        {[...components]
          .sort((x, y) => {
            if (x.length < y.length) return -1;
            if (x.length > y.length) return 1;
            if (x < y) return -1;
            if (x > y) return 1;
            return 0;
          })
          .map((component) => (
            <option key={component} value={component}>
              {component}
            </option>
          ))}
      </Selector>
    </List>
  );
}

const Selector = styled.select`
  font-size: 1rem;
  width: 50%;
  border: 1px solid black;
`;

const List = styled.div``;