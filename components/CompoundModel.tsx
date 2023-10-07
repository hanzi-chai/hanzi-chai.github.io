import { Empty, Select, Typography } from "antd";
import { Compound, Operand } from "../lib/data";
import styled from "styled-components";
import { PropsWithChildren, useContext } from "react";
import {
  DispatchContext,
  ZiContext,
  useWenCustomized,
  useZiCustomized,
} from "./Context";
import Char from "./Char";
import { MyInputNumber } from "./ComponentModel";
import ConfigItem from "./ConfigItem";

const Wrapper = styled.div``;

const ideos: Operand[] = [
  "⿰",
  "⿱",
  "⿲",
  "⿳",
  "⿴",
  "⿵",
  "⿶",
  "⿷",
  "⿸",
  "⿹",
  "⿺",
  "⿻",
  "〾",
];
// Filter `option.label` match the user type `input`
const filterOption = (
  input: string,
  option?: { label: string; value: string },
) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase());

const CompoundModel = ({ name }: { name?: string }) => {
  const zi = useZiCustomized();
  const wen = useWenCustomized();
  const dispatch = useContext(DispatchContext);
  return (
    <Wrapper>
      <Typography.Title level={2}>调整数据</Typography.Title>
      {name ? (
        <>
          <ConfigItem label="结构">
            <Select
              value={zi[name].operator}
              style={{ width: "128px" }}
              onChange={(operator) => {
                const modified = JSON.parse(
                  JSON.stringify(zi[name]),
                ) as Compound;
                modified.operator = operator;
                dispatch({
                  type: "data",
                  subtype: "compound",
                  key: name,
                  value: modified,
                });
              }}
              options={ideos.map((x) => ({ value: x, label: x }))}
            />
          </ConfigItem>
          {zi[name].operandList.map((value, index) => {
            return (
              <ConfigItem label={`第 ${index + 1} 部`} key={index}>
                <Select
                  style={{ width: "128px" }}
                  showSearch
                  value={value}
                  placeholder="Select a person"
                  optionFilterProp="children"
                  onChange={(part) => {
                    const modified = JSON.parse(
                      JSON.stringify(zi[name]),
                    ) as Compound;
                    modified.operandList[index] = part;
                    dispatch({
                      type: "data",
                      subtype: "compound",
                      key: name,
                      value: modified,
                    });
                  }}
                  filterOption={filterOption}
                  options={Object.keys(zi)
                    .concat(Object.keys(wen))
                    .map((x) => ({ value: x, label: x }))}
                />
              </ConfigItem>
            );
          })}
          {zi[name].mix && (
            <ConfigItem label="混合">
              <MyInputNumber min={1} max={20} value={zi[name].mix} />
            </ConfigItem>
          )}
        </>
      ) : (
        <Empty />
      )}
    </Wrapper>
  );
};

export default CompoundModel;
