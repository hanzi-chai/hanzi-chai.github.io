import { Input, Tabs, Typography } from "antd";
import { useState } from "react";
import Pool from "./Pool";
import StrokeSearch from "./StrokeSearch";
import ElementAdder from "./ElementAdder";

const RootPicker = () => {
  const [name, setName] = useState(undefined as string | undefined);
  const [sequence, setSequence] = useState("");
  return (
    <>
      <StrokeSearch sequence={sequence} setSequence={setSequence} />
      <Pool name={name} setName={setName} sequence={sequence} />
      <ElementAdder name={name} />
    </>
  );
};

export default RootPicker;
