import { useState } from "react";
import {
  useAtomValue,
  displayAtom,
  useAddAtom,
  customizeAtom,
  useRemoveAtom,
} from "~/atoms";
import { Button, Flex, Modal, Popover, Space } from "antd";
import { DeleteButton, MinusButton, PlusButton } from "./Utils";
import Root from "./Element";
import ElementSelect, { ElementSelectProps } from "./ElementSelect";
import Char from "./Character";

function RootSelectPopover(props: ElementSelectProps) {
  const display = useAtomValue(displayAtom);
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
      <Root>{display(props.char!)}</Root>
    </Popover>
  );
}

function AnalysisCustomizer({ component }: { component: string }) {
  const customize = useAtomValue(customizeAtom);
  const sequence = customize[component] ?? [];
  const addCustomization = useAddAtom(customizeAtom);

  return (
    <>
      <Flex gap="small" align="center">
        <span>（自定义：）</span>
        {sequence.map((x, i) => (
          <RootSelectPopover
            key={i}
            char={x}
            onlyRootsAndStrokes
            onChange={(s) =>
              addCustomization(
                component,
                sequence.map((y, j) => (i === j ? s : y)),
              )
            }
          />
        ))}
        <PlusButton
          onClick={() => addCustomization(component, sequence.concat("1"))}
        />
        <MinusButton
          onClick={() =>
            addCustomization(component, sequence.slice(0, sequence.length - 1))
          }
        />
      </Flex>
    </>
  );
}

export default function ResultSummary({
  char,
  rootSeries,
  disableCustomize = false,
}: {
  char: string;
  rootSeries: string[];
  disableCustomize?: boolean;
}) {
  const display = useAtomValue(displayAtom);
  const customize = useAtomValue(customizeAtom);
  const add = useAddAtom(customizeAtom);
  const remove = useRemoveAtom(customizeAtom);
  const overrideRootSeries = customize[char];
  return (
    <Flex gap="middle" justify="space-between">
      <Space onClick={(e) => e.stopPropagation()}>
        <Char>{display(char)}</Char>
        {rootSeries.map((x, index) => (
          <Root key={index}>{display(x)}</Root>
        ))}
        {overrideRootSeries && <AnalysisCustomizer component={char} />}
      </Space>
      {!disableCustomize && (
        <span onClick={(e) => e.stopPropagation()}>
          {overrideRootSeries ? (
            <Button onClick={() => remove(char)}>取消自定义</Button>
          ) : (
            <Button onClick={() => add(char, ["1"])}>自定义</Button>
          )}
        </span>
      )}
    </Flex>
  );
}
