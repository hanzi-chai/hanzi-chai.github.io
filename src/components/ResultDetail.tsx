import { Space, Table } from "antd";
import type { ColumnType, ColumnsType } from "antd/es/table";
import Root from "./Root";
import { SchemeWithData } from "../lib/form";
import { useForm, useRoot } from "./context";
import { Selector } from "../lib/config";
import { sieveMap } from "../lib/selector";

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

const ResultDetail = ({
  data,
  map,
}: {
  data: Partial<SchemeWithData>[];
  map: Record<string, number[][]>;
}) => {
  const {
    analysis: { selector },
  } = useRoot();
  const form = useForm();
  const displayRoot = (c: string) => {
    return form[c] ? form[c].name || c : c;
  };

  const columns: ColumnsType<Partial<SchemeWithData>> = [
    {
      title: "拆分方式",
      dataIndex: "roots",
      key: "roots",
      render: (_, { roots }) => (
        <Space>
          {roots!.map((root, index) => (
            <Root key={index}>{displayRoot(root)}</Root>
          ))}
        </Space>
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
      <Space>
        {Object.entries(map).map(([s, v]) => (
          <Space key={s}>
            <Root>{displayRoot(s)}</Root>
            <span>{v.map((ar) => `(${ar.join(",")})`).join(" ")}</span>
          </Space>
        ))}
      </Space>
      <Table
        columns={columns}
        dataSource={data.sort(makeSorter(selector))}
        pagination={{ hideOnSinglePage: true, defaultPageSize: 20 }}
        size="small"
      />
    </>
  ) : (
    <div></div>
  );
};

export default ResultDetail;
