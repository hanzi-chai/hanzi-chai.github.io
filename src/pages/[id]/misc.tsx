import { Flex, Statistic, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useAtomValue } from "jotai";
import {
  analysisAtom,
  charactersAtom,
  degeneratorAtom,
  groupingAtom,
  mappingAtom,
  repertoireAtom,
} from "~/atoms";
import { Display } from "~/components/Utils";
import {
  degenerate,
  getRequiredTargets,
  renderSVGGlyph,
  type AnalysisConfig,
} from "~/lib";

interface Degenerated {
  hash: string;
  strokes: string;
  list: { name: string; length: number }[];
}

export default function Misc() {
  const repertoire = useAtomValue(repertoireAtom);
  const degenerator = useAtomValue(degeneratorAtom);
  const analysisConfig: AnalysisConfig = {
    analysis: useAtomValue(analysisAtom),
    primaryRoots: new Map(
      Object.entries(useAtomValue(mappingAtom)).filter(([x]) => repertoire[x]),
    ),
    secondaryRoots: new Map(
      Object.entries(useAtomValue(groupingAtom)).filter(([x]) => repertoire[x]),
    ),
  };
  const characters = useAtomValue(charactersAtom);
  const { components } = getRequiredTargets(
    repertoire,
    analysisConfig,
    characters,
  );
  let maximum = 0;
  const degeneratedMap = new Map<string, { name: string; length: number }[]>();
  for (const [name, character] of Object.entries(repertoire)) {
    if (character.glyph?.type !== "basic_component" || !components.has(name))
      continue;
    const glyph = character.glyph.strokes;
    maximum += glyph.length;
    const rendered = renderSVGGlyph(glyph);
    for (let i = 1; i !== rendered.length; ++i) {
      const slice = rendered.slice(0, i + 1);
      const degenerated = degenerate(degenerator, slice);
      const hash = JSON.stringify(degenerated);
      const length = slice.length;
      if (!degeneratedMap.has(hash)) degeneratedMap.set(hash, []);
      degeneratedMap.get(hash)!.push({ name, length });
    }
  }
  const filteredMap = new Map<string, { name: string; length: number }[]>();
  const listHashSet = new Set<string>();
  for (const [hash, list] of degeneratedMap) {
    const listHash = list
      .map((x) => x.name)
      .sort()
      .join(",");
    if (listHashSet.has(listHash)) continue;
    listHashSet.add(listHash);
    filteredMap.set(hash, list);
  }
  const dataSource: Degenerated[] = [...filteredMap].map(([hash, list]) => ({
    hash,
    list,
    strokes: JSON.parse(hash)[0].join(", ") as string,
  }));
  dataSource.sort((a, b) => {
    let dlength = a.list[0]!.length - b.list[0]!.length;
    if (dlength !== 0) return dlength;
    return a.strokes.localeCompare(b.strokes);
  });
  const columns: ColumnsType<Degenerated> = [
    { title: "长度", render: (_, { list }) => list[0]!.length },
    { title: "笔画", render: (_, { hash }) => JSON.parse(hash)[0].join(", ") },
    {
      title: "列表",
      render: (_, { list }) => (
        <Flex>
          {list.map(({ name }) => (
            <Display key={name} name={name} />
          ))}
        </Flex>
      ),
    },
  ];
  return (
    <>
      <Typography.Title level={2}>字根研究</Typography.Title>
      <Flex justify="center" gap="middle">
        <Statistic value={maximum} title="总笔画数" />
        <Statistic value={degeneratedMap.size} title="总计" />
        <Statistic value={filteredMap.size} title="独立" />
      </Flex>
      <Table
        size="small"
        pagination={{ pageSize: 100 }}
        dataSource={dataSource}
        columns={columns}
        rowKey="hash"
      />
    </>
  );
}
