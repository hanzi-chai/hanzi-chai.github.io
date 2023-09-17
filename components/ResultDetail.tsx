import { Space, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import Root from "./Root";
import styled from "styled-components";

export interface DataType {
  key: string;
  roots: string[];
  order: number[];
  numberOfCrosses: number;
  numberOfAttaches: number;
  sizes: number[];
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
        {roots.map((root, index) => (
          <Root name={root} key={index} />
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
  {
    title: "笔画序",
    dataIndex: "order",
    key: "order",
    render: (_, { order }) => <span>{`(${order.join(", ")})`}</span>,
  },
  {
    title: "相交",
    dataIndex: "numberOfCrosses",
    key: "numberOfCrosses",
  },
  {
    title: "相连",
    dataIndex: "numberOfAttaches",
    key: "numberOfAttaches",
  },
  {
    title: "字根大小",
    dataIndex: "sizes",
    key: "sizes",
    render: (_, { sizes }) => <span>{`(${sizes.join(", ")})`}</span>,
  },
];

const ResultDetail = ({ data }: { data: DataType[] }) => (
  <Table
    columns={columns}
    dataSource={data}
    pagination={{ hideOnSinglePage: true }}
    size="small"
  />
);

export default ResultDetail;
