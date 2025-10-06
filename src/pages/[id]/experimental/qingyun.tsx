import {
  ProForm,
  ProFormGroup,
  ProFormList,
  ProFormText,
} from "@ant-design/pro-components";
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
import { AdjustableElementGroup } from "~/components/Mapping";
import { Display } from "~/components/Utils";
import {
  ElementWithIndex,
  exportTSV,
  exportYAML,
  getReversedMapping,
  isMerge,
  Key,
  MappedInfo,
  Mapping,
} from "~/lib";
import Element from "../element";
import Char from "~/components/Character";
import ValueEditor from "~/components/Value";
import { useMemo } from "react";

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
  字根: string[];
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
  "1": "一",
  "2": "丨",
  "3": "丿",
  "4": "丶",
  "5": "乛",
  "6": "乚",
};

function convertMapping(mapping: Mapping) {
  const result: Map<string, Converted> = new Map();
  for (const [key, value] of Object.entries(mapping)) {
    if (!/^.$/.test(key) || isMerge(value)) continue;
    if (typeof value[0] === "string") {
      const ref = (value[1] as ElementWithIndex).element;
      result.set(key, {
        字根: [repr[key] || key],
        编码: (value[0] + mapping[ref]) as string,
      });
    } else {
      const ref1 = (value[0] as ElementWithIndex).element;
      const ref2 = (value[1] as ElementWithIndex).element;
      let ref0 = ref2;
      while (isMerge(mapping[ref0]!)) {
        ref0 = (mapping[ref0] as ElementWithIndex).element;
      }
      result.set(key, {
        字根: [key],
        编码: (mapping[ref1] as string) + (mapping[ref0] as string),
        读音: combineShengYun(ref1, ref2),
      });
    }
  }
  for (const [key, value] of Object.entries(mapping)) {
    if (!/^.$/.test(key) || !isMerge(value)) continue;
    let root = value.element;
    while (isMerge(mapping[root]!)) {
      root = (mapping[root] as ElementWithIndex).element;
    }
    result.get(root)!.字根.push(key);
  }
  return Array.from(result.values()).map(({ 字根, 编码, 读音 }) => ({
    字根: 字根.join(""),
    编码,
    读音,
  }));
}

function LineView() {
  const mapping = useAtomValue(mappingAtom);
  const alphabet = useAtomValue(alphabetAtom);
  const reversedMapping = getReversedMapping(mapping, alphabet);
  const analysisResult = useAtomValue(analysisResultAtom);
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
    elements: Object.entries(mapping)
      .filter(
        ([_, value]) =>
          value == char || (isMerge(value) && mapping[value.element] === char),
      )
      .map(([key]) => key.replace("韵-", ""))
      .filter(
        (name) =>
          ["m", "ng", "ueng", "io", "主根-1", "主根-2"].includes(name) ===
          false,
      ), // 排除韵母 m 和 ng,
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
        <strong
          style={{ width: 48, flexShrink: 0 }}
          onClick={() => {
            exportYAML(convertMapping(mapping), "roots", 1, false);
            const analysis = [...analysisResult.customized]
              .map(([key, value]) => ({
                部件: key,
                拆分: value.sequence.map((x) => repr[x] || x).join(""),
              }))
              .filter((x) => x.拆分.length > 1);
            exportYAML(analysis, "analysis", 1, false);
          }}
        >
          韵码
        </strong>
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

const syllableAtom = atomWithStorage<Record<string, string>>("syllables", {});

function SyllableForm() {
  const mapping = useAtomValue(mappingAtom);
  const [syllables, setSyllables] = useAtom(syllableAtom);
  const content: { key: string; value: [string, string] }[] = [];
  const allSyllable = new Map<string, string>(
    Object.entries(syllables).map(
      ([k, v]) => [k, v.slice(0, v.length - 1)] as const,
    ),
  );
  const userFrequency = useAtomValue(userFrequencyAtom);
  for (const [key, value] of Object.entries(mapping)) {
    if (!/^.$/.test(key) || isMerge(value)) continue;
    if (typeof value[0]! === "string") {
      const k1 = value[0] as string;
      if ((value[1] as ElementWithIndex).element === "主根-1") {
        const k2 = "yphjklnm".includes(k1) ? "e" : "i";
        allSyllable.set(key, `${k1}${k2}`);
      } else {
        const k2 = "yphjklnm".includes(k1) ? "a" : "o";
        allSyllable.set(key, `${k1}${k2}`);
      }
    }
  }
  const analysisResult = useAtomValue(analysisResultAtom);
  const characters = useAtomValue(charactersAtom);
  for (const [key, value] of Object.entries(mapping)) {
    if (!/^.$/.test(key)) continue;
    if (isMerge(value)) {
      let ref = value.element;
      while (isMerge(mapping[ref]!)) {
        ref = (mapping[ref] as ElementWithIndex).element;
      }
      allSyllable.set(key, allSyllable.get(ref) || "");
      continue;
    }
    const first = value[0]!;
    const second = value[1]!;
    if (typeof first === "string" || typeof second === "string") {
      continue;
    }
    content.push({ key, value: [first.element, second.element] });
  }
  return (
    <Flex vertical style={{ width: 300, padding: 16, display: "none" }}>
      <Button
        onClick={() => {
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
          exportTSV(lines, "syllables");
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
