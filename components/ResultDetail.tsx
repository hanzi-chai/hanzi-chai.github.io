import { Space, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Root } from "./RootsList";
import styled from "styled-components";

export interface DataType {
  key: string;
  roots: string[];
  // order: number[];
  // numberOfCrosses: number;
  // numberOfAttaches: number;
  // sizes: number[]
}

const RootsContainer = styled.div`
  display: flex;
  gap: 8px;
`;

const columns: ColumnsType<DataType> = [
  {
    title: "拆分方式",
    dataIndex: "roots",
    key: "roots",
    render: (_, { roots }) => (
      <RootsContainer>
        {roots.map((root) => (
          <Root>{root}</Root>
        ))}
      </RootsContainer>
    ),
  },
  {
    title: "字根数",
    dataIndex: "roots",
    key: "numberOfRoots",
    render: (_, { roots }) => <span>{roots.length}</span>,
  },
];

const ResultDetail = ({ data }: { data: DataType[] }) => (
  <Table columns={columns} dataSource={data} />
);

export default ResultDetail;
