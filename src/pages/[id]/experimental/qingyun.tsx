import {
  Button,
  Flex,
  Input,
  notification,
  Space,
  Tag,
  Typography,
} from "antd";
import { ColumnsType } from "antd/es/table";
import { Table } from "antd/lib";
import { atomWithStorage } from "jotai/utils";
import { sortBy } from "lodash-es";
import styled from "styled-components";
import {
  adaptedFrequencyAtom,
  拼写运算自定义原子,
  字母表原子,
  如字形分析配置原子,
  如字形分析结果原子,
  汉字集合原子,
  分类器原子,
  别名显示原子,
  动态自定义拆分原子,
  基本信息原子,
  决策原子,
  决策空间原子,
  如字库原子,
  如笔顺映射原子,
  useAtom,
  useAtomValue,
  useChaifenTitle,
  用户频率原子,
} from "~/atoms";
import { AdjustableElementGroup, getAffiliates } from "~/components/Mapping";
import { Display } from "~/components/Utils";
import {
  BasicComponent,
  dynamicAnalysis,
  ElementWithIndex,
  exportTSV,
  exportYAML,
  getReversedMapping,
  isMerge,
  isPUA,
  首码分组,
  Value,
} from "~/lib";

const PrintArea = styled.div`
  width: 210mm;
  height: 297mm;
  float: left;

  padding: 10mm 5mm;
  border: 1px #d3d3d3 solid;
  border-radius: 5px;
  background: white;
  box-shadow: 0 0 8px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  justify-content: space-between;

  @media print {
    position: absolute;
    top: 0;
    left: 0;
    border: none;
    border-radius: 0;
    box-shadow: none;
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

function RootTable() {
  const mapping = useAtomValue(决策原子);
  const alphabet = useAtomValue(字母表原子);
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
  const list = (roots: 首码分组[]) => (
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

const Wrapper = styled.div`
min-width: 20px;
height: 20px;
line-height: 1;
text-align: center;
`;

function AnalysisTable() {
  const analysisResult = useAtomValue(如字形分析结果原子);
  const classifier = useAtomValue(分类器原子);
  const mapping = useAtomValue(决策原子);
  const repertoire = useAtomValue(如字库原子);
  const dynamicCustomize = useAtomValue(动态自定义拆分原子);
  const { componentResults } = analysisResult;
  const index = [...Array(6).keys()].map((_) => new Map<number, string[]>());
  const getSequence = (name: string) =>
    (repertoire[name]!.glyph as BasicComponent).strokes.map(
      (x) => classifier[x.feature],
    );
  for (const [name, value] of componentResults) {
    if (value.sequence.length === 1) continue;
    const sequence = getSequence(name);
    const first = sequence[0]! - 1;
    if (!index[first]!.has(sequence.length)) {
      index[first]!.set(sequence.length, []);
    }
    index[first]!.get(sequence.length)!.push(name);
  }
  for (const map of index) {
    for (const list of map.values()) {
      list.sort((a, b) =>
        getSequence(a).join("").localeCompare(getSequence(b).join("")),
      );
    }
  }
  return (
    <div>
      {index.map((data, i) => (
        <Flex vertical gap="8px" style={{ pageBreakInside: "avoid" }}>
          <Typography.Title level={3} style={{ textAlign: "center" }}>
            起笔 {i + 1}
          </Typography.Title>
          {[...data].map(([count, names]) => {
            return (
              <Flex align="start">
                <Wrapper style={{ width: 80, flexShrink: 0 }}>
                  笔画数 {count}
                </Wrapper>
                <Flex wrap gap="4px 20px">
                  {names.map((name) => {
                    const sequence =
                      name in dynamicCustomize
                        ? dynamicCustomize[name]!.find((a) =>
                            a.every((r) => r in mapping),
                          )!
                        : componentResults.get(name)!.sequence;
                    return (
                      <Flex>
                        <Wrapper style={{ color: "rgba(39, 86, 173, 1)" }}>
                          <Display name={name} />
                        </Wrapper>
                        <Flex>
                          {sequence.map((x, index) => {
                            return (
                              <Wrapper>
                                <Display name={x} />
                              </Wrapper>
                            );
                          })}
                        </Flex>
                      </Flex>
                    );
                  })}
                </Flex>
              </Flex>
            );
          })}
        </Flex>
      ))}
    </div>
  );
}

export const syllableAtom = atomWithStorage<Record<string, string>>(
  "snow_qingyun_hint",
  {},
);

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

function SyllableForm() {
  const mapping = useAtomValue(决策原子);
  const mappingSpace = useAtomValue(决策空间原子);
  const [syllables, setSyllables] = useAtom(syllableAtom);
  const content: { key: string; value: [string, string] }[] = [];
  const userFrequency = useAtomValue(用户频率原子);
  const repertoire = useAtomValue(如字库原子);
  const analysisConfig = useAtomValue(如字形分析配置原子);
  const characters = useAtomValue(汉字集合原子);
  const analysisResult = useAtomValue(如字形分析结果原子);
  const adaptedFrequency = useAtomValue(adaptedFrequencyAtom);
  const sequenceMap = useAtomValue(如笔顺映射原子);
  const algebra = useAtomValue(拼写运算自定义原子);
  const display = useAtomValue(别名显示原子);
  const PUA: string[] = [];

  for (const [key, value] of Object.entries(mapping)) {
    if (/^[\uE000-\uF9FF]$/.test(key)) {
      PUA.push(key);
    }
    if (!/^.$/.test(key) || isMerge(value)) continue;
    if (typeof value[0] === "string") continue;
    const k1 = (value[0] as ElementWithIndex).element;
    const k2 = (value[1] as ElementWithIndex).element;
    content.push({ key, value: [k1, k2] });
  }
  PUA.sort();
  console.log("PUA", PUA);

  return (
    <Flex vertical style={{ width: 300, padding: 16 }}>
      <Button
        onClick={() => {
          const gf0014 = {} as Record<number, string[]>;
          const message: string[] = [];
          const allkeys = new Set(
            Object.keys(mappingSpace)
              .concat(Object.keys(mapping))
              .filter((x) => /^[^\d]$/.test(x)),
          );
          const reverseMap = new Map<number, string>();
          for (const [key, value] of Object.entries(repertoire)) {
            if (value.gf0014_id) {
              reverseMap.set(value.gf0014_id, key);
            }
          }
          for (let i = 1; i <= 514; ++i) {
            if (!reverseMap.has(i)) {
              console.warn(`GF0014 ID ${i} not found in repertoire.`);
              continue;
            }
            const key = reverseMap.get(i)!;
            if (!allkeys.has(key)) {
              message.push(`${i}: ${display(key)}`);
            }
          }
          const getShengyun = (v: Value) => {
            if (v === null) return;
            if (typeof v === "string") return;
            if (Array.isArray(v)) {
              if (
                typeof v[0] === "object" &&
                v[0].element.startsWith("声") &&
                typeof v[1] === "object" &&
                v[1].element.startsWith("韵")
              ) {
                let raw = v[0].element.slice(2) + v[1].element.slice(2);
                raw = raw.replace("ir", "i");
                raw = raw.replace("0", "");
                raw = raw.replace(/yi(?=[aoe])/g, "y");
                raw = raw.replace(/wu(?=[aoe])/g, "w");
                raw = raw.replace(/yuü/g, "yu");
                raw = raw.replace(/(?<=[jqx])ü/g, "u");
                raw = raw.replace(/(?<=[nl])ü/g, "v");
                raw = raw.replace(/ue(?=[in])/g, "u");
                raw = raw.replace("iou", "iu");
                return raw;
              }
            }
          };
          for (const key of allkeys) {
            const values = JSON.parse(JSON.stringify(mappingSpace[key] ?? []));
            if (mapping[key] !== undefined) {
              values.push({ value: mapping[key]!, score: 0 });
            }
            if (repertoire[key]!.tygf) {
              const readings = repertoire[key]!.readings.map((r) =>
                r.pinyin.slice(0, -1),
              );
              for (const value of values) {
                const shengyun = getShengyun(value.value);
                if (shengyun && !readings.includes(shengyun)) {
                  message.push(
                    `${display(key)} ${shengyun}：${readings.join(", ")}`,
                  );
                } else if (
                  !shengyun &&
                  value.value !== null &&
                  !(
                    Array.isArray(value.value) &&
                    typeof value.value[0] === "string"
                  )
                ) {
                  message.push(
                    `${display(key)} ${JSON.stringify(
                      value.value,
                    )}：${readings.join(", ")}`,
                  );
                }
              }
            } else if (repertoire[key]!.gf0014_id) {
              const readings: string[] = [];
              for (const raw of gf0014[
                repertoire[key]!.gf0014_id - 1
              ] as string[]) {
                if (raw === "") continue;
                const list = raw.split(" ");
                for (const item of list) {
                  readings.push(item.slice(0, -1));
                }
              }
              const allShengyun = new Set<string>();
              for (const value of values) {
                const shengyun = getShengyun(value.value);
                if (shengyun) allShengyun.add(shengyun);
                if (shengyun && !readings.includes(shengyun)) {
                  message.push(
                    `${display(key)} ${shengyun}：${readings.join(", ")}`,
                  );
                }
              }
              for (const reading of readings) {
                if (!allShengyun.has(reading)) {
                  message.push(
                    `${display(key)} 缺少 ${reading}：${readings.join(", ")}`,
                  );
                }
              }
            } else {
              for (const value of values) {
                const shengyun = getShengyun(value.value);
                if (shengyun) {
                  message.push(`${display(key)} 不合法 ${shengyun}`);
                }
              }
            }
          }
          notification.info({
            message: `检查完毕，共 ${message.length} 处问题`,
            description: message.join("；"),
            duration: 0,
          });
        }}
      >
        检查
      </Button>
      <Button
        onClick={() => {
          const rootsInfo: Converted[] = [];
          const allSyllable = new Map<string, string>();
          for (const [key, value] of Object.entries(mapping)) {
            if (!/^.$/.test(key) || isMerge(value)) continue;
            const affiliates = getAffiliates(key, mapping).map(
              ({ from }) => from,
            );
            if (typeof value[0] === "string") {
              let code = value[0];
              if ((value[1] as ElementWithIndex).element === "主根-1") {
                code += "yphjklnm".includes(code) ? "e" : "i";
              } else {
                code += "yphjklnm".includes(code) ? "a" : "o";
              }
              allSyllable.set(key, code);
              rootsInfo.push({
                字根: [repr[key] || key, ...affiliates].join(""),
                编码: code,
              });
            } else {
              const k1 = (value[0] as ElementWithIndex).element;
              const k2 = (value[1] as ElementWithIndex).element;
              allSyllable.set(key, combineShengYun(k1, k2));
              let ref0 = k2;
              while (isMerge(mapping[ref0]!)) {
                ref0 = (mapping[ref0] as ElementWithIndex).element;
              }
              rootsInfo.push({
                字根: [key, ...affiliates].join(""),
                编码: (mapping[k1] as string) + (mapping[ref0] as string),
                读音: syllables[key],
              });
            }
            for (const child of affiliates) {
              allSyllable.set(child, allSyllable.get(key) || "");
            }
          }
          const lines: string[][] = [];
          const result = dynamicAnalysis(
            repertoire,
            analysisConfig,
            characters,
            adaptedFrequency,
            sequenceMap,
            algebra,
          );
          result.当前拆分.forEach(([char, sequence]) => {
            const syllables = sequence.map((x) => allSyllable.get(x) || "");
            if (syllables.some((x) => x === undefined || x === "")) {
              console.log(char, sequence, syllables);
            }
            let frequency = Math.max(userFrequency?.[char] || 0, 101);
            if (repertoire[char]!.gb2312 === 0) {
              frequency = 101;
            }
            const frequency_str = frequency.toString();
            lines.push([char, syllables.join(" "), frequency_str]);
            if (syllables.length === 1) {
              const isTYGF = repertoire[char]!.tygf > 0;
              if (isTYGF) {
                lines.push([
                  char,
                  ["m", ...syllables].join(" "),
                  frequency_str,
                ]);
              } else {
                lines.push([
                  char,
                  ["m", "m", ...syllables].join(" "),
                  frequency_str,
                ]);
              }
            }
            if (syllables.length > 4) {
              const alt = syllables.slice(0, 3).concat([syllables.at(-1)!]);
              lines.push([char, alt.join(" "), frequency_str]);
            }
          });
          const componentAnalysis = [...analysisResult.customized]
            .map(([key, value]) => ({
              部件: key,
              拆分: value.sequence.map((x) => repr[x] || x).join(""),
            }))
            .filter((x) => x.拆分.length > 1);
          exportYAML(rootsInfo, "roots", 1, false);
          exportYAML(componentAnalysis, "analysis", 1, false);
          exportTSV(
            result.当前拆分.map((x) => [
              x[0],
              x[1].map((c) => (isPUA(c) ? repertoire[c]!.name : c)).join(" "),
            ]),
            "current_analysis.txt",
          );
          exportTSV(lines, "syllables");
          exportYAML(result, "dynamic_analysis", 1, false);
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
      {PUA.map((char) => (
        <Flex key={char} align="center" gap="middle" justify="center">
          <span>U+{char.charCodeAt(0).toString(16).toUpperCase()}</span>
          <Display name={char} />
        </Flex>
      ))}
    </Flex>
  );
}

export default function QingYun() {
  useChaifenTitle("图示");
  const { name, author, version, description } = useAtomValue(基本信息原子);
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
        <RootTable />
        {/* <AnalysisTable /> */}
      </PrintArea>
      {/* <SyllableForm /> */}
    </Flex>
  );
}
