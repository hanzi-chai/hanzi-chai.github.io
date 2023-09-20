import { useContext } from "react";
import styled from "styled-components";
import { ConfigContext, WenContext } from "./Context";
import Char from "./Char";
import { Component } from "../lib/data";
import { reverseClassifier } from "../lib/utils";
import { Config } from "../lib/config";

const Wrapper = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  border: 1px solid black;
  padding: 8px;
  margin: 16px 0;
`;

interface PoolProps {
  componentName?: string;
  setComponentName: (s: string | undefined) => void;
  sequence: string;
}

export const makeSequenceFilter = (
  classifier: Config["classifier"],
  sequence: string,
) => {
  const reversedClassifier = reverseClassifier(classifier);
  return ([x, v]: [string, Component]) => {
    const fullSequence = v.shape[0].glyph
      .map((s) => s.feature)
      .map((x) => reversedClassifier.get(x)!)
      .join("");
    return fullSequence.search(sequence) !== -1;
  };
};

const Pool = ({ componentName, setComponentName, sequence }: PoolProps) => {
  const CHAI = useContext(WenContext);
  const { classifier } = useContext(ConfigContext);
  return (
    <Wrapper>
      {Object.entries(CHAI)
        .filter(makeSequenceFilter(classifier, sequence))
        .sort((a, b) => a[0].length - b[0].length)
        .map(([x, v]) => (
          <Char
            key={x}
            name={x}
            current={x === componentName}
            change={setComponentName}
          />
        ))}
    </Wrapper>
  );
};

export default Pool;
