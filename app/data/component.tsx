"use client";

import React from "react";
import ComponentPicker from "../../components/ComponentPicker";
import ComponentModel from "../../components/ComponentModel";
import ComponentView from "../../components/ComponentView";
import { useState } from "react";
import CHAI from "../../data/CHAI.json";

export default function DataPage() {
  const [currentComponent, setCurrentComponent] = useState("");
  const components = Object.keys(CHAI);
  const component = CHAI[currentComponent as "一"];
  return (
    <>
    <div>
      <h1>笔画数据校对</h1>
    </div>
    <ComponentPicker setCurrentComponent={setCurrentComponent} components={components} />
    <ComponentView component={component} />
    <ComponentModel component={component} />
    </>
  );
}
