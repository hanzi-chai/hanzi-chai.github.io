import ComponentPicker from "./ComponentPicker";
import ComponentModel from "./ComponentModel";
import ComponentView from "./ComponentView";
import { useState } from "react";
import CHAI from "../data/CHAI.json";

export default function Data() {
  const [currentComponent, setCurrentComponent] = useState("");
  const components = Object.keys(CHAI);
  const component = CHAI[currentComponent as "一"];
  return (
    <>
      <ComponentPicker
        setCurrentComponent={setCurrentComponent}
        components={components}
      />
      <ComponentView component={component} />
      <ComponentModel component={component} />
    </>
  );
}
