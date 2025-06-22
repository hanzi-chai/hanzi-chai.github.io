import {
  ProForm,
  ProFormGroup,
  ProFormItem,
  ProFormList,
} from "@ant-design/pro-components";
import {
  Button,
  Checkbox,
  Flex,
  Popover,
  Statistic,
  Table,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { atom, useAtom, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { isEqual, sample, sortBy } from "lodash-es";
import {
  charactersAtom,
  degeneratorAtom,
  groupingAtom,
  mappingAtom,
  repertoireAtom,
} from "~/atoms";
import Element from "~/components/Element";
import ElementSelect from "~/components/ElementSelect";
import { Display } from "~/components/Utils";
import {
  type BasicComponent,
  classifier,
  degenerate,
  exportYAML,
  type Feature,
  type Mapping,
  renderSVGGlyph,
  type Repertoire,
} from "~/lib";

export interface TreeNode {
  字根: string;
  孩子们: TreeNode[];
}

function 构建字根树(map: Map<string, string | undefined>): TreeNode {
  const nodes = new Map<string, TreeNode>();
  let roots: TreeNode | undefined = undefined;

  // 先创建所有的节点
  for (const key of map.keys()) {
    nodes.set(key, { 字根: key, 孩子们: [] });
  }

  // 组装树结构
  for (const [child, parent] of map.entries()) {
    const childNode = nodes.get(child)!;
    if (parent === undefined) {
      roots = childNode;
    } else {
      const parentNode = nodes.get(parent);
      if (parentNode) {
        parentNode.孩子们.push(childNode);
      }
    }
  }

  if (!roots) throw new Error("没有找到根节点");
  return roots;
}

export const parentMapAtom = atom((get) => {
  const mapping = get(mappingAtom);
  const grouping = get(groupingAtom);
  const repertoire = get(repertoireAtom);
  const degenerator = get(degeneratorAtom);
  const degeneratorMap = new Map<string, string>();

  for (const element of Object.keys(mapping).concat(Object.keys(grouping))) {
    const glyph = repertoire[element]?.glyph;
    if (glyph === undefined) continue;
    if (glyph.type !== "basic_component") {
      console.log("Not a basic component:", element);
      continue;
    }
    const rendered = renderSVGGlyph(glyph.strokes);
    const hash = JSON.stringify(degenerate(degenerator, rendered));
    if (!degeneratorMap.has(hash)) {
      degeneratorMap.set(hash, element);
    } else {
      console.log("Duplicate hash found:", hash);
    }
  }

  const parentMap = new Map<string, string | undefined>([["", undefined]]);
  for (let i = 1; i <= 5; ++i) {
    parentMap.set(i.toString(), "");
  }
  const elements = Object.keys(mapping).filter((x) => repertoire[x]);
  for (const element of elements) {
    const glyph = repertoire[element]?.glyph!;
    const rendered = renderSVGGlyph((glyph as BasicComponent).strokes);
    parentMap.set(element, classifier[rendered[0]!.feature].toString());
    for (let i = rendered.length - 1; i > 1; --i) {
      const slice = rendered.slice(0, i);
      const hash = JSON.stringify(degenerate(degenerator, slice));
      if (degeneratorMap.has(hash)) {
        const rawParent = degeneratorMap.get(hash)!;
        const parent = grouping[rawParent] || rawParent;
        parentMap.set(element, parent);
        break;
      }
    }
  }
  return parentMap;
});

export const treeAtom = atom((get) => {
  const parentMap = get(parentMapAtom);
  return 构建字根树(parentMap);
});

export const 精简映射原子 = atom((get) => {
  const mapping = get(mappingAtom);
  const parentMap = get(parentMapAtom);
  const newMapping: Mapping = {};
  for (const [key, value] of Object.entries(mapping)) {
    let shouldAdd = "一二三四五六七八九十".includes(key);
    const parent = parentMap.get(key);
    if (!parent) {
      shouldAdd = true;
    } else {
      const parentValue = mapping[parent];
      if (!isEqual(value, parentValue)) {
        shouldAdd = true;
      }
    }
    if (shouldAdd) {
      newMapping[key] = value;
    }
  }
  return newMapping;
});

interface Degenerated {
  hash: string;
  length: number;
  strokes: string;
  categories: string;
  name?: string;
  list: string[];
  count: string[];
}

const selectedAtom = atomWithStorage<string[]>("selected", []);

const getComponentCounts = (repertoire: Repertoire, characters: string[]) => {
  const count = new Map<string, string[]>();
  const 二分 = new Map<string, string[]>();
  const queue = [...characters];
  const knownSet = new Set<string>(characters);
  while (queue.length) {
    const char = queue.shift()!;
    const glyph = repertoire[char]?.glyph!;
    if (glyph.type === "basic_component") {
      二分.set(char, [char]);
    } else {
      const parts = glyph.operandList.slice(0, 2);
      if (parts.every((x) => 二分.has(x))) {
        const components = parts.map((x) => 二分.get(x)?.[0]!);
        二分.set(char, components);
      } else {
        for (const part of parts) {
          if (!knownSet.has(part)) {
            knownSet.add(part);
            queue.push(part);
          }
        }
        queue.push(char);
      }
    }
  }
  for (const char of characters) {
    const components = 二分.get(char)!;
    for (const component of components) {
      if (!count.has(component)) count.set(component, []);
      count.get(component)?.push(char);
    }
  }
  return count;
};

const RootCheckbox = ({ name }: { name: string }) => {
  const [selectedChars, setSelected] = useAtom(selectedAtom);
  const selectedSet = new Set(selectedChars);
  return (
    <>
      <Checkbox
        checked={selectedSet.has(name || "")}
        onChange={(e) => {
          const checked = e.target.checked;
          setSelected((prev) => {
            if (checked) {
              return [...prev, name || ""];
            }
            return prev.filter((x) => x !== name);
          });
        }}
      />
      <Button
        onClick={() => {
          const record = Object.fromEntries(
            selectedChars.map((x) => [x, sample("vewazmio;/")]),
          );
          exportYAML(record, "字根");
        }}
      >
        {selectedSet.size}
      </Button>
    </>
  );
};

const Tree = ({ tree }: { tree: TreeNode }) => {
  return (
    <Flex>
      <Element>
        <Display name={tree.字根} />
      </Element>
      <div style={{ paddingLeft: "8px" }}>
        {tree.孩子们.map((child, index) => (
          <Flex key={index} gap="4px">
            <span>→</span>
            <Tree key={index} tree={child} />
          </Flex>
        ))}
      </div>
    </Flex>
  );
};

const RootTree = () => {
  const 总树 = useAtomValue(treeAtom);
  return (
    <Flex vertical gap="8px 0" wrap="wrap" style={{ height: "2400px" }}>
      <Button onClick={() => exportYAML(总树, "tree")}>导出</Button>
      {总树.孩子们.map((tree, index) => (
        <Tree key={index} tree={tree} />
      ))}
    </Flex>
  );
};

interface 双编码分解 {
  字根: string;
  第一码: string;
  第二码: string;
}

const 双编码原子 = atomWithStorage<双编码分解[]>("dual_code", []);

const 双编码编辑器 = () => {
  const [双编码信息, set双编码信息] = useAtom(双编码原子);
  return (
    <ProForm<{ 双编码信息: 双编码分解[] }>
      initialValues={{ 双编码信息 }}
      layout="horizontal"
      onValuesChange={async (_, { 双编码信息 }) => {
        console.log("双编码信息", 双编码信息);
        set双编码信息(双编码信息);
      }}
    >
      <Button onClick={() => exportYAML(双编码信息, "dual")}>导出</Button>
      <ProFormList name="双编码信息" alwaysShowItemLabel>
        <ProFormGroup>
          <ProFormItem name="字根" label="字根">
            <ElementSelect />
          </ProFormItem>
          <ProFormItem name="第一码" label="第一码">
            <ElementSelect />
          </ProFormItem>
          <ProFormItem name="第二码" label="第二码">
            <ElementSelect />
          </ProFormItem>
        </ProFormGroup>
      </ProFormList>
    </ProForm>
  );
};

export default function Misc() {
  const repertoire = useAtomValue(repertoireAtom);
  const degenerator = useAtomValue(degeneratorAtom);
  const characters = useAtomValue(charactersAtom);
  const components = getComponentCounts(repertoire, characters);
  let 最大字根数 = 0;
  const degeneratedMap = new Map<
    string,
    { length: number; names: string[]; count: string[] }
  >();
  const allDegenerated = new Map<string, string>();
  for (const [name, character] of Object.entries(repertoire)) {
    if (character.glyph?.type !== "basic_component") continue;
    const glyph = character.glyph.strokes;
    const rendered = renderSVGGlyph(glyph);
    const hash = JSON.stringify(degenerate(degenerator, rendered));
    if (!allDegenerated.has(hash)) allDegenerated.set(hash, name);
    if (!components.has(name)) continue;
    最大字根数 += glyph.length;
    for (let i = 1; i !== rendered.length; ++i) {
      const slice = rendered.slice(0, i + 1);
      const hash = JSON.stringify(degenerate(degenerator, slice));
      if (!degeneratedMap.has(hash))
        degeneratedMap.set(hash, {
          names: [],
          length: slice.length,
          count: [],
        });
      degeneratedMap.get(hash)?.names.push(name);
      degeneratedMap.get(hash)?.count.push(...components.get(name)!);
    }
  }
  // 找出独立字根
  const invertedMap = new Map<
    string,
    { hash: string; length: number; count: string[] }[]
  >();
  for (const [hash, { length, names, count }] of degeneratedMap) {
    const key = names.join(", ");
    if (!invertedMap.has(key)) invertedMap.set(key, []);
    invertedMap.get(key)?.push({ hash, length, count });
  }
  // 生成表格数据
  const dataSource: Degenerated[] = [];
  const allNames: string[] = [];
  for (const [names, variations] of invertedMap) {
    const sorted = sortBy(variations, (x) => -x.length);
    const { hash, length, count } = sorted[0]!;
    const features: Feature[] = JSON.parse(hash)[0];
    const list = names.split(", ");
    const name = allDegenerated.get(hash);
    if (name) allNames.push(name);
    dataSource.push({
      hash,
      length,
      list,
      name,
      strokes: features.join(", "),
      categories: features.map((x) => classifier[x] ?? x).join(", "),
      count,
    });
  }
  dataSource.sort((a, b) => {
    const dlength = a.length - b.length;
    if (dlength !== 0) return dlength;
    const dcount = b.count.length - a.count.length;
    if (dcount !== 0) return dcount;
    const dcategory = a.categories.localeCompare(b.categories);
    if (dcategory !== 0) return dcategory;
    return a.strokes.localeCompare(b.strokes);
  });
  const columns: ColumnsType<Degenerated> = [
    { title: "长度", dataIndex: "length", key: "length" },
    {
      title: "发现",
      render: (_, { name }) => (name ? "是" : "否"),
      filters: [
        { text: "是", value: true },
        { text: "否", value: false },
      ],
      onFilter: (value, record) => (record.name !== undefined) === value,
    },
    { title: "笔画", render: (_, { hash }) => JSON.parse(hash)[0].join(", ") },
    {
      title: "列表",
      render: (_, { list }) => (
        <Flex align="center" wrap>
          {list.map((name) => (
            <Display key={name} name={name} />
          ))}
        </Flex>
      ),
    },
    {
      title: "数量",
      render: (_, { count }) => (
        <Popover content={count.join(", ")}>
          <span>{count.length}</span>
        </Popover>
      ),
    },
    {
      title: "选中",
      render: (_, { name }) => <RootCheckbox name={name || ""} />,
    },
  ];
  return (
    <>
      <Typography.Title level={2}>字根研究</Typography.Title>
      <RootTree />
      <双编码编辑器 />
      <Flex justify="center" gap="middle">
        <Statistic value={最大字根数} title="总笔画数" />
        <Statistic value={degeneratedMap.size} title="总计" />
        <Statistic value={invertedMap.size} title="独立" />
        <Statistic
          value={dataSource.filter((x) => !x.name).length}
          title="未发现"
        />
        <Statistic
          value={dataSource.filter((x) => x.count.length > 10).length}
          title="频率 > 10"
        />
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
