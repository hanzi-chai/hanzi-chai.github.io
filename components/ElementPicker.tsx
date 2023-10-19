import { Checkbox, Flex } from "antd";
import { useRoot } from "./context";
import { ElementNode, provideElements } from "../lib/root";
import { createContext, useContext } from "react";

const LevelContext = createContext(0);

const NodeRenderer = ({ name, children }: ElementNode) => {
  const { nodes } = useRoot();
  const level = useContext(LevelContext);
  return (
    <div style={{ paddingLeft: 16 * level }}>
      <LevelContext.Provider value={level + 1}>
        <Checkbox checked={nodes.includes(name)}>{name}</Checkbox>
        <Flex vertical>
          {children.map((x, index) => (
            <NodeRenderer key={index} {...x} />
          ))}
        </Flex>
      </LevelContext.Provider>
    </div>
  );
};

const ElementPicker = () => {
  return (
    <LevelContext.Provider value={0}>
      <Flex vertical>
        {provideElements.map((x, index) => (
          <NodeRenderer key={index} {...x} />
        ))}
      </Flex>
    </LevelContext.Provider>
  );
};

export default ElementPicker;
