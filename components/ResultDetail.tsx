import { Space, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import Root from "./Root";
import styled from "styled-components";
import { SchemeWithData } from "../lib/chai";

const RootsContainer = styled.div`
  display: flex;
  gap: 8px;
`;

const columns: ColumnsType<Partial<SchemeWithData>> = [
  {
    title: "拆分方式",
    dataIndex: "roots",
    key: "roots",
    render: (_, { roots }) => (
      <RootsContainer>
        {roots!.map((root, index) => (
          <Root name={root} key={index} />
        ))}
      </RootsContainer>
    ),
  },
  {
    title: "字根数",
    dataIndex: "roots",
    key: "numberOfRoots",
    render: (_, { roots }) => <span>{roots!.length}</span>,
  },
  {
    title: "笔画序",
    dataIndex: "order",
    key: "order",
    render: (_, { order }) => <span>{order && `(${order.join(", ")})`}</span>,
  },
  {
    title: "相交",
    dataIndex: "crossing",
    key: "crossing",
  },
  {
    title: "相连",
    dataIndex: "attaching",
    key: "attaching",
  },
  {
    title: "字根大小",
    dataIndex: "bias",
    key: "bias",
    render: (_, { bias }) => (
      <span>{bias && `(${bias.map((x) => -x).join(", ")})`}</span>
    ),
  },
];

const ResultDetail = ({ data }: { data: SchemeWithData[] }) => {
  return data.length ? (
    <Table
      columns={columns}
      dataSource={data}
      pagination={{ hideOnSinglePage: true }}
      size="small"
    />
  ) : (
    <div></div>
  );
};

export default ResultDetail;
