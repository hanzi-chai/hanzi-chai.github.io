import { Flex, Layout, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { 部件, 部件字根, 默认退化配置 } from "hanzi-chai";
import { useEffect, useState } from "react";
import { listCharacters, listGlyphs } from "~/api";
import {
  useAtomValue,
  useSetAtom,
  可编辑字形列表原子,
  可编辑字符列表原子,
  字库原子,
} from "~/atoms";
import BorderItem from "~/components/BorderItem";
import FilterForm from "~/components/FilterForm";
import GlyphView from "~/components/GlyphView";
import { useChaifenTitle, 字符字形过滤器, type 过滤器参数 } from "~/utils";

// interface TreeNodeData {
//   name: string;
//   character: 原始汉字数据;
//   children: TreeNodeData[];
// }

// const treeify = (repertoire: 原始字库数据) => {
//   const components: {
//     name: string;
//     glyph: 部件数据;
//     character: 原始汉字数据;
//   }[] = [];
//   for (const [name, character] of Object.entries(repertoire)) {
//     const glyph = character.glyphs.find(
//       (x) =>
//         x.type === "basic_component" ||
//         x.type === "derived_component" ||
//         x.type === "spliced_component",
//     );
//     if (!glyph) continue;
//     components.push({ name, glyph, character });
//   }
//   const treeData: TreeNodeData[] = [];
//   // build tree according to DerivedComponent["source"]
//   const treeMap = new Map<string, TreeNodeData>();
//   let counter = 0;
//   while (components.length) {
//     counter++;
//     if (counter > 4000) break;
//     const { name, glyph, character } = components.shift()!;
//     if (glyph.type === "basic_component") {
//       const node: TreeNodeData = {
//         name,
//         character,
//         children: [],
//       };
//       treeData.push(node);
//       treeMap.set(name, node);
//     } else {
//       const source =
//         glyph.type === "derived_component"
//           ? treeMap.get(glyph.source)
//           : treeMap.get(glyph.operandList[0]!);
//       if (!source) {
//         components.push({ name, glyph, character });
//       } else {
//         const node: TreeNodeData = {
//           name,
//           character,
//           children: [],
//         };
//         source.children?.push(node);
//         treeMap.set(name, node);
//       }
//     }
//   }
//   return treeData;
// };

// const TreeNode = ({
//   name,
//   character,
// }: {
//   name: string;
//   character: 原始汉字数据;
// }) => {
//   return (
//     <Flex align="center">
//       <BoxedElementWithTooltip element={name} />
//       {name}
//       <字形数据更新器 character={character} />
//       <EditGlyph character={character} />
//     </Flex>
//   );
// };

// const Tree = ({ data, level }: { data: TreeNodeData; level: number }) => {
//   return (
//     <Flex gap="middle" align="start">
//       <TreeNode name={data.name} character={data.character} />
//       <Flex vertical>
//         {data.children.map((x) => (
//           <Tree key={x.name} data={x} level={level + 1} />
//         ))}
//       </Flex>
//     </Flex>
//   );
// };

// const ComponentsTreeView = () => {
//   const repertoire = useAtomValue(原始字库数据原子);
//   const loading = isEmpty(repertoire);
//   const treeData = useMemo(() => treeify(repertoire), [repertoire]);
//   if (loading) return null;
//   return (
//     <Flex
//       vertical
//       style={{
//         gap: "8px",
//         overflowY: "auto",
//       }}
//     >
//       {treeData.length}
//       {treeData.map((x) => (
//         <Tree key={x.name} data={x} level={0} />
//       ))}
//     </Flex>
//   );
// };

const DegeneratorTable = () => {
  const repertoire = useAtomValue(字库原子);
  const [filterData, setFilterData] = useState<过滤器参数>({});
  const filter = new 字符字形过滤器(filterData);
  const components: 部件[] = [];
  for (const [_, 字形] of repertoire.字形迭代器()) {
    if (字形 instanceof 部件) {
      components.push(字形);
    }
  }
  components.sort((a, b) => a.笔画数() - b.笔画数());
  const dataSource = components
    .filter((cache) => cache.笔画数() >= 3)
    .filter((cache) => filter.过滤字形(cache, repertoire));
  const toCompare = components.filter((cache) => cache.笔画数() >= 2);
  const [page, setPage] = useState(1);
  const columns: ColumnsType<部件> = [
    {
      title: "部件",
      dataIndex: "name",
      render: (_, record) => {
        return <GlyphView glyph={record.图形盒子} />;
      },
      width: 128,
    },
    {
      title: "含有",
      dataIndex: "glyph",
      render: (_, record) => {
        const rootMap = new Map<部件, number[]>();
        for (const another of toCompare) {
          if (another.获取名称() === record.获取名称()) continue;
          const 字根 = new 部件字根(another, another);
          const slices = record.生成新二进制切片列表(字根, 默认退化配置);
          if (slices.length) {
            rootMap.set(another, slices);
          }
        }
        const rootList = [...rootMap].sort((a, b) => {
          const [, aslices] = a;
          const [, bslices] = b;
          return bslices[0]! - aslices[0]!;
        });
        return (
          <Flex gap="middle" wrap="wrap">
            {rootList.map(([name, slices]) => {
              return (
                <Space key={name.获取名称()} align="center">
                  <BorderItem>
                    <GlyphView glyph={name.图形盒子} />
                  </BorderItem>
                  {slices
                    .map((x) => `(${record.二进制转索引(x).join(", ")})`)
                    .join(", ")}
                </Space>
              );
            })}
          </Flex>
        );
      },
      width: 960,
    },
  ];
  return (
    <>
      <FilterForm setFilter={setFilterData} />
      <Table
        dataSource={dataSource}
        columns={columns}
        size="small"
        rowKey="name"
        pagination={{
          pageSize: 50,
          current: page,
        }}
        onChange={(pagination) => {
          setPage(pagination.current!);
        }}
        className="max-w-480"
      />
    </>
  );
};

export default function Algorithm() {
  useChaifenTitle("管理");
  const 设置字符列表 = useSetAtom(可编辑字符列表原子);
  const 设置字形列表 = useSetAtom(可编辑字形列表原子);

  useEffect(() => {
    Promise.all([listCharacters(), listGlyphs()]).then(
      ([字符数据, 字形数据]) => {
        if (!("err" in 字符数据)) 设置字符列表(字符数据);
        if (!("err" in 字形数据)) 设置字形列表(字形数据);
      },
    );
  }, []);

  return (
    <Layout className="h-full overflow-y-auto">
      <Layout.Content className="h-full p-8 max-w-360 mx-auto flex flex-col overflow-y-auto">
        <Typography.Title>部件分解</Typography.Title>
        {/* <ComponentsTreeView /> */}
        <DegeneratorTable />
      </Layout.Content>
    </Layout>
  );
}
