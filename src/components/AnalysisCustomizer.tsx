import { useState, memo, useCallback } from "react";
import {
  useSetAtom,
  useAtomValue,
  addRootCustomizeAtom,
  removeRootCustomizeAtom,
  useDisplay,
  configAnalysisAtom,
} from "~/atoms";
import { Button, Flex, Popover } from "antd";
import { ItemSelect, RootSelect } from "./Utils";
import Char from "./Char";
import PlusOutlined from "@ant-design/icons/PlusOutlined";
import MinusOutlined from "@ant-design/icons/MinusOutlined";
import DeleteOutlined from "@ant-design/icons/DeleteOutlined";

interface RootSelectProps {
  char: string;
  onChange: (s: string) => void;
  exclude: string;
  withGrouped?: boolean;
}

function RootSelectPopover(props: RootSelectProps) {
  const display = useDisplay();
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={(v) => setOpen(v)}
      trigger="hover"
      content={
        <RootSelect
          {...props}
          onChange={(v) => {
            props.onChange(v);
            setOpen(false);
          }}
        />
      }
    >
      <Button type="dashed" color="blue">
        {display(props.char)}
      </Button>
    </Popover>
  );
}

const EachSequence = ({
  component,
  sequencejoin,
  display,
}: {
  component: string;
  sequencejoin: string;
  display: Function;
}) => {
  const sequence = sequencejoin.split(" ");
  const addRootCustomize = useSetAtom(addRootCustomizeAtom);
  const removeRootCustomize = useSetAtom(removeRootCustomizeAtom);

  return (
    <Flex justify="space-between" key={component}>
      <Char>{display(component)}</Char>
      <Flex gap="small">
        {sequence.map((x, i) => (
          <RootSelectPopover
            withGrouped
            key={i}
            char={x}
            onChange={(s) =>
              addRootCustomize(
                component,
                sequence.map((y, j) => (i === j ? s : y)),
              )
            }
            exclude=""
          />
        ))}
        <Button
          shape="circle"
          type="text"
          onClick={() => addRootCustomize(component, sequence.concat("1"))}
          icon={<PlusOutlined />}
        />
        <Button
          shape="circle"
          type="text"
          onClick={() =>
            addRootCustomize(component, sequence.slice(0, sequence.length - 1))
          }
          icon={<MinusOutlined />}
        />
        <Button
          shape="circle"
          type="text"
          danger
          onClick={() => removeRootCustomize(component)}
          icon={<DeleteOutlined />}
        />
      </Flex>
    </Flex>
  );
};

const MemoEachSequence = memo(EachSequence);

const AnalysisCustomizer = () => {
  const customize = useAtomValue(configAnalysisAtom)?.customize ?? {};
  const display = useCallback(useDisplay, [])();
  const [newCustomization, setNew] = useState<string | undefined>(undefined);
  const addRootCustomize = useSetAtom(addRootCustomizeAtom);
  return (
    <>
      {Object.entries(customize).map(([component, sequence]) => (
        <MemoEachSequence
          component={component}
          sequencejoin={sequence.join(" ")}
          key={String(component)}
          display={display}
        />
      ))}
      <Flex justify="center" gap="large">
        <ItemSelect value={newCustomization} onChange={setNew} />
        <Button
          type="primary"
          onClick={() => addRootCustomize(newCustomization!, ["1"])}
          disabled={newCustomization === undefined}
        >
          添加自定义
        </Button>
      </Flex>
    </>
  );
};

export default AnalysisCustomizer;
