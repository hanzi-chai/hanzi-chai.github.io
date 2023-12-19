import { Flex, Select, Switch, Typography } from "antd";
import { useContext, useEffect, useState } from "react";
import EncoderRules from "~/components/EncoderRules";
import { EditorColumn, EditorRow, Uploader } from "~/components/Utils";
import { useAll } from "~/components/contants";
import { ConfigContext, DispatchContext } from "~/components/context";
import { CharsetFilter, EncoderResult, filtermap } from "~/lib/encoder";
import { getSupplemental } from "~/lib/utils";

const filterOptions = ["成字部件", "非成字部件", "所有汉字"] as const;
type FilterOption = (typeof filterOptions)[number];

const Encode = () => {
  const config = useContext(ConfigContext);
  const data = useAll();
  const dispatch = useContext(DispatchContext);
  const [dev, setDev] = useState(false);
  const [filterOption, setFilterOption] = useState<FilterOption>("所有汉字");
  const [reference, setReference] = useState<Map<string, string[]>>(() => {
    const content = localStorage.getItem("." + config.info?.name);
    if (content === null) return new Map();
    return new Map(Object.entries(JSON.parse(content)));
  });
  const filterMap: Record<FilterOption, (p: [string, string[]]) => boolean> = {
    成字部件: ([char]) => data.form[char]?.default_type === "component",
    非成字部件: ([char]) => supplemental.includes(char),
    所有汉字: () => true,
  };
  const [gb2312, setGB2312] = useState<CharsetFilter>("未定义");
  const [tygf, setTYGF] = useState<CharsetFilter>("未定义");
  const list = Object.entries(data.repertoire)
    .filter(filtermap[gb2312]("gb2312"))
    .filter(filtermap[tygf]("tygf"))
    .map(([x]) => x);
  const supplemental = getSupplemental(data.form, list);
  const [result, setResult] = useState<EncoderResult>(new Map());

  useEffect(() => {
    localStorage.setItem(
      "." + config.info?.name,
      JSON.stringify(Object.fromEntries([...reference])),
    );
  }, [reference]);

  let correct = 0;
  let incorrect = 0;
  let unknown = 0;
  let dataSource = [...result]
    .filter(
      ([x, v]) => v.code.length > 0 && filterMap[filterOption]([x, v.code]),
    )
    .map(([char, code]) => {
      const refcode = reference.get(char) || [];
      if (refcode.length) {
        if (code.code.filter((v) => refcode.includes(v)).length) {
          correct += 1;
        } else {
          incorrect += 1;
        }
      } else {
        unknown += 1;
      }
      return {
        key: char,
        char: char,
        sequence: code.sequence,
        code: code.code,
        refcode: refcode,
      };
    });

  if (dev) {
    dataSource = dataSource.filter(({ code, refcode }) => {
      return code.filter((v) => refcode.includes(v)).length === 0;
    });
  }

  // if (dev) {
  //   columns.push({
  //     title: "参考编码",
  //     dataIndex: "refcode",
  //     key: "refcode",
  //     render: (_, record) => {
  //       return <span>{record.refcode.join(", ")}</span>;
  //     },
  //   });
  // }

  return (
    <EditorRow>
      <EditorColumn span={12}>
        <Typography.Title level={2}>编码规则</Typography.Title>
        <EncoderRules />
        <Flex justify="center" align="center" gap="large">
          校对模式
          <Switch checked={dev} onChange={setDev} />
          <Uploader
            type="txt"
            text="导入 TSV 码表"
            action={(content) => {
              const ref: Map<string, string[]> = new Map();
              const tsv = content
                .trim()
                .split("\n")
                .map((x) => x.split("\t"));
              for (const line of tsv) {
                const [key, value] = line;
                if (key !== undefined && value !== undefined) {
                  ref.set(key, [value]);
                }
              }
              setReference(ref);
            }}
          />
          {reference !== undefined && `已加载码表，条数：${reference.size}`}
        </Flex>
        {dev && (
          <Flex justify="center" align="center" gap="large">
            校对范围
            <Select
              value={filterOption}
              options={filterOptions.map((x) => ({ label: x, value: x }))}
              onChange={setFilterOption}
            />
            {`正确：${correct}, 错误：${incorrect}, 未知：${unknown}，正确率：${Math.round(
              (correct / (correct + incorrect + unknown)) * 100,
            )}%`}
          </Flex>
        )}
      </EditorColumn>
    </EditorRow>
  );
};

export default Encode;
