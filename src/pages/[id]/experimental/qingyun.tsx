import { Button, Flex, Input, Space, Tag, Typography } from "antd";
import { ColumnsType } from "antd/es/table";
import { Table } from "antd/lib";
import { atomWithStorage } from "jotai/utils";
import { sortBy } from "lodash-es";
import styled from "styled-components";
import {
  alphabetAtom,
  analysisResultAtom,
  charactersAtom,
  infoAtom,
  mappingAtom,
  useAtom,
  useAtomValue,
  useChaifenTitle,
  userFrequencyAtom,
} from "~/atoms";
import { AdjustableElementGroup, getAffiliates } from "~/components/Mapping";
import { Display } from "~/components/Utils";
import {
  ElementWithIndex,
  exportTSV,
  exportYAML,
  getReversedMapping,
  isMerge,
  MappedInfo,
} from "~/lib";

const PrintArea = styled.div`
  width: 210mm;
  height: 297mm;
  float: left;

  padding: 10mm 3mm;
  border: 1px #d3d3d3 solid;
  border-radius: 5px;
  background: white;
  box-shadow: 0 0 8px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  justify-content: space-between;

  @media print {
    position: fixed;
    top: 0;
    left: 0;
    border: none;
    border-radius: 0;
  }
`;

const Secondary = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1rem;
`;

interface Converted {
  字根: string;
  编码: string;
  读音?: string;
}

function combineShengYun(sheng: string, yun: string) {
  let string = `${sheng.replace("声-", "")}${yun.replace("韵-", "")}`;
  string = string
    .replace("0", "")
    .replace("yia", "ya")
    .replace("yio", "yo")
    .replace("wua", "wa")
    .replace("wue", "we")
    .replace("uü", "u")
    .replace(/([jqx])ü/, "$1u")
    .replace("ir", "i")
    .replace("iou", "iu")
    .replace("uei", "ui")
    .replace("uen", "un");
  return string;
}

const repr: Record<string, string> = {
  "1": "１",
  "2": "２",
  "3": "３",
  "4": "４",
  "5": "５",
  "6": "６",
};

function LineView() {
  const mapping = useAtomValue(mappingAtom);
  const alphabet = useAtomValue(alphabetAtom);
  const reversedMapping = getReversedMapping(mapping, alphabet);
  const dama = "bpmfdtnlgkhjqxzcsrwyv";
  const xiaoma = "aoeiu;,./";
  const dama_shengmu = [...dama].map((char) => ({
    key: char,
    elements: Object.entries(mapping)
      .filter(([key, value]) => value == char && key.startsWith("声-"))
      .map(([key]) => key.replace("声-", "")),
  }));
  const xiaoma_yunmu = [...xiaoma].map((char) => ({
    key: char,
    elements: sortBy(
      Object.entries(mapping)
        .filter(
          ([key, value]) =>
            value == char && !["主根-1", "主根-2"].includes(key),
        )
        .map(([key]) => key),
      (x) => x.length,
    ).flatMap((key) => [
      key.replace("韵-", ""),
      ...getAffiliates(key, mapping).map(({ from }) => from.replace("韵-", "")),
    ]),
  }));
  const list = (roots: MappedInfo[]) => (
    <Flex gap="small" wrap="wrap">
      {roots.map(({ name, code }) => (
        <AdjustableElementGroup
          displayMode
          key={name}
          name={name}
          code={code}
        />
      ))}
    </Flex>
  );
  const columns: ColumnsType<{ key: string; elements: string[] }> = [
    {
      title: "声码",
      dataIndex: "key",
      key: "key",
      render: (key, { elements }) =>
        `${key.toUpperCase()} [${elements.join(", ")}]`,
      width: 72,
    },
    {
      title: "第一主根",
      key: "elements",
      render: (_, { key }) => {
        const roots = reversedMapping
          .get(key)!
          .filter(({ name }) => /^\d$/.test(name));
        roots.forEach((x) => (x.code = x.code[0]! as string));
        return list(roots);
      },
      width: 72,
    },
    {
      title: "第二主根",
      key: "elements",
      render: (_, { key }) => {
        const roots = reversedMapping
          .get(key)!
          .filter(({ name }) => !name.startsWith("声-") && !/\d/.test(name))
          .filter(({ code }) => typeof code[0] === "string");
        roots.forEach((x) => (x.code = x.code[0]! as string));
        return list(roots);
      },
      width: 104,
    },
    {
      title: "其他字根",
      key: "elements",
      render: (_, { key }) => {
        const roots = reversedMapping
          .get(key)!
          .filter(({ name }) => !name.startsWith("声-") && !/\d/.test(name))
          .filter(({ code }) => typeof code[0] !== "string");
        return list(roots);
      },
    },
  ];
  return (
    <>
      <Flex align="center" style={{ padding: "8px 8px" }} gap="large">
        <strong style={{ width: 48, flexShrink: 0 }}>韵码</strong>
        <Flex gap="4px 16px" wrap="wrap">
          {xiaoma_yunmu.map(({ key, elements }) => (
            <span key={key}>{`${key.toUpperCase()} [${elements.join(
              ", ",
            )}]`}</span>
          ))}
        </Flex>
      </Flex>
      <Table
        columns={columns}
        dataSource={dama_shengmu}
        pagination={false}
        size="small"
      />
    </>
  );
}

const syllableAtom = atomWithStorage<Record<string, string>>(
  "snow_qingyun_hint",
  {},
);

function SyllableForm() {
  const mapping = useAtomValue(mappingAtom);
  const [syllables, setSyllables] = useAtom(syllableAtom);
  const analysisResult = useAtomValue(analysisResultAtom);
  const characters = useAtomValue(charactersAtom);
  const userFrequency = useAtomValue(userFrequencyAtom);

  const content: { key: string; value: [string, string] }[] = [];
  const result: Converted[] = [];
  const allSyllable = new Map<string, string>();
  for (const [key, value] of Object.entries(mapping)) {
    if (!/^.$/.test(key) || isMerge(value)) continue;
    const affiliates = getAffiliates(key, mapping).map(({ from }) => from);
    if (typeof value[0] === "string") {
      let code = value[0];
      if ((value[1] as ElementWithIndex).element === "主根-1") {
        code += "yphjklnm".includes(code) ? "e" : "i";
      } else {
        code += "yphjklnm".includes(code) ? "a" : "o";
      }
      allSyllable.set(key, code);
      result.push({
        字根: [repr[key] || key, ...affiliates].join(""),
        编码: code,
      });
    } else {
      const k1 = (value[0] as ElementWithIndex).element;
      const k2 = (value[1] as ElementWithIndex).element;
      allSyllable.set(key, combineShengYun(k1, k2));
      content.push({ key, value: [k1, k2] });
      let ref0 = k2;
      while (isMerge(mapping[ref0]!)) {
        ref0 = (mapping[ref0] as ElementWithIndex).element;
      }
      result.push({
        字根: [key, ...affiliates].join(""),
        编码: (mapping[k1] as string) + (mapping[ref0] as string),
        读音: syllables[key],
      });
    }
    for (const child of affiliates) {
      allSyllable.set(child, allSyllable.get(key) || "");
    }
  }
  const { componentResults, compoundResults } = analysisResult;
  const lines: string[][] = [];
  characters.forEach((char) => {
    const sequence =
      componentResults.get(char)?.sequence ??
      compoundResults.get(char)?.sequence ??
      [];
    const syllables = sequence.map((x) => allSyllable.get(x) || "");
    if (syllables.some((x) => x === undefined || x === "")) {
      console.log(char, sequence, syllables);
    }
    lines.push([
      char,
      syllables.join(" "),
      (userFrequency?.[char] || 0).toString(),
    ]);
    if (syllables.length > 4) {
      const alt = syllables.slice(0, 3).concat([syllables.at(-1)!]);
      lines.push([
        char,
        alt.join(" "),
        (userFrequency?.[char] || 0).toString(),
      ]);
    }
  });
  const analysis = [...analysisResult.customized]
    .map(([key, value]) => ({
      部件: key,
      拆分: value.sequence.map((x) => repr[x] || x).join(""),
    }))
    .filter((x) => x.拆分.length > 1);
  return (
    <Flex vertical style={{ width: 300, padding: 16 }}>
      <Button
        onClick={() => {
          exportTSV(lines, "syllables");
          exportYAML(result, "roots", 1, false);
          exportYAML(analysis, "analysis", 1, false);
        }}
      >
        导出
      </Button>
      {content.map(({ key, value }) => (
        <Flex key={key} align="center" gap="middle" justify="center">
          <Display name={key} />
          <span style={{ width: 200 }}>
            {value[0]}, {value[1]}
          </span>
          <Input
            value={syllables[key] || ""}
            onChange={(e) =>
              setSyllables({ ...syllables, [key]: e.target.value })
            }
            placeholder="读音"
          />
        </Flex>
      ))}
    </Flex>
  );
}

export default function QingYun() {
  useChaifenTitle("图示");
  const { name, author, version, description } = useAtomValue(infoAtom);
  return (
    <Flex>
      <PrintArea>
        <Flex justify="center">
          <Secondary>
            <Typography.Text>{description}</Typography.Text>
          </Secondary>
          <Typography.Title style={{ margin: 0 }}>{name}</Typography.Title>
          <Secondary>
            <Space>
              <Tag color="blue">作者：{author}</Tag>
              <Tag color="cyan">版本：{version}</Tag>
            </Space>
          </Secondary>
        </Flex>
        <LineView />
      </PrintArea>
      <SyllableForm />
    </Flex>
  );
}
