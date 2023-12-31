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
import {
  DeleteButton,
  ItemSelect,
  MinusButton,
  PlusButton,
  ElementSelect,
  ElementSelectProps,
} from "./Utils";
import Char from "./Char";

function RootSelectPopover(props: ElementSelectProps) {
  const display = useDisplay();
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={(v) => setOpen(v)}
      trigger="hover"
      content={
        <ElementSelect
          {...props}
          onChange={(v) => {
            props.onChange(v);
            setOpen(false);
          }}
        />
      }
    >
      <Button type="dashed" color="blue">
        {display(props.char!)}
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
            key={i}
            char={x}
            onlyRootsAndStrokes
            onChange={(s) =>
              addRootCustomize(
                component,
                sequence.map((y, j) => (i === j ? s : y)),
              )
            }
          />
        ))}
        <PlusButton
          onClick={() => addRootCustomize(component, sequence.concat("1"))}
        />
        <MinusButton
          onClick={() =>
            addRootCustomize(component, sequence.slice(0, sequence.length - 1))
          }
        />
        <DeleteButton onClick={() => removeRootCustomize(component)} />
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
        <ItemSelect
          value={newCustomization}
          onChange={setNew}
          customFilter={([_, glyph]) => {
            return glyph.default_type === "component";
          }}
        />
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
