import { Flex, Layout, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { 部件, 默认退化配置 } from "hanzi-chai";
import { useState } from "react";
import { useAtomValueUnwrapped, 如字库原子 } from "~/atoms";
import BorderItem from "~/components/BorderItem";
import { CharacterDisplay } from "~/components/Utils";

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
  const repertoire = useAtomValueUnwrapped(如字库原子);
  const components: 部件[] = [];
  for (const { 字形列表 } of repertoire) {
    for (const 字形 of 字形列表) {
      if (字形 instanceof 部件) {
        components.push(字形);
      }
    }
  }
  components.sort((a, b) => a.笔画数() - b.笔画数());
  const dataSource = components.filter((cache) => cache.笔画数() >= 3);
  const toCompare = components.filter((cache) => cache.笔画数() >= 2);
  const [page, setPage] = useState(1);
  const columns: ColumnsType<部件> = [
    {
      title: "部件",
      dataIndex: "name",
      render: (_, { 字符 }) => {
        return <CharacterDisplay character={字符} />;
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
          const slices = record.生成二进制切片列表(another, 默认退化配置);
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
                    <CharacterDisplay character={name.字符} />
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
      className="max-w-[1920px]"
    />
  );
};

export default function Algorithm() {
  return (
    <Layout className="h-full overflow-y-auto">
      <Layout.Content className="h-full p-8 max-w-[1440px] mx-auto flex flex-col overflow-y-auto">
        <Typography.Title>部件分解</Typography.Title>
        {/* <ComponentsTreeView /> */}
        <DegeneratorTable />
      </Layout.Content>
    </Layout>
  );
}
