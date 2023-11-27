import { useState, memo, useCallback } from "react";
import { useDesign, useFormConfig } from "./context";
import { Button, Flex, Popover } from "antd";
import { ItemSelect, RootSelect } from "./Utils";
import Char from "./Char";
import PlusOutlined from "@ant-design/icons/PlusOutlined";
import MinusOutlined from "@ant-design/icons/MinusOutlined";
import DeleteOutlined from "@ant-design/icons/DeleteOutlined";
import { useDisplay } from "./contants";

interface RootSelectProps {
  char?: string;
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
        {display(props.char!)}
      </Button>
    </Popover>
  );
}

const EachSequence = ({
  component,
  sequencejoin,
  design,
  display,
}: {
  component: string;
  sequencejoin: string;
  design: Function;
  display: Function;
}) => {
  const sequence = sequencejoin.split(" ");

  return (
    <Flex justify="space-between" key={component}>
      <Char>{display(component)}</Char>
      <Flex gap="small">
        {sequence.map((x, i) => (
          <RootSelectPopover
            withGrouped
            key={i}
            char={x}
            onChange={(s) => {
              design({
                subtype: "root-customize",
                action: "add",
                key: component,
                value: sequence.map((y, j) => (i === j ? s : y)),
              });
            }}
            exclude=""
          />
        ))}
        <Button
          shape="circle"
          type="text"
          onClick={() => {
            design({
              subtype: "root-customize",
              action: "add",
              key: component,
              value: sequence.concat("1"),
            });
          }}
          icon={<PlusOutlined />}
        />
        <Button
          shape="circle"
          type="text"
          onClick={() => {
            design({
              subtype: "root-customize",
              action: "add",
              key: component,
              value: sequence.slice(0, sequence.length - 1),
            });
          }}
          icon={<MinusOutlined />}
        />
        <Button
          shape="circle"
          type="text"
          danger
          onClick={() => {
            design({
              subtype: "root-customize",
              action: "remove",
              key: component,
            });
          }}
          icon={<DeleteOutlined />}
        />
      </Flex>
    </Flex>
  );
};

const MemoEachSequence = memo(EachSequence);

const AnalysisCustomizer = () => {
  const {
    analysis: { customize },
  } = useFormConfig();
  const design = useCallback(useDesign, [])();
  const display = useCallback(useDisplay, [])();
  const [newCustomization, setNew] = useState<string | undefined>(undefined);

  return (
    <>
      {Object.entries(customize).map(([component, sequence]) => (
        <MemoEachSequence
          component={component}
          sequencejoin={sequence.join(" ")}
          key={String(component)}
          display={display}
          design={design}
        />
      ))}
      <Flex justify="center" gap="large">
        <ItemSelect value={newCustomization} onChange={setNew} />
        <Button
          type="primary"
          onClick={() =>
            design({
              subtype: "root-customize",
              action: "add",
              key: newCustomization!,
              value: ["1"],
            })
          }
          disabled={newCustomization === undefined}
        >
          添加自定义
        </Button>
      </Flex>
    </>
  );
};

export default AnalysisCustomizer;
