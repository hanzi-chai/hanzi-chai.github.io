import { Space, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import Root from "./Root";
import styled from "styled-components";
import { SchemeWithData } from "../lib/chai";
import { useContext } from "react";
import { ConfigContext } from "./Context";
import { Config, sieveMap } from "../lib/config";

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
    dataIndex: "length",
    key: "length",
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

const makeSorter = (selector: Config["selector"]) => {
  const selectorFields = selector.map((x) => sieveMap.get(x)!.name);
  return (a: Partial<SchemeWithData>, b: Partial<SchemeWithData>) => {
    for (const f of selectorFields) {
      const field = f as keyof SchemeWithData;
      const [af, bf] = [a[field], b[field]];
      if (af === undefined && bf === undefined) return 0;
      if (af === undefined) return -1;
      if (bf === undefined) return 1;
      if (af < bf) return -1;
      if (af > bf) return 1;
    }
    return 0; // never
  };
};

const RootSlices = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 0 16px;
`;

const RootSlice = styled.div`
  display: flex;
  align-items: center;
`;

const ResultDetail = ({
  data,
  map,
}: {
  data: Partial<SchemeWithData>[];
  map: [number[], string][];
}) => {
  const { selector } = useContext(ConfigContext);
  return data.length ? (
    <>
      <RootSlices>
        {map
          .filter(([v, s]) => v.length > 1)
          .map(([v, s]) => (
            <RootSlice key={v.join(",")}>
              <span>({v.join(",")}) =&nbsp;</span>
              <Root name={s} />
            </RootSlice>
          ))}
      </RootSlices>
      <Table
        columns={columns}
        dataSource={data.sort(makeSorter(selector))}
        pagination={{ hideOnSinglePage: true }}
        size="small"
      />
    </>
  ) : (
    <div></div>
  );
};

export default ResultDetail;
