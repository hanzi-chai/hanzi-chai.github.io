import { Flex, Space, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import Root from "./Root";
import { useFormConfig } from "./context";
import type { Selector } from "~/lib/config";
import { sieveMap } from "~/lib/selector";
import { useDisplay } from "./contants";
import type { SchemeWithData } from "~/lib/form";
import { binaryToIndices } from "~/lib/degenerator";

const makeSorter = (selector: Selector) => {
  return (a: SchemeWithData, b: SchemeWithData) => {
    for (const sieve of selector) {
      const [af, bf] = [a.data.get(sieve), b.data.get(sieve)];
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
  strokes,
}: {
  data: SchemeWithData[];
  map: Map<number, string>;
  strokes: number;
}) => {
  const {
    analysis: { selector },
  } = useFormConfig();
  const display = useDisplay();

  const columns: ColumnsType<SchemeWithData> = [
    {
      title: "拆分方式",
      dataIndex: "sequence",
      key: "sequence",
      render: (_, { sequence }) => (
        <Space>
          {sequence.map((root, index) => (
            <Root key={index}>{display(root)}</Root>
          ))}
        </Space>
      ),
    },
  ];

  for (const sieve of selector) {
    const { display } = sieveMap.get(sieve)!;
    columns.push({
      title: sieve,
      key: sieve,
      render: (_, { data }) => {
        const value = data.get(sieve);
        return (
          <span>
            {display && value ? display(value as number & number[]) : value}
          </span>
        );
      },
    });
  }

  const reversedRootMap = new Map<string, number[][]>();
  const convert = binaryToIndices(strokes);
  for (const [binary, name] of map) {
    const prevList = reversedRootMap.get(name);
    const indices = convert(binary);
    if (indices.length === 1) continue;
    if (prevList !== undefined) {
      prevList.push(indices);
    } else {
      reversedRootMap.set(name, [indices]);
    }
  }

  return data.length ? (
    <>
      <Flex wrap="wrap" gap="middle">
        {[...reversedRootMap].map(([s, v]) => (
          <Space key={s}>
            <Root>{display(s)}</Root>
            <span>{v.map((ar) => `(${ar.join(",")})`).join(" ")}</span>
          </Space>
        ))}
      </Flex>
      <Table
        columns={columns}
        rowKey="scheme"
        dataSource={data.sort(makeSorter(selector))}
        pagination={{ hideOnSinglePage: true, defaultPageSize: 20 }}
        size="small"
      />
    </>
  ) : (
    <div />
  );
};

export default ResultDetail;
