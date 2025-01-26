import { Flex, Layout, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import Element from "~/components/Element";
import {
  repertoireAtom,
  displayAtom,
  primitiveRepertoireAtom,
  errorFeedback,
  useAddAtom,
  glyphAtom,
} from "~/atoms";
import { list, remoteUpdate } from "~/api";
import type {
  BasicComponent,
  DerivedComponent,
  PrimitiveCharacter,
  PrimitiveRepertoire,
} from "~/lib";
import {
  binaryToIndices,
  defaultDegenerator,
  generateSliceBinaries,
} from "~/lib";
import { computeComponent, type ComputedComponent } from "~/lib";
import { listToObject } from "~/lib";
import { useSetAtom, useAtomValue } from "~/atoms";
import { isEmpty } from "lodash-es";
import { EditorColumn, EditorRow, svgDisplay } from "~/components/Utils";
import * as O from "optics-ts/standalone";
import CompoundForm from "~/components/CompoundForm";
import ComponentForm from "~/components/ComponentForm";
import { InlineCustomizer, InlineUpdater } from "~/components/CharacterTable";
import { Delete, EditGlyph, Mutate } from "~/components/Action";

interface TreeNodeData {
  name: string;
  character: PrimitiveCharacter;
  children: TreeNodeData[];
}

const treeify = (repertoire: PrimitiveRepertoire) => {
  const components: {
    name: string;
    glyph: BasicComponent | DerivedComponent;
    character: PrimitiveCharacter;
  }[] = [];
  for (const [name, character] of Object.entries(repertoire)) {
    const glyph = character.glyphs.find(
      (x) => x.type === "basic_component" || x.type === "derived_component",
    );
    if (!glyph) continue;
    components.push({ name, glyph, character });
  }
  const treeData: TreeNodeData[] = [];
  // build tree according to DerivedComponent["source"]
  const treeMap = new Map<string, TreeNodeData>();
  while (components.length) {
    const { name, glyph, character } = components.shift()!;
    if (glyph.type === "basic_component") {
      const node: TreeNodeData = {
        name,
        character,
        children: [],
      };
      treeData.push(node);
      treeMap.set(name, node);
    } else {
      const source = treeMap.get(glyph.source);
      if (!source) {
        components.push({ name, glyph, character });
      } else {
        const node: TreeNodeData = {
          name,
          character,
          children: [],
        };
        source.children?.push(node);
        treeMap.set(name, node);
      }
    }
  }
  return treeData;
};

const TreeNode = ({
  name,
  character,
}: {
  name: string;
  character: PrimitiveCharacter;
}) => {
  const display = useAtomValue(displayAtom);
  const glyphMap = useAtomValue(glyphAtom);
  return (
    <Flex align="center">
      <Element>{svgDisplay(name, glyphMap)}</Element>
      <span>{display(name)}</span>
      <InlineUpdater character={character} />
      <Space>
        <EditGlyph character={character} />
        <Mutate unicode={character.unicode} />
        <Delete unicode={character.unicode} />
      </Space>
    </Flex>
  );
};

const Tree = ({ data, level }: { data: TreeNodeData; level: number }) => {
  return (
    <Flex vertical style={{ paddingLeft: "16px" }}>
      <TreeNode name={data.name} character={data.character} />
      {data.children.map((x) => (
        <Tree key={x.name} data={x} level={level + 1} />
      ))}
    </Flex>
  );
};

const ComponentsTreeView = () => {
  const repertoire = useAtomValue(primitiveRepertoireAtom);
  const loading = isEmpty(repertoire);
  const treeData = useMemo(() => treeify(repertoire), [repertoire]);
  if (loading) return null;
  return (
    <Flex
      vertical
      style={{
        gap: "8px",
        overflowY: "auto",
      }}
    >
      {treeData.length}
      {treeData.map((x) => (
        <Tree key={x.name} data={x} level={0} />
      ))}
    </Flex>
  );
};

const DegeneratorTable = () => {
  const repertoire = useAtomValue(repertoireAtom);
  const loading = isEmpty(repertoire);
  const components: ComputedComponent[] = [];
  for (const [name, character] of Object.entries(repertoire)) {
    if (character.glyph?.type !== "basic_component") continue;
    const glyph = character.glyph.strokes;
    const cache = computeComponent(name, glyph);
    components.push(cache);
  }
  components.sort((a, b) => a.glyph.length - b.glyph.length);
  const dataSource = components.filter((cache) => cache.glyph.length >= 3);
  const toCompare = components.filter((cache) => cache.glyph.length >= 2);
  const display = useAtomValue(displayAtom);
  const [page, setPage] = useState(1);
  const columns: ColumnsType<ComputedComponent> = [
    {
      title: "部件",
      dataIndex: "name",
      render: (_, { name }) => {
        return display(name);
      },
      width: 128,
    },
    {
      title: "含有",
      dataIndex: "glyph",
      render: (_, record) => {
        const rootMap = new Map<string, number[]>();
        for (const another of toCompare) {
          if (another.name === record.name) continue;
          const slices = generateSliceBinaries(
            defaultDegenerator,
            record,
            another,
          );
          if (slices.length) {
            rootMap.set(another.name, slices);
          }
        }
        const rootList = [...rootMap].sort((a, b) => {
          const [, aslices] = a;
          const [, bslices] = b;
          return bslices[0]! - aslices[0]!;
        });
        const convert = binaryToIndices(record.glyph.length);
        return (
          <Flex gap="middle" wrap="wrap">
            {rootList.map(([name, slices]) => {
              return (
                <Space key={name}>
                  <Element>{display(name)}</Element>
                  {slices.map((x) => `(${convert(x).join(", ")})`).join(", ")}
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
      loading={loading}
      pagination={{
        pageSize: 50,
        current: page,
      }}
      onChange={(pagination) => {
        setPage(pagination.current!);
      }}
      style={{
        maxWidth: "1920px",
      }}
    />
  );
};

export default function Algorithm() {
  const setForm = useSetAtom(primitiveRepertoireAtom);

  useEffect(() => {
    list().then((data) => {
      if ("err" in data) return;
      setForm(listToObject(data));
    });
  }, [setForm]);

  return (
    <Layout style={{ height: "100%", overflowY: "auto" }}>
      <Layout.Content
        style={{
          height: "100%",
          padding: "32px",
          maxWidth: "1440px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        <Typography.Title>部件分解</Typography.Title>
        <ComponentsTreeView />
        {/* <EditorColumn span={6}>
          </EditorColumn>
          <EditorColumn span={18}>
            <DegeneratorTable />
          </EditorColumn> */}
      </Layout.Content>
    </Layout>
  );
}
