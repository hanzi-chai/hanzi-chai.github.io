import { useContext } from "react";
import styled from "styled-components";
import { DataContext } from "./Context";
import { Typography } from "antd";
import Pool from "./Pool";
import StrokeSearch from "./StrokeSearch";

export default function ComponentPicker({
  setCurrentComponent,
  currentComponent,
}: {
  setCurrentComponent: (s: string) => void;
  currentComponent: string;
}) {
  const CHAI = useContext(DataContext);
  return (
    <List>
      <Typography.Title level={2}>选择部件</Typography.Title>
      <StrokeSearch />
      <Pool />
    </List>
  );
}

const List = styled.div``;
