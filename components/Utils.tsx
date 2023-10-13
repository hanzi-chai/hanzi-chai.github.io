import { Col, ColProps, Menu, Row, RowProps } from "antd";
import styled from "styled-components";

export const FlexContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin: 8px 0;
`;

const ScrollableRow = styled(Row)`
  flex: 1;
  overflow-y: auto;
`;

export const EditorRow = (props: RowProps) => (
  <ScrollableRow gutter={32} {...props} />
);

const ScrollableColumn = styled(Col)`
  height: 100%;
  overflow-y: auto;
`;

export const Switcher = styled(Menu)``;

export const EditorColumn = (props: ColProps) => (
  <ScrollableColumn className="gutter-row" {...props} />
);
