import { Space, Table, Tag } from "antd";
import type { ColumnType, ColumnsType } from "antd/es/table";
import Root from "./Root";
import styled from "styled-components";
import { SchemeWithData } from "../lib/root";
import { useRoot } from "./Context";
import { Config, RootConfig, Selector } from "../lib/config";
import { sieveMap } from "../lib/selector";

const RootsContainer = styled.div`
  display: flex;
  gap: 8px;
`;

const makeSorter = (selector: Selector) => {
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
  const {
    analysis: { selector },
  } = useRoot();

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
  ];

  for (const sieve of selector) {
    const { title, name, display } = sieveMap.get(sieve)!;
    let render: ColumnType<Partial<SchemeWithData>>["render"] = undefined;
    if (display) {
      render = (_, data) => {
        const value = data[name as "length"] as number | undefined;
        const cast = display as (data: number) => string;
        return <span>{value && cast(value)}</span>;
      };
    }
    columns.push({ title, dataIndex: name, key: name, render });
  }

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
