import { Input, Tabs, Typography } from "antd";
import { useState } from "react";
import Pool from "./Pool";
import StrokeSearch from "./StrokeSearch";
import ElementAdder from "./ElementAdder";

const RootPicker = () => {
  const [char, setChar] = useState<string | undefined>(undefined);
  const [sequence, setSequence] = useState("");
  return (
    <>
      <StrokeSearch sequence={sequence} setSequence={setSequence} />
      <Pool char={char} setChar={setChar} sequence={sequence} />
      <ElementAdder char={char} />
    </>
  );
};

export default RootPicker;
